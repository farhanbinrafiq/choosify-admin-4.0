/**
 * Pre-VPS self-hosting pass — application-owned media storage. This is the
 * CORE storage path (no external provider required); Cloudinary remains
 * available only as an explicit, optional alternate provider (see
 * lib/vercel-catalog/mediaUpload.ts) for anyone who still wants it.
 *
 * Two separate roots, matching the public/private split real user data
 * needs:
 *  - MEDIA_STORAGE_ROOT (public) — served as static files. Default: a
 *    gitignored local `.data/media/` for dev. On a VPS this MUST be a real
 *    persistent path outside the repo/build dir, e.g. /data/choosify/media.
 *  - PRIVATE_STORAGE_ROOT (private) — NEVER static-mounted, NEVER has a
 *    public URL. Only reachable via the authenticated
 *    GET /catalog/media/private/:id route. Default: `.data/private/` for
 *    dev; production should point this at e.g. /data/choosify/private.
 *
 * Filenames are always server-generated (crypto.randomUUID + an extension
 * derived from the *validated* MIME type, never from the client-supplied
 * filename) — this is the path-traversal and overwrite-by-filename
 * defense, not an incidental detail.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';

/** Public — served as ordinary static files, safe for anonymous access. */
export const PUBLIC_MEDIA_CATEGORIES = [
  'users',
  'sellers',
  'creators',
  'brands',
  'products',
  'services',
  'reviews',
  'guides',
  'cms',
  'ads',
  'careers',
  'videos',
  'temporary',
] as const;

/** Private — sensitive documents, never statically servable. Owner + admin only, via an authenticated API. */
export const PRIVATE_MEDIA_CATEGORIES = [
  'verification',
  'identity-documents',
  'seller-documents',
  'creator-documents',
  /** Warranty claim evidence photos/videos — buyer/seller/admin only, never public. */
  'warranty-claims',
] as const;

export const MEDIA_CATEGORIES = [...PUBLIC_MEDIA_CATEGORIES, ...PRIVATE_MEDIA_CATEGORIES] as const;
export type MediaCategory = (typeof MEDIA_CATEGORIES)[number];
export type MediaVisibility = 'public' | 'private';

export function isMediaCategory(value: unknown): value is MediaCategory {
  return typeof value === 'string' && (MEDIA_CATEGORIES as readonly string[]).includes(value);
}

export function visibilityForCategory(category: MediaCategory): MediaVisibility {
  return (PRIVATE_MEDIA_CATEGORIES as readonly string[]).includes(category) ? 'private' : 'public';
}

const IMAGE_MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const VIDEO_MIME_TO_EXTENSION: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
};

const DOCUMENT_MIME_TO_EXTENSION: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};

const MIME_TO_EXTENSION: Record<string, string> = {
  ...IMAGE_MIME_TO_EXTENSION,
  ...VIDEO_MIME_TO_EXTENSION,
  ...DOCUMENT_MIME_TO_EXTENSION,
};

export function extensionForMimeType(mimeType: string): string {
  return MIME_TO_EXTENSION[mimeType.toLowerCase()] || '';
}

export function mediaTypeForMimeType(mimeType: string): 'image' | 'video' | 'document' {
  const mime = mimeType.toLowerCase();
  if (mime in VIDEO_MIME_TO_EXTENSION) return 'video';
  if (mime in DOCUMENT_MIME_TO_EXTENSION) return 'document';
  return 'image';
}

function publicStorageRoot(): string {
  const configured = process.env.MEDIA_STORAGE_ROOT?.trim();
  return resolve(configured || join(process.cwd(), '.data', 'media'));
}

function privateStorageRoot(): string {
  const configured = process.env.PRIVATE_STORAGE_ROOT?.trim();
  return resolve(configured || join(process.cwd(), '.data', 'private'));
}

function rootForVisibility(visibility: MediaVisibility): string {
  return visibility === 'private' ? privateStorageRoot() : publicStorageRoot();
}

function publicBaseUrl(): string {
  const configured = process.env.MEDIA_PUBLIC_BASE_URL?.trim();
  return (configured || '/media').replace(/\/$/, '');
}

/**
 * Optional absolute origin (e.g. https://dashboard.choosify.bd) prepended
 * to publicUrl. Kept separate from MEDIA_PUBLIC_BASE_URL, which doubles as
 * the Express static-mount path (app.use(mediaMount.urlPrefix, ...)) and
 * must stay a bare path -- an absolute URL there breaks the mount itself.
 * choosify-web and choosify-admin are served from different origins, so a
 * relative publicUrl 404s when the web app renders a file the admin app
 * stored (nginx on choosify.bd only proxies /api/v1, not /media).
 */
function publicOrigin(): string {
  const configured = process.env.MEDIA_PUBLIC_ORIGIN?.trim();
  return configured ? configured.replace(/\/$/, '') : '';
}

/** Local dev / Express-static mount point — see server/app.ts. Public root only; the private root is never static-mounted. */
export function getMediaStaticMount(): { root: string; urlPrefix: string } {
  return { root: publicStorageRoot(), urlPrefix: publicBaseUrl() };
}

export type SavedMedia = {
  relativePath: string;
  /** Only set for public visibility — private files have no static URL. */
  publicUrl?: string;
  sizeBytes: number;
};

function assertWithinRoot(root: string, absolutePath: string, action: 'write' | 'delete' | 'read'): void {
  if (!absolutePath.startsWith(root + sep) && absolutePath !== root) {
    throw new Error(`Refusing to ${action} outside the configured media storage root`);
  }
}

/**
 * Writes a validated file to disk under `${category}/${randomFilename}`,
 * choosing the public or private root based on the category, and returns
 * its relative path (+ public URL, for public categories only). `buffer`/
 * `mimeType` must already have passed uploadValidation.ts — this function
 * does not re-validate content, only the category and the resulting path.
 */
export async function saveMediaFile(input: {
  category: MediaCategory;
  buffer: Buffer;
  mimeType: string;
}): Promise<SavedMedia> {
  if (!isMediaCategory(input.category)) {
    throw new Error(`Invalid media category: ${String(input.category)}`);
  }
  const visibility = visibilityForCategory(input.category);
  const extension = extensionForMimeType(input.mimeType) || '.bin';
  const filename = `${randomUUID()}${extension}`;
  const relativePath = `${input.category}/${filename}`;

  const root = rootForVisibility(visibility);
  const absolutePath = resolve(root, relativePath);
  assertWithinRoot(root, absolutePath, 'write');

  await mkdir(resolve(root, input.category), { recursive: true });
  await writeFile(absolutePath, input.buffer);

  return {
    relativePath,
    publicUrl: visibility === 'public' ? `${publicOrigin()}${publicBaseUrl()}/${relativePath}` : undefined,
    sizeBytes: input.buffer.byteLength,
  };
}

/** Deletes a previously-saved file from whichever root matches its category. Never throws if the file is already gone. */
export async function deleteMediaFile(relativePath: string, category: MediaCategory): Promise<void> {
  const root = rootForVisibility(visibilityForCategory(category));
  const absolutePath = resolve(root, relativePath);
  assertWithinRoot(root, absolutePath, 'delete');
  try {
    await unlink(absolutePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code !== 'ENOENT') throw error;
  }
}

/** Reads a private file's absolute path for streaming — callers MUST have already authorized the request. */
export function resolvePrivateFilePath(relativePath: string): string {
  const root = privateStorageRoot();
  const absolutePath = resolve(root, relativePath);
  assertWithinRoot(root, absolutePath, 'read');
  return absolutePath;
}
