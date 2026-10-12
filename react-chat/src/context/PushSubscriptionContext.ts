import { createContext, useContext } from 'react';
import type { usePushSubscription } from '../hooks/usePushSubscription';

export const PushSubscriptionContext = createContext<ReturnType<typeof usePushSubscription> | null>(null);

export function usePushSubscriptionState() {
  const state = useContext(PushSubscriptionContext);
  if (!state) throw new Error('Push subscription must be used within App');
  return state;
}
