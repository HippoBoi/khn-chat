import { useEffect, useState } from 'react';
import api from '../services/api';
import { useChatStore } from '../store/useChatStore';
import { UsernameForm, MAX_USERNAME_LENGTH } from './UsernameForm';
import { ProfilePicturePicker } from './ProfilePicturePicker';
import './AccountModal.css';

interface AccountModalProps {
  open: boolean;
  onClose: () => void;
}

export function AccountModal({ open, onClose }: AccountModalProps) {
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
    <div className="account-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="account-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Account settings"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="account-modal-header">
          <span className="account-modal-title">Account</span>
          <button
            type="button"
            className="account-modal-close"
            onClick={onClose}
            aria-label="Close account settings"
          >
            X
          </button>
        </div>
        <AccountModalBody onClose={onClose} />
      </div>
    </div>
  );
}

function AccountModalBody({ onClose }: { onClose: () => void }) {
  const userId = useChatStore((s) => s.userId);
  const username = useChatStore((s) => s.username);
  const profilePictureIndex = useChatStore((s) => s.profilePictureIndex);
  const profilePictureUrl = useChatStore((s) => s.profilePictureUrl);
  const uploadedProfilePictureUrl = useChatStore((s) => s.uploadedProfilePictureUrl);
  const setUsername = useChatStore((s) => s.setUsername);
  const setProfilePictureIndex = useChatStore((s) => s.setProfilePictureIndex);
  const setProfilePictureUrl = useChatStore((s) => s.setProfilePictureUrl);

  const [draftUsername, setDraftUsername] = useState(username);
  const [draftIndex, setDraftIndex] = useState(profilePictureIndex);
  const [draftUrl, setDraftUrl] = useState(profilePictureUrl);
  const [draftUploadedUrl, setDraftUploadedUrl] = useState(uploadedProfilePictureUrl);
  const [isUploading, setIsUploading] = useState(false);

  const trimmedUsername = draftUsername.trim();
  const isUsernameTooLong = trimmedUsername.length > MAX_USERNAME_LENGTH;
  const canSave = !isUploading && !isUsernameTooLong;

  const handleSave = () => {
    if (!canSave) return;

    if (trimmedUsername && !isUsernameTooLong && trimmedUsername !== username) {
      setUsername(trimmedUsername);
      if (userId) {
        api
          .put(`/users/${encodeURIComponent(userId)}`, { username: trimmedUsername })
          .catch(() => {});
      }
    }

    if (draftUrl) {
      setProfilePictureUrl(draftUrl);
    } else {
      if (draftUploadedUrl && draftUploadedUrl !== uploadedProfilePictureUrl) {
        setProfilePictureUrl(draftUploadedUrl);
      }
      setProfilePictureIndex(draftIndex);
    }

    onClose();
  };

  return (
    <>
      <section className="profile-settings" aria-label="Profile settings">
        <UsernameForm value={draftUsername} onChange={setDraftUsername} onSubmit={handleSave} />
        <ProfilePicturePicker
          selectedIndex={draftIndex}
          selectedUrl={draftUrl}
          uploadedUrl={draftUploadedUrl}
          isUploading={isUploading}
          onUploadingChange={setIsUploading}
          onPresetSelect={(index) => {
            setDraftIndex(index);
            setDraftUrl(null);
          }}
          onUploadedSelect={() => {
            setDraftUrl(draftUploadedUrl);
          }}
          onUploadComplete={(publicUrl) => {
            setDraftUploadedUrl(publicUrl);
            setDraftUrl(publicUrl);
          }}
        />
      </section>
      <button
        type="button"
        className="account-modal-save"
        onClick={handleSave}
        disabled={!canSave}
      >
        {isUploading ? 'Uploading...' : 'Save'}
      </button>
    </>
  );
}
