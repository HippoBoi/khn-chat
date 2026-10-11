import './AccountButton.css';
import { PROFILE_PICTURES } from '../constants/profilePictures';
import { useChatStore } from '../store/useChatStore';

interface AccountButtonProps {
  onClick: () => void;
}

export function AccountButton({ onClick }: AccountButtonProps) {
    const username = useChatStore((s) => s.username);
    const profilePictureIndex = useChatStore((s) => s.profilePictureIndex);
    const profilePictureUrl = useChatStore((s) => s.profilePictureUrl);

    const profilePictureSrc =
        profilePictureUrl ?? PROFILE_PICTURES[profilePictureIndex] ?? PROFILE_PICTURES[0];

    const displayName = username.length > 8 ? `${username.slice(0, 8)}…` : username;

    return (
        <button className="account-button" type="button" onClick={onClick} aria-label="Open account settings" title={username || 'Account'}>
            <img
                className="account-button-avatar"
                src={profilePictureSrc}
                alt={`${username || 'User'} profile picture`}
            />
            <p>{displayName}</p>
        </button>
    );
}