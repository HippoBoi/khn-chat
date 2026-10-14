export interface ChatUser {
  userId: string;
  username: string;
  tag?: string;
  lastSeen?: number | null;
}
