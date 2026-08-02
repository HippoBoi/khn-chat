import { useEffect, useRef, useState } from 'react';
import { useNotificationStore } from '../store/useNotificationStore';
import './NotificationInbox.css';

const NOTIFICATION_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

function formatNotificationTime(createdAt: number) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '';
  return NOTIFICATION_TIME_FORMATTER.format(date);
}

export function NotificationInbox() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);
  const markAllRead = useNotificationStore((s) => s.markAllRead);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleToggle = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) fetchNotifications();
  };

  return (
    <div className="notification-inbox" ref={containerRef}>
      <button
        type="button"
        className="notification-inbox-toggle"
        onClick={handleToggle}
        aria-label={isOpen ? 'Close notifications' : 'Open notifications'}
        aria-expanded={isOpen}
        title="Notifications"
      >
        <svg
          className="notification-inbox-bell"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 ? (
          <span className="notification-inbox-badge" aria-label={`${unreadCount} unread notifications`}>
            {unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="notification-inbox-panel" role="dialog" aria-label="Notifications">
          <div className="notification-inbox-header">
            <span className="notification-inbox-title">Notifications</span>
            {unreadCount > 0 ? (
              <button type="button" className="notification-inbox-mark-read" onClick={markAllRead}>
                Mark all read
              </button>
            ) : null}
          </div>
          <ul className="notification-inbox-list">
            {notifications.length === 0 ? (
              <li className="notification-inbox-empty">No notifications yet</li>
            ) : (
              notifications.map((notification) => (
                <li
                  key={notification.id}
                  className={`notification-inbox-item${
                    notification.isRead ? '' : ' notification-inbox-item--unread'
                  }`}
                >
                  <div className="notification-inbox-item-header">
                    <span className="notification-inbox-item-title">{notification.title}</span>
                    <time className="notification-inbox-item-time">
                      {formatNotificationTime(notification.createdAt)}
                    </time>
                  </div>
                  <p className="notification-inbox-item-body">{notification.body}</p>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
