import crypto from 'node:crypto';

type UploadInput = {
  base64Data: string;
  mimeType: string;
  fileName: string;
};

const getCloudName = () =>
  process.env.CLOUDINARY_CLOUD_NAME?.trim() ||
  process.env.VITE_CLOUDINARY_CLOUD_NAME?.trim() ||
  '';

const getUploadPreset = () =>
  process.env.CLOUDINARY_UPLOAD_PRESET?.trim() ||
  process.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim() ||
  '';

export async function uploadImageToCloudinary(input: UploadInput): Promise<string> {
  const cloudName = getCloudName();
  if (!cloudName) {
    throw new Error(
      'Image upload is not configured. Set CLOUDINARY_CLOUD_NAME (or VITE_CLOUDINARY_CLOUD_NAME) on the server.',
    );
  }

  const uploadPreset = getUploadPreset();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  const dataUri = `data:${input.mimeType || 'image/jpeg'};base64,${input.base64Data}`;

  const form = new FormData();
  form.append('file', dataUri);
  form.append('folder', 'choosify/products');

  if (uploadPreset) {
    form.append('upload_preset', uploadPreset);
  } else if (apiKey && apiSecret) {
    const timestamp = Math.round(Date.now() / 1000);
    const folder = 'choosify/products';
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
    const signature = crypto.createHash('sha1').update(paramsToSign + apiSecret).digest('hex');
    form.append('api_key', apiKey);
    form.append('timestamp', String(timestamp));
    form.append('signature', signature);
  } else {
    throw new Error(
      'Image upload is not configured. Set CLOUDINARY_UPLOAD_PRESET or CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET on the server.',
    );
  }

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
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

/** PDF/DOCX resumes for Careers applications (Cloudinary raw upload). */
export async function uploadDocumentToCloudinary(input: UploadInput): Promise<string> {
  const cloudName = getCloudName();
  if (!cloudName) {
    throw new Error(
      'Document upload is not configured. Set CLOUDINARY_CLOUD_NAME (or VITE_CLOUDINARY_CLOUD_NAME) on the server.',
    );
  }

  const uploadPreset = getUploadPreset();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  const mimeType = input.mimeType || 'application/pdf';
  const dataUri = `data:${mimeType};base64,${input.base64Data}`;
  const folder = 'choosify/resumes';

  const form = new FormData();
  form.append('file', dataUri);
  form.append('folder', folder);

  if (uploadPreset) {
    form.append('upload_preset', uploadPreset);
  } else if (apiKey && apiSecret) {
    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
    const signature = crypto.createHash('sha1').update(paramsToSign + apiSecret).digest('hex');
    form.append('api_key', apiKey);
    form.append('timestamp', String(timestamp));
    form.append('signature', signature);
  } else {
    throw new Error(
      'Document upload is not configured. Set CLOUDINARY_UPLOAD_PRESET or CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET on the server.',
    );
  }

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(raw || `Cloudinary document upload failed with ${response.status}`);
  }

  const payload = (await response.json()) as { secure_url?: string };
  if (!payload.secure_url) {
    throw new Error('Cloudinary upload succeeded but no secure_url was returned.');
  }

  return payload.secure_url;
}
