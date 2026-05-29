import { useState } from 'react';
import { socket } from '../services/socket';
import { useChatStore } from '../store/useChatStore';

export function MessageInput() {
  const [text, setText] = useState('');
  const username = useChatStore((s) => s.username);
  const isConnected = useChatStore((s) => s.isConnected);
  const profilePictureIndex = useChatStore((s) => s.profilePictureIndex);

  const handleSend = () => {
    const trimmed = text.trim();
    const usernameToShow = username || 'unnamed';
    if (!trimmed || !isConnected) return;

    const message = {
      id: crypto.randomUUID(),
      text: trimmed,
      sender: usernameToShow,
      timestamp: Date.now(),
      profilePictureIndex,
    };

    socket.emit('message', message);
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
        placeholder="Type a message..."
        disabled={!isConnected}
      />
      <button onClick={handleSend} disabled={!isConnected || !text.trim()}>
        Send
      </button>
    </div>
  );
}
