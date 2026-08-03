import { Injectable } from '@nestjs/common';
import { AgentRegistryService } from '../registry/agent-registry.service';
import { AgentProfileView } from '../types/agent.types';

/**
 * Agent Router：按任务关键词自动选择最合适的 Agent。
 */
@Injectable()
export class AgentRouterService {
  constructor(private readonly registry: AgentRegistryService) {}

  private score(agent: AgentProfileView, text: string): number {
    const t = text.toLowerCase();
    let score = 0;
    const skillSet = new Set(agent.skills.map((s) => s.code));

    const rules: Array<{ codes: string[]; words: string[]; weight: number }> = [
      { codes: ['code'], words: ['code', 'bug', 'function', 'typescript', 'python', 'api', '编译', '代码', '报错', 'refactor'], weight: 5 },
      { codes: ['rag', 'knowledge_search'], words: ['knowledge', '文档', '知识', 'rag', 'policy', '手册', '检索'], weight: 5 },
      { codes: ['translate'], words: ['translate', '翻译', '缅文', 'burmese', 'english', 'chinese', '中译', '英译'], weight: 5 },
      { codes: ['summarize'], words: ['summarize', '总结', '摘要', '概要', '整理文档'], weight: 3 },
    ];

    for (const rule of rules) {
      if (!rule.codes.some((c) => skillSet.has(c))) continue;
      if (rule.words.some((w) => t.includes(w))) score += rule.weight;
    }

    if (agent.code === 'assistant') score += 1; // 兜底加分最低
    if (agent.enabled && agent.status === 'active') score += 0.5;
    return score;
  }

  async route(
    message: string,
    preferredCode?: string,
    roleCode?: string,
  ): Promise<{ agent: AgentProfileView; reason: string }> {
    if (preferredCode) {
      const agent = await this.registry.getByCode(preferredCode);
      if (roleCode && !this.registry.roleAllows(agent.roleAccess, roleCode)) {
        const fallback = await this.registry.getByCode('assistant');
        return { agent: fallback, reason: `denied:${preferredCode}->assistant` };
      }
      return { agent, reason: `explicit:${preferredCode}` };
    }
    const agents = (
      await this.registry.list({ enabled: true, status: 'active', roleCode })
    ).filter((a) => a.enabled);
    if (!agents.length) {
      const fallback = await this.registry.getByCode('assistant');
      return { agent: fallback, reason: 'fallback:assistant' };
    }
    const ranked = agents
      .map((a) => ({ agent: a, score: this.score(a, message) }))
      .sort((a, b) => b.score - a.score);
    const best = ranked[0];
    if (best.score <= 0.5) {
      const assistant = agents.find((a) => a.code === 'assistant') ?? best.agent;
      return { agent: assistant, reason: 'default:assistant' };
    }
    return { agent: best.agent, reason: `score:${best.score}` };
  }
}
