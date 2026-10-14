export interface ChatImage {
  id: string;
  key: string;
  url: string;
  contentType: string;
  sizeBytes: number;
  width: number;
  height: number;
}

export interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
  userId?: string | null;
  profilePictureIndex: number;
  profilePictureUrl?: string | null;
  pingedUserIds?: string[];
  conversationId?: string | null;
  image?: ChatImage | null;
}
