/**
 * Creator profile input rules — shared by the server normalizer
 * (lib/vercel-catalog/catalogEditorialContract) and Creator Studio, so the
 * Studio shows exactly the errors the server would return. Lives outside src/
 * and server/ (like shared/media/profileImageCrop) so both sides import it
 * without pulling in the other's dependency tree.
 */

/** The social platforms the Creator model stores (CatalogCreator.socialLinks keys) and the hosts each accepts. */
export const CREATOR_SOCIAL_PLATFORMS = {
  facebook: { label: 'Facebook', hosts: ['facebook.com', 'fb.com', 'fb.watch'] },
  instagram: { label: 'Instagram', hosts: ['instagram.com'] },
  youtube: { label: 'YouTube', hosts: ['youtube.com', 'youtu.be'] },
  linkedin: { label: 'LinkedIn', hosts: ['linkedin.com'] },
  tiktok: { label: 'TikTok', hosts: ['tiktok.com'] },
} as const;

export type CreatorSocialPlatform = keyof typeof CREATOR_SOCIAL_PLATFORMS;
export const CREATOR_SOCIAL_PLATFORM_KEYS = Object.keys(CREATOR_SOCIAL_PLATFORMS) as CreatorSocialPlatform[];

/** A parsed absolute http(s) URL, or null (rejects javascript:, data:, relative and malformed values). */
function parseHttpUrl(value: string): URL | null {
  if (!/^https?:\/\//i.test(value)) return null;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u : null;
  } catch {
    return null;
  }
}

/** Problem with a platform link, or null when it is empty (= no link) or valid. */
export function creatorSocialLinkProblem(platform: CreatorSocialPlatform, raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const { label, hosts } = CREATOR_SOCIAL_PLATFORMS[platform];
  const url = parseHttpUrl(value);
  if (!url) return `${label} link must be a full web address starting with https://`;
  const host = url.hostname.toLowerCase().replace(/^(www|m|mobile)\./, '');
  if (!hosts.some((h) => host === h || host.endsWith(`.${h}`))) {
    return `${label} link must point to ${hosts[0]}`;
  }
  if (value.length > 2000) return `${label} link is too long`;
  return null;
}

/** Problem with an "other link" (label + url), or null. An entry with neither is simply ignored. */
export function creatorCustomLinkProblem(label: string, raw: string): string | null {
  const value = raw.trim();
  const name = label.trim();
  if (!value && !name) return null;
  if (!name) return 'Give each other link a name';
  if (!value) return `Add the web address for “${name}”`;
  if (!parseHttpUrl(value)) return `“${name}” must be a full web address starting with https://`;
  if (value.length > 2000) return `“${name}” link is too long`;
  return null;
}

/** Problem with a creator-defined contact method (label + value), or null. A blank row is ignored.
 *  Values may be plain text, a phone/handle, or a link — but a link must be http(s), mailto: or tel:. */
export function creatorCustomContactProblem(label: string, raw: string): string | null {
  const value = raw.trim();
  const name = label.trim();
  if (!value && !name) return null;
  if (!name) return 'Give each contact method a name';
  if (!value) return `Add the details for “${name}”`;
  if (name.length > 40) return 'Contact method names can be up to 40 characters';
  if (value.length > 200) return `“${name}” is too long (200 characters max)`;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value)?.[1]?.toLowerCase();
  if (scheme && !['http', 'https', 'mailto', 'tel'].includes(scheme)) return `“${name}” uses an unsupported link type`;
  if ((scheme === 'http' || scheme === 'https') && !parseHttpUrl(value)) return `“${name}” is not a valid web address`;
  return null;
}

/** Problem with a Creator Overview section (title + text), or null. A blank section is ignored. */
export function creatorOverviewSectionProblem(title: string, body: string): string | null {
  const t = title.trim();
  const b = body.trim();
  if (!t && !b) return null;
  if (!t) return 'Give each overview section a title';
  if (!b) return `Write something for “${t}” or remove it`;
  if (t.length > 60) return 'Section titles can be up to 60 characters';
  if (b.length > 2000) return `“${t}” is too long (2,000 characters max)`;
  return null;
}

/** Problem with a business email, or null when empty (= not set) or valid. */
export function creatorEmailProblem(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return 'Enter a valid business email, e.g. name@example.com';
  return null;
}

/** Problem with a phone number, or null when empty (= not set) or valid. Digits, spaces, +, - and () only. */
export function creatorPhoneProblem(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const digits = value.replace(/\D/g, '').length;
  if (!/^\+?[0-9(][0-9\s\-()]{5,24}$/.test(value) || digits < 6 || digits > 15) {
    return 'Enter a valid phone number (digits, spaces, + - and brackets only)';
  }
  return null;
}
