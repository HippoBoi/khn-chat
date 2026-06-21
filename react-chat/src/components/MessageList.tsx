import { useEffect, useRef } from 'react';
import { useChatStore } from '../store/useChatStore';
import { PROFILE_PICTURES } from '../constants/profilePictures';
import type { Message } from '../types/message';
import './MessageList.css';
import api from '../services/api';

interface MessagesResponse {
  messages: Message[];
}

function getProfilePictureSrc(message: Message) {
  if (message.profilePictureUrl) {
    return message.profilePictureUrl;
  }

  return PROFILE_PICTURES[message.profilePictureIndex] ?? PROFILE_PICTURES[0];
}

const USER_ID_BADGE_COLOR_COUNT = 6;

function UserIdBadge({ userId }: { userId?: string | null }) {
  if (!userId) {
    return null;
  }

  const compactUserId = userId.replaceAll('-', '');
  const colorIndex = [...compactUserId].reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    0,
  ) % USER_ID_BADGE_COLOR_COUNT;
  const label = `#${compactUserId.slice(0, 6).toUpperCase()}`;

  return (
    <span
      className={`message-user-id message-user-id-${colorIndex}`}
      title={`Anonymous user ID: ${userId}`}
    >
      {label}
    </span>
  );
}

export function MessageList() {
  const messages = useChatStore((s) => s.messages);
  const setMessages = useChatStore((s) => s.setMessages);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      const response = await api.get<MessagesResponse>('/messages');
      setMessages(response.data.messages);
    };

    fetchMessages();
  }, [setMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="message-list">
      {messages.map((msg: Message) => (
        <div key={msg.id} className="message-item">
          <img
            className="message-profile-pic"
            src={getProfilePictureSrc(msg)}
            alt="profile"
          />
          <div className="message-content">
            <div className="message-header">
              <span className="message-sender">{msg.sender}</span>
              <UserIdBadge userId={msg.userId} />
            </div>
            <p className="message-text">{msg.text}</p>
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
