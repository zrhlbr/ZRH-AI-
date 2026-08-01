import { Injectable } from '@nestjs/common';
import { AIMessage } from '../../ai/types/ai.types';

export interface PromptBuildInput {
  userQuery: string;
  knowledgeContext: string;
  memoryMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  citationInstruction?: boolean;
  /** 额外 system 指令（如 Chat 角色 Prompt） */
  extraSystemPrompt?: string | null;
}

/**
 * Prompt Pipeline：System → Memory → Knowledge → Citation → User
 */
@Injectable()
export class PromptBuilderService {
  private readonly systemPrompt = [
    'You are ZRH AI, independently developed by ZRH Technology Group, deployed on ZRH AI Enterprise.',
    'Answer using the provided knowledge context when relevant; prioritize knowledge-base facts over general memory.',
    'If context is insufficient for the asked fact, say the knowledge base does not cover it instead of inventing details.',
    'Prefer concise Markdown answers in the user language.',
    'When you use knowledge, cite sources as [#n] matching the context markers.',
    'Do not claim to be OpenAI, Google, Anthropic, Alibaba, or other third-party AI brands.',
  ].join(' ');

  build(input: PromptBuildInput): AIMessage[] {
    const messages: AIMessage[] = [{ role: 'system', content: this.systemPrompt }];

    if (input.extraSystemPrompt?.trim()) {
      messages.push({ role: 'system', content: input.extraSystemPrompt.trim() });
    }

    if (input.memoryMessages?.length) {
      const memoryText = input.memoryMessages
        .slice(-8)
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\n');
      messages.push({
        role: 'system',
        content: `Conversation memory (recent turns):\n${memoryText}`,
      });
    }

    if (input.knowledgeContext?.trim()) {
      messages.push({
        role: 'system',
        content: `Knowledge context:\n${input.knowledgeContext}`,
      });
    } else {
      messages.push({
        role: 'system',
        content: 'Knowledge context: (empty). Answer from general knowledge carefully and state uncertainty.',
      });
    }

    if (input.citationInstruction !== false && input.knowledgeContext?.trim()) {
      messages.push({
        role: 'system',
        content:
          'Citation rules: append inline markers like [#1][#2] next to claims grounded in context. Do not invent source numbers.',
      });
    }

    messages.push({ role: 'user', content: input.userQuery });
    return messages;
  }
}
