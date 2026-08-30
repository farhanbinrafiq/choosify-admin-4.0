import { getStoredAccessToken, refreshAccessToken } from './authRefresh';

const API_BASE =
  ((import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_BASE_URL as string | undefined) ||
  '/api/v1';

const CLOUD_NAME =
  ((import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_CLOUDINARY_CLOUD_NAME as string | undefined) ||
  'djdyqr8yd';

const UPLOAD_PRESET = (import.meta as ImportMeta & { env?: Record<string, string> }).env
  ?.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

async function uploadViaCloudinaryPreset(file: File, folder = 'choosify/products'): Promise<string> {
  if (!UPLOAD_PRESET?.trim()) {
    throw new Error('Missing VITE_CLOUDINARY_UPLOAD_PRESET');
  }

  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', UPLOAD_PRESET.trim());
  form.append('folder', folder);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(raw || `Cloudinary upload failed with ${response.status}`);
  }

  const payload = (await response.json()) as { secure_url?: string };
  if (!payload.secure_url) {
    throw new Error('Cloudinary upload succeeded but no secure_url was returned.');
  }

  return payload.secure_url;
}

/** Maps the legacy Cloudinary-style folder ("choosify/products") to a media category. */
function categoryFromFolder(folder: string): string {
  const last = folder.split('/').pop() || 'products';
  return last;
}

function doUploadFetch(base64Data: string, file: File, folder: string, token: string | null) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return fetch(`${API_BASE}/catalog/media/upload`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type || 'image/jpeg',
      data: base64Data,
      category: categoryFromFolder(folder),
    }),
  });
}

async function uploadViaCatalogApi(file: File, folder: string): Promise<string> {
  const base64Data = await fileToBase64(file);
  const token = getStoredAccessToken();
  let response = await doUploadFetch(base64Data, file, folder, token);

  // Same long-session token expiry as other admin API calls -- retry once
  // via a silent refresh before surfacing a raw 'expired token' error.
  if (response.status === 401 && token) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await doUploadFetch(base64Data, file, folder, refreshed);
    }
  }

  if (!response.ok) {
    const raw = await response.text();
    let message = raw || `Upload failed with ${response.status}`;
    try {
      const parsed = JSON.parse(raw) as { error?: string };
      if (parsed.error) message = parsed.error;
    } catch {
      // keep raw
    }
    throw new Error(message);
  }

  const payload = (await response.json()) as { url?: string };
  if (!payload.url) {
    throw new Error('Upload succeeded but no URL was returned.');
  }

  return payload.url;
}

async function uploadImage(file: File, folder = 'choosify/products'): Promise<string> {
  const allowed = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);
  const mime = (file.type || '').toLowerCase();
  if (!allowed.has(mime)) {
    throw new Error('Unsupported image type. Use JPG, PNG, WEBP, or GIF.');
  }

  if (UPLOAD_PRESET?.trim()) {
    try {
      return await uploadViaCloudinaryPreset(file, folder);
    } catch (error) {
      console.warn('[mediaUpload] Direct Cloudinary upload failed, trying catalog API.', error);
    }
  }

  return uploadViaCatalogApi(file, folder);
}

export async function uploadProductImage(file: File): Promise<string> {
  return uploadImage(file, 'choosify/products');
}

export async function uploadBrandImage(file: File): Promise<string> {
  return uploadImage(file, 'choosify/brands');
}

export async function uploadCreatorImage(file: File): Promise<string> {
  return uploadImage(file, 'choosify/creators');
}

export async function uploadProductImages(files: File[]): Promise<string[]> {
  const uploads = files.map((file) => uploadProductImage(file));
  return Promise.all(uploads);
}

const ALLOWED_VIDEO_MIME = new Set(['video/mp4', 'video/webm']);

/**
 * Uploads a single product video file through the app's own media route
 * (POST /catalog/media/upload → local media disk). Returns a public `/media/...`
 * URL. The catalog JSON body limit still applies, so this is only for short
 * clips; larger videos should be supplied as a video link instead. Throws a
 * clear message on rejection — the caller must NOT persist anything on failure.
 */
export async function uploadProductVideoFile(file: File): Promise<string> {
  const mime = (file.type || '').toLowerCase();
  if (!ALLOWED_VIDEO_MIME.has(mime)) {
    throw new Error('Unsupported video type. Upload an MP4 or WebM file.');
  }
  const base64Data = await fileToBase64(file);
  const token = getStoredAccessToken();
  const send = (bearer: string | null) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    return fetch(`${API_BASE}/catalog/media/upload`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ fileName: file.name, mimeType: mime, data: base64Data, category: 'products' }),
    });
  };
  let response = await send(token);
  if (response.status === 401 && token) {
    const refreshed = await refreshAccessToken();
    if (refreshed) response = await send(refreshed);
  }
  if (response.status === 413) {
    throw new Error('Video is too large to upload directly. Use a shorter clip, or paste a video link instead.');
  }
  if (!response.ok) {
    const raw = await response.text();
    let message = raw || `Video upload failed with ${response.status}`;
    try {
      const parsed = JSON.parse(raw) as { error?: string };
      if (parsed.error) message = parsed.error;
    } catch {
      // keep raw
    }
    throw new Error(message);
  }
  const payload = (await response.json()) as { url?: string };
  if (!payload.url) throw new Error('Video upload succeeded but no URL was returned.');
  return payload.url;
}
