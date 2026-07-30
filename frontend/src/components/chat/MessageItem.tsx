import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, RefreshCw, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';
import type { ChatMessage } from '../../api/chat';
import { useChatStore } from '../../store/chatStore';
import { MarkdownRenderer } from './MarkdownRenderer';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(ms: number | null): string | null {
  if (ms === null || ms === undefined) return null;
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

export interface MessageItemProps {
  message: ChatMessage;
  isLast: boolean;
  streamingActive: boolean;
}

/**
 * 单条消息：用户右对齐气泡 / AI 玻璃卡片。
 * memo 化 —— 流式期间历史消息零重渲染。
 */
export const MessageItem = memo(function MessageItem({ message, isLast, streamingActive }: MessageItemProps) {
  const { t, i18n } = useTranslation();
  const { setFeedback, removeMessage, regenerate, continueAnswer } = useChatStore();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪贴板不可用
    }
  };

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm border border-zrh-accent/30 bg-zrh-accent/10 px-4 py-2.5">
          <p className="whitespace-pre-wrap text-sm text-zrh-text">{message.content}</p>
          <p className="mt-1 text-right text-[10px] text-zrh-text-dim">{formatTime(message.createdAt)}</p>
        </div>
      </div>
    );
  }

  const duration = formatDuration(message.durationMs);
  const tokens =
    message.completionTokens !== null && message.completionTokens !== undefined
      ? `${message.completionTokens} ${t('chat.tokens')}`
      : null;

  return (
    <div className="flex justify-start" data-role="assistant">
      <div className="zrh-glass zrh-glow-border max-w-[92%] rounded-2xl rounded-bl-sm px-4 py-3 sm:max-w-[85%]">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-[10px] font-semibold tracking-widest text-zrh-accent">ZRH AI</span>
          {message.model && (
            <span className="rounded-full border border-zrh-border/60 px-2 py-0.5 text-[9px] text-zrh-text-dim">
              {message.model}
            </span>
          )}
          {message.status === 'stopped' && (
            <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-[9px] text-amber-400">
              {t('chat.stopped')}
            </span>
          )}
          {message.status === 'error' && (
            <span className="rounded-full border border-red-500/40 px-2 py-0.5 text-[9px] text-red-400">
              {t('chat.error')}
            </span>
          )}
        </div>

        <MarkdownRenderer content={message.content} />

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-zrh-border/40 pt-2">
          <span className="text-[10px] text-zrh-text-dim">
            {new Date(message.createdAt).toLocaleString(i18n.language, {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {duration && <span className="text-[10px] text-zrh-text-dim">{duration}</span>}
          {tokens && <span className="text-[10px] text-zrh-text-dim">{tokens}</span>}

          <span className="flex-1" />

          <div className="flex items-center gap-0.5">
            <ActionButton title={copied ? t('chat.copied') : t('chat.copy')} onClick={() => void copy()}>
              {copied ? <Check className="h-3.5 w-3.5 text-zrh-accent" /> : <Copy className="h-3.5 w-3.5" />}
            </ActionButton>
            <ActionButton
              title={t('chat.like')}
              data-testid="like-message"
              active={message.feedback === 'like'}
              onClick={() => void setFeedback(message.id, 'like')}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </ActionButton>
            <ActionButton
              title={t('chat.dislike')}
              data-testid="dislike-message"
              active={message.feedback === 'dislike'}
              onClick={() => void setFeedback(message.id, 'dislike')}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </ActionButton>
            {isLast && !streamingActive && (
              <>
                <ActionButton title={t('chat.regenerate')} onClick={() => void regenerate()}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </ActionButton>
                <ActionButton title={t('chat.continue')} onClick={() => void continueAnswer()}>
                  <span className="text-[10px] font-semibold">»</span>
                </ActionButton>
              </>
            )}
            <ActionButton title={t('chat.deleteMessage')} onClick={() => void removeMessage(message.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
});

function ActionButton({
  children,
  title,
  active,
  'data-testid': testId,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  active?: boolean;
  'data-testid'?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      data-testid={testId}
      aria-label={title}
      onClick={onClick}
      className={`rounded-md p-1.5 transition-colors ${
        active ? 'bg-zrh-accent/15 text-zrh-accent' : 'text-zrh-text-dim hover:bg-zrh-surface-raised hover:text-zrh-text'
      }`}
    >
      {children}
    </button>
  );
}
