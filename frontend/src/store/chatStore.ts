import { create } from 'zustand';
import {
  chatApi,
  streamChat,
  ChatCitation,
  ChatMessage,
  ChatModelInfo,
  ChatModelStatus,
  ChatParams,
  ChatStats,
  ConversationItem,
  PromptTemplate,
} from '../api/chat';

interface StreamingState {
  active: boolean;
  conversationId: number | null;
  content: string;
  appendToMessageId: number | null;
  baseContent: string;
  ragHit: boolean | null;
  citations: ChatCitation[];
}

interface ChatState {
  conversations: ConversationItem[];
  convTotal: number;
  convPage: number;
  convSearch: string;
  loadingList: boolean;

  activeId: number | null;
  activeTitle: string;
  activeModel: string;
  messages: ChatMessage[];
  hasMore: boolean;
  loadingMessages: boolean;

  streaming: StreamingState;
  error: string | null;

  models: ChatModelInfo[];
  modelsStatus: ChatModelStatus[];
  params: ChatParams | null;
  prompts: PromptTemplate[];
  selectedPromptCode: string | null;
  stats: ChatStats | null;

  /** 首页输入区携带过来的首条消息 */
  pendingHomeMessage: string | null;
  setPendingHomeMessage: (message: string | null) => void;

  loadConversations: (reset?: boolean) => Promise<void>;
  setConvSearch: (search: string) => void;
  openConversation: (id: number) => Promise<void>;
  loadOlderMessages: () => Promise<void>;
  newChat: () => void;

  send: (message: string) => Promise<void>;
  stop: () => Promise<void>;
  regenerate: () => Promise<void>;
  continueAnswer: () => Promise<void>;

  renameConversation: (id: number, title: string) => Promise<void>;
  togglePin: (id: number) => Promise<void>;
  toggleFavorite: (id: number) => Promise<void>;
  removeConversation: (id: number) => Promise<void>;
  switchModel: (model: string) => Promise<void>;
  setFeedback: (messageId: number, feedback: 'like' | 'dislike' | null) => Promise<void>;
  removeMessage: (messageId: number) => Promise<void>;

  loadModels: () => Promise<void>;
  loadParams: () => Promise<void>;
  saveParams: (data: Partial<ChatParams>) => Promise<void>;
  loadPrompts: () => Promise<void>;
  setSelectedPromptCode: (code: string | null) => void;
  loadStats: () => Promise<void>;
  clearError: () => void;
}

let abortController: AbortController | null = null;

export const useChatStore = create<ChatState>()((set, get) => ({
  conversations: [],
  convTotal: 0,
  convPage: 1,
  convSearch: '',
  loadingList: false,

  activeId: null,
  activeTitle: '',
  activeModel: '',
  messages: [],
  hasMore: false,
  loadingMessages: false,

  streaming: {
    active: false,
    conversationId: null,
    content: '',
    appendToMessageId: null,
    baseContent: '',
    ragHit: null,
    citations: [],
  },
  error: null,

  models: [],
  modelsStatus: [],
  params: null,
  prompts: [],
  selectedPromptCode: null,
  stats: null,

  pendingHomeMessage: null,
  setPendingHomeMessage: (pendingHomeMessage) => set({ pendingHomeMessage }),

  loadConversations: async (reset = true) => {
    const { convPage, conversations, convSearch } = get();
    const page = reset ? 1 : convPage + 1;
    set({ loadingList: true });
    try {
      const data = await chatApi.listConversations({ page, pageSize: 20, search: convSearch || undefined });
      set({
        conversations: reset ? data.items : [...conversations, ...data.items],
        convTotal: data.total,
        convPage: page,
        loadingList: false,
      });
    } catch {
      set({ loadingList: false });
    }
  },

  setConvSearch: (convSearch) => {
    set({ convSearch });
    void get().loadConversations(true);
  },

  openConversation: async (id) => {
    set({ loadingMessages: true, messages: [], activeId: id, error: null });
    try {
      const data = await chatApi.getConversation(id, { limit: 30 });
      set({
        messages: data.messages,
        hasMore: data.hasMore,
        activeTitle: data.conversation.title,
        activeModel: data.conversation.model,
        selectedPromptCode: data.conversation.promptCode,
        loadingMessages: false,
      });
    } catch {
      set({ loadingMessages: false, error: 'load_failed' });
    }
  },

  loadOlderMessages: async () => {
    const { activeId, messages, hasMore, loadingMessages } = get();
    if (!activeId || !hasMore || loadingMessages || messages.length === 0) return;
    set({ loadingMessages: true });
    try {
      const data = await chatApi.getConversation(activeId, { limit: 30, before: messages[0].id });
      set({ messages: [...data.messages, ...messages], hasMore: data.hasMore, loadingMessages: false });
    } catch {
      set({ loadingMessages: false });
    }
  },

  newChat: () => {
    const defaultModel = get().models.find((m) => m.isDefault)?.name ?? get().models[0]?.name ?? '';
    set({
      activeId: null,
      activeTitle: '',
      messages: [],
      hasMore: false,
      error: null,
      activeModel: get().activeModel || defaultModel,
    });
  },

  send: async (message) => {
    const trimmed = message.trim();
    if (!trimmed || get().streaming.active) return;
    await runStream(get, set, { message: trimmed });
  },

  stop: async () => {
    const { streaming } = get();
    abortController?.abort();
    if (streaming.conversationId) {
      try {
        await chatApi.stop(streaming.conversationId);
      } catch {
        // 客户端已中断，服务端停止失败可忽略
      }
    }
  },

  regenerate: async () => {
    const { activeId, messages, streaming } = get();
    if (!activeId || streaming.active) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant') return;
    // 移除本地最后一条 assistant，等待流式重建
    set({ messages: messages.slice(0, -1) });
    await runStream(get, set, { regenerate: true });
  },

  continueAnswer: async () => {
    const { activeId, messages, streaming } = get();
    if (!activeId || streaming.active) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant') return;
    await runStream(get, set, { continue: true });
  },

  renameConversation: async (id, title) => {
    await chatApi.updateConversation(id, { title });
    set((s) => ({
      conversations: s.conversations.map((c) => (c.id === id ? { ...c, title } : c)),
      activeTitle: s.activeId === id ? title : s.activeTitle,
    }));
  },

  togglePin: async (id) => {
    const conv = get().conversations.find((c) => c.id === id);
    if (!conv) return;
    await chatApi.updateConversation(id, { pinned: !conv.pinned });
    await get().loadConversations(true);
  },

  toggleFavorite: async (id) => {
    const conv = get().conversations.find((c) => c.id === id);
    if (!conv) return;
    await chatApi.updateConversation(id, { favorite: !conv.favorite });
    await get().loadConversations(true);
  },

  removeConversation: async (id) => {
    await chatApi.deleteConversation(id);
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== id),
      convTotal: s.convTotal - 1,
      ...(s.activeId === id ? { activeId: null, messages: [], activeTitle: '' } : {}),
    }));
  },

  switchModel: async (model) => {
    const { activeId } = get();
    set({ activeModel: model });
    if (activeId) {
      await chatApi.updateConversation(activeId, { model });
      set((s) => ({
        conversations: s.conversations.map((c) => (c.id === activeId ? { ...c, model } : c)),
      }));
    }
  },

  setFeedback: async (messageId, feedback) => {
    const current = get().messages.find((m) => m.id === messageId);
    const next = current?.feedback === feedback ? null : feedback;
    const updated = await chatApi.updateMessage(messageId, next);
    set((s) => ({
      messages: s.messages.map((m) => (m.id === messageId ? { ...m, feedback: updated.feedback } : m)),
    }));
  },

  removeMessage: async (messageId) => {
    await chatApi.deleteMessage(messageId);
    set((s) => ({ messages: s.messages.filter((m) => m.id !== messageId) }));
  },

  loadModels: async () => {
    try {
      const data = await chatApi.models();
      set({ models: data.models });
      const { activeModel } = get();
      if (!activeModel) {
        const def = data.models.find((m) => m.isDefault) ?? data.models[0];
        if (def) set({ activeModel: def.name });
      }
    } catch {
      // Ollama 离线时保持现状
    }
    try {
      const status = await chatApi.modelsStatus();
      set({ modelsStatus: status.models });
    } catch {
      // 状态接口失败不阻塞
    }
  },

  loadParams: async () => {
    try {
      const params = await chatApi.getParams();
      set({ params });
    } catch {
      // 忽略
    }
  },

  saveParams: async (data) => {
    const params = await chatApi.saveParams(data);
    set({ params });
  },

  loadPrompts: async () => {
    try {
      const prompts = await chatApi.prompts();
      set({ prompts });
    } catch {
      // 忽略
    }
  },

  setSelectedPromptCode: (selectedPromptCode) => set({ selectedPromptCode }),

  loadStats: async () => {
    try {
      const stats = await chatApi.stats();
      set({ stats });
    } catch {
      // 忽略
    }
  },

  clearError: () => set({ error: null }),
}));

type Get = () => ChatState;
type Set = (partial: Partial<ChatState> | ((s: ChatState) => Partial<ChatState>)) => void;

/** 统一流式执行：send / continue / regenerate */
async function runStream(
  get: Get,
  set: Set,
  mode: { message?: string; continue?: boolean; regenerate?: boolean },
): Promise<void> {
  const { activeId, activeModel, selectedPromptCode } = get();
  abortController = new AbortController();
  set({
    streaming: {
      active: true,
      conversationId: activeId,
      content: '',
      appendToMessageId: null,
      baseContent: '',
      ragHit: null,
      citations: [],
    },
    error: null,
  });

  let streamedContent = '';
  let baseContent = '';
  let finalMessageId: number | null = null;
  let finalConversationId: number | null = activeId;
  let userMessage: ChatMessage | null = null;
  let ragHit: boolean | null = null;
  let citations: ChatCitation[] = [];

  try {
    await streamChat({
      conversationId: activeId ?? undefined,
      message: mode.message,
      model: activeModel || undefined,
      promptCode: activeId ? undefined : (selectedPromptCode ?? undefined),
      continue: mode.continue,
      regenerate: mode.regenerate,
      signal: abortController.signal,
      onEvent: (event) => {
        if (event.type === 'meta') {
          finalConversationId = event.conversationId;
          if (event.appendToMessageId) {
            const existing = get().messages.find((m) => m.id === event.appendToMessageId);
            baseContent = existing?.content ?? '';
            set((s) => ({
              streaming: { ...s.streaming, appendToMessageId: event.appendToMessageId!, baseContent },
            }));
          }
          if (event.userMessageId && mode.message) {
            userMessage = {
              id: event.userMessageId,
              conversationId: event.conversationId,
              role: 'user',
              content: mode.message,
              model: event.model,
              promptTokens: null,
              completionTokens: null,
              durationMs: null,
              status: 'done',
              feedback: null,
              createdAt: new Date().toISOString(),
            };
            set((s) => ({ messages: [...s.messages, userMessage!] }));
          }
          set((s) => ({
            streaming: { ...s.streaming, conversationId: event.conversationId },
            activeId: s.activeId ?? event.conversationId,
            activeModel: event.model,
          }));
        } else if (event.type === 'rag') {
          ragHit = event.hit;
          citations = event.hit && event.citations ? event.citations : [];
          set((s) => ({
            streaming: { ...s.streaming, ragHit: event.hit, citations },
          }));
        } else if (event.type === 'delta') {
          streamedContent += event.content;
          set((s) => ({ streaming: { ...s.streaming, content: streamedContent } }));
        } else if (event.type === 'done') {
          finalMessageId = event.messageId;
          finalConversationId = event.conversationId;
          if (event.ragHit != null) ragHit = event.ragHit;
          if (event.citations?.length) citations = event.citations;
          if (event.messageId) {
            const assistantMessage: ChatMessage = {
              id: event.messageId,
              conversationId: event.conversationId,
              role: 'assistant',
              content: baseContent + streamedContent,
              model: get().activeModel,
              promptTokens: event.promptTokens ?? null,
              completionTokens: event.completionTokens ?? null,
              durationMs: event.durationMs ?? null,
              status: event.status,
              feedback: null,
              createdAt: new Date().toISOString(),
              ragHit,
              citations: ragHit ? citations : null,
            };
            set((s) => ({
              messages: event.messageId && s.streaming.appendToMessageId
                ? s.messages.map((m) => (m.id === event.messageId ? assistantMessage : m))
                : [...s.messages, assistantMessage],
            }));
          }
        } else if (event.type === 'error') {
          set({ error: event.message });
        }
      },
    });
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      set({ error: error instanceof Error ? error.message : 'stream_failed' });
    }
  } finally {
    abortController = null;
    set((s) => ({
      streaming: {
        active: false,
        conversationId: null,
        content: '',
        appendToMessageId: null,
        baseContent: '',
        ragHit: null,
        citations: [],
      },
      messages: finalMessageId
        ? s.messages
        : s.streaming.content
          ? s.messages
          : s.messages,
    }));
    // 刷新列表与统计（新对话出现在列表顶部）
    void get().loadConversations(true);
    void get().loadStats();
    void get().loadModels();
    if (finalConversationId && !get().activeTitle) {
      void chatApi.getConversation(finalConversationId, { limit: 1 }).then((d) => {
        set({ activeTitle: d.conversation.title });
      }).catch(() => undefined);
    }
  }
}
