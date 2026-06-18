import { useRef, useState } from 'react';
import { useChatStore } from '../store/useChatStore';
import { PROFILE_PICTURES } from '../constants/profilePictures';
import api from '../services/api';
import './ProfilePicturePicker.css';

const ACCEPTED_PROFILE_PICTURE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_PROFILE_PICTURE_SIZE_BYTES = 2 * 1024 * 1024;

interface ProfilePictureUploadResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

export function ProfilePicturePicker() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const profilePictureIndex = useChatStore((s) => s.profilePictureIndex);
  const profilePictureUrl = useChatStore((s) => s.profilePictureUrl);
  const setProfilePictureIndex = useChatStore((s) => s.setProfilePictureIndex);
  const setProfilePictureUrl = useChatStore((s) => s.setProfilePictureUrl);

  const handleProfilePictureSelect = (index: number) => {
    setUploadError('');
    setProfilePictureIndex(index);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!ACCEPTED_PROFILE_PICTURE_TYPES.includes(file.type)) {
      setUploadError('Use a PNG, JPG, or WebP image.');
      return;
    }

    if (file.size > MAX_PROFILE_PICTURE_SIZE_BYTES) {
      setUploadError('Profile picture must be 2 MB or smaller.');
      return;
    }

    try {
      setUploadError('');
      setIsUploading(true);

      const response = await api.post<ProfilePictureUploadResponse>('/uploads/profile-picture', {
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      });

      const uploadResponse = await fetch(response.data.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error('Profile picture upload failed');
      }

      setProfilePictureUrl(response.data.publicUrl);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Profile picture upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="profile-picker">
      <p>Profile Picture</p>
      <div className="profile-picker-content">
        <div className="profile-picker-options">
          {PROFILE_PICTURES.map((pic, index) => (
            <button
              key={index}
              type="button"
              className={`profile-picker-option${
                !profilePictureUrl && index === profilePictureIndex ? ' selected' : ''
              }`}
              onClick={() => handleProfilePictureSelect(index)}
            >
              <img src={pic} alt={`Profile ${index}`} />
            </button>
          ))}
          <button
            type="button"
            className={`profile-picker-option profile-picker-upload${
              profilePictureUrl ? ' selected' : ''
            }`}
            onClick={handleUploadClick}
            disabled={isUploading}
            aria-label="Upload profile picture"
            title="Upload profile picture"
          >
            {profilePictureUrl ? (
              <img src={profilePictureUrl} alt="Uploaded profile" />
            ) : (
              <span aria-hidden="true">+</span>
            )}
          </button>
          <input
            ref={fileInputRef}
            className="profile-picker-file-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
          />
        </div>
        {uploadError ? <p className="profile-picker-error">{uploadError}</p> : null}
      </div>
    </div>
  );
}
