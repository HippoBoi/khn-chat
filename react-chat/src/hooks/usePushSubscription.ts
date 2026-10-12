import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [pushService] = useState(getPushService);
  const [isSupported] = useState(() => pushService.isSupported());
  const [isEnabled, setIsEnabled] = useState(getPushEnabled);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const attemptedUserId = useRef<string | null>(null);
  const isBusy = useRef(false);

  useEffect(() => {
    if (!isSupported) return;

    pushService.initialize();
  }, [isSupported, pushService]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !userId || isBusy.current) return false;
    isBusy.current = true;
    attemptedUserId.current = userId;
    setIsSubscribing(true);
    try {
      const subscribed = await pushService.subscribe(userId);
      setIsSubscribed(subscribed);
      if (subscribed) {
        window.localStorage.setItem(PUSH_ENABLED_KEY, 'true');
        setIsEnabled(true);
      }
      return subscribed;
    } catch {
      return false;
    } finally {
      isBusy.current = false;
      setIsSubscribing(false);
    }
  }, [isSupported, pushService, userId]);

  const unsubscribe = useCallback(async () => {
    if (isBusy.current) return false;
    isBusy.current = true;
    setIsSubscribing(true);
    try {
      await pushService.unsubscribe(userId);
      setIsSubscribed(false);
      window.localStorage.setItem(PUSH_ENABLED_KEY, 'false');
      setIsEnabled(false);
      return true;
    } catch {
      return false;
    } finally {
      isBusy.current = false;
      setIsSubscribing(false);
    }
  }, [pushService, userId]);

  const toggle = useCallback(async () => {
    if (!isSupported || isBusy.current) return;
    if (isEnabled && isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  }, [isSupported, isEnabled, isSubscribed, subscribe, unsubscribe]);

  useEffect(() => {
    if (!isSupported || !userId || !isEnabled) return;
    if (attemptedUserId.current === userId) return;
    if (!pushService.canRequestPermission()) return;

    pushService.setUserId?.(userId);
    void subscribe();
  }, [isSupported, userId, isEnabled, pushService, subscribe]);

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
