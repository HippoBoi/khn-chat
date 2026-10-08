import { useEffect } from 'react';
import { socket } from '../services/socket';
import { useChatStore } from '../store/useChatStore';
import { useConversationStore } from '../store/useConversationStore';
import { useNotificationStore } from '../store/useNotificationStore';
import type { Notification } from '../types/notification';

const ORIGINAL_TITLE = 'KHN Chat';

function playNotificationSound() {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, context.currentTime);
    oscillator.frequency.setValueAtTime(1000, context.currentTime + 0.08);

    gain.gain.setValueAtTime(0.15, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.2);

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.2);

    oscillator.onended = () => context.close();
  } catch {
    return;
  }
}

export function useNotification() {
  const isConnected = useChatStore((s) => s.isConnected);
  const addToast = useNotificationStore((s) => s.addToast);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);
  const markConversationRead = useNotificationStore((s) => s.markConversationRead);
  const setReadState = useNotificationStore((s) => s.setReadState);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);

  useEffect(() => {
    if (!isConnected) return;

    fetchNotifications();
    useConversationStore.getState().fetchUnreadCounts();
  }, [isConnected, fetchNotifications]);

  useEffect(() => {
    if (!isConnected || !activeConversationId) return;

    markConversationRead(activeConversationId);
    useConversationStore.getState().clearUnread(activeConversationId);
  }, [isConnected, activeConversationId, markConversationRead]);

  useEffect(() => {
    const handleNotification = (notification: Notification) => {
      addNotification(notification);

      const activeId = useConversationStore.getState().activeConversationId;
      if (!notification.isRead && notification.conversationId !== activeId) {
        const current = useConversationStore.getState().unreadByConversation;
        useConversationStore.getState().setUnreadByConversation({
          ...current,
          [notification.conversationId]:
            (current[notification.conversationId] ?? 0) + 1,
        });
      }

      addToast({
        type: 'message',
        title: notification.title,
        body: notification.body,
        sender: notification.title,
        avatarUrl: notification.data?.profilePictureUrl ?? undefined,
      });

      if (useNotificationStore.getState().isSoundEnabled) {
        playNotificationSound();
      }
    };

    socket.on('notification', handleNotification);
    return () => {
      socket.off('notification', handleNotification);
    };
  }, [addNotification, addToast]);

  useEffect(() => {
    const handleReadState = (payload: { all?: boolean; id?: string; conversationId?: string }) => {
      setReadState(payload);
      if (payload.all) {
        useConversationStore.getState().setUnreadByConversation({});
      } else if (payload.conversationId) {
        useConversationStore.getState().clearUnread(payload.conversationId);
      }
    };

    socket.on('notifications-read', handleReadState);
    return () => {
      socket.off('notifications-read', handleReadState);
    };
  }, [setReadState]);

  useEffect(() => {
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) ${ORIGINAL_TITLE}`;
    } else {
      document.title = ORIGINAL_TITLE;
    }
  }, [unreadCount]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchNotifications();
        const activeId = useConversationStore.getState().activeConversationId;
        if (activeId) {
          markConversationRead(activeId);
          useConversationStore.getState().clearUnread(activeId);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchNotifications, markConversationRead]);
}
