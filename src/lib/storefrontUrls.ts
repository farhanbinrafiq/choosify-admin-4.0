/** Published Choosify-Web origin (Preview Website). Never hardcode a stale host at the call site. */
export function getPublishedStorefrontUrl(): string {
  const env = String((import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_CHOOSIFY_WEB_URL || '')
    .trim()
    .replace(/\/$/, '');
  if (env) return env;
  if (import.meta.env.DEV) return 'http://localhost:5173';
  return 'https://choosify.bd';
}

/**
 * Live Preview iframe origin. Prefer an explicit preview URL; otherwise the published storefront.
 * Draft-token session API is optional — callers must not invent a mock homepage.
 */
export function getLivePreviewStorefrontUrl(): string {
  const env = String(
    (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_CHOOSIFY_WEB_PREVIEW_URL || '',
  )
    .trim()
    .replace(/\/$/, '');
  if (env) return env;
  return getPublishedStorefrontUrl();
}
