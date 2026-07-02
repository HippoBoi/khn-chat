import { create } from 'zustand';

export interface ToastNotification {
  id: string;
  type: 'message' | 'system' | 'error';
  title: string;
  body: string;
  sender?: string;
  avatarUrl?: string;
  timestamp: number;
}

interface NotificationState {
  toasts: ToastNotification[];
  unreadCount: number;
  isSoundEnabled: boolean;
  addToast: (notification: Omit<ToastNotification, 'id' | 'timestamp'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  incrementUnread: () => void;
  resetUnread: () => void;
  setSoundEnabled: (enabled: boolean) => void;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  toasts: [],
  unreadCount: 0,
  isSoundEnabled: false,
  addToast: (notification) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { ...notification, id: crypto.randomUUID(), timestamp: Date.now() },
      ],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
  clearToasts: () => set({ toasts: [] }),
  incrementUnread: () =>
    set((state) => ({ unreadCount: state.unreadCount + 1 })),
  resetUnread: () => set({ unreadCount: 0 }),
  setSoundEnabled: (enabled) => set({ isSoundEnabled: enabled }),
}));
