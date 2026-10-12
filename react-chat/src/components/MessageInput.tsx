import { useEffect, useMemo, useRef, useState } from 'react';
import { socket } from '../services/socket';
import { useChatStore } from '../store/useChatStore';
import { useConversationStore } from '../store/useConversationStore';
import { getUserIdLabel } from '../utils/userIdLabel';
import { API_BASE_URL } from '../services/api';
import type { ChatImage, Message } from '../types/message';
import './MessageInput.css';

const MAX_MESSAGE_CHARACTERS = 1000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
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
  const [image, setImage] = useState<ChatImage | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadControllerRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);
  const pendingMessageRef = useRef<(Omit<Message, 'timestamp'> & { imageId: string | null }) | null>(null);
  const mentionTokenStart = useRef(-1);
  const userId = useChatStore((s) => s.userId);
  const username = useChatStore((s) => s.username);
  const messages = useChatStore((s) => s.messages);
  const isConnected = useChatStore((s) => s.isConnected);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const profilePictureIndex = useChatStore((s) => s.profilePictureIndex);
  const profilePictureUrl = useChatStore((s) => s.profilePictureUrl);
  const addMessage = useChatStore((s) => s.addMessage);
  const isOverCharacterLimit = text.length > MAX_MESSAGE_CHARACTERS;

  useEffect(() => () => uploadControllerRef.current?.abort(), []);

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    let file = event.target.files?.[0];
    event.target.value = '';
    if (!file || uploadControllerRef.current || sendingRef.current) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setSendError('Image must be 5 MB or less.');
      return;
    }

    const controller = new AbortController();
    uploadControllerRef.current = controller;
    setIsUploading(true);
    setSendError('');

    try {
      if (/\.(heic|heif)$/i.test(file.name) || /^image\/hei[cf]/i.test(file.type)) {
        const { heicTo } = await import('heic-to');
        const blob = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.9 });
        file = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
      }
      if (controller.signal.aborted) return;

      if (file.size > MAX_IMAGE_BYTES) throw new Error('Image must be 5 MB or less.');

      const params = new URLSearchParams({ userId, conversationId: activeConversationId });
      const response = await fetch(`${API_BASE_URL}/uploads/chat-image/file?${params}`, {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
        signal: controller.signal,
      });

      const result = await response.json() as { image?: ChatImage; error?: string };

      if (!response.ok || !result.image) throw new Error(result.error || 'Image upload failed.');
      if (controller.signal.aborted) return;

      setImage(result.image);
      pendingMessageRef.current = null;

    } catch (error) {
      if (!controller.signal.aborted) {
        setSendError(error instanceof Error ? error.message : 'Image upload failed.');
      }
    } finally {
      uploadControllerRef.current = null;
      setIsUploading(false);
    }
  };

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
    pendingMessageRef.current = null;
    setSendError('');

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
    pendingMessageRef.current = null;
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
    if ((!trimmed && !image) || !isConnected || isOverCharacterLimit ||
        uploadControllerRef.current || sendingRef.current) return;

    const message = pendingMessageRef.current || {
      id: crypto.randomUUID(),
      text: trimmed,
      sender: usernameToShow,
      userId,
      profilePictureIndex,
      profilePictureUrl,
      pingedUserIds: resolvePingedUserIds(trimmed),
      conversationId: activeConversationId,
      imageId: image?.id || null,
    };

    pendingMessageRef.current = message;
    sendingRef.current = true;
    setIsSending(true);
    setSendError('');
    setMentionOpen(false);
    socket.timeout(10000).emit('message', message, (
      error: Error | null,
      response?: { ok: boolean; message?: Message; error?: string },
    ) => {
      sendingRef.current = false;
      setIsSending(false);
      if (error || !response?.ok || !response.message) {
        setSendError(response?.error || 'Could not confirm your message. Please retry.');
        return;
      }
      if (useConversationStore.getState().activeConversationId === activeConversationId) {
        addMessage(response.message);
      }
      setText('');
      setImage(null);
      pendingMessageRef.current = null;
    });
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
      {image && (
        <div className="message-image-preview">
          <img src={image.url} alt="Image ready to send" width={image.width} height={image.height} />
          <button type="button" disabled={isUploading || isSending} onClick={() => {
            setImage(null);
            pendingMessageRef.current = null;
            setSendError('');
          }} aria-label="Remove image">Remove</button>
        </div>
      )}
      {isUploading && (
        <div className="message-upload-status" role="status">
          Uploading image...
          <button type="button" onClick={() => uploadControllerRef.current?.abort()}>Cancel</button>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.png,.jpg,.jpeg,.webp,.heic,.heif"
        onChange={handleImageSelect}
      />
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
        <button
          type="button"
          className="action-button"
          onClick={() => fileInputRef.current?.click()}
          disabled={!isConnected || isUploading || isSending}
          aria-label="Upload image"
          title="Upload image">
          <i className="fa-solid fa-image" aria-hidden="true"></i>
        </button>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className={isOverCharacterLimit ? 'message-input-error' : undefined}
          placeholder="..."
          disabled={!isConnected || isSending}
          aria-invalid={isOverCharacterLimit}
          aria-describedby={isOverCharacterLimit ? 'message-character-error' : undefined}
        />
        <button
          type="button"
          className="message-send-button fa-solid fa-play"
          onClick={handleSend}
          disabled={!isConnected || (!text.trim() && !image) || isOverCharacterLimit || isUploading || isSending}
          aria-label="Send message"
          title="Send message"
        >
        </button>
      </div>
      {sendError && <p className="message-upload-error" role="alert">{sendError}</p>}
      {isOverCharacterLimit && (
        <p id="message-character-error" className="message-character-error">
          Your message is too long.
        </p>
      )}
    </div>
  );
}