import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Copy, Link2, RefreshCw, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';
import type { ChatCitation, ChatMessage } from '../../api/chat';
import { brand } from '../../design-system/theme';
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
      <div className="zrh-msg-enter flex justify-end">
        <div className="max-w-[min(85%,36rem)] rounded-2xl rounded-br-md bg-zrh-accent/12 px-4 py-2.5 sm:px-5">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-zrh-text">{message.content}</p>
          <p className="mt-1 text-right text-caption text-zrh-text-dim">{formatTime(message.createdAt)}</p>
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
    <div className="zrh-msg-enter flex justify-start" data-role="assistant">
      <div className="max-w-[min(100%,42rem)] rounded-2xl px-1 py-1 sm:px-2">
        <div className="mb-1.5 flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-caption font-semibold tracking-brand text-zrh-accent">{brand.name}</span>
            {message.status === 'stopped' && (
              <span className="rounded-full border border-zrh-warn/40 px-2 py-0.5 text-[9px] text-zrh-warn">
                {t('chat.stopped')}
              </span>
            )}
            {message.status === 'error' && (
              <span className="rounded-full border border-zrh-err/40 px-2 py-0.5 text-[9px] text-zrh-err">
                {t('chat.error')}
              </span>
            )}
          </div>
          <span className="text-[9px] tracking-wide text-zrh-text-dim/80">
            {i18n.language.startsWith('zh') ? brand.groupZh : brand.subtitle}
          </span>
        </div>

        <MarkdownRenderer content={message.content} />

        {message.ragHit && !!message.citations?.length && (
          <CitationList citations={message.citations} />
        )}

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
          {message.ragHit && (
            <span className="text-[10px] text-zrh-accent/90">{t('chat.knowledgeGrounded')}</span>
          )}

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

function CitationList({ citations }: { citations: ChatCitation[] }) {
  const { t } = useTranslation();
  return (
    <div className="mt-3 border-t border-zrh-border/40 pt-2">
      <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium tracking-wide text-zrh-text-dim">
        <Link2 className="h-3 w-3 text-zrh-accent" aria-hidden />
        {t('chat.sources')}
      </p>
      <ul className="space-y-1.5">
        {citations.map((c) => (
          <li key={`${c.documentId}-${c.chunkId}-${c.index}`}>
            <Link
              to="/knowledge"
              className="block rounded-md px-1.5 py-1 transition-colors hover:bg-zrh-surface-raised/80"
              title={c.snippet}
            >
              <span className="text-[11px] text-zrh-text">
                <span className="text-zrh-accent">[#{c.index}]</span> {c.title || c.filename}
              </span>
              {c.snippet ? (
                <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-zrh-text-dim">{c.snippet}</p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
