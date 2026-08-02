import { useEffect } from 'react';
import { socket } from '../services/socket';
import { useChatStore } from '../store/useChatStore';
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
    // Audio not supported
  }
}

export function useNotification() {
  const isConnected = useChatStore((s) => s.isConnected);
  const addToast = useNotificationStore((s) => s.addToast);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const setReadState = useNotificationStore((s) => s.setReadState);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  useEffect(() => {
    if (!isConnected) return;

    fetchNotifications();
    markAllRead();
  }, [isConnected, fetchNotifications, markAllRead]);

  useEffect(() => {
    const handleNotification = (notification: Notification) => {
      addNotification(notification);

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
    const handleReadState = (payload: { all?: boolean; id?: string }) => {
      setReadState(payload);
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
        markAllRead();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchNotifications, markAllRead]);
}
