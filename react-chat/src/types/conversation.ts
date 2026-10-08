export interface Conversation {
  id: string;
  name: string;
  createdBy?: string | null;
  createdAt: number;
  lastMessageAt?: number | null;
  memberCount: number;
  memberIds: string[];
}
