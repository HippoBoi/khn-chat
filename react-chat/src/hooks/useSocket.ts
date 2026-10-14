import { useEffect } from 'react';
import api from '../services/api';
import { socket } from '../services/socket';
import { useChatStore } from '../store/useChatStore';
import { useConversationStore } from '../store/useConversationStore';
import type { Message } from '../types/message';
import type { Conversation } from '../types/conversation';

export function useSocket() {
  const addMessage = useChatStore((s) => s.addMessage);
  const setConnected = useChatStore((s) => s.setConnected);
  const setChatVisible = useChatStore((s) => s.setChatVisible);
  const username = useChatStore((s) => s.username);

  useEffect(() => {
    if (!socket.connected) return;
    const userId = useChatStore.getState().userId;
    if (userId) {
      socket.emit('identify', { userId, username: username || undefined });
    }
  }, [username]);

  useEffect(() => {
    socket.connect();

    socket.on('connect', () => {
      setConnected(true);
      setChatVisible(true);

      const { userId, username } = useChatStore.getState();
      if (userId) {
        socket.emit('identify', { userId, username: username || undefined });
        api.put(`/users/${encodeURIComponent(userId)}`, { username: username || undefined }).catch(() => {});
      }
      socket.emit('join-conversation', {
        conversationId: useConversationStore.getState().activeConversationId,
      });
      useConversationStore.getState().fetchConversations();
      useConversationStore.getState().fetchUnreadCounts();
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('message', (msg: Message) => {
      const activeId = useConversationStore.getState().activeConversationId;
      if (msg.conversationId && msg.conversationId !== activeId) {
        return;
      }
      if (!msg.conversationId && activeId !== 'public') {
        return;
      }
      addMessage(msg);
    });

    const handleInvite = (payload: { conversation: Conversation }) => {
      if (payload && payload.conversation) {
        const store = useConversationStore.getState();
        store.addConversation(payload.conversation);
        const currentUserId = useChatStore.getState().userId;
        if (payload.conversation.createdBy && currentUserId &&
          payload.conversation.createdBy.toLowerCase() === currentUserId.toLowerCase()) {
          return;
        }
        store.markConversationUnseen(payload.conversation.id);
        store.fetchUnreadCounts();
      }
    };

    socket.on('conversation-invite', handleInvite);

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('message');
      socket.off('conversation-invite', handleInvite);
      socket.disconnect();
    };
  }, [addMessage, setConnected, setChatVisible]);
}
