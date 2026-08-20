/**
 * Pre-VPS self-hosting pass — single chokepoint every upload endpoint calls
 * through. Decides local-disk (core, default) vs Cloudinary (optional,
 * legacy) based on MEDIA_STORAGE_PROVIDER, so the three route handlers stay
 * thin and identical in shape regardless of provider.
 *
 * Private categories (verification/identity-documents/seller-documents/
 * creator-documents) are ALWAYS stored locally, never via Cloudinary,
 * regardless of MEDIA_STORAGE_PROVIDER — a Cloudinary URL is fetchable by
 * anyone who has it, which is incompatible with "private documents must
 * never be exposed through an unauthenticated static URL." Only our own
 * authenticated GET /catalog/media/private/:id route can honor that.
 */
import { uploadDocumentToCloudinary, uploadImageToCloudinary } from '../../lib/vercel-catalog/mediaUpload';
import { processImage } from '../lib/imageProcessing';
import {
  isMediaCategory,
  mediaTypeForMimeType,
  saveMediaFile,
  visibilityForCategory,
  type MediaCategory,
} from '../lib/mediaStorage';
import { createMediaRecord, type MediaRecord } from './mediaRepository';

const IMAGE_MIME_PREFIX = 'image/';

function storageProvider(category: MediaCategory): 'local' | 'cloudinary' {
  if (visibilityForCategory(category) === 'private') return 'local';
  const raw = process.env.MEDIA_STORAGE_PROVIDER?.trim().toLowerCase();
  return raw === 'cloudinary' ? 'cloudinary' : 'local';
}

export type UploadedMedia = {
  /** Public URL for public media; a stable /catalog/media/private/:id reference for private media (never a raw filesystem path). */
  url: string;
  thumbnailUrl?: string;
  mediaId: string;
  provider: 'local' | 'cloudinary';
  visibility: 'public' | 'private';
};

function privateReferenceUrl(mediaId: string): string {
  return `/api/v1/catalog/media/private/${mediaId}`;
}

async function storeLocal(input: {
  category: MediaCategory;
  base64Data: string;
  mimeType: string;
  fileName: string;
  uploaderId: string;
}): Promise<{ record: MediaRecord; thumbnailUrl?: string }> {
  const rawBuffer = Buffer.from(input.base64Data, 'base64');
  const isImage = input.mimeType.toLowerCase().startsWith(IMAGE_MIME_PREFIX);
  const visibility = visibilityForCategory(input.category);

  if (isImage) {
    const processed = await processImage(rawBuffer);
    const saved = await saveMediaFile({ category: input.category, buffer: processed.full.buffer, mimeType: 'image/webp' });
    // Thumbnails are a public-UI convenience only — skip for private docs (nothing renders a private thumbnail grid).
    const savedThumb =
      visibility === 'public'
        ? await saveMediaFile({ category: input.category, buffer: processed.thumbnail.buffer, mimeType: 'image/webp' })
        : null;
    const record = await createMediaRecord({
      uploadedByUserId: input.uploaderId,
      category: input.category,
      mediaType: 'image',
      provider: 'local',
      relativePath: saved.relativePath,
      publicUrl: saved.publicUrl,
      mimeType: 'image/webp',
      sizeBytes: saved.sizeBytes,
      width: processed.full.width,
      height: processed.full.height,
      originalFilename: input.fileName,
    });
    return { record, thumbnailUrl: savedThumb?.publicUrl };
  }

  // Non-image (PDF/DOC/DOCX/video) — store as-is, no image pipeline.
  const saved = await saveMediaFile({ category: input.category, buffer: rawBuffer, mimeType: input.mimeType });
  const record = await createMediaRecord({
    uploadedByUserId: input.uploaderId,
    category: input.category,
    mediaType: mediaTypeForMimeType(input.mimeType),
    provider: 'local',
    relativePath: saved.relativePath,
    publicUrl: saved.publicUrl,
    mimeType: input.mimeType,
    sizeBytes: saved.sizeBytes,
    originalFilename: input.fileName,
  });
  return { record };
}

function resultFor(record: MediaRecord, thumbnailUrl: string | undefined, provider: 'local' | 'cloudinary'): UploadedMedia {
  const visibility = record.visibility;
  return {
    url: visibility === 'private' ? privateReferenceUrl(record.id) : record.publicUrl!,
    thumbnailUrl,
    mediaId: record.id,
    provider,
    visibility,
  };
}

export async function storeUploadedImage(input: {
  category: MediaCategory;
  base64Data: string;
  mimeType: string;
  fileName: string;
  uploaderId: string;
}): Promise<UploadedMedia> {
  if (!isMediaCategory(input.category)) throw new Error(`Invalid media category: ${input.category}`);

  if (storageProvider(input.category) === 'cloudinary') {
    const url = await uploadImageToCloudinary({ base64Data: input.base64Data, mimeType: input.mimeType, fileName: input.fileName });
    const record = await createMediaRecord({
      uploadedByUserId: input.uploaderId,
      category: input.category,
      mediaType: 'image',
      provider: 'cloudinary',
      publicUrl: url,
      mimeType: input.mimeType,
      sizeBytes: Math.floor((input.base64Data.length * 3) / 4),
      originalFilename: input.fileName,
    });
    return resultFor(record, undefined, 'cloudinary');
  }

  const { record, thumbnailUrl } = await storeLocal(input);
  return resultFor(record, thumbnailUrl, 'local');
}

export async function storeUploadedDocument(input: {
  category: MediaCategory;
  base64Data: string;
  mimeType: string;
  fileName: string;
  uploaderId: string;
}): Promise<UploadedMedia> {
  if (!isMediaCategory(input.category)) throw new Error(`Invalid media category: ${input.category}`);

  if (storageProvider(input.category) === 'cloudinary') {
    const url = await uploadDocumentToCloudinary({ base64Data: input.base64Data, mimeType: input.mimeType, fileName: input.fileName });
    const record = await createMediaRecord({
      uploadedByUserId: input.uploaderId,
      category: input.category,
      mediaType: 'document',
      provider: 'cloudinary',
      publicUrl: url,
      mimeType: input.mimeType,
      sizeBytes: Math.floor((input.base64Data.length * 3) / 4),
      originalFilename: input.fileName,
    });
    return resultFor(record, undefined, 'cloudinary');
  }

  const { record } = await storeLocal(input);
  return resultFor(record, undefined, 'local');
}

/** Brand/creator claim verification assets — ALWAYS private (see file header). */
export async function storeUploadedVerificationAsset(input: {
  base64Data: string;
  mimeType: string;
  fileName: string;
  kind: 'image' | 'document';
  uploaderId: string;
}): Promise<UploadedMedia> {
  const { record, thumbnailUrl } = await storeLocal({
    category: 'verification',
    base64Data: input.base64Data,
    mimeType: input.mimeType,
    fileName: input.fileName,
    uploaderId: input.uploaderId,
  });
  return resultFor(record, thumbnailUrl, 'local');
}
