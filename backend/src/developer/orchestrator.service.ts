import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AIGatewayService } from '../ai/gateway/ai-gateway.service';
import { WorkspaceService } from './workspace.service';
import { PlanService } from './plan.service';
import { DiffService } from './diff.service';
import { CodeIndexService } from './code-index.service';
import { DevSkillsService } from './skills.service';
import { DevAuditService } from './audit.service';
import { SecurityPolicyService } from './security-policy.service';
import { RunnerClientService } from './runner-client.service';

/**
 * Developer Orchestrator — plan-first agent loop.
 * Extends capability without modifying Chat business module.
 */
@Injectable()
export class DeveloperOrchestrator {
  private readonly logger = new Logger(DeveloperOrchestrator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AIGatewayService,
    private readonly workspaces: WorkspaceService,
    private readonly plans: PlanService,
    private readonly diffs: DiffService,
    private readonly index: CodeIndexService,
    private readonly skills: DevSkillsService,
    private readonly audit: DevAuditService,
    private readonly policy: SecurityPolicyService,
    private readonly runner: RunnerClientService,
  ) {}

  /**
   * Map UI skill → preferred gateway modelRef (internal; UI shows alias).
   * Phase 0.5: the coding engine is configured in dev_provider_settings
   * (providerCode='local-coder') — never hardcoded. Rollback = update that row.
   */
  async pickModelRef(skillCode: string, explicit?: string): Promise<{ modelRef?: string; modelAlias: string }> {
    if (explicit) return { modelRef: explicit, modelAlias: 'coding-engine' };
    const s = skillCode || 'feature';
    if (s === 'review' || s === 'deploy_diag') {
      return { modelRef: 'ollama:qwen3:8b', modelAlias: 'analysis-engine' };
    }
    try {
      const setting = await this.prisma.devProviderSetting.findUnique({
        where: { providerCode: 'local-coder' },
      });
      const cfg = (setting?.configJson || {}) as { modelRef?: string };
      if (setting?.enabled && cfg.modelRef) {
        return { modelRef: cfg.modelRef, modelAlias: 'coding-engine' };
      }
    } catch (err) {
      this.logger.warn(`local-coder setting lookup failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    // Safe fallback: env override, then current approved default
    return {
      modelRef: process.env.DEV_CODER_MODEL || 'ollama:qwen2.5-coder:7b',
      modelAlias: 'coding-engine',
    };
  }

  async createSession(input: {
    workspaceId: number;
    userId: number;
    roleCode: string;
    title?: string;
    skillCode?: string;
    modelRef?: string;
  }) {
    await this.workspaces.assertAccess(input.workspaceId, input.userId, input.roleCode, 'viewer');
    const model = await this.pickModelRef(input.skillCode || 'feature', input.modelRef);
    return this.prisma.devSession.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        title: input.title || 'Developer session',
        skillCode: input.skillCode || 'feature',
        modelAlias: model.modelAlias,
        modelRef: model.modelRef,
      },
    });
  }

  private async gatherContext(workspaceId: number, userId: number, roleCode: string, message: string) {
    const semantic = await this.index.searchSemantic(workspaceId, userId, roleCode, message);
    const symbols = await this.index.searchSymbols(workspaceId, userId, roleCode, message.split(/\s+/)[0] || message);
    const snippets = (semantic.items || [])
      .slice(0, 5)
      .map((i: { path: string; content: string }) => `// file: ${i.path}\n${i.content.slice(0, 800)}`)
      .join('\n\n');
    return {
      symbolCount: (symbols.items || []).length,
      context: this.policy.redact(snippets).slice(0, 6000),
    };
  }

  async chat(input: {
    sessionId: number;
    userId: number;
    roleCode: string;
    message: string;
    planMode?: boolean;
    res?: Response;
  }) {
    const session = await this.prisma.devSession.findUnique({ where: { id: input.sessionId } });
    if (!session) throw new Error('session not found');
    if (session.userId !== input.userId && input.roleCode !== 'SUPER_ADMIN') {
      throw new ForbiddenException('session ownership denied');
    }
    await this.workspaces.assertAccess(session.workspaceId, input.userId, input.roleCode, 'viewer');

    await this.prisma.devSessionMessage.create({
      data: { sessionId: session.id, role: 'user', content: this.policy.redact(input.message) },
    });

    const hint = await this.skills.getHint(session.skillCode);
    const ctx = await this.gatherContext(session.workspaceId, input.userId, input.roleCode, input.message);
    const planMode = input.planMode !== false; // default on for writes intent
    const wantsWrite = /(fix|implement|create|modify|delete|refactor|add|写|改|删|实现)/i.test(input.message);

    const system = [
      'You are ZRH Developer Agent, an enterprise coding assistant for ZRH AI.',
      'Never claim to be Cursor or use proprietary Cursor internals.',
      'Never read or echo .env secrets.',
      hint,
      planMode && wantsWrite
        ? 'For any file changes: output a PLAN first as JSON block ```plan ... ``` with title, summary, steps[{action,path,detail}]. Do not claim files were written.'
        : 'Answer with analysis. If code changes are needed, propose a plan JSON.',
      ctx.context ? `Project context:\n${ctx.context}` : 'No indexed context yet; ask to rebuild index if needed.',
    ].join('\n');

    const modelRef = session.modelRef || (await this.pickModelRef(session.skillCode)).modelRef;
    const messages = [
      { role: 'system' as const, content: system },
      { role: 'user' as const, content: input.message },
    ];

    // Optional Cursor cloud only if enabled in settings
    const cursor = await this.prisma.devProviderSetting.findUnique({
      where: { providerCode: 'cursor-cloud' },
    });
    const effectiveModel =
      cursor?.enabled && process.env.CURSOR_API_KEY
        ? 'cursor-cloud:agent'
        : modelRef;

    if (input.res) {
      input.res.setHeader('Content-Type', 'text/event-stream');
      input.res.setHeader('Cache-Control', 'no-cache');
      input.res.setHeader('Connection', 'keep-alive');
      input.res.flushHeaders?.();
    }

    let answer = '';
    try {
      if (input.res) {
        const { stream } = await this.gateway.stream(messages, { modelRef: effectiveModel });
        await new Promise<void>((resolve, reject) => {
          stream.subscribe({
            next: (chunk) => {
              const text = chunk.content || '';
              if (!text) return;
              answer += text;
              input.res!.write(`data: ${JSON.stringify({ type: 'token', text })}\n\n`);
            },
            error: reject,
            complete: resolve,
          });
        });
      } else {
        answer = await this.gateway.generate(messages, effectiveModel);
      }
    } catch (err) {
      this.logger.warn(`gateway generate failed, using heuristic plan: ${err}`);
      answer = wantsWrite
        ? [
            'Proposed implementation plan (offline fallback):',
            '```plan',
            JSON.stringify(
              {
                title: `Plan: ${input.message.slice(0, 60)}`,
                summary: 'Heuristic plan because model gateway was unavailable.',
                steps: [
                  { action: 'analyze', detail: 'Inspect relevant modules' },
                  { action: 'modify', path: 'README.md', detail: 'Document intended change' },
                ],
              },
              null,
              2,
            ),
            '```',
          ].join('\n')
        : `Unable to reach model gateway. Context symbols=${ctx.symbolCount}. Please retry.`;
      if (input.res) {
        input.res.write(`data: ${JSON.stringify({ type: 'token', text: answer })}\n\n`);
      }
    }

    answer = this.policy.redact(answer);
    await this.prisma.devSessionMessage.create({
      data: { sessionId: session.id, role: 'assistant', content: answer },
    });

    let plan = null as Awaited<ReturnType<PlanService['create']>> | null;
    const planMatch = answer.match(/```plan\s*([\s\S]*?)```/i);
    if (planMatch) {
      try {
        const parsed = JSON.parse(planMatch[1]) as {
          title?: string;
          summary?: string;
          steps?: Array<{ action: string; path?: string; detail?: string }>;
        };
        plan = await this.plans.create({
          workspaceId: session.workspaceId,
          sessionId: session.id,
          userId: input.userId,
          roleCode: input.roleCode,
          title: parsed.title || 'Developer plan',
          summary: parsed.summary || input.message.slice(0, 200),
          steps: parsed.steps?.length
            ? parsed.steps
            : [{ action: 'analyze', detail: input.message.slice(0, 200) }],
        });
      } catch {
        // ignore malformed plan
      }
    }

    await this.audit.log({
      userId: input.userId,
      workspaceId: session.workspaceId,
      action: 'session.chat',
      resource: String(session.id),
      result: 'ok',
      detail: `plan=${plan?.id ?? 'none'}; alias=${session.modelAlias}`,
    });

    const payload = {
      sessionId: session.id,
      modelAlias: session.modelAlias,
      answer,
      plan,
    };
    if (input.res) {
      input.res.write(`data: ${JSON.stringify({ type: 'done', ...payload })}\n\n`);
      input.res.end();
      return payload;
    }
    return payload;
  }

  /** After plan approval: materialize a draft diff via AI Gateway (fallback heuristic). */
  async materializeDiffFromPlan(planId: number, userId: number, roleCode: string) {
    const plan = await this.plans.get(planId, userId, roleCode);
    if (plan.status !== 'approved') throw new Error('plan not approved');
    const files: Array<{
      path: string;
      changeType: 'create' | 'modify' | 'delete';
      patch: string;
      content?: string;
      baseSha?: string;
    }> = [];

    const writeSteps = plan.steps.filter(
      (step) =>
        step.path &&
        !this.policy.isEnvPath(step.path) &&
        ['create', 'modify', 'delete', 'write'].includes(step.action),
    );

    for (const step of writeSteps) {
      const changeType: 'create' | 'modify' | 'delete' =
        step.action === 'delete' ? 'delete' : step.action === 'create' ? 'create' : 'modify';
      if (changeType === 'delete') {
        files.push({ path: step.path!, changeType, patch: '' });
        continue;
      }

      let existing = '';
      let baseSha: string | undefined;
      try {
        const cur = await this.runner.readFile(plan.workspaceId, step.path!);
        existing = cur.content;
        baseSha = cur.sha256 || createHash('sha256').update(existing).digest('hex');
      } catch {
        // new file
      }

      let content = existing
        ? `${existing}\n\n// TODO(ZRH): ${step.detail || step.action}\n`
        : `// ZRH Developer Agent planned change\n// ${step.detail || step.action}\n`;

      try {
        const generated = await this.gateway.generate(
          [
            {
              role: 'system',
              content: [
                'You are ZRH Developer Agent patch generator.',
                'Return ONLY the full file content inside one fenced block:',
                '```file',
                '...entire file...',
                '```',
                'No explanations. Never include secrets or .env values.',
              ].join('\n'),
            },
            {
              role: 'user',
              content: [
                `Path: ${step.path}`,
                `Action: ${step.action}`,
                `Detail: ${step.detail || ''}`,
                existing ? `Current file:\n${existing.slice(0, 8000)}` : 'File does not exist yet.',
              ].join('\n\n'),
            },
          ],
          (await this.pickModelRef('feature')).modelRef,
        );
        const match = generated.match(/```file\s*([\s\S]*?)```/i) || generated.match(/```[\w.-]*\s*([\s\S]*?)```/);
        if (match?.[1]?.trim()) {
          content = this.policy.redact(match[1].replace(/^\n/, ''));
        }
      } catch (err) {
        this.logger.warn(
          `patch generate fallback for ${step.path}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      files.push({
        path: step.path!,
        changeType,
        patch: '',
        content,
        baseSha,
      });
    }

    if (!files.length) {
      files.push({
        path: 'ZRH_DEV_PLAN.md',
        changeType: 'create',
        patch: '',
        content: `# ${plan.title}\n\n${plan.summary}\n\n## Steps\n${plan.steps
          .map((s) => `- ${s.action}${s.path ? ` \`${s.path}\`` : ''}: ${s.detail || ''}`)
          .join('\n')}\n`,
      });
    }
    return this.diffs.create({
      workspaceId: plan.workspaceId,
      planId: plan.id,
      userId,
      roleCode,
      title: `Diff for plan #${plan.id}`,
      files,
    });
  }
}
