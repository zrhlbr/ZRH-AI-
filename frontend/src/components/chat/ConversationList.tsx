import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Download,
  MessageSquarePlus,
  Pencil,
  Pin,
  PinOff,
  Search,
  Star,
  Trash2,
} from 'lucide-react';
import type { ConversationItem } from '../../api/chat';
import { exportConversation } from '../../api/chat';
import { useChatStore } from '../../store/chatStore';
import { ZModal } from '../ui';

function groupByTime(items: ConversationItem[], t: (k: string) => string) {
  const pinned = items.filter((c) => c.pinned);
  const favorite = items.filter((c) => !c.pinned && c.favorite);
  const recent = items.filter((c) => !c.pinned && !c.favorite);
  const groups: Array<{ label: string; items: ConversationItem[] }> = [];
  if (pinned.length) groups.push({ label: t('chat.pinned'), items: pinned });
  if (favorite.length) groups.push({ label: t('chat.favorites'), items: favorite });
  if (recent.length) groups.push({ label: t('chat.recent'), items: recent });
  return groups;
}

/**
 * 左侧栏：新建对话 / 搜索历史 / 分组（固定·收藏·最近）/ 重命名 / 删除 / 导出 / 分页加载。
 */
export function ConversationList() {
  const { t } = useTranslation();
  const {
    conversations,
    convTotal,
    convSearch,
    loadingList,
    activeId,
    loadConversations,
    setConvSearch,
    openConversation,
    newChat,
    renameConversation,
    togglePin,
    toggleFavorite,
    removeConversation,
  } = useChatStore();

  const [renaming, setRenaming] = useState<{ id: number; title: string } | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const groups = groupByTime(conversations, t);

  const confirmRename = async () => {
    if (renaming && renaming.title.trim()) {
      await renameConversation(renaming.id, renaming.title.trim());
    }
    setRenaming(null);
  };

  const confirmDelete = async () => {
    if (deleting !== null) {
      await removeConversation(deleting);
    }
    setDeleting(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          data-testid="new-chat"
          onClick={newChat}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zrh-accent/40 bg-zrh-accent/10 px-3 py-2.5 text-xs font-semibold text-zrh-accent transition-colors hover:bg-zrh-accent/20"
        >
          <MessageSquarePlus className="h-4 w-4" aria-hidden />
          {t('chat.new')}
        </button>
      </div>

      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 rounded-lg border border-zrh-border/60 bg-black/20 px-2.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-zrh-text-dim" aria-hidden />
          <input
            data-testid="chat-search"
            value={convSearch}
            onChange={(e) => setConvSearch(e.target.value)}
            placeholder={t('chat.searchPlaceholder')}
            className="min-w-0 flex-1 bg-transparent py-2 text-xs text-zrh-text outline-none placeholder:text-zrh-text-dim/60"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {conversations.length === 0 && !loadingList && (
          <p className="px-2 py-8 text-center text-xs text-zrh-text-dim">{t('chat.noConversations')}</p>
        )}

        {groups.map((group) => (
          <div key={group.label} className="mb-2">
            <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-zrh-text-dim/70">
              {group.label}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((conv) => (
                <ConversationRow
                  key={conv.id}
                  conv={conv}
                  active={conv.id === activeId}
                  onOpen={() => void openConversation(conv.id)}
                  onRename={() => setRenaming({ id: conv.id, title: conv.title })}
                  onTogglePin={() => void togglePin(conv.id)}
                  onToggleFavorite={() => void toggleFavorite(conv.id)}
                  onExport={() => void exportConversation(conv.id, 'md')}
                  onDelete={() => setDeleting(conv.id)}
                />
              ))}
            </ul>
          </div>
        ))}

        {conversations.length < convTotal && (
          <button
            type="button"
            disabled={loadingList}
            onClick={() => void loadConversations(false)}
            className="mt-1 w-full rounded-lg py-2 text-center text-xs text-zrh-text-dim transition-colors hover:bg-zrh-surface-raised hover:text-zrh-text disabled:opacity-50"
          >
            {loadingList ? t('status.loading') : t('chat.loadMore')}
          </button>
        )}
      </div>

      {/* 重命名弹窗 */}
      <ZModal open={renaming !== null} onClose={() => setRenaming(null)} title={t('chat.rename')}>
        <input
          autoFocus
          data-testid="rename-chat-input"
          value={renaming?.title ?? ''}
          onChange={(e) => setRenaming((r) => (r ? { ...r, title: e.target.value } : r))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void confirmRename();
          }}
          placeholder={t('chat.renamePlaceholder')}
          className="w-full rounded-lg border border-zrh-border bg-black/20 px-3 py-2 text-sm text-zrh-text outline-none focus:border-zrh-accent/60"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setRenaming(null)}
            className="rounded-lg px-3 py-1.5 text-xs text-zrh-text-dim hover:text-zrh-text"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            data-testid="confirm-rename"
            onClick={() => void confirmRename()}
            className="rounded-lg bg-zrh-accent px-4 py-1.5 text-xs font-semibold text-zrh-bg hover:bg-zrh-accent-soft"
          >
            {t('common.confirm')}
          </button>
        </div>
      </ZModal>

      {/* 删除确认弹窗 */}
      <ZModal open={deleting !== null} onClose={() => setDeleting(null)} title={t('chat.delete')}>
        <p className="text-sm text-zrh-text-dim">{t('chat.deleteConfirm')}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setDeleting(null)}
            className="rounded-lg px-3 py-1.5 text-xs text-zrh-text-dim hover:text-zrh-text"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            data-testid="confirm-delete"
            onClick={() => void confirmDelete()}
            className="rounded-lg bg-red-500/80 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
          >
            {t('common.confirm')}
          </button>
        </div>
      </ZModal>
    </div>
  );
}

function formatConvTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ConversationRow({
  conv,
  active,
  onOpen,
  onRename,
  onTogglePin,
  onToggleFavorite,
  onExport,
  onDelete,
}: {
  conv: ConversationItem;
  active: boolean;
  onOpen: () => void;
  onRename: () => void;
  onTogglePin: () => void;
  onToggleFavorite: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        data-testid="conversation-row"
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onOpen();
        }}
        className={`group relative w-full cursor-pointer rounded-lg px-2.5 py-2 text-left transition-colors ${
          active ? 'bg-zrh-accent/10 ring-1 ring-zrh-accent/30' : 'hover:bg-zrh-surface-raised'
        }`}
      >
        <div className="flex items-center gap-1.5">
          {conv.pinned && <Pin className="h-3 w-3 shrink-0 text-zrh-accent" aria-hidden />}
          {conv.favorite && !conv.pinned && <Star className="h-3 w-3 shrink-0 text-amber-400" aria-hidden />}
          <p className="min-w-0 flex-1 truncate text-xs text-zrh-text">{conv.title}</p>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="min-w-0 flex-1 truncate text-[10px] text-zrh-text-dim/70">
            {formatConvTime(conv.lastMessageAt || conv.createdAt)}
          </p>
          <span className="shrink-0 text-[9px] text-zrh-text-dim/50">
            {conv.messageCount} {t('chat.messageCount')}
          </span>
        </div>

        {/* 悬浮操作 */}
        <div className="absolute right-1 top-1 hidden gap-0.5 rounded-md bg-zrh-surface/95 p-0.5 shadow-lg group-hover:flex">
          <RowAction title={t('chat.rename')} data-testid="rename-chat" onClick={onRename}>
            <Pencil className="h-3 w-3" />
          </RowAction>
          <RowAction title={conv.pinned ? t('chat.unpin') : t('chat.pin')} data-testid="pin-chat" onClick={onTogglePin}>
            {conv.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
          </RowAction>
          <RowAction title={conv.favorite ? t('chat.unfavorite') : t('chat.favorite')} data-testid="favorite-chat" onClick={onToggleFavorite}>
            <Star className={`h-3 w-3 ${conv.favorite ? 'fill-amber-400 text-amber-400' : ''}`} />
          </RowAction>
          <RowAction title={t('chat.export')} data-testid="export-chat" onClick={onExport}>
            <Download className="h-3 w-3" />
          </RowAction>
          <RowAction title={t('chat.delete')} data-testid="delete-chat" onClick={onDelete} danger>
            <Trash2 className="h-3 w-3" />
          </RowAction>
        </div>
      </div>
    </li>
  );
}

function RowAction({
  children,
  title,
  onClick,
  danger,
  'data-testid': testId,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
  'data-testid'?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      data-testid={testId}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`rounded p-1 transition-colors ${
        danger ? 'text-zrh-text-dim hover:text-red-400' : 'text-zrh-text-dim hover:text-zrh-accent'
      }`}
    >
      {children}
    </button>
  );
}
