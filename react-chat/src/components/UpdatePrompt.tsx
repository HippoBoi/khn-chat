import type { AndroidVersionInfo } from '../services/appUpdate';
import './UpdatePrompt.css';

interface UpdatePromptProps {
  currentVersionName: string | null;
  latest: AndroidVersionInfo;
  onLater: () => void;
}

export function UpdatePrompt({ currentVersionName, latest, onLater }: UpdatePromptProps) {
  const handleUpdate = () => {
    window.open(latest.downloadUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="update-prompt-overlay" role="presentation">
      <div className="update-prompt" role="dialog" aria-modal="true" aria-label="Update available">
        <div className="update-prompt-header">
          <span className="update-prompt-title">Update available</span>
          <button
            type="button"
            className="update-prompt-close"
            onClick={onLater}
            aria-label="Dismiss update prompt"
          >
            X
          </button>
        </div>

        <p className="update-prompt-versions">
          {currentVersionName ? `You're on v${currentVersionName}. ` : ''}
          {latest.latestVersionName ? `v${latest.latestVersionName} is ready.` : 'A new version is ready.'}
        </p>

        {latest.message ? <p className="update-prompt-message">{latest.message}</p> : null}

        <div className="update-prompt-actions">
          <button type="button" className="update-prompt-later" onClick={onLater}>
            Later
          </button>

          <button type="button" className="update-prompt-update" onClick={handleUpdate}>
            Update now
          </button>
        </div>
      </div>
    </div>
  );
}
