/**
 * A blob:/data: URL is a browser-local preview of a file that never uploaded.
 * It exists only in the tab that created it — buyers and other devices can never
 * load it — so it must never be saved as an image URL.
 */
export function isLocalPreviewUrl(url: unknown): boolean {
  return typeof url === 'string' && /^(blob:|data:)/i.test(url.trim());
}
