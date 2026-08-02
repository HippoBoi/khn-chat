import { useMemo, useRef, useState } from 'react';
import { socket } from '../services/socket';
import { useChatStore } from '../store/useChatStore';
import { getUserIdLabel } from '../utils/userIdLabel';
import './MessageInput.css';

const MAX_MESSAGE_CHARACTERS = 1000;
const MENTION_TOKEN_PATTERN = /(?:^|\s)(@[^\s]*)$/;
const MENTION_LABEL_PATTERN = /@([a-z0-9]+)/gi;

interface MentionSuggestion {
  userId: string;
  label: string;
  sender: string;
}

export function MessageInput() {
  const [text, setText] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const mentionTokenStart = useRef(-1);
  const userId = useChatStore((s) => s.userId);
  const username = useChatStore((s) => s.username);
  const messages = useChatStore((s) => s.messages);
  const isConnected = useChatStore((s) => s.isConnected);
  const profilePictureIndex = useChatStore((s) => s.profilePictureIndex);
  const profilePictureUrl = useChatStore((s) => s.profilePictureUrl);
  const isOverCharacterLimit = text.length > MAX_MESSAGE_CHARACTERS;

  const suggestionPool = useMemo(() => {
    const seen = new Set<string>();
    const pool: MentionSuggestion[] = [];

    for (const message of messages) {
      if (!message.userId || message.userId === userId) continue;

      const { label } = getUserIdLabel(message.userId);
      const key = `${label}:${message.userId}`;

      if (seen.has(key)) continue;

      seen.add(key);
      pool.push({ userId: message.userId, label, sender: message.sender });
    }

    return pool;
  }, [messages, userId]);

  const suggestions = useMemo(() => {
    const query = mentionQuery.trim().toUpperCase();

    return suggestionPool.filter(
      (suggestion) =>
        suggestion.label.includes(query) || suggestion.sender.toUpperCase().includes(query),
    );
  }, [suggestionPool, mentionQuery]);

  const handleChange = (value: string) => {
    setText(value);

    const input = inputRef.current;
    const selectionStart = input ? input.selectionStart : value.length;
    const beforeCursor = value.slice(0, selectionStart ?? value.length);
    const tokenMatch = beforeCursor.match(MENTION_TOKEN_PATTERN);

    if (tokenMatch && tokenMatch[1].length > 1) {
      const token = tokenMatch[1];
      mentionTokenStart.current = beforeCursor.length - token.length;
      setMentionQuery(token.slice(1));
      setMentionOpen(true);
      setSelectedSuggestionIndex(0);
      return;
    }

    setMentionOpen(false);
    setMentionQuery('');
  };

  const applyMention = (suggestion: MentionSuggestion) => {
    const input = inputRef.current;
    const currentValue = input ? input.value : text;
    const beforeCursor = currentValue.slice(0, mentionTokenStart.current);
    const afterCursor = currentValue.slice(
      (input ? input.selectionStart : currentValue.length) ?? currentValue.length,
    );
    const next = `${beforeCursor}@${suggestion.label} ${afterCursor}`;

    setText(next);
    setMentionOpen(false);
    setMentionQuery('');

    requestAnimationFrame(() => {
      const inputEl = inputRef.current;
      if (inputEl) {
        const caret = next.length - afterCursor.length;
        inputEl.setSelectionRange(caret, caret);
        inputEl.focus();
      }
    });
  };

  const resolvePingedUserIds = (value: string): string[] => {
    const labelToUserId = new Map<string, string>();

    for (const message of messages) {
      if (message.userId) {
        labelToUserId.set(getUserIdLabel(message.userId).label, message.userId);
      }
    }

    const pinged: string[] = [];
    const seen = new Set<string>();

    for (const match of value.matchAll(MENTION_LABEL_PATTERN)) {
      const label = match[1].toUpperCase();
      const matchedUserId = labelToUserId.get(label);

      if (matchedUserId && !seen.has(matchedUserId)) {
        seen.add(matchedUserId);
        pinged.push(matchedUserId);
      }
    }

    return pinged;
  };

  const handleSend = () => {
    const trimmed = text.trim();
    const usernameToShow = username || 'unnamed';
    if (!trimmed || !isConnected || isOverCharacterLimit) return;
    // eslint-disable-next-line react-hooks/purity
    const timestamp = Date.now();

    const message = {
      id: crypto.randomUUID(),
      text: trimmed,
      sender: usernameToShow,
      timestamp,
      userId,
      profilePictureIndex,
      profilePictureUrl,
      pingedUserIds: resolvePingedUserIds(trimmed),
    };

    socket.emit('message', message);
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mentionOpen && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex((index) => (index + 1) % suggestions.length);
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex(
          (index) => (index - 1 + suggestions.length) % suggestions.length,
        );
        return;
      }

      if (e.key === 'Enter' || e.key === 'Tab') {
        const suggestion = suggestions[selectedSuggestionIndex % suggestions.length] ?? suggestions[0];
        if (suggestion) {
          e.preventDefault();
          applyMention(suggestion);
          return;
        }
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionOpen(false);
        setMentionQuery('');
        return;
      }
    }

    if (e.key === 'Enter') handleSend();
  };

  return (
    <div className="message-composer">
      <div className="message-composer-input-wrap">
        {mentionOpen && suggestions.length > 0 && (
          <ul className="mention-suggestions" role="listbox">
            {suggestions.map((suggestion, index) => (
              <li
                key={suggestion.userId}
                role="option"
                aria-selected={index === selectedSuggestionIndex}
                className={
                  index === selectedSuggestionIndex ? 'mention-option-selected' : undefined
                }
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applyMention(suggestion)}
              >
                <span className="mention-option-label">@{suggestion.label}</span>
                <span className="mention-option-sender">{suggestion.sender}</span>
              </li>
            ))}
          </ul>
        )}
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className={isOverCharacterLimit ? 'message-input-error' : undefined}
          placeholder="Type a message... (use @ to ping a user)"
          disabled={!isConnected}
          aria-invalid={isOverCharacterLimit}
          aria-describedby={isOverCharacterLimit ? 'message-character-error' : undefined}
        />
      </div>
      <button onClick={handleSend} disabled={!isConnected || !text.trim() || isOverCharacterLimit}>
        Send
      </button>
      {isOverCharacterLimit && (
        <p id="message-character-error" className="message-character-error">
          Your message is too long.
        </p>
      )}
    </div>
  );
}