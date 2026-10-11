import { useEffect } from 'react';
import { useConversationStore } from '../store/useConversationStore';
import './ChatList.css';

interface ChatListProps {
  onCreateClick: () => void;
  open?: boolean;
  onClose?: () => void;
}

export function ChatList({ onCreateClick, open = false, onClose }: ChatListProps) {
  const conversations = useConversationStore((s) => s.conversations);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const setActiveConversation = useConversationStore((s) => s.setActiveConversation);
  const unreadByConversation = useConversationStore((s) => s.unreadByConversation);
  const isLoading = useConversationStore((s) => s.isLoading);

  useEffect(() => {
    if (!open || !onClose) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    if (!window.matchMedia('(max-width: 1023.98px)').matches) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open ]);

  const handleSelectConversation = (conversationId: string) => {
    setActiveConversation(conversationId);
    onClose?.();
  };

  const handleCreateClick = () => {
    onCreateClick();
    onClose?.();
  };

  return (
    <>
      <div
        className={`chat-sidebar-backdrop${open ? ' open' : ''}`}
        onClick={onClose}
      />
      <aside
        id="chat-sidebar"
        className={`chat-sidebar${open ? ' open' : ''}`}
      >
      <div className="chat-sidebar-header">
        <span className="chat-sidebar-title">Chats</span>
        <div className="chat-sidebar-header-actions">
          <button
            type="button"
            className="chat-new-button fa-solid fa-plus"
            onClick={handleCreateClick}
            title="Create new chat"
          >
          </button>
          <button
            type="button"
            className="chat-sidebar-close fa-solid fa-xmark"
            onClick={onClose}
            title="Close chat list"
          >
          </button>
        </div>
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
              onClick={() => handleSelectConversation(conversation.id)}
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
    </>
  );
}
