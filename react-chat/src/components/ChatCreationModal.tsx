import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useChatStore } from '../store/useChatStore';
import { useConversationStore } from '../store/useConversationStore';
import { getUserIdLabel } from '../utils/userIdLabel';
import type { ChatUser } from '../types/chatUser';
import './ChatCreationModal.css';

interface UsersResponse {
  users: ChatUser[];
}

interface ChatCreationModalProps {
  open: boolean;
  onClose: () => void;
}

export function ChatCreationModal({ open, onClose }: ChatCreationModalProps) {
  const userId = useChatStore((s) => s.userId);
  const createConversation = useConversationStore((s) => s.createConversation);
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setQuery('');
    setSelectedIds([]);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setIsLoadingUsers(true);

    const timerId = window.setTimeout(async () => {
      try {
        const response = await api.get<UsersResponse>('/users', {
          params: { exclude: userId, q: query, limit: 50 },
        });
        if (cancelled) return;
        setUsers(response.data.users);
      } catch {
        if (cancelled) return;
        setUsers([]);
      } finally {
        if (!cancelled) setIsLoadingUsers(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [open, query, userId]);

  const toggleSelected = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const canCreate = useMemo(() => {
    return name.trim().length > 0 && !isCreating;
  }, [name, isCreating]);

  const handleCreate = async () => {
    if (!canCreate) return;
    setIsCreating(true);
    setError(null);

    try {
      await createConversation(name.trim().slice(0, 80), selectedIds);
      onClose();
    } catch {
      setError('FAILED TO CREATE CHAT');
    } finally {
      setIsCreating(false);
    }
  };

  if (!open) return null;

  return (
    <div className="chat-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="chat-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Create chat"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="chat-modal-header">
          <span className="chat-modal-title">New chat</span>
          <button
            type="button"
            className="chat-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            X
          </button>
        </div>
        <label className="chat-modal-label">
          Chat name
          <input
            type="text"
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="chat-modal-label">
          Add users
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ramon..."
          />
        </label>
        <div className="chat-modal-users" role="listbox" aria-label="Users">
          {isLoadingUsers ? <p className="chat-modal-hint">Loading users...</p> : null}
          {!isLoadingUsers && users.length === 0 ? (
            <p className="chat-modal-hint">No other users found yet.</p>
          ) : null}
          {users.map((user) => {
            const { label, colorIndex } = getUserIdLabel(user.userId);
            const selected = selectedIds.includes(user.userId);
            return (
              <button
                key={user.userId}
                type="button"
                role="option"
                aria-selected={selected}
                className={`chat-modal-user${selected ? ' chat-modal-user-selected' : ''}`}
                onClick={() => toggleSelected(user.userId)}
                title={user.userId}
              >
                <span className={`chat-modal-badge message-user-id-${colorIndex}`}>{label}</span>
                <span className="chat-modal-username">{user.username}</span>
                <span className="chat-modal-check" aria-hidden="true">
                  {selected ? '✓' : ''}
                </span>
              </button>
            );
          })}
        </div>
        {error ? <p className="chat-modal-error">{error}</p> : null}
        <button
          type="button"
          className="chat-modal-create"
          disabled={!canCreate}
          onClick={handleCreate}
        >
          {isCreating ? 'CREATING...' : 'CREATE'}
        </button>
      </div>
    </div>
  );
}
