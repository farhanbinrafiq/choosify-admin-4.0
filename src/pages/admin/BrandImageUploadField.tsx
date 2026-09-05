import React, { useCallback, useRef, useState } from 'react';
import { Image as ImageIcon, Loader2, Pencil, Trash2, Upload } from 'lucide-react';
import { dataUrlToFile, uploadBrandImage } from '../../services/mediaUpload';
import { BrandLogoCropModal } from '../../components/brand/BrandLogoCropModal';

type BrandImageUploadFieldProps = {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  /** `banner` = wide cover; `logo` = square tile; `avatar` = circular tile */
  variant?: 'banner' | 'logo' | 'avatar';
  /** Fill parent (hero overlay); parent must be position:relative */
  embedded?: boolean;
  className?: string;
  /** Override upload target (default: brand Cloudinary folder) */
  uploadFn?: (file: File) => Promise<string>;
};

export function BrandImageUploadField({
  value,
  onChange,
  label,
  variant = 'banner',
  embedded = false,
  className = '',
  uploadFn = uploadBrandImage,
}: BrandImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showUrlPaste, setShowUrlPaste] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState('');

  const isLogo = variant === 'logo';
  const isAvatar = variant === 'avatar';
  const isRoundTile = isLogo || isAvatar;

  const runUpload = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;
      setError(null);
      setUploading(true);
      try {
        const url = await uploadFn(file);
        onChange(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [onChange, uploadFn],
  );

  // Brand logos never upload the raw file directly — a seller/admin frames
  // the useful logo area first (never a forced square crop; the modal lets
  // them pick square/wide/tall). Cover images are unaffected: this only
  // gates the `logo` variant, per "do not run the brand cover through the
  // logo crop workflow."
  const pickLogoFile = useCallback((file: File | null | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(String(reader.result || ''));
      setCropOpen(true);
    };
    reader.onerror = () => setError('Could not read this file.');
    reader.readAsDataURL(file);
  }, []);

  const onCropSave = useCallback(
    (dataUrl: string) => {
      setCropOpen(false);
      setCropSrc('');
      void runUpload(dataUrlToFile(dataUrl, 'brand-logo.png'));
    },
    [runUpload],
  );

  const onCropCancel = useCallback(() => {
    setCropOpen(false);
    setCropSrc('');
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const handleFilePicked = isLogo ? pickLogoFile : runUpload;

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    void handleFilePicked(e.dataTransfer.files?.[0]);
  };

  if (embedded) {
    const controls =
      isRoundTile ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-black/0 hover:bg-black/35 transition-colors group/logo">
          <button
            type="button"
            disabled={uploading}
            title={value ? 'Replace image' : 'Upload image'}
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
            className="opacity-90 group-hover/logo:opacity-100 inline-flex items-center justify-center w-7 h-7 bg-white border border-slate-200 text-slate-700 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
          {isLogo && value ? (
            <button
              type="button"
              title="Edit logo framing"
              onClick={(e) => {
                e.stopPropagation();
                setCropSrc(value);
                setCropOpen(true);
              }}
              className="opacity-0 group-hover/logo:opacity-100 inline-flex items-center justify-center w-7 h-7 bg-white border border-slate-200 text-slate-700 rounded-lg shadow-sm cursor-pointer"
            >
              <Pencil className="w-3 h-3" />
            </button>
          ) : null}
          {value ? (
            <button
              type="button"
              title="Remove image"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="opacity-0 group-hover/logo:opacity-100 inline-flex items-center justify-center w-7 h-7 bg-white border border-slate-200 text-red-600 rounded-lg shadow-sm cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          ) : null}
        </div>
      ) : (
        <div className="absolute bottom-2 right-2 z-10 flex gap-1.5">
          <button
            type="button"
            disabled={uploading}
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
            className="inline-flex items-center gap-1 px-2 py-1 bg-white/95 border border-slate-200 text-[9px] font-bold text-slate-700 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Upload className="w-3 h-3" />
            {value ? 'Replace' : 'Upload'}
          </button>
          {value ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="inline-flex items-center px-2 py-1 bg-white/95 border border-slate-200 text-[9px] font-bold text-red-600 rounded-lg shadow-sm cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          ) : null}
        </div>
      );

    return (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`absolute inset-0 z-[1] ${isAvatar ? 'rounded-full' : ''} ${dragOver ? 'ring-2 ring-[#FF5B00] ring-inset' : ''} ${className}`}
      >
        {uploading && (
          <div className={`absolute inset-0 z-20 bg-white/80 flex items-center justify-center ${isAvatar ? 'rounded-full' : ''}`}>
            <Loader2 className="w-5 h-5 animate-spin text-[#FF5B00]" />
          </div>
        )}
        {controls}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleFilePicked(e.target.files?.[0])}
        />
        {error && (
          <p className="absolute bottom-10 left-2 right-2 z-20 text-[10px] font-medium text-red-600 bg-white/90 rounded px-2 py-1">
            {error}
          </p>
        )}
        {isLogo && (
          <BrandLogoCropModal open={cropOpen} imageSrc={cropSrc} onCancel={onCropCancel} onSave={onCropSave} />
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        {label ? (
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{label}</span>
        ) : (
          <span />
        )}
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-[10px] font-bold text-red-600 hover:text-red-700 flex items-center gap-1 bg-transparent border-none cursor-pointer"
          >
            <Trash2 className="w-3 h-3" /> Remove
          </button>
        ) : null}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative overflow-hidden border-2 border-dashed transition-colors ${
          isAvatar
            ? 'rounded-full aspect-square w-full max-w-[112px]'
            : isLogo
              ? 'rounded-2xl aspect-square w-full max-w-[112px]'
              : 'rounded-xl w-full h-28'
        } ${dragOver ? 'border-[#FF5B00] bg-orange-50' : 'border-slate-200 bg-slate-50'}`}
      >
        {value ? (
          <img
            src={value}
            alt=""
            className={`absolute inset-0 w-full h-full ${isLogo ? 'object-contain p-1.5' : 'object-cover'}`}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-400 px-2 text-center">
            <ImageIcon className="w-5 h-5" />
            <span className="text-[9px] font-bold uppercase">Drop image</span>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-[#FF5B00]" />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-[#FF5B00] text-[10px] font-bold text-slate-700 rounded-lg cursor-pointer disabled:opacity-50"
        >
          <Upload className="w-3 h-3" />
          {value ? 'Replace' : 'Choose file'}
        </button>
        {isLogo && value ? (
          <button
            type="button"
            disabled={uploading}
            onClick={() => {
              setCropSrc(value);
              setCropOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-[#FF5B00] text-[10px] font-bold text-slate-700 rounded-lg cursor-pointer disabled:opacity-50"
          >
            <Pencil className="w-3 h-3" />
            Edit logo
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setShowUrlPaste((v) => !v)}
          className="text-[10px] font-bold text-slate-500 hover:text-[#FF5B00] bg-transparent border-none cursor-pointer underline-offset-2 hover:underline"
        >
          {showUrlPaste ? 'Hide URL' : 'Paste URL instead'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleFilePicked(e.target.files?.[0])}
        />
      </div>

      {showUrlPaste && (
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
          className="w-full p-2 border rounded-xl text-xs bg-white border-slate-200 text-slate-700"
        />
      )}

      {error && <p className="text-[10px] font-medium text-red-600">{error}</p>}

      {isLogo && (
        <BrandLogoCropModal open={cropOpen} imageSrc={cropSrc} onCancel={onCropCancel} onSave={onCropSave} />
      )}
    </div>
  );
}
