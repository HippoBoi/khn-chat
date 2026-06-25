import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useChatStore } from '../store/useChatStore';
import { PROFILE_PICTURES } from '../constants/profilePictures';
import type { Message } from '../types/message';
import './MessageList.css';
import api from '../services/api';
import { getYouTubeVideoId, VIDEO_PLAYER_MEDIA_QUERY } from '../utils/youtube';

const URL_PATTERN = /https?:\/\/[^\s<>]+/gi;

interface MessagesResponse {
  messages: Message[];
}

interface MessageListProps {
  onYouTubeVideoSelect: (videoId: string) => void;
}

interface LinkifiedPart {
  text: string;
  url?: string;
}

interface TrimmedUrl {
  url: string;
  trailingText: string;
}

function isDownloadUrl(url: string): boolean {
  return /download|[?&](dl|raw)=/i.test(url);
}

function trimUrlPunctuation(candidate: string): TrimmedUrl {
  let url = candidate;
  let trailingText = '';

  while (/[.,!?;:'"]$/.test(url)) {
    trailingText = url.slice(-1) + trailingText;
    url = url.slice(0, -1);
  }

  const pairs = [
    ['(', ')'],
    ['[', ']'],
    ['{', '}'],
  ] as const;

  for (const [opening, closing] of pairs) {
    while (
      url.endsWith(closing) &&
      url.split(closing).length - 1 > url.split(opening).length - 1
    ) {
      trailingText = closing + trailingText;
      url = url.slice(0, -1);
    }
  }

  return { trailingText, url };
}

function splitMessageLinks(text: string): LinkifiedPart[] {
  const parts: LinkifiedPart[] = [];
  let previousEnd = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const matchIndex = match.index;
    if (matchIndex > previousEnd) {
      parts.push({ text: text.slice(previousEnd, matchIndex) });
    }

    const candidate = match[0];
    const { url, trailingText } = trimUrlPunctuation(candidate);
    parts.push({ text: url, url });
    if (trailingText) parts.push({ text: trailingText });
    previousEnd = matchIndex + candidate.length;
  }

  if (previousEnd < text.length) {
    parts.push({ text: text.slice(previousEnd) });
  }

  return parts;
}

function MessageText({
  text,
  onYouTubeVideoSelect,
}: {
  text: string;
  onYouTubeVideoSelect: (videoId: string) => void;
}) {
  const handleLinkClick = (event: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    const videoId = getYouTubeVideoId(url);
    if (!videoId || !window.matchMedia(VIDEO_PLAYER_MEDIA_QUERY).matches) return;

    event.preventDefault();
    onYouTubeVideoSelect(videoId);
  };

  return (
    <p className="message-text">
      {splitMessageLinks(text).map((part, index) =>
        part.url && !isDownloadUrl(part.url) ? (
          <a
            key={`${index}-${part.url}`}
            className="message-link"
            href={part.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => handleLinkClick(event, part.url!)}
          >
            {part.text}
          </a>
        ) : (
          part.text
        ),
      )}
    </p>
  );
}

function getProfilePictureSrc(message: Message) {
  if (message.profilePictureUrl) {
    return message.profilePictureUrl;
  }

  return PROFILE_PICTURES[message.profilePictureIndex] ?? PROFILE_PICTURES[0];
}

const USER_ID_BADGE_COLOR_COUNT = 6;
const MESSAGE_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'Etc/GMT+4',
});

function UserIdBadge({ userId }: { userId?: string | null }) {
  if (!userId) {
    return null;
  }

  const compactUserId = userId.replaceAll('-', '');
  const userIdHash = [...compactUserId].reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    0,
  );
  const colorIndex = userIdHash % USER_ID_BADGE_COLOR_COUNT;
  const label = userIdHash.toString(36).toUpperCase().padStart(6, '0').slice(-6);

  return (
    <span
      className={`message-user-id message-user-id-${colorIndex}`}
      aria-label={`Anonymous user ID: ${userId}`}
    >
      {label}
    </span>
  );
}

function MessageTimestamp({ timestamp }: { timestamp: number }) {
  const sentAt = new Date(timestamp);

  if (Number.isNaN(sentAt.getTime())) {
    return null;
  }

  return (
    <time
      className="message-timestamp"
      dateTime={sentAt.toISOString()}
      aria-label={`Sent at ${MESSAGE_TIME_FORMATTER.format(sentAt)}`}
    >
      {MESSAGE_TIME_FORMATTER.format(sentAt)}
    </time>
  );
}

export function MessageList({ onYouTubeVideoSelect }: MessageListProps) {
  const messages = useChatStore((s) => s.messages);
  const setMessages = useChatStore((s) => s.setMessages);
  const messageListRef = useRef<HTMLDivElement>(null);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);

  useEffect(() => {
    const fetchMessages = async () => {
      const response = await api.get<MessagesResponse>('/messages');
      setMessages(response.data.messages);
      setHasLoadedHistory(true);
    };

    fetchMessages();
  }, [setMessages]);

  useLayoutEffect(() => {
    if (!hasLoadedHistory || !messageListRef.current) return;

    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [hasLoadedHistory]);

  return (
    <div ref={messageListRef} className="message-list">
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
              <span className="message-metadata">
                <UserIdBadge userId={msg.userId} />
                <MessageTimestamp timestamp={msg.timestamp} />
              </span>
            </div>
            <MessageText text={msg.text} onYouTubeVideoSelect={onYouTubeVideoSelect} />
          </div>
        </div>
      ))}
    </div>
  );
}
