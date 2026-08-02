import { useCallback, useEffect, useState } from 'react';
import { getToken } from 'firebase/messaging';
import api from '../services/api';
import { getFirebaseMessaging } from '../services/firebase';
import { useChatStore } from '../store/useChatStore';

const DEFAULT_CONVERSATION_ID = 'public';
const PUSH_ENABLED_KEY = 'chat-push-notifications-enabled';

function getIsPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

function getPushEnabled(): boolean {
  const stored = window.localStorage.getItem(PUSH_ENABLED_KEY);
  if (stored === null) return true;
  return stored !== 'false';
}

export function usePushSubscription() {
  const userId = useChatStore((s) => s.userId);
  const isConnected = useChatStore((s) => s.isConnected);
  const [isSupported] = useState(getIsPushSupported);
  const [isEnabled, setIsEnabled] = useState(getPushEnabled);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    if (!isSupported) return;

    navigator.serviceWorker
      .register('/firebase-messaging-sw.js')
      .catch(() => {
        // Service worker registration failed; push notifications unavailable.
      });
  }, [isSupported]);

  useEffect(() => {
    if (!isSupported) return;

    const syncStatus = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        setIsSubscribed(!!existing);
      } catch {
        setIsSubscribed(false);
      }
    };

    syncStatus();
  }, [isSupported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    setIsSubscribing(true);
    try {
      const messaging = await getFirebaseMessaging();
      if (!messaging) return false;

      const registration = await navigator.serviceWorker.ready;
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: registration,
      });
      if (!token) return false;

      await api.post('/push/subscribe', {
        userId,
        token,
        conversationId: DEFAULT_CONVERSATION_ID,
      });

      setIsSubscribed(true);
      return true;
    } catch {
      return false;
    } finally {
      setIsSubscribing(false);
    }
  }, [isSupported, userId]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return;

    try {
      const messaging = await getFirebaseMessaging();
      const registration = await navigator.serviceWorker.ready;

      if (messaging) {
        const token = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: registration,
        }).catch(() => null);

        if (token) {
          await api.delete('/push/subscribe', { data: { userId, token } });
        }
      }

      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        await existing.unsubscribe();
      }

      setIsSubscribed(false);
    } catch {
      // Unsubscribe failed; push state may be stale.
    }
  }, [isSupported, userId]);

  const toggle = useCallback(async () => {
    if (isEnabled) {
      await unsubscribe();
    } else {
      await subscribe();
    }
    setIsEnabled((current) => {
      const next = !current;
      window.localStorage.setItem(PUSH_ENABLED_KEY, String(next));
      return next;
    });
  }, [isEnabled, subscribe, unsubscribe]);

  useEffect(() => {
    if (!isSupported || !isConnected || !userId || !isEnabled) return;
    if (Notification.permission !== 'default' && Notification.permission !== 'granted') return;

    subscribe();
  }, [isSupported, isConnected, userId, isEnabled, subscribe]);

  return {
    isSupported,
    isEnabled,
    isSubscribed,
    isSubscribing,
    subscribe,
    unsubscribe,
    toggle,
  };
}