import { useEffect } from 'react';
import { socket } from '../services/socket';
import { useChatStore } from '../store/useChatStore';
import { useNotificationStore } from '../store/useNotificationStore';
import type { Message } from '../types/message';

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

function sendBrowserNotification(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification(title, { body, icon: '/icon.svg' });
}

function requestNotificationPermission() {
  if (!('Notification' in window) || Notification.permission !== 'default') return;
  Notification.requestPermission().catch(() => {});
}

export function useNotification() {
  const userId = useChatStore((s) => s.userId);
  const addToast = useNotificationStore((s) => s.addToast);
  const incrementUnread = useNotificationStore((s) => s.incrementUnread);
  const resetUnread = useNotificationStore((s) => s.resetUnread);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  useEffect(() => {
    const handleMessage = (msg: Message) => {
      if (msg.userId === userId) return;

      addToast({
        type: 'message',
        title: msg.sender,
        body: msg.text,
        sender: msg.sender,
        avatarUrl: msg.profilePictureUrl ?? undefined,
      });

      incrementUnread();

      if (document.hidden) {
        requestNotificationPermission();
        sendBrowserNotification(msg.sender, msg.text);
      }

      if (useNotificationStore.getState().isSoundEnabled) {
        playNotificationSound();
      }
    };

    socket.on('message', handleMessage);
    return () => { socket.off('message', handleMessage); };
  }, [userId, addToast, incrementUnread]);

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
        resetUnread();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [resetUnread]);
}
