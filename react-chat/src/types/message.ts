export interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
  profilePictureIndex: number;
  profilePictureUrl?: string | null;
}
