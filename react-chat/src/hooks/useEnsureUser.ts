import { useEffect, useRef } from 'react';
import api from '../services/api';
import { useChatStore } from '../store/useChatStore';

export function useEnsureUser() {
  const userId = useChatStore((s) => s.userId);
  const username = useChatStore((s) => s.username);
  const lastAttempt = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    const key = `${userId}:${username}`;
    if (lastAttempt.current === key) return;
    lastAttempt.current = key;

    api
      .put(`/users/${encodeURIComponent(userId)}`, { username: username || undefined })
      .catch(() => {
        lastAttempt.current = null;
      });
  }, [userId, username]);
}
