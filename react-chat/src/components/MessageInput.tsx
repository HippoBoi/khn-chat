import { useState } from 'react';
import { socket } from '../services/socket';
import { useChatStore } from '../store/useChatStore';

const MAX_MESSAGE_CHARACTERS = 1000;

interface MessageInputProps {
  onMessageSent?: (messageText: string) => void;
}

export function MessageInput({ onMessageSent }: MessageInputProps) {
  const [text, setText] = useState('');
  const userId = useChatStore((s) => s.userId);
  const username = useChatStore((s) => s.username);
  const isConnected = useChatStore((s) => s.isConnected);
  const profilePictureIndex = useChatStore((s) => s.profilePictureIndex);
  const profilePictureUrl = useChatStore((s) => s.profilePictureUrl);
  const isOverCharacterLimit = text.length > MAX_MESSAGE_CHARACTERS;

  const handleSend = () => {
    const trimmed = text.trim();
    const usernameToShow = username || 'unnamed';
    if (!trimmed || !isConnected || isOverCharacterLimit) return;

    const message = {
      id: crypto.randomUUID(),
      text: trimmed,
      sender: usernameToShow,
      timestamp: Date.now(),
      userId,
      profilePictureIndex,
      profilePictureUrl,
    };

    socket.emit('message', message);
    onMessageSent?.(trimmed);
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSend();
  };

  return (
    <div className="message-composer">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        className={isOverCharacterLimit ? 'message-input-error' : undefined}
        placeholder="Type a message..."
        disabled={!isConnected}
        aria-invalid={isOverCharacterLimit}
        aria-describedby={isOverCharacterLimit ? 'message-character-error' : undefined}
      />
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
