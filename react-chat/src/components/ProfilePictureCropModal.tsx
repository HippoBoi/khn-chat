import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AvatarEditor, { type AvatarEditorRef } from 'react-avatar-editor';
import './ProfilePictureCropModal.css';

const AVATAR_CROP_SIZE = 320;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.01;
const OUTPUT_CONTENT_TYPE = 'image/webp';
const OUTPUT_QUALITY = 0.9;

interface ProfilePictureCropModalProps {
  file: File;
  isUploading: boolean;
  onCancel: () => void;
  onConfirm: (file: File) => Promise<void>;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not prepare the cropped profile picture.'));
          return;
        }

        resolve(blob);
      },
      OUTPUT_CONTENT_TYPE,
      OUTPUT_QUALITY,
    );
  });
}

function buildCroppedFileName(fileName: string, contentType: string) {
  const extension = contentType === 'image/png' ? 'png' : contentType === 'image/jpeg' ? 'jpg' : 'webp';
  const baseName = fileName.replace(/\.[^/.]+$/, '') || 'profile-picture';

  return `${baseName}-cropped.${extension}`;
}

export function ProfilePictureCropModal({
  file,
  isUploading,
  onCancel,
  onConfirm,
}: ProfilePictureCropModalProps) {
  const editorRef = useRef<AvatarEditorRef>(null);
  const [zoom, setZoom] = useState(1.2);
  const [cropError, setCropError] = useState('');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isUploading) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isUploading, onCancel]);

  const handleConfirm = async () => {
    const canvas = editorRef.current?.getImageScaledToCanvas();

    if (!canvas) {
      setCropError('Move the image into position before saving.');
      return;
    }

    try {
      setCropError('');

      const blob = await canvasToBlob(canvas);
      const contentType = blob.type || OUTPUT_CONTENT_TYPE;
      const croppedFile = new File([blob], buildCroppedFileName(file.name, contentType), {
        type: contentType,
        lastModified: Date.now(),
      });

      await onConfirm(croppedFile);
    } catch (error) {
      setCropError(error instanceof Error ? error.message : 'Could not crop the profile picture.');
    }
  };

  return createPortal(
    <div className="profile-crop-backdrop" role="presentation">
      <section
        className="profile-crop-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-crop-title"
      >
        <div className="profile-crop-header">
          <h2 id="profile-crop-title">Adjust Profile Picture</h2>
          <button
            type="button"
            className="profile-crop-icon-button"
            onClick={onCancel}
            disabled={isUploading}
            aria-label="Close crop editor"
          >
            x
          </button>
        </div>

        <div className="profile-crop-editor">
          <AvatarEditor
            ref={editorRef}
            image={file}
            width={AVATAR_CROP_SIZE}
            height={AVATAR_CROP_SIZE}
            border={36}
            borderRadius={AVATAR_CROP_SIZE / 2}
            color={[15, 23, 42, 0.58]}
            borderColor={[255, 255, 255, 0.65]}
            scale={zoom}
            showGrid
          />
        </div>

        <div className="profile-crop-controls">
          <label className="profile-crop-zoom">
            <span>Zoom</span>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={ZOOM_STEP}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              disabled={isUploading}
            />
          </label>
        </div>

        {cropError ? <p className="profile-crop-error">{cropError}</p> : null}

        <div className="profile-crop-actions">
          <button
            type="button"
            className="profile-crop-secondary"
            onClick={onCancel}
            disabled={isUploading}
          >
            Cancel
          </button>
          <button type="button" onClick={handleConfirm} disabled={isUploading}>
            {isUploading ? 'Uploading...' : 'Save Picture'}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
