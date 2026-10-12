import './PushToggle.css';

interface PushToggleProps {
  isSupported: boolean;
  isEnabled: boolean;
  isSubscribed: boolean;
  isSubscribing: boolean;
  onToggle: () => void;
}

export function PushToggle({
  isSupported,
  isEnabled,
  isSubscribed,
  isSubscribing,
  onToggle,
}: PushToggleProps) {
  const active = isEnabled && isSubscribed;
  const label = active ? 'Disable push notifications' : 'Enable push notifications';

  return (
    <button
      type="button"
      className="push-toggle"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={active}
      aria-disabled={!isSupported || isSubscribing}
      disabled={!isSupported || isSubscribing}
      title={isSupported ? label : 'Push notifications not supported in this browser'}
    >
      <span className="push-toggle-track" aria-hidden="true">
        <span className="push-toggle-thumb">
          <svg
            className="push-toggle-bell"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        </span>
      </span>
    </button>
  );
}
