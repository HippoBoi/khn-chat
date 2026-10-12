import { useEffect } from 'react';
import { usePushSubscriptionState } from '../context/PushSubscriptionContext';
import { PushToggle } from './PushToggle';
import './SettingsModal.css';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { isSupported, isEnabled, isSubscribed, isSubscribing, toggle } = usePushSubscriptionState();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="settings-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="settings-modal-header">
          <span className="settings-modal-title">Settings</span>
          <button
            type="button"
            className="settings-modal-close"
            onClick={onClose}
            aria-label="Close settings"
          >
            X
          </button>
        </div>
        <div className="settings-modal-row">
          <span className="settings-modal-label">Notifications</span>
          <PushToggle
            isSupported={isSupported}
            isEnabled={isEnabled}
            isSubscribed={isSubscribed}
            isSubscribing={isSubscribing}
            onToggle={toggle}
          />
        </div>
      </div>
    </div>
  );
}
