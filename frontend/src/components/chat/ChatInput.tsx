import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Cpu, Play, RefreshCw, Send, Square } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { toEngineLabelByIndex } from '../../utils/engineAlias';

/** 引擎切换器：UI 仅显示品牌引擎名，传参仍用真实模型名 */
function ModelSwitcher() {
  const { t } = useTranslation();
  const { models, modelsStatus, activeModel, switchModel, streaming } = useChatStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const enabledModels = models.filter((m) => m.enabled);
  const activeIndex = Math.max(0, enabledModels.findIndex((m) => m.name === activeModel));
  const statusOf = (name: string) => modelsStatus.find((s) => s.name === name)?.status;
  const dotClass = (status?: string) =>
    status === 'running'
      ? 'bg-zrh-ok'
      : status === 'online'
        ? 'bg-zrh-tech-blue'
        : status === 'loading'
          ? 'bg-zrh-warn'
          : 'bg-zrh-text-dim/40';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        data-testid="model-switcher"
        disabled={streaming.active}
        onClick={() => setOpen((v) => !v)}
        aria-label={t('chat.modelSwitch')}
        className="zrh-inset flex items-center gap-1.5 rounded-zrh-md border border-zrh-border/60 px-2.5 py-1.5 text-caption text-zrh-text transition-colors hover:border-zrh-accent/50 disabled:opacity-50"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${dotClass(statusOf(activeModel))}`} aria-hidden />
        <Cpu className="h-3.5 w-3.5 text-zrh-accent/80" aria-hidden />
        <span className="max-w-36 truncate">
          {activeModel ? toEngineLabelByIndex(activeModel, activeIndex) : t('chat.model')}
        </span>
        <ChevronDown className={`h-3 w-3 text-zrh-text-dim transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {open && (
        <ul className="absolute bottom-full left-0 z-30 mb-1.5 w-56 overflow-hidden rounded-xl border border-zrh-border bg-zrh-surface shadow-xl">
          {enabledModels.map((m, index) => (
              <li key={m.name}>
                <button
                  type="button"
                  onClick={() => {
                    void switchModel(m.name);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs transition-colors hover:bg-zrh-accent/10 ${
                    m.name === activeModel ? 'bg-zrh-accent/5 text-zrh-accent' : 'text-zrh-text'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass(statusOf(m.name))}`} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{toEngineLabelByIndex(m.name, index)}</span>
                  {!m.installed && <span className="text-[9px] text-zrh-text-dim">{t('chat.modelStatus.stopped')}</span>}
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

/** Prompt 模板选择（新对话生效） */
function PromptSelector() {
  const { t } = useTranslation();
  const { prompts, selectedPromptCode, setSelectedPromptCode, activeId } = useChatStore();
  if (activeId) return null; // 已有对话沿用其 Prompt
  const systemPrompts = prompts.filter((p) => p.role === 'system');
  if (systemPrompts.length === 0) return null;
  return (
    <select
      value={selectedPromptCode ?? ''}
      onChange={(e) => setSelectedPromptCode(e.target.value || null)}
      className="zrh-inset rounded-zrh-md border border-zrh-border/60 px-2 py-1.5 text-caption text-zrh-text-dim outline-none hover:border-zrh-accent/50"
      aria-label={t('chat.promptTemplate')}
    >
      <option value="">{t('chat.defaultPrompt')}</option>
      {systemPrompts.map((p) => (
        <option key={p.code} value={p.code}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

/**
 * 聊天输入区：模型切换 / Prompt 选择 / 发送 / 停止 / 重新生成 / 继续回答。
 * Enter 发送，Shift+Enter 换行。
 */
export function ChatInput() {
  const { t } = useTranslation();
  const { send, stop, regenerate, continueAnswer, streaming, messages, error, clearError } = useChatStore();
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const lastMessage = messages[messages.length - 1];
  const canRegenerate = !streaming.active && lastMessage?.role === 'assistant';

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const submit = () => {
    const value = input.trim();
    if (!value || streaming.active) return;
    setInput('');
    requestAnimationFrame(autoResize);
    void send(value);
  };

  return (
    <div className="border-t border-zrh-border/60 bg-zrh-bg/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-zrh-bg/90">
      {error && (
        <div className="mb-2 flex items-center justify-between rounded-lg border border-zrh-err/40 bg-zrh-err/10 px-3 py-2 text-xs text-zrh-err">
          <span className="min-w-0 truncate">
            {error === 'load_failed'
              ? t('chat.errors.loadFailed')
              : error === 'stream_failed'
                ? t('chat.errors.streamFailed')
                : error}
          </span>
          <button type="button" onClick={clearError} className="ml-2 shrink-0 opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <ModelSwitcher />
        <PromptSelector />
        {canRegenerate && (
          <>
            <button
              type="button"
              data-testid="regenerate"
              onClick={() => void regenerate()}
              className="flex items-center gap-1 rounded-lg border border-zrh-border/60 px-2.5 py-1.5 text-[11px] text-zrh-text-dim transition-colors hover:border-zrh-accent/50 hover:text-zrh-text"
            >
              <RefreshCw className="h-3 w-3" aria-hidden />
              {t('chat.regenerate')}
            </button>
            <button
              type="button"
              data-testid="continue"
              onClick={() => void continueAnswer()}
              className="flex items-center gap-1 rounded-lg border border-zrh-border/60 px-2.5 py-1.5 text-[11px] text-zrh-text-dim transition-colors hover:border-zrh-accent/50 hover:text-zrh-text"
            >
              <Play className="h-3 w-3" aria-hidden />
              {t('chat.continue')}
            </button>
          </>
        )}
      </div>

      <div className="zrh-glass zrh-glow-border flex items-end gap-2 rounded-2xl p-2">
        <textarea
          ref={textareaRef}
          data-testid="chat-input"
          value={input}
          rows={1}
          onChange={(e) => {
            setInput(e.target.value);
            autoResize();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={streaming.active ? t('chat.thinking') : t('chat.inputPlaceholder')}
          className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2.5 py-2 text-sm text-zrh-text outline-none placeholder:text-zrh-text-dim/60"
        />
        {streaming.active ? (
          <button
            type="button"
            data-testid="chat-stop"
            onClick={() => void stop()}
            aria-label={t('chat.stop')}
            className="flex items-center gap-1.5 rounded-zrh-lg border border-zrh-err/50 bg-zrh-err/10 px-3 py-2.5 text-xs font-semibold text-zrh-err transition-colors hover:bg-zrh-err/20"
          >
            <Square className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">{t('chat.stop')}</span>
          </button>
        ) : (
          <button
            type="button"
            data-testid="chat-send"
            onClick={submit}
            disabled={!input.trim()}
            aria-label={t('chat.send')}
            className="rounded-zrh-lg bg-zrh-accent p-2.5 text-zrh-on-accent transition-colors hover:bg-zrh-accent-soft disabled:opacity-40"
          >
            <Send className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
