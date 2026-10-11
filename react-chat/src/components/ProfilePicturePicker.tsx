import { useRef, useState } from 'react';
import { PROFILE_PICTURES } from '../constants/profilePictures';
import api from '../services/api';
import { ProfilePictureCropModal } from './ProfilePictureCropModal';
import './ProfilePicturePicker.css';

const ACCEPTED_PROFILE_PICTURE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_PROFILE_PICTURE_SIZE_BYTES = 2 * 1024 * 1024;

interface ProfilePictureUploadResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

interface ProfilePicturePickerProps {
  selectedIndex: number;
  selectedUrl: string | null;
  uploadedUrl: string | null;
  isUploading: boolean;
  onUploadingChange: (uploading: boolean) => void;
  onPresetSelect: (index: number) => void;
  onUploadedSelect: () => void;
  onUploadComplete: (publicUrl: string) => void;
}

export function ProfilePicturePicker({
  selectedIndex,
  selectedUrl,
  uploadedUrl,
  isUploading,
  onUploadingChange,
  onPresetSelect,
  onUploadedSelect,
  onUploadComplete,
}: ProfilePicturePickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState('');
  const [fileToCrop, setFileToCrop] = useState<File | null>(null);

  const handleProfilePictureSelect = (index: number) => {
    setUploadError('');
    onPresetSelect(index);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleUploadedProfilePictureSelect = () => {
    setUploadError('');
    onUploadedSelect();
  };

  const uploadProfilePicture = async (file: File) => {
    try {
      setUploadError('');
      onUploadingChange(true);

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

      onUploadComplete(response.data.publicUrl);
      setFileToCrop(null);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Profile picture upload failed.');
      throw error;
    } finally {
      onUploadingChange(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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

    setUploadError('');
    setFileToCrop(file);
  };

  return (
    <>
      <div className="profile-picker">
        <p>Profile Picture</p>
        <div className="profile-picker-content">
          <div className="profile-picker-options">
            {PROFILE_PICTURES.map((pic, index) => (
              <button
                key={index}
                type="button"
                className={`profile-picker-option${
                  !selectedUrl && index === selectedIndex ? ' selected' : ''
                }`}
                onClick={() => handleProfilePictureSelect(index)}
              >
                <img src={pic} alt={`Profile ${index}`} />
              </button>
            ))}
            {uploadedUrl ? (
              <button
                type="button"
                className={`profile-picker-option profile-picker-custom${
                  selectedUrl ? ' selected' : ''
                }`}
                onClick={handleUploadedProfilePictureSelect}
                aria-label="Select uploaded profile picture"
                title="Select uploaded profile picture"
              >
                <img src={uploadedUrl} alt="Uploaded profile" />
              </button>
            ) : null}
            <button
              type="button"
              className="profile-picker-option profile-picker-upload"
              onClick={handleUploadClick}
              disabled={isUploading}
              aria-label="Upload profile picture"
              title="Upload profile picture"
            >
              <span aria-hidden="true">+</span>
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

      {fileToCrop ? (
        <ProfilePictureCropModal
          file={fileToCrop}
          isUploading={isUploading}
          onCancel={() => {
            setUploadError('');
            setFileToCrop(null);
          }}
          onConfirm={uploadProfilePicture}
        />
      ) : null}
    </>
  );
}
