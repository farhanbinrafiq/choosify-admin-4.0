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
