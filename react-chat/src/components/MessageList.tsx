import { useEffect, useRef } from 'react';
import { useChatStore } from '../store/useChatStore';
import { PROFILE_PICTURES } from '../constants/profilePictures';
import type { Message } from '../types/message';
import './MessageList.css';
import api from '../services/api';

interface MessagesResponse {
  messages: Message[];
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
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="message-list">
      {messages.map((msg: Message) => (
        <div key={msg.id} className="message-item">
          <img
            className="message-profile-pic"
            src={PROFILE_PICTURES[msg.profilePictureIndex ?? 0]}
            alt="profile"
          />
          <strong>{msg.sender}</strong>: {msg.text}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
