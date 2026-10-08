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
  setActiveConversation: (id: string) => void;
  fetchConversations: () => Promise<void>;
  fetchUnreadCounts: () => Promise<void>;
  createConversation: (name: string, memberIds: string[]) => Promise<Conversation>;
  addConversation: (conversation: Conversation) => void;
  setUnreadByConversation: (counts: Record<string, number>) => void;
  decrementUnread: (conversationId: string) => void;
  clearUnread: (conversationId: string) => void;
}

export const DEFAULT_CONVERSATION_ID = 'public';

export const useConversationStore = create<ConversationState>()((set, get) => ({
  conversations: [],
  activeConversationId: DEFAULT_CONVERSATION_ID,
  isLoading: false,
  hasLoaded: false,
  unreadByConversation: {},
  setActiveConversation: (id) => {
    const current = get().activeConversationId;
    if (current === id) return;
    set({ activeConversationId: id });
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
        return {
          conversations,
          hasLoaded: true,
          activeConversationId: activeStillExists
            ? state.activeConversationId
            : conversations[0]?.id ?? DEFAULT_CONVERSATION_ID,
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
    set((state) => ({
      conversations: state.conversations.some((c) => c.id === conversation.id)
        ? state.conversations.map((c) => (c.id === conversation.id ? conversation : c))
        : [conversation, ...state.conversations],
    })),
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
