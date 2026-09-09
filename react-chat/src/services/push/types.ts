export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string | undefined>;
}

export interface PushService {
  isSupported(): boolean;
  initialize(): void;
  getSubscriptionStatus(): Promise<boolean>;
  canRequestPermission(): boolean;
  subscribe(userId: string): Promise<boolean>;
  unsubscribe(userId: string): Promise<void>;
  onForegroundMessage(callback: (message: PushMessage) => void): () => void;
  onNotificationTap(callback: () => void): () => void;
}