import { useEffect, useState } from 'react';
import { getToken } from 'firebase/messaging';
import api from '../services/api';
import { getFirebaseMessaging } from '../services/firebase';
import { useChatStore } from '../store/useChatStore';

const DEFAULT_CONVERSATION_ID = 'public';

export function usePushSubscription() {
  const userId = useChatStore((s) => s.userId);
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    setIsSupported(true);
  }, []);

  useEffect(() => {
    if (!isSupported) return;

    const initialize = async () => {
      try {
        await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        const registration = await navigator.serviceWorker.ready;
        const existingSubscription = await registration.pushManager.getSubscription();

        if (existingSubscription && Notification.permission === 'granted') {
          setIsSubscribed(true);
        }
      } catch {
        // Service worker registration failed; push notifications unavailable.
      }
    };

    initialize();
  }, [isSupported]);

  const subscribe = async (): Promise<boolean> => {
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
  };

  const unsubscribe = async () => {
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

      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        await existingSubscription.unsubscribe();
      }

      setIsSubscribed(false);
    } catch {
      // Unsubscribe failed; state may be stale.
    }
  };

  return { isSupported, isSubscribed, isSubscribing, subscribe, unsubscribe };
}
