export interface Notification {
  id: string;
  userId: string;
  conversationId: string;
  type: 'message' | 'system';
  title: string;
  body: string;
  data?: {
    messageId?: string;
    profilePictureUrl?: string | null;
    profilePictureIndex?: number;
  } | null;
  isRead: boolean;
  createdAt: number;
}
