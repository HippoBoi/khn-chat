import { PushNotifications } from '@capacitor/push-notifications';
import api from '../api';
import type { PushMessage, PushService } from './types';

const DEFAULT_CONVERSATION_ID = 'public';
const NATIVE_PUSH_TOKEN_KEY = 'chat-native-push-token';

class NativePushService implements PushService {
  private isInitialized = false;
  private foregroundListener: ((message: PushMessage) => void) | undefined;
  private tapListener: (() => void) | undefined;

  isSupported(): boolean {
    return true;
  }

  initialize(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      const data = notification.data as Record<string, string> | undefined;
      const title = notification.title || data?.title || 'KHN Chat';
      const body = notification.body || data?.body || '';
      this.foregroundListener?.({ title, body, data });
    }).catch(() => {});

    PushNotifications.addListener('pushNotificationActionPerformed', () => {
      this.tapListener?.();
    }).catch(() => {});
  }

  async getSubscriptionStatus(): Promise<boolean> {
    return !!this.getStoredToken();
  }

  canRequestPermission(): boolean {
    return true;
  }

  async subscribe(userId: string): Promise<boolean> {
    let permission = await this.checkPermission();

    if (permission.receive === 'prompt') {
      permission = await this.requestPermission();
    }

    if (permission.receive !== 'granted') return false;

    const token = await this.getToken();
    if (!token) return false;

    await api.post('/push/subscribe', {
      userId,
      token,
      conversationId: DEFAULT_CONVERSATION_ID,
    });

    return true;
  }

  async unsubscribe(userId: string): Promise<void> {
    const token = this.getStoredToken();

    if (token) {
      try {
        await api.delete('/push/subscribe', { data: { userId, token } });
      } catch {
        // err
      }
    }

    try {
      await PushNotifications.unregister();
    } catch {
      // err
    }

    this.clearStoredToken();
  }

  onForegroundMessage(callback: (message: PushMessage) => void): () => void {
    this.foregroundListener = callback;
    return () => {
      this.foregroundListener = undefined;
    };
  }

  onNotificationTap(callback: () => void): () => void {
    this.tapListener = callback;
    return () => {
      this.tapListener = undefined;
    };
  }

  private async checkPermission() {
    try {
      return await PushNotifications.checkPermissions();
    } catch {
      return { receive: 'prompt' as const };
    }
  }

  private async requestPermission() {
    try {
      return await PushNotifications.requestPermissions();
    } catch {
      return { receive: 'denied' as const };
    }
  }

  private async getToken(): Promise<string | null> {
    const stored = this.getStoredToken();
    if (stored) return stored;

    return new Promise((resolve) => {
      const timeout = window.setTimeout(() => resolve(null), 15000);
      let settled = false;
      const settle = (token: string | null) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        resolve(token);
      };

      (async () => {
        try {
          await PushNotifications.addListener('registration', (result) => {
            this.storeToken(result.value);
            settle(result.value);
          });
          await PushNotifications.addListener('registrationError', () => settle(null));
          await PushNotifications.register();
        } catch {
          settle(null);
        }
      })();
    });
  }

  private storeToken(token: string) {
    try {
      window.localStorage.setItem(NATIVE_PUSH_TOKEN_KEY, token);
    } catch {
      // error
    }
  }

  private getStoredToken(): string | null {
    try {
      return window.localStorage.getItem(NATIVE_PUSH_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  private clearStoredToken() {
    try {
      window.localStorage.removeItem(NATIVE_PUSH_TOKEN_KEY);
    } catch {
      // error
    }
  }
}

export const nativePushService = new NativePushService();