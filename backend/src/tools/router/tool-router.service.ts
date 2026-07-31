import { Injectable } from '@nestjs/common';
import { ToolRegistryService } from '../registry/tool-registry.service';
import { ToolCallPlan, ToolDefinitionView } from '../types/tool.types';

/**
 * Tool Router：按 Agent / Task 关键词选择工具。
 */
@Injectable()
export class ToolRouterService {
  constructor(private readonly registry: ToolRegistryService) {}

  private agentDefaults: Record<string, string[]> = {
    developer: ['code_execute', 'calculator', 'http_request', 'system_health'],
    knowledge: ['knowledge_search', 'rag_search', 'document_parser'],
    translation: ['translation'],
    document: ['document_parser', 'file_manager', 'knowledge_search'],
    assistant: ['calculator', 'system_health', 'knowledge_search', 'rag_search', 'translation'],
  };

  private keywordMap: Array<{ keys: RegExp; tool: string; reason: string }> = [
    { keys: /翻译|translate|မြန်မာ|burmese/i, tool: 'translation', reason: 'language keyword' },
    { keys: /rag|引用|citation|重排/i, tool: 'rag_search', reason: 'rag keyword' },
    { keys: /知识|检索|search|knowledge/i, tool: 'knowledge_search', reason: 'knowledge keyword' },
    { keys: /解析|parse|文档|document/i, tool: 'document_parser', reason: 'document keyword' },
    { keys: /计算|calc|算一下|\d+\s*[\+\-\*\/]/i, tool: 'calculator', reason: 'math keyword' },
    { keys: /代码|code|执行|sandbox/i, tool: 'code_execute', reason: 'code keyword' },
    { keys: /健康|health|状态/i, tool: 'system_health', reason: 'health keyword' },
    { keys: /http|请求|url|api\s*call/i, tool: 'http_request', reason: 'http keyword' },
    { keys: /数据库|database|统计|count/i, tool: 'database_query', reason: 'db keyword' },
    { keys: /文件|file|目录|list/i, tool: 'file_manager', reason: 'file keyword' },
  ];

  async route(input: {
    task?: string;
    agentCode?: string;
  }): Promise<{ plan: ToolCallPlan; candidates: ToolDefinitionView[] }> {
    const enabled = await this.registry.list({ enabled: true });
    const enabledCodes = new Set(enabled.map((t) => t.code));
    const task = (input.task ?? '').trim();

    for (const rule of this.keywordMap) {
      if (task && rule.keys.test(task) && enabledCodes.has(rule.tool)) {
        const tool = enabled.find((t) => t.code === rule.tool)!;
        return {
          plan: {
            toolCode: tool.code,
            args: this.guessArgs(tool.code, task),
            reason: rule.reason,
          },
          candidates: this.candidatesForAgent(enabled, input.agentCode),
        };
      }
    }

    const defaults = this.agentDefaults[input.agentCode ?? 'assistant'] ?? this.agentDefaults.assistant;
    const first = defaults.find((c) => enabledCodes.has(c)) ?? enabled[0]?.code;
    if (!first) {
      return {
        plan: { toolCode: 'system_health', args: {}, reason: 'fallback empty registry' },
        candidates: [],
      };
    }
    return {
      plan: {
        toolCode: first,
        args: this.guessArgs(first, task),
        reason: input.agentCode ? `agent default:${input.agentCode}` : 'default assistant tools',
      },
      candidates: this.candidatesForAgent(enabled, input.agentCode),
    };
  }

  private candidatesForAgent(enabled: ToolDefinitionView[], agentCode?: string): ToolDefinitionView[] {
    const defaults = this.agentDefaults[agentCode ?? 'assistant'] ?? this.agentDefaults.assistant;
    const set = new Set(defaults);
    const preferred = enabled.filter((t) => set.has(t.code));
    return preferred.length ? preferred : enabled.slice(0, 5);
  }

  private guessArgs(toolCode: string, task: string): Record<string, unknown> {
    switch (toolCode) {
      case 'translation':
        return { text: task, targetLang: /缅|my|burmese/i.test(task) ? 'my-MM' : 'en-US' };
      case 'knowledge_search':
      case 'rag_search':
        return { query: task || 'overview' };
      case 'document_parser':
        return { content: task || '# empty', filename: 'note.md' };
      case 'calculator':
      case 'code_execute': {
        const m = task.match(/([0-9+\-*/().\s]+)/);
        return { expression: (m?.[1] ?? '1+1').trim() };
      }
      case 'http_request':
        return { url: 'http://127.0.0.1:4010/api/v1/health', method: 'GET' };
      case 'database_query':
        return { metric: 'overview' };
      case 'file_manager':
        return { action: 'list', path: '' };
      case 'system_health':
      default:
        return {};
    }
  }
}
