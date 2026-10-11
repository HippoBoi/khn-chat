import { useRef, useState } from 'react';
import { PROFILE_PICTURES } from '../constants/profilePictures';
import { API_BASE_URL } from '../services/api';
import { ProfilePictureCropModal } from './ProfilePictureCropModal';
import './ProfilePicturePicker.css';

const ACCEPTED_PROFILE_PICTURE_INPUT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
];
const PROFILE_PICTURE_INPUT_ALIASES: Record<string, string> = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-jpeg': 'image/jpeg',
  'image/x-png': 'image/png',
};
const HEIC_INPUT_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);
const HEIC_FILE_EXTENSIONS = new Set(['heic', 'heif']);
const ACCEPTED_PROFILE_PICTURE_UPLOAD_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_PROFILE_PICTURE_UPLOAD_BYTES = 2 * 1024 * 1024;
const MAX_PROFILE_PICTURE_INPUT_BYTES = 25 * 1024 * 1024;

interface ProfilePictureUploadResponse {
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
  const [isConverting, setIsConverting] = useState(false);

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

      const contentType = normalizeProfilePictureContentType(file.type, file.name);

      if (!contentType || !ACCEPTED_PROFILE_PICTURE_UPLOAD_TYPES.includes(contentType)) {
        throw new Error('Use a PNG, JPG, or WebP image.');
      }

      if (file.size > MAX_PROFILE_PICTURE_UPLOAD_BYTES) {
        throw new Error('Profile picture must be 2 MB or smaller.');
      }

      // Upload through the backend (same origin as the API) instead of PUTting
      // directly to S3: native app origins are rejected by the bucket's CORS
      // policy, which surfaces as "Failed to fetch" on mobile.
      const uploadResponse = await fetch(
        `${API_BASE_URL}/uploads/profile-picture/file?fileName=${encodeURIComponent(file.name)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': contentType,
          },
          body: file,
        },
      );

      if (!uploadResponse.ok) {
        throw new Error(await readUploadErrorMessage(uploadResponse));
      }

      const result = (await uploadResponse.json()) as ProfilePictureUploadResponse;

      if (!result.publicUrl) {
        throw new Error('Profile picture upload failed');
      }

      onUploadComplete(result.publicUrl);
      setFileToCrop(null);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Profile picture upload failed.');
      throw error;
    } finally {
      onUploadingChange(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (file.size > MAX_PROFILE_PICTURE_INPUT_BYTES) {
      setUploadError('That photo is too large. Pick a smaller image.');
      return;
    }

    const contentType = normalizeProfilePictureContentType(file.type, file.name);

    if (!contentType || !ACCEPTED_PROFILE_PICTURE_INPUT_TYPES.includes(contentType)) {
      setUploadError('Use a PNG, JPG, or WebP image.');
      return;
    }

    if (HEIC_INPUT_TYPES.has(contentType) || HEIC_FILE_EXTENSIONS.has(getFileExtension(file.name))) {
      try {
        setIsConverting(true);
        setUploadError('');
        setFileToCrop(await convertHeicToJpeg(file));
      } catch {
        setUploadError('Could not read that photo. Use a PNG or JPG image.');
      } finally {
        setIsConverting(false);
      }

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
              disabled={isUploading || isConverting}
              aria-label="Upload profile picture"
              title="Upload profile picture"
            >
              <span aria-hidden="true">+</span>
            </button>
            <input
              ref={fileInputRef}
              className="profile-picker-file-input"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif,image/heic,image/heif,.png,.jpg,.jpeg,.webp,.avif,.heic,.heif"
              onChange={handleFileChange}
            />
          </div>
          {isConverting ? <p className="profile-picker-status">Preparing photo...</p> : null}
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

function getFileExtension(fileName: string): string {
  const trimmed = fileName.trim().toLowerCase();
  const dotIndex = trimmed.lastIndexOf('.');

  if (dotIndex === -1) {
    return '';
  }

  return trimmed.slice(dotIndex + 1);
}

function inferProfilePictureTypeFromExtension(fileName: string): string | null {
  const extension = getFileExtension(fileName);

  if (extension === 'png') {
    return 'image/png';
  }

  if (extension === 'jpg' || extension === 'jpeg') {
    return 'image/jpeg';
  }

  if (extension === 'webp') {
    return 'image/webp';
  }

  if (extension === 'avif') {
    return 'image/avif';
  }

  if (HEIC_FILE_EXTENSIONS.has(extension)) {
    return 'image/heic';
  }

  return null;
}

function normalizeProfilePictureContentType(type: string, fileName: string): string | null {
  let normalized = type.trim().toLowerCase().split(';')[0].trim();

  if (PROFILE_PICTURE_INPUT_ALIASES[normalized]) {
    normalized = PROFILE_PICTURE_INPUT_ALIASES[normalized];
  }

  if (!normalized || normalized === 'application/octet-stream') {
    return inferProfilePictureTypeFromExtension(fileName);
  }

  return normalized;
}

async function convertHeicToJpeg(file: File): Promise<File> {
  const { heicTo } = await import('heic-to');
  const blob = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 });
  const baseName = file.name.replace(/\.[^/.]+$/, '') || 'profile-picture';

  return new File([blob], `${baseName}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

async function readUploadErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: unknown };

    if (payload && typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error;
    }
  } catch {
    // Fall through to the generic message below.
  }

  return 'Profile picture upload failed';
}
