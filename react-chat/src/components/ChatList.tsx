import { useConversationStore } from '../store/useConversationStore';
import './ChatList.css';

interface ChatListProps {
  onCreateClick: () => void;
}

export function ChatList({ onCreateClick }: ChatListProps) {
  const conversations = useConversationStore((s) => s.conversations);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const setActiveConversation = useConversationStore((s) => s.setActiveConversation);
  const unreadByConversation = useConversationStore((s) => s.unreadByConversation);
  const isLoading = useConversationStore((s) => s.isLoading);

  return (
    <aside className="chat-sidebar" aria-label="Chat list">
      <div className="chat-sidebar-header">
        <span className="chat-sidebar-title">Chats</span>
        <button
          type="button"
          className="chat-new-button"
          onClick={onCreateClick}
          aria-label="Create new chat"
          title="Create new chat"
        >
          +
        </button>
      </div>
      <div className="chat-list">
        {isLoading && conversations.length === 0 ? (
          <p className="chat-list-empty">Loading chats...</p>
        ) : null}
        {!isLoading && conversations.length === 0 ? (
          <p className="chat-list-empty">No chats yet. Create one!</p>
        ) : null}
        {conversations.map((conversation) => {
          const unread = unreadByConversation[conversation.id] ?? 0;
          const isActive = conversation.id === activeConversationId;
          return (
            <button
              key={conversation.id}
              type="button"
              className={`chat-list-item${isActive ? ' chat-list-item-active' : ''}`}
              onClick={() => setActiveConversation(conversation.id)}
              aria-pressed={isActive}
              title={conversation.name}
            >
              <span className="chat-list-item-main">
                <span className="chat-list-item-name">{conversation.name}</span>
              </span>
              {unread > 0 ? (
                <span className="chat-list-unread" aria-label={`${unread} unread`}>
                  {unread > 99 ? '99+' : unread}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
