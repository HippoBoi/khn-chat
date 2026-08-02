import { create } from 'zustand';
import api from '../services/api';
import { useChatStore } from './useChatStore';
import type { Notification } from '../types/notification';

export interface ToastNotification {
  id: string;
  type: 'message' | 'system' | 'error';
  title: string;
  body: string;
  sender?: string;
  avatarUrl?: string;
  timestamp: number;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

type ReadStatePayload = { all?: boolean; id?: string };

interface NotificationState {
  toasts: ToastNotification[];
  notifications: Notification[];
  unreadCount: number;
  isSoundEnabled: boolean;
  hasLoadedNotifications: boolean;
  addToast: (notification: Omit<ToastNotification, 'id' | 'timestamp'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  addNotification: (notification: Notification) => void;
  fetchNotifications: () => Promise<void>;
  markAllRead: () => Promise<void>;
  setReadState: (payload: ReadStatePayload) => void;
  setUnreadCount: (count: number) => void;
  setSoundEnabled: (enabled: boolean) => void;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  toasts: [],
  notifications: [],
  unreadCount: 0,
  isSoundEnabled: false,
  hasLoadedNotifications: false,
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
  addNotification: (notification) =>
    set((state) => {
      if (state.notifications.some((existing) => existing.id === notification.id)) {
        return state;
      }

      return {
        notifications: [notification, ...state.notifications],
        unreadCount: notification.isRead ? state.unreadCount : state.unreadCount + 1,
      };
    }),
  fetchNotifications: async () => {
    const userId = useChatStore.getState().userId;
    if (!userId) return;

    try {
      const response = await api.get<NotificationsResponse>('/notifications', {
        params: { userId, limit: 50 },
      });
      const { notifications, unreadCount } = response.data;

      set({
        notifications,
        unreadCount,
        hasLoadedNotifications: true,
      });
    } catch {
      // Notification fetch is non-critical; ignore errors.
    }
  },
  markAllRead: async () => {
    const userId = useChatStore.getState().userId;
    if (!userId) return;

    try {
      await api.post('/notifications/read', { userId });
      set((state) => ({
        unreadCount: 0,
        notifications: state.notifications.map((notification) => ({
          ...notification,
          isRead: true,
        })),
      }));
    } catch {
      // Ignore mark-all-read errors.
    }
  },
  setReadState: ({ all, id }) =>
    set((state) => {
      if (all) {
        return {
          unreadCount: 0,
          notifications: state.notifications.map((notification) => ({
            ...notification,
            isRead: true,
          })),
        };
      }

      if (!id) return state;

      let decremented = false;
      const notifications = state.notifications.map((notification) => {
        if (notification.id === id && !notification.isRead) {
          decremented = true;
          return { ...notification, isRead: true };
        }
        return notification;
      });

      return {
        notifications,
        unreadCount: decremented ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
      };
    }),
  setUnreadCount: (count) => set({ unreadCount: count }),
  setSoundEnabled: (enabled) => set({ isSoundEnabled: enabled }),
}));
