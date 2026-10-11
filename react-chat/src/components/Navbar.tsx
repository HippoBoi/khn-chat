import { ConnectionStatus } from './ConnectionStatus';
import { usePushSubscription } from '../hooks/usePushSubscription';
import { Title } from './Title';
import './Navbar.css';

interface PushToggleProps {
  isSupported: boolean;
  isEnabled: boolean;
  isSubscribed: boolean;
  isSubscribing: boolean;
  onToggle: () => void;
}

function PushToggle({
  isSupported,
  isEnabled,
  isSubscribed,
  isSubscribing,
  onToggle,
}: PushToggleProps) {
  const active = isEnabled && isSubscribed;
  const label = isEnabled ? 'Disable push notifications' : 'Enable push notifications';

  return (
    <button
      type="button"
      className="push-toggle"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={active}
      aria-disabled={!isSupported || isSubscribing}
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

function Navbar() {
    const {
        isSupported: isPushSupported,
        isEnabled: isPushEnabled,
        isSubscribed: isPushSubscribed,
        isSubscribing: isPushSubscribing,
        toggle: togglePush,
    } = usePushSubscription();

    return (
        <div className="navbar">
            <Title />
            <PushToggle
              isSupported={isPushSupported}
              isEnabled={isPushEnabled}
              isSubscribed={isPushSubscribed}
              isSubscribing={isPushSubscribing}
              onToggle={togglePush}
            />
            <ConnectionStatus />
        </div>
    )
}

export default Navbar;