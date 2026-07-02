import React, { useId, useRef, useState } from 'react';
import { Image as ImageIcon, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { uploadProductImages } from '../../services/mediaUpload';

type ProductImageUploaderProps = {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
  showUrlInput?: boolean;
  compact?: boolean;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
};

export function ProductImageUploader({
  images,
  onImagesChange,
  maxImages = 12,
  showUrlInput = true,
  compact = false,
  onError,
  onSuccess,
}: ProductImageUploaderProps) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const remainingSlots = Math.max(0, maxImages - images.length);

  const openFilePicker = (event?: React.SyntheticEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (isUploading || remainingSlots === 0) return;
    fileInputRef.current?.click();
  };

  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((file) => file.type.startsWith('image/')).slice(0, remainingSlots);
    if (!files.length) {
      onError?.('Please choose JPG or PNG image files.');
      return;
    }

    setIsUploading(true);
    try {
      const uploadedUrls = await uploadProductImages(files);
      onImagesChange([...images, ...uploadedUrls].slice(0, maxImages));
      onSuccess?.(`Uploaded ${uploadedUrls.length} image${uploadedUrls.length === 1 ? '' : 's'}.`);
    } catch (error) {
      const localUrls = files.map((file) => URL.createObjectURL(file));
      onImagesChange([...images, ...localUrls].slice(0, maxImages));
      onError?.(
        error instanceof Error
          ? `${error.message} Showing local preview — configure Cloudinary before publishing.`
          : 'Upload failed. Showing local preview — configure Cloudinary before publishing.',
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.target.files?.length) {
      void handleFiles(event.target.files);
    }
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (event.dataTransfer.files?.length) {
      void handleFiles(event.dataTransfer.files);
    }
  };

  const addUrl = (event?: React.MouseEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    const next = urlInput.trim();
    if (!next) return;
    onImagesChange([...images, next].slice(0, maxImages));
    setUrlInput('');
    onSuccess?.('Image URL added.');
  };

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
        <input
          id={inputId}
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onInputChange}
        />
        {images.map((image, index) => (
          <div key={`${image}-${index}`} className="relative h-14 w-14 overflow-hidden rounded-lg border border-[#E5E7EB]">
            <img src={image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onImagesChange(images.filter((_, idx) => idx !== index));
              }}
              className="absolute right-0 top-0 bg-red-500 p-0.5 text-white"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        {remainingSlots > 0 && (
          <button
            type="button"
            disabled={isUploading}
            onClick={openFilePicker}
            className="flex h-14 w-14 flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#E5E7EB] bg-[#FAFAFA] text-orange-500 transition-colors hover:border-orange-500 hover:bg-orange-50 disabled:opacity-50"
            title="Upload photo"
          >
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3" onClick={(event) => event.stopPropagation()}>
      <input
        id={inputId}
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onInputChange}
      />

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            openFilePicker(event);
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragging(false);
        }}
        onDrop={onDrop}
        onClick={openFilePicker}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-5 text-center transition-colors ${
          isDragging ? 'border-orange-500 bg-orange-50/60' : 'border-[#E5E7EB] bg-[#FAFAFA] hover:border-orange-400 hover:bg-orange-50/40'
        } ${isUploading || remainingSlots === 0 ? 'pointer-events-none opacity-60' : ''}`}
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500">
          {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
        </div>
        <p className="text-xs font-black uppercase tracking-wider text-[#1A1A2E]">
          {isUploading ? 'Uploading photos...' : 'Click or drag photos here'}
        </p>
        <p className="mt-1 text-[11px] font-medium text-slate-500">
          JPG or PNG · up to {remainingSlots} more image{remainingSlots === 1 ? '' : 's'}
        </p>
        <span className="mt-4 inline-block rounded-xl bg-[#FF5B00] px-4 py-2 text-[10px] font-extrabold uppercase tracking-wider text-white">
          Browse Files
        </span>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {images.map((image, index) => (
            <div key={`${image}-${index}`} className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
              <div className="aspect-square bg-slate-50">
                <img src={image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="flex items-center gap-2 p-2">
                <div className="min-w-0 flex-1 truncate text-[10px] font-mono text-slate-500">{image}</div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onImagesChange(images.filter((_, idx) => idx !== index));
                  }}
                  className="rounded-lg bg-red-100/60 p-2 text-red-500 transition-colors hover:bg-red-500 hover:text-white"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showUrlInput && (
        <div className="flex gap-2">
          <input
            value={urlInput}
            onChange={(event) => setUrlInput(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            placeholder="Or paste an image HTTPS URL..."
            className="flex-1 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs text-[#1A1A2E] outline-none focus:border-orange-500"
          />
          <button
            type="button"
            onClick={addUrl}
            className="rounded-xl bg-[#1A1A2E] px-4 text-xs font-black uppercase text-white hover:bg-slate-800"
          >
            Add URL
          </button>
        </div>
      )}

      {images.length === 0 && (
        <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
          <ImageIcon className="h-4 w-4" />
          No photos yet. Click the box above to choose files from your computer.
        </div>
      )}
    </div>
  );
}
