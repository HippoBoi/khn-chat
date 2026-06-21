import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Message } from '../types/message';

interface ChatState {
  messages: Message[];
  isConnected: boolean;
  isChatVisible: boolean;
  userId: string;
  username: string;
  profilePictureIndex: number;
  profilePictureUrl: string | null;
  uploadedProfilePictureUrl: string | null;
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
  setConnected: (connected: boolean) => void;
  setChatVisible: (visible: boolean) => void;
  setUsername: (username: string) => void;
  setProfilePictureIndex: (index: number) => void;
  setProfilePictureUrl: (url: string | null) => void;
  selectUploadedProfilePicture: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      isConnected: false,
      isChatVisible: false,
      userId: crypto.randomUUID(),
      username: '',
      profilePictureIndex: 0,
      profilePictureUrl: null,
      uploadedProfilePictureUrl: null,
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
      setProfilePictureIndex: (index) => set({ profilePictureIndex: index, profilePictureUrl: null }),
      setProfilePictureUrl: (url) => set({ profilePictureUrl: url, uploadedProfilePictureUrl: url }),
      selectUploadedProfilePicture: () =>
        set((state) => ({ profilePictureUrl: state.uploadedProfilePictureUrl })),
    }),
    {
      name: 'chat-profile',
      version: 1,
      migrate: (persistedState) => {
        const state = persistedState as Partial<ChatState>;

        return {
          userId: state.userId ?? crypto.randomUUID(),
          username: state.username ?? '',
          profilePictureIndex: state.profilePictureIndex ?? 0,
          profilePictureUrl: state.profilePictureUrl ?? null,
          uploadedProfilePictureUrl: state.uploadedProfilePictureUrl ?? null,
        };
      },
      partialize: (state) => ({
        userId: state.userId,
        username: state.username,
        profilePictureIndex: state.profilePictureIndex,
        profilePictureUrl: state.profilePictureUrl,
        uploadedProfilePictureUrl: state.uploadedProfilePictureUrl,
      }),
    },
  ),
);
