import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_SKILLS = [
  { code: 'bugfix', name: 'Bug Fix', description: 'Locate and fix defects', sortOrder: 1, promptHint: 'Focus on root cause, minimal safe patch, add regression test if feasible.' },
  { code: 'feature', name: 'Feature Development', description: 'Implement features with plan-first workflow', sortOrder: 2, promptHint: 'Propose plan, then multi-file changes with clear acceptance checks.' },
  { code: 'review', name: 'Code Review', description: 'Review diffs for bugs and risk', sortOrder: 3, promptHint: 'Review for correctness, security, and maintainability. Do not apply writes unless asked.' },
  { code: 'refactor', name: 'Refactor', description: 'Improve structure without behavior change', sortOrder: 4, promptHint: 'Preserve behavior; prefer small cohesive refactors.' },
  { code: 'testgen', name: 'Test Generation', description: 'Generate unit/integration tests', sortOrder: 5, promptHint: 'Generate focused tests for changed behavior.' },
  { code: 'docs', name: 'Documentation', description: 'Write or update docs', sortOrder: 6, promptHint: 'Update docs accurately; avoid inventing APIs.' },
  { code: 'deploy_diag', name: 'Deployment Diagnosis', description: 'Diagnose build/deploy failures', sortOrder: 7, promptHint: 'Use logs, health, and build output; propose safe remediation plan.' },
];

@Injectable()
export class DevSkillsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    for (const s of DEFAULT_SKILLS) {
      await this.prisma.devSkill.upsert({
        where: { code: s.code },
        update: { name: s.name, description: s.description, promptHint: s.promptHint, sortOrder: s.sortOrder },
        create: s,
      });
    }
    await this.prisma.devProviderSetting.upsert({
      where: { providerCode: 'cursor-cloud' },
      update: {},
      create: { providerCode: 'cursor-cloud', enabled: false, configJson: { note: 'optional official API; disabled by default' } },
    });
    // Phase 0.5: primary local coding engine, configurable (not hardcoded).
    // Rollback = set configJson.modelRef back to 'ollama:deepseek-coder:latest'.
    await this.prisma.devProviderSetting.upsert({
      where: { providerCode: 'local-coder' },
      update: {},
      create: {
        providerCode: 'local-coder',
        enabled: true,
        configJson: {
          modelRef: 'ollama:qwen2.5-coder:7b',
          previousModelRef: 'ollama:deepseek-coder:latest',
          note: 'primary local coding engine; update modelRef to switch/rollback',
        },
      },
    });
  }

  list() {
    return this.prisma.devSkill.findMany({ where: { enabled: true }, orderBy: { sortOrder: 'asc' } });
  }

  async getHint(code?: string) {
    if (!code) return DEFAULT_SKILLS[1].promptHint;
    const row = await this.prisma.devSkill.findUnique({ where: { code } });
    return row?.promptHint || DEFAULT_SKILLS[1].promptHint;
  }
}
