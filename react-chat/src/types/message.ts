export interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
  userId?: string | null;
  profilePictureIndex: number;
  profilePictureUrl?: string | null;
}
