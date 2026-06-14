import { useEffect } from 'react';
import { socket } from '../services/socket';
import { useChatStore } from '../store/useChatStore';
import type { Message } from '../types/message';

export function useSocket() {
  const addMessage = useChatStore((s) => s.addMessage);
  const setConnected = useChatStore((s) => s.setConnected);
  const setChatVisible = useChatStore((s) => s.setChatVisible);

  useEffect(() => {
    socket.connect();

    socket.on('connect', () => {
      setConnected(true);
      setChatVisible(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('message', (msg: Message) => {
      addMessage(msg);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('message');
      socket.disconnect();
    };
  }, [addMessage, setConnected, setChatVisible]);
}
