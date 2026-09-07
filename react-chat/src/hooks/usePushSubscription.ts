import { useCallback, useEffect, useState } from 'react';
import { getPushService } from '../services/push';
import { useChatStore } from '../store/useChatStore';
import { useNotificationStore } from '../store/useNotificationStore';

const PUSH_ENABLED_KEY = 'chat-push-notifications-enabled';

function getPushEnabled(): boolean {
  const stored = window.localStorage.getItem(PUSH_ENABLED_KEY);
  if (stored === null) return true;
  return stored !== 'false';
}

export function usePushSubscription() {
  const userId = useChatStore((s) => s.userId);
  const isConnected = useChatStore((s) => s.isConnected);
  const [pushService] = useState(getPushService);
  const [isSupported] = useState(() => pushService.isSupported());
  const [isEnabled, setIsEnabled] = useState(getPushEnabled);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    if (!isSupported) return;

    pushService.initialize();
  }, [isSupported, pushService]);

  useEffect(() => {
    if (!isSupported) return;

    pushService.getSubscriptionStatus().then(setIsSubscribed);
  }, [isSupported, pushService]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    setIsSubscribing(true);
    try {
      const subscribed = await pushService.subscribe(userId);
      if (subscribed) {
        setIsSubscribed(true);
      }
      return subscribed;
    } catch {
      return false;
    } finally {
      setIsSubscribing(false);
    }
  }, [pushService, userId]);

  const unsubscribe = useCallback(async () => {
    try {
      await pushService.unsubscribe(userId);
      setIsSubscribed(false);
    } catch {
      // Unsubscribe failed; push state may be stale.
    }
  }, [pushService, userId]);

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
    if (!pushService.canRequestPermission()) return;

    subscribe();
  }, [isSupported, isConnected, userId, isEnabled, pushService, subscribe]);

  useEffect(() => {
    if (!isSupported) return;

    const addToast = useNotificationStore.getState().addToast;
    const removeForeground = pushService.onForegroundMessage((message) => {
      addToast({
        type: 'message',
        title: message.title,
        body: message.body,
        sender: message.title,
      });
    });

    const removeTap = pushService.onNotificationTap(() => {
      const store = useNotificationStore.getState();
      store.fetchNotifications();
      store.markAllRead();
    });

    return () => {
      removeForeground();
      removeTap();
    };
  }, [isSupported, pushService]);

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