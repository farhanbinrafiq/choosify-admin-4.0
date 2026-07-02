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

async function uploadViaCloudinaryPreset(file: File): Promise<string> {
  if (!UPLOAD_PRESET?.trim()) {
    throw new Error('Missing VITE_CLOUDINARY_UPLOAD_PRESET');
  }

  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', UPLOAD_PRESET.trim());
  form.append('folder', 'choosify/products');

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

async function uploadViaCatalogApi(file: File): Promise<string> {
  const base64Data = await fileToBase64(file);
  const response = await fetch(`${API_BASE}/catalog/media/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type || 'image/jpeg',
      data: base64Data,
    }),
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(raw || `Upload failed with ${response.status}`);
  }

  const payload = (await response.json()) as { url?: string };
  if (!payload.url) {
    throw new Error('Upload succeeded but no URL was returned.');
  }

  return payload.url;
}

export async function uploadProductImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files are supported.');
  }

  if (UPLOAD_PRESET?.trim()) {
    try {
      return await uploadViaCloudinaryPreset(file);
    } catch (error) {
      console.warn('[mediaUpload] Direct Cloudinary upload failed, trying catalog API.', error);
    }
  }

  return uploadViaCatalogApi(file);
}

export async function uploadProductImages(files: File[]): Promise<string[]> {
  const uploads = files.map((file) => uploadProductImage(file));
  return Promise.all(uploads);
}
