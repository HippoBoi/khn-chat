import { create } from 'zustand';
import type { Message } from '../types/message';

interface ChatState {
  messages: Message[];
  isConnected: boolean;
  isChatVisible: boolean;
  username: string;
  profilePictureIndex: number;
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
  setConnected: (connected: boolean) => void;
  setChatVisible: (visible: boolean) => void;
  setUsername: (username: string) => void;
  setProfilePictureIndex: (index: number) => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  messages: [],
  isConnected: false,
  isChatVisible: false,
  username: '',
  profilePictureIndex: 0,
  addMessage: (message) =>
    set((state) => ({
      messages: state.messages.some((existing) => existing.id === message.id)
        ? state.messages
        : [...state.messages, message],
    })),
  setMessages: (messages) => set({ messages }),
  setConnected: (connected) => set({ isConnected: connected }),
  setChatVisible: (visible) => set({ isChatVisible: visible }),
  setUsername: (username) => set({ username }),
  setProfilePictureIndex: (index) => set({ profilePictureIndex: index }),
}));
