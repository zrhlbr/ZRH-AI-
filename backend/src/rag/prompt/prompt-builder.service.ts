import { Injectable } from '@nestjs/common';
import { AIMessage } from '../../ai/types/ai.types';

export interface PromptBuildInput {
  userQuery: string;
  knowledgeContext: string;
  memoryMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  citationInstruction?: boolean;
}

/**
 * Prompt Pipeline：System → Memory → Knowledge → Citation → User
 */
@Injectable()
export class PromptBuilderService {
  private readonly systemPrompt = [
    'You are ZRH AI Enterprise RAG assistant.',
    'Answer using the provided knowledge context when relevant.',
    'If context is insufficient, say what is missing instead of inventing facts.',
    'Prefer concise Markdown answers.',
    'When you use knowledge, cite sources as [#n] matching the context markers.',
  ].join(' ');

  build(input: PromptBuildInput): AIMessage[] {
    const messages: AIMessage[] = [{ role: 'system', content: this.systemPrompt }];

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

    if (input.citationInstruction !== false) {
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
