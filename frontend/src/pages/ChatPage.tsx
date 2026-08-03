import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PanelLeft, PanelRight } from 'lucide-react';
import { ConversationList } from '../components/chat/ConversationList';
import { ChatInput } from '../components/chat/ChatInput';
import { ChatSidebar } from '../components/chat/ChatSidebar';
import { MessageItem } from '../components/chat/MessageItem';
import { MarkdownRenderer } from '../components/chat/MarkdownRenderer';
import { useChatStore } from '../store/chatStore';
import { BrandMark } from '../design-system/BrandMark';
import { brand } from '../design-system/theme';

const LEFT_KEY = 'zrh-ai-chat-left-w';
const RIGHT_KEY = 'zrh-ai-chat-right-w';

/** 拖动宽度手柄 */
function useResizable(key: string, initial: number, min: number, max: number, side: 'left' | 'right') {
  const [width, setWidth] = useState(() => {
    const saved = Number(localStorage.getItem(key));
    return Number.isFinite(saved) && saved >= min && saved <= max ? saved : initial;
  });
  const startDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = width;
      const onMove = (ev: MouseEvent) => {
        const delta = side === 'left' ? ev.clientX - startX : startX - ev.clientX;
        const next = Math.min(max, Math.max(min, startWidth + delta));
        setWidth(next);
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        setWidth((w) => {
          localStorage.setItem(key, String(w));
          return w;
        });
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [width, min, max, side, key],
  );
  return { width, startDrag };
}

/** 消息列表：自动滚动 + 顶部懒加载历史 */
function MessageList() {
  const { t } = useTranslation();
  const { messages, hasMore, loadingMessages, loadOlderMessages, streaming, activeId } = useChatStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  // 自动滚动：新内容到达且用户停留在底部附近时跟随
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, streaming.content]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 60 && hasMore && !loadingMessages) {
      const prevHeight = el.scrollHeight;
      void loadOlderMessages().then(() => {
        requestAnimationFrame(() => {
          const node = scrollRef.current;
          if (node) node.scrollTop = node.scrollHeight - prevHeight;
        });
      });
    }
  };

  const showStreaming = streaming.active && streaming.conversationId === activeId;

  return (
    <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
      <div className="mx-auto flex w-full max-w-[60rem] flex-col gap-5">
        {loadingMessages && messages.length === 0 && (
          <p className="py-16 text-center text-xs text-zrh-text-dim">{t('status.loading')}</p>
        )}

        {!loadingMessages && messages.length === 0 && !showStreaming && (
          <div className="zrh-msg-enter flex flex-col items-center gap-4 py-16 text-center">
            <BrandMark size={96} className="h-16 w-16 rounded-zrh-2xl shadow-zrh-glow" />
            <div>
              <p className="font-display text-base font-semibold tracking-brand text-zrh-accent">
                {brand.name}
              </p>
              <p className="mt-1 text-caption tracking-wide text-zrh-text-dim">{t('chat.brandGroup')}</p>
            </div>
            <p className="max-w-md whitespace-pre-line text-xs leading-relaxed text-zrh-text-dim">
              {t('chat.welcome')}
            </p>
          </div>
        )}

        {hasMore && messages.length > 0 && (
          <button
            type="button"
            onClick={() => void loadOlderMessages()}
            className="mx-auto rounded-full border border-zrh-border/60 px-3 py-1 text-[10px] text-zrh-text-dim hover:border-zrh-accent/50 hover:text-zrh-text"
          >
            {t('chat.loadOlder')}
          </button>
        )}

        {messages.map((m, i) => {
          // Feature Freeze: hide assistant being continued to avoid dual bubbles
          if (
            showStreaming &&
            streaming.appendToMessageId &&
            m.id === streaming.appendToMessageId
          ) {
            return null;
          }
          return (
            <MessageItem
              key={m.id}
              message={m}
              isLast={i === messages.length - 1}
              streamingActive={streaming.active}
            />
          );
        })}

        {showStreaming && (
          <div className="flex justify-start">
            <div className="zrh-glass zrh-glow-border max-w-[92%] rounded-2xl rounded-bl-sm px-4 py-3 sm:max-w-[85%]">
              <div className="mb-1.5 flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold tracking-widest text-zrh-accent">{brand.name}</span>
                  {streaming.ragHit && (
                    <span className="text-[9px] text-zrh-accent/90">{t('chat.knowledgeGrounded')}</span>
                  )}
                </div>
                <span className="text-[9px] tracking-wide text-zrh-text-dim/80">{t('chat.brandGroup')}</span>
              </div>
              {streaming.content || streaming.baseContent ? (
                <MarkdownRenderer content={streaming.baseContent + streaming.content} streaming />
              ) : (
                <span className="zrh-typing" aria-label={t('chat.thinking')}>
                  <i />
                  <i />
                  <i />
                </span>
              )}
              {streaming.ragHit && streaming.citations.length > 0 && (
                <p className="mt-2 text-[10px] text-zrh-text-dim">
                  {t('chat.sources')}: {streaming.citations.map((c) => c.title || c.filename).join(' · ')}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * AI 对话页（阶段 3 核心）
 * 桌面三栏：左历史 / 中聊天 / 右状态（可拖动宽度，持久化）；
 * 平板手机：单栏 + 双侧抽屉。
 */
export function ChatPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const {
    loadConversations,
    loadModels,
    loadPrompts,
    loadStats,
    pendingHomeMessage,
    setPendingHomeMessage,
    send,
    activeTitle,
    activeId,
    openConversation,
    newChat,
  } = useChatStore();

  const left = useResizable(LEFT_KEY, 264, 200, 420, 'left');
  const right = useResizable(RIGHT_KEY, 300, 240, 460, 'right');
  const [leftDrawer, setLeftDrawer] = useState(false);
  const [rightDrawer, setRightDrawer] = useState(false);

  useEffect(() => {
    void loadConversations(true);
    void loadModels();
    void loadPrompts();
    void loadStats();
  }, [loadConversations, loadModels, loadPrompts, loadStats]);

  // Feature Freeze: wire /chat/:id deep link
  useEffect(() => {
    if (!routeId) return;
    const n = Number(routeId);
    if (!Number.isFinite(n) || n <= 0) {
      navigate('/chat', { replace: true });
      return;
    }
    if (activeId !== n) {
      void openConversation(n).catch(() => navigate('/chat', { replace: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from URL only when routeId changes
  }, [routeId]);

  useEffect(() => {
    if (activeId != null && routeId !== String(activeId)) {
      navigate(`/chat/${activeId}`, { replace: true });
    }
  }, [activeId, routeId, navigate]);

  const onNewChat = () => {
    newChat();
    navigate('/chat', { replace: true });
  };

  // 首页输入区携带的首条消息
  useEffect(() => {
    if (pendingHomeMessage) {
      setPendingHomeMessage(null);
      newChat();
      navigate('/chat', { replace: true });
      void send(pendingHomeMessage);
    }
  }, [pendingHomeMessage, setPendingHomeMessage, send, newChat, navigate]);

  return (
    <div className="zrh-chat-shell flex h-[calc(100dvh-var(--zrh-shell-header-h,3.25rem))] min-h-0 w-full max-w-full flex-col overflow-x-hidden bg-zrh-bg">
      {/* 页头（移动端抽屉开关 + 标题） */}
      <div className="flex items-center justify-between gap-2 border-b border-zrh-border/60 bg-zrh-bg px-3 py-1.5 xl:hidden">
        <button
          type="button"
          onClick={() => setLeftDrawer(true)}
          aria-label={t('chat.history')}
          className="rounded-lg p-1.5 text-zrh-text-dim hover:text-zrh-text"
        >
          <PanelLeft className="h-5 w-5" />
        </button>
        <p className="min-w-0 flex-1 truncate text-center text-xs font-medium text-zrh-text">
          {activeTitle || t('nav.chat')}
        </p>
        <button
          type="button"
          onClick={() => setRightDrawer(true)}
          aria-label={t('chat.params')}
          className="rounded-lg p-1.5 text-zrh-text-dim hover:text-zrh-text"
        >
          <PanelRight className="h-5 w-5" />
        </button>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 overflow-x-hidden">
        {/* 左栏（桌面） */}
        <aside
          style={{ width: left.width }}
          className="hidden min-h-0 shrink-0 border-r border-zrh-border/60 bg-zrh-surface/80 xl:block"
        >
          <ConversationList onNewChat={onNewChat} />
        </aside>
        <div
          role="separator"
          aria-orientation="vertical"
          onMouseDown={left.startDrag}
          className="hidden w-1 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-zrh-accent/40 xl:block"
        />

        {/* 中央聊天区 — 居中消息 + 底部输入 */}
        <section className="flex min-w-0 max-w-full flex-1 flex-col overflow-x-hidden">
          <div className="hidden items-center gap-3 border-b border-zrh-border/50 bg-zrh-bg px-4 py-2 xl:flex">
            <BrandMark size={28} className="h-7 w-7 rounded-lg" />
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-brand text-zrh-accent">{brand.name}</p>
              <p className="truncate text-[10px] text-zrh-text-dim">{t('app.tagline')}</p>
            </div>
            {activeTitle && (
              <p className="ml-auto max-w-xs truncate text-[11px] text-zrh-text-dim">{activeTitle}</p>
            )}
          </div>
          <MessageList />
          <div className="mx-auto w-full max-w-[60rem] pb-[max(0.25rem,env(safe-area-inset-bottom))]">
            <ChatInput />
          </div>
        </section>

        <div
          role="separator"
          aria-orientation="vertical"
          onMouseDown={right.startDrag}
          className="hidden w-1 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-zrh-accent/40 xl:block"
        />
        <aside
          style={{ width: right.width }}
          className="hidden min-h-0 shrink-0 border-l border-zrh-border/60 bg-zrh-surface/80 xl:block"
        >
          <ChatSidebar />
        </aside>
      </div>

      {leftDrawer && (
        <div className="fixed inset-0 z-40 max-w-[100vw] overflow-hidden bg-zrh-text/40 backdrop-blur-sm xl:hidden" onClick={() => setLeftDrawer(false)}>
          <div
            className="h-full w-72 max-w-[85vw] border-r border-zrh-border bg-zrh-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <ConversationList onNewChat={onNewChat} />
          </div>
        </div>
      )}
      {rightDrawer && (
        <div className="fixed inset-0 z-40 max-w-[100vw] overflow-hidden bg-zrh-text/40 backdrop-blur-sm xl:hidden" onClick={() => setRightDrawer(false)}>
          <div
            className="ml-auto h-full w-80 max-w-[88vw] border-l border-zrh-border bg-zrh-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <ChatSidebar />
          </div>
        </div>
      )}
    </div>
  );
}
