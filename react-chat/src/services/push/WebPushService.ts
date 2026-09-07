import { getToken, onMessage } from 'firebase/messaging';
import api from '../api';
import { getFirebaseMessaging } from '../firebase';
import type { PushMessage, PushService } from './types';

const DEFAULT_CONVERSATION_ID = 'public';

function getIsPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

class WebPushService implements PushService {
  isSupported(): boolean {
    return getIsPushSupported();
  }

  initialize(): void {
    if (!getIsPushSupported()) return;

    navigator.serviceWorker
      .register('/firebase-messaging-sw.js')
      .catch(() => {
        // Service worker registration failed; push notifications unavailable.
      });
  }

  async getSubscriptionStatus(): Promise<boolean> {
    if (!getIsPushSupported()) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      return !!existing;
    } catch {
      return false;
    }
  }

  canRequestPermission(): boolean {
    return (
      typeof Notification !== 'undefined' &&
      (Notification.permission === 'default' || Notification.permission === 'granted')
    );
  }

  async subscribe(userId: string): Promise<boolean> {
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

    return true;
  }

  async unsubscribe(userId: string): Promise<void> {
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
  }

  onForegroundMessage(callback: (message: PushMessage) => void): () => void {
    let remove: (() => void) | undefined;

    getFirebaseMessaging().then((messaging) => {
      if (!messaging) return;

      remove = onMessage(messaging, (payload) => {
        const title = payload.data?.title || payload.notification?.title;
        const body = payload.data?.body || payload.notification?.body || '';
        if (!title) return;

        callback({ title, body, data: payload.data });
      });
    });

    return () => remove?.();
  }

  onNotificationTap(): () => void {
    return () => {};
  }
}

export const webPushService = new WebPushService();