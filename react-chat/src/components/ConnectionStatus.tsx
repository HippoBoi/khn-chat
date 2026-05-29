import { useChatStore } from '../store/useChatStore';
import './ConnectionStatus.css';

export function ConnectionStatus() {
  const isConnected = useChatStore((s) => s.isConnected);

  return (
    <p className={`connection-status${isConnected ? ' is-connected' : ''}`}>
      <span className="connection-dot" aria-hidden="true" />
      {isConnected ? 'Connected' : 'Disconnected'}
    </p>
  );
}
