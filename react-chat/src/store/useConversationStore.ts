import { create } from 'zustand';
import api from '../services/api';
import { socket } from '../services/socket';
import { useChatStore } from './useChatStore';
import type { Conversation } from '../types/conversation';

interface ConversationsResponse {
  conversations: Conversation[];
}

interface CreateConversationResponse {
  conversation: Conversation;
}

interface UnreadByConversationResponse {
  unreadByConversation: Record<string, number>;
}

interface ConversationState {
  conversations: Conversation[];
  activeConversationId: string;
  isLoading: boolean;
  hasLoaded: boolean;
  unreadByConversation: Record<string, number>;
  unseenConversationIds: string[];
  knownConversationIds: string[];
  setActiveConversation: (id: string) => void;
  fetchConversations: () => Promise<void>;
  fetchUnreadCounts: () => Promise<void>;
  createConversation: (name: string, memberIds: string[]) => Promise<Conversation>;
  addConversation: (conversation: Conversation) => void;
  markConversationUnseen: (id: string) => void;
  markConversationSeen: (id: string) => void;
  setUnreadByConversation: (counts: Record<string, number>) => void;
  decrementUnread: (conversationId: string) => void;
  clearUnread: (conversationId: string) => void;
}

export const DEFAULT_CONVERSATION_ID = 'public';

const NEW_CHAT_STORAGE_KEY = 'khn-new-chats-v1';

function loadNewChatState(): { unseen: string[]; known: string[] } {
  try {
    const raw = localStorage.getItem(NEW_CHAT_STORAGE_KEY);
    if (!raw) return { unseen: [], known: [] };
    const parsed = JSON.parse(raw) as { unseen?: unknown; known?: unknown };
    return {
      unseen: Array.isArray(parsed.unseen) ? parsed.unseen.filter((v): v is string => typeof v === 'string') : [],
      known: Array.isArray(parsed.known) ? parsed.known.filter((v): v is string => typeof v === 'string') : [],
    };
  } catch {
    return { unseen: [], known: [] };
  }
}

function persistNewChatState(known: string[], unseen: string[]) {
  try {
    localStorage.setItem(NEW_CHAT_STORAGE_KEY, JSON.stringify({ known, unseen }));
  } catch {
    return;
  }
}

const initialNewChatState = loadNewChatState();

export const useConversationStore = create<ConversationState>()((set, get) => ({
  conversations: [],
  activeConversationId: DEFAULT_CONVERSATION_ID,
  isLoading: false,
  hasLoaded: false,
  unreadByConversation: {},
  unseenConversationIds: initialNewChatState.unseen,
  knownConversationIds: initialNewChatState.known,
  setActiveConversation: (id) => {
    const current = get().activeConversationId;
    if (current === id) return;
    set((state) => {
      if (!state.unseenConversationIds.includes(id) && !state.knownConversationIds.includes(id)) {
        const nextKnown = [...state.knownConversationIds, id];
        persistNewChatState(nextKnown, state.unseenConversationIds);
        return { activeConversationId: id, knownConversationIds: nextKnown };
      }
      if (!state.unseenConversationIds.includes(id)) {
        return { activeConversationId: id };
      }
      const nextUnseen = state.unseenConversationIds.filter((item) => item !== id);
      const nextKnown = state.knownConversationIds.includes(id)
        ? state.knownConversationIds
        : [...state.knownConversationIds, id];
      persistNewChatState(nextKnown, nextUnseen);
      return {
        activeConversationId: id,
        unseenConversationIds: nextUnseen,
        knownConversationIds: nextKnown,
      };
    });
    useChatStore.getState().setMessages([]);
    socket.emit('join-conversation', { conversationId: id });
    get().clearUnread(id);
    const userId = useChatStore.getState().userId;
    if (userId) {
      api.post('/notifications/read', { userId, conversationId: id }).catch(() => {});
    }
  },
  fetchConversations: async () => {
    const userId = useChatStore.getState().userId;
    if (!userId) return;
    set({ isLoading: true });
    try {
      const response = await api.get<ConversationsResponse>('/conversations', {
        params: { userId },
      });
      const conversations = response.data.conversations;
      set((state) => {
        const activeStillExists = conversations.some((c) => c.id === state.activeConversationId);
        const nextActiveId = activeStillExists
          ? state.activeConversationId
          : conversations[0]?.id ?? DEFAULT_CONVERSATION_ID;
        const nextKnown = new Set(state.knownConversationIds);
        const nextUnseen = new Set(state.unseenConversationIds);
        if (nextKnown.size === 0 && !state.hasLoaded) {
          for (const conversation of conversations) {
            nextKnown.add(conversation.id);
          }
          nextUnseen.delete(nextActiveId);
        } else {
          for (const conversation of conversations) {
            if (!nextKnown.has(conversation.id) && conversation.id !== nextActiveId) {
              nextUnseen.add(conversation.id);
            }
            nextKnown.add(conversation.id);
          }
          const incomingIds = new Set(conversations.map((c) => c.id));
          for (const id of Array.from(nextUnseen)) {
            if (!incomingIds.has(id)) nextUnseen.delete(id);
          }
          nextUnseen.delete(nextActiveId);
        }
        const known = Array.from(nextKnown);
        const unseen = Array.from(nextUnseen);
        persistNewChatState(known, unseen);
        return {
          conversations,
          hasLoaded: true,
          activeConversationId: nextActiveId,
          knownConversationIds: known,
          unseenConversationIds: unseen,
        };
      });
      socket.emit('join-conversation', { conversationId: get().activeConversationId });
    } catch {
      set({ hasLoaded: true });
    } finally {
      set({ isLoading: false });
    }
  },
  fetchUnreadCounts: async () => {
    const userId = useChatStore.getState().userId;
    if (!userId) return;
    try {
      const response = await api.get<UnreadByConversationResponse>(
        '/notifications/unread-by-conversation',
        { params: { userId } },
      );
      set({ unreadByConversation: response.data.unreadByConversation });
    } catch {
      return;
    }
  },
  createConversation: async (name, memberIds) => {
    const userId = useChatStore.getState().userId;
    const response = await api.post<CreateConversationResponse>('/conversations', {
      name,
      memberIds,
      createdBy: userId,
    });
    const conversation = response.data.conversation;
    get().addConversation(conversation);
    get().setActiveConversation(conversation.id);
    return conversation;
  },
  addConversation: (conversation) =>
    set((state) => {
      const conversations = state.conversations.some((c) => c.id === conversation.id)
        ? state.conversations.map((c) => (c.id === conversation.id ? conversation : c))
        : [conversation, ...state.conversations];
      if (state.knownConversationIds.includes(conversation.id)) {
        return { conversations };
      }
      const nextKnown = [...state.knownConversationIds, conversation.id];
      persistNewChatState(nextKnown, state.unseenConversationIds);
      return { conversations, knownConversationIds: nextKnown };
    }),
  markConversationUnseen: (id) =>
    set((state) => {
      if (!id || id === state.activeConversationId) return state;
      if (state.unseenConversationIds.includes(id)) return state;
      const nextUnseen = [...state.unseenConversationIds, id];
      const nextKnown = state.knownConversationIds.includes(id)
        ? state.knownConversationIds
        : [...state.knownConversationIds, id];
      persistNewChatState(nextKnown, nextUnseen);
      return { unseenConversationIds: nextUnseen, knownConversationIds: nextKnown };
    }),
  markConversationSeen: (id) =>
    set((state) => {
      if (!state.unseenConversationIds.includes(id)) return state;
      const nextUnseen = state.unseenConversationIds.filter((item) => item !== id);
      persistNewChatState(state.knownConversationIds, nextUnseen);
      return { unseenConversationIds: nextUnseen };
    }),
  setUnreadByConversation: (counts) => set({ unreadByConversation: counts }),
  decrementUnread: (conversationId) =>
    set((state) => ({
      unreadByConversation: {
        ...state.unreadByConversation,
        [conversationId]: Math.max(0, (state.unreadByConversation[conversationId] ?? 1) - 1),
      },
    })),
  clearUnread: (conversationId) =>
    set((state) => {
      if (!state.unreadByConversation[conversationId]) return state;
      const next = { ...state.unreadByConversation };
      delete next[conversationId];
      return { unreadByConversation: next };
    }),
}));
