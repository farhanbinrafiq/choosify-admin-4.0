const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

function readMaxUploadBytes(): number {
  const raw = process.env.UPLOAD_MAX_BYTES;
  if (!raw?.trim()) return DEFAULT_MAX_BYTES;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_BYTES;
  return Math.floor(parsed);
}

function estimateBase64Bytes(base64Data: string): number {
  const normalized = base64Data.includes(',') ? base64Data.split(',').pop() || '' : base64Data;
  return Math.floor((normalized.length * 3) / 4);
}

function extensionFromFileName(fileName: string): string {
  const index = fileName.lastIndexOf('.');
  if (index === -1) return '';
  return fileName.slice(index).toLowerCase();
}

export type UploadValidationInput = {
  base64Data: string;
  mimeType?: string;
  fileName?: string;
};

export function validateImageUploadInput(input: UploadValidationInput): {
  ok: true;
  mimeType: string;
  fileName: string;
  estimatedBytes: number;
} | {
  ok: false;
  error: string;
} {
  const base64Data = input.base64Data?.trim();
  if (!base64Data) {
    return { ok: false, error: 'Missing image data' };
  }

  const mimeType = (input.mimeType || 'image/jpeg').trim().toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return { ok: false, error: 'Unsupported image MIME type' };
  }

  const fileName = (input.fileName || 'product-image').trim();
  const extension = extensionFromFileName(fileName);
  if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
    return { ok: false, error: 'Unsupported image file extension' };
  }

  const estimatedBytes = estimateBase64Bytes(base64Data);
  const maxBytes = readMaxUploadBytes();
  if (estimatedBytes > maxBytes) {
    return { ok: false, error: `Image exceeds maximum upload size of ${maxBytes} bytes` };
  }

  return { ok: true, mimeType, fileName, estimatedBytes };
}

const ALLOWED_VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/webm']);
const ALLOWED_VIDEO_EXTENSIONS = new Set(['.mp4', '.webm']);
const DEFAULT_VIDEO_MAX_BYTES = 50 * 1024 * 1024; // 50MB — a deliberate beta-scale ceiling, not a streaming platform

function readMaxVideoUploadBytes(): number {
  const raw = process.env.VIDEO_UPLOAD_MAX_BYTES;
  if (!raw?.trim()) return DEFAULT_VIDEO_MAX_BYTES;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_VIDEO_MAX_BYTES;
  return Math.floor(parsed);
}

/**
 * No live upload surface accepts video today (product "video" is a pasted
 * embed URL — see Phase 9 of the pre-VPS audit). This validator exists so
 * the storage/validation pipeline is ready the moment a real video-upload
 * feature is built, without inventing UI that doesn't exist yet.
 */
export function validateVideoUploadInput(input: UploadValidationInput): {
  ok: true;
  mimeType: string;
  fileName: string;
  estimatedBytes: number;
} | {
  ok: false;
  error: string;
} {
  const base64Data = input.base64Data?.trim();
  if (!base64Data) {
    return { ok: false, error: 'Missing video data' };
  }

  const mimeType = (input.mimeType || 'video/mp4').trim().toLowerCase();
  if (!ALLOWED_VIDEO_MIME_TYPES.has(mimeType)) {
    return { ok: false, error: 'Unsupported video type. Upload MP4 or WebM.' };
  }

  const fileName = (input.fileName || 'video.mp4').trim();
  const extension = extensionFromFileName(fileName);
  if (!extension || !ALLOWED_VIDEO_EXTENSIONS.has(extension)) {
    return { ok: false, error: 'Unsupported video file extension. Use .mp4 or .webm.' };
  }

  const estimatedBytes = estimateBase64Bytes(base64Data);
  const maxBytes = readMaxVideoUploadBytes();
  if (estimatedBytes > maxBytes) {
    return { ok: false, error: `Video exceeds the maximum upload size of ${Math.round(maxBytes / (1024 * 1024))}MB` };
  }

  return { ok: true, mimeType, fileName, estimatedBytes };
}

const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const ALLOWED_DOCUMENT_EXTENSIONS = new Set(['.pdf', '.doc', '.docx']);
const DEFAULT_RESUME_MAX_BYTES = 8 * 1024 * 1024;

/** PDF/DOC + images for brand/creator claim verification (trade license, NID, face photo). */
const ALLOWED_VERIFICATION_MIME_TYPES = new Set([
  ...ALLOWED_DOCUMENT_MIME_TYPES,
  ...ALLOWED_MIME_TYPES,
]);

const ALLOWED_VERIFICATION_EXTENSIONS = new Set([
  ...ALLOWED_DOCUMENT_EXTENSIONS,
  ...ALLOWED_EXTENSIONS,
]);

export function validateDocumentUploadInput(input: UploadValidationInput): {
  ok: true;
  mimeType: string;
  fileName: string;
  estimatedBytes: number;
} | {
  ok: false;
  error: string;
} {
  const base64Data = input.base64Data?.trim();
  if (!base64Data) {
    return { ok: false, error: 'Missing document data' };
  }

  const mimeType = (input.mimeType || 'application/pdf').trim().toLowerCase();
  if (!ALLOWED_DOCUMENT_MIME_TYPES.has(mimeType)) {
    return { ok: false, error: 'Unsupported document type. Upload PDF, DOC, or DOCX.' };
  }

  const fileName = (input.fileName || 'resume.pdf').trim();
  const extension = extensionFromFileName(fileName);
  if (!extension || !ALLOWED_DOCUMENT_EXTENSIONS.has(extension)) {
    return { ok: false, error: 'Unsupported document extension. Use .pdf, .doc, or .docx.' };
  }

  const estimatedBytes = estimateBase64Bytes(base64Data);
  const maxBytes = Math.max(readMaxUploadBytes(), DEFAULT_RESUME_MAX_BYTES);
  if (estimatedBytes > maxBytes) {
    return { ok: false, error: `Document exceeds maximum upload size of ${maxBytes} bytes` };
  }

  return { ok: true, mimeType, fileName, estimatedBytes };
}

export function validateVerificationUploadInput(input: UploadValidationInput): {
  ok: true;
  mimeType: string;
  fileName: string;
  estimatedBytes: number;
  kind: 'image' | 'document';
} | {
  ok: false;
  error: string;
} {
  const base64Data = input.base64Data?.trim();
  if (!base64Data) {
    return { ok: false, error: 'Missing verification file data' };
  }

  const mimeType = (input.mimeType || 'application/pdf').trim().toLowerCase();
  if (!ALLOWED_VERIFICATION_MIME_TYPES.has(mimeType)) {
    return {
      ok: false,
      error: 'Unsupported file type. Upload PDF/DOC/DOCX or JPEG/PNG/WebP/GIF.',
    };
  }

  const fileName = (input.fileName || 'verification-doc').trim();
  const extension = extensionFromFileName(fileName);
  if (!extension || !ALLOWED_VERIFICATION_EXTENSIONS.has(extension)) {
    return {
      ok: false,
      error: 'Unsupported file extension. Use .pdf, .doc, .docx, .jpg, .jpeg, .png, .webp, or .gif.',
    };
  }

  const estimatedBytes = estimateBase64Bytes(base64Data);
  const maxBytes = Math.max(readMaxUploadBytes(), DEFAULT_RESUME_MAX_BYTES);
  if (estimatedBytes > maxBytes) {
    return { ok: false, error: `File exceeds maximum upload size of ${maxBytes} bytes` };
  }

  const kind = ALLOWED_MIME_TYPES.has(mimeType) ? 'image' : 'document';
  return { ok: true, mimeType, fileName, estimatedBytes, kind };
}
