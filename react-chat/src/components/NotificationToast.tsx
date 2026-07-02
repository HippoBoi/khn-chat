import { useEffect } from 'react';
import { useNotificationStore, type ToastNotification } from '../store/useNotificationStore';
import './NotificationToast.css';

const TOAST_DURATION_MS = 4000;

function ToastItem({ notification }: { notification: ToastNotification }) {
  const removeToast = useNotificationStore((s) => s.removeToast);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      removeToast(notification.id);
    }, TOAST_DURATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [notification.id, removeToast]);

  return (
    <div
      className={`toast-item toast-item--${notification.type}`}
      onClick={() => removeToast(notification.id)}
      role="alert"
    >
      <div className="toast-item-header">
        <span className="toast-item-title">{notification.title}</span>
        <button
          type="button"
          className="toast-item-close"
          onClick={(e) => {
            e.stopPropagation();
            removeToast(notification.id);
          }}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
      <p className="toast-item-body">{notification.body}</p>
    </div>
  );
}

export function NotificationToast() {
  const toasts = useNotificationStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((notification) => (
        <ToastItem key={notification.id} notification={notification} />
      ))}
    </div>
  );
}
