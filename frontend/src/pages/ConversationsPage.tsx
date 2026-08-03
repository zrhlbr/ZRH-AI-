import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MessageSquarePlus, Pin, Search, Star } from 'lucide-react';
import { chatApi, type ConversationItem } from '../api/chat';

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

/**
 * UX V4.0：我的会话 / 收藏（共用实现）。
 * 只读历史列表 + 搜索 + 新建对话；点击行进入 /chat/:id。
 * 不改动任何聊天逻辑，仅消费既有 api:chat:read 接口。
 */
export function ConversationsPage({ favoriteOnly = false }: { favoriteOnly?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async (reset: boolean, nextPage: number, keyword: string) => {
    setLoading(true);
    try {
      const data = await chatApi.listConversations({
        page: nextPage,
        pageSize: 20,
        search: keyword || undefined,
        favorite: favoriteOnly ? true : undefined,
      });
      setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
      setTotal(data.total);
      setPage(nextPage);
    } catch {
      // 列表加载失败保持现状
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(true, 1, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅首载
  }, [favoriteOnly]);

  const onSearch = (value: string) => {
    setSearch(value);
    void load(true, 1, value);
  };

  const title = favoriteOnly ? t('nav.favorites') : t('nav.conversations');
  const emptyKey = favoriteOnly ? 'conversations.emptyFavorites' : 'chat.noConversations';

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col overflow-x-hidden px-4 py-6 sm:py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-brand text-zrh-accent">{title}</h1>
        <button
          type="button"
          onClick={() => navigate('/chat')}
          className="flex items-center gap-1.5 rounded-xl border border-zrh-accent/40 bg-zrh-accent/10 px-3 py-2 text-xs font-semibold text-zrh-accent transition-colors hover:bg-zrh-accent/20"
        >
          <MessageSquarePlus className="h-4 w-4" aria-hidden />
          {t('chat.new')}
        </button>
      </div>

      <div className="zrh-inset mt-4 flex items-center gap-2 rounded-zrh-md border border-zrh-border/60 px-3">
        <Search className="h-3.5 w-3.5 shrink-0 text-zrh-text-dim" aria-hidden />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={t('chat.searchPlaceholder')}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-zrh-text outline-none placeholder:text-zrh-text-dim/60"
        />
      </div>

      <div className="mt-4 flex-1">
        {items.length === 0 && !loading && (
          <p className="py-16 text-center text-xs text-zrh-text-dim">{t(emptyKey)}</p>
        )}
        <ul className="flex flex-col gap-1">
          {items.map((conv) => (
            <li key={conv.id}>
              <button
                type="button"
                onClick={() => navigate(`/chat/${conv.id}`)}
                className="w-full rounded-xl px-3.5 py-3 text-left transition-colors hover:bg-zrh-surface-raised"
              >
                <div className="flex items-center gap-1.5">
                  {conv.pinned && <Pin className="h-3 w-3 shrink-0 text-zrh-accent" aria-hidden />}
                  {conv.favorite && <Star className="h-3 w-3 shrink-0 fill-zrh-accent text-zrh-accent" aria-hidden />}
                  <p className="min-w-0 flex-1 truncate text-sm text-zrh-text">{conv.title}</p>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate text-[11px] text-zrh-text-dim/70">
                    {formatConvTime(conv.lastMessageAt || conv.createdAt)}
                  </p>
                  <span className="shrink-0 text-[10px] text-zrh-text-dim/50">
                    {conv.messageCount} {t('chat.messageCount')}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>

        {items.length < total && (
          <button
            type="button"
            disabled={loading}
            onClick={() => void load(false, page + 1, search)}
            className="mt-2 w-full rounded-lg py-2 text-center text-xs text-zrh-text-dim transition-colors hover:bg-zrh-surface-raised hover:text-zrh-text disabled:opacity-50"
          >
            {loading ? t('status.loading') : t('chat.loadMore')}
          </button>
        )}
        {loading && items.length === 0 && (
          <p className="py-16 text-center text-xs text-zrh-text-dim">{t('status.loading')}</p>
        )}
      </div>
    </div>
  );
}
