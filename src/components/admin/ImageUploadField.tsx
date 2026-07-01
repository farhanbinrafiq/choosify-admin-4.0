import React, { useRef } from 'react';
import { ImageIcon, Upload, Link as LinkIcon } from 'lucide-react';

type ImageUploadFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  helperText?: string;
  accept?: string;
  previewClassName?: string;
  compact?: boolean;
};

export function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ImageUploadField({
  label,
  value,
  onChange,
  placeholder = 'https://... or upload an image',
  helperText,
  accept = 'image/*',
  previewClassName = 'w-16 h-16',
  compact = false,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      onChange(dataUrl);
    } catch {
      onChange(URL.createObjectURL(file));
    }
    event.target.value = '';
  };

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      <label className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary block">
        {label}
      </label>
      <div className="flex items-start gap-3">
        <div
          className={`${previewClassName} rounded-lg bg-gray-50 border border-app-border overflow-hidden shrink-0 flex items-center justify-center`}
        >
          {value ? (
            <img src={value} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <ImageIcon className="w-5 h-5 text-app-text-secondary" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={value}
              placeholder={placeholder}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1 px-3 py-2 bg-white border border-app-border rounded-lg text-[12px] text-app-text-primary focus:outline-none focus:border-app-accent transition-colors"
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="px-3 py-2 bg-app-accent text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:opacity-90 transition-opacity flex items-center gap-1.5 shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload
            </button>
          </div>
          {helperText && <p className="text-[10px] text-app-text-secondary">{helperText}</p>}
          <div className="flex items-center gap-1 text-[10px] text-slate-500">
            <LinkIcon className="w-3 h-3" />
            Paste a URL or upload a local image
          </div>
        </div>
      </div>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleFileChange} />
    </div>
  );
}
