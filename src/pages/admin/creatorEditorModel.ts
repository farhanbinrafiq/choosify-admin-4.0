import type {
  CatalogCreator,
  CatalogCreatorFeaturedItem,
  CatalogMediaItem,
} from '../../types/catalog';
import type { ProfileImageCropParams } from '../../../shared/media/profileImageCrop';
import { isLocalPreviewUrl } from '../../lib/localPreview';

/** A stored image URL; '' for a removed image (an explicit PATCH clear); undefined (left
 *  unchanged by PATCH) only for a never-uploaded local preview. */
const storableImage = (url: string | undefined): string | undefined =>
  !url ? '' : isLocalPreviewUrl(url) ? undefined : url;

export type CreatorEditorStatus = 'DRAFT' | 'LIVE' | 'ARCHIVED';

/**
 * Inline-editable Creator Studio sections. The canonical `bio` is edited ONCE,
 * in `overview` (the identity block renders the same value read-only). Trust
 * score, followers, verification, review counts and follower media counts are
 * platform/relationship-derived and are never editable here.
 */
export type CreatorEditSection =
  | 'cover'
  | 'avatar'
  | 'identity'
  | 'social'
  | 'expertise'
  | 'overview'
  | 'contact'
  | 'partnerships'
  | 'featured';

export type CreatorBrandPartner = { name: string; color?: string; brandId?: string; logo?: string };
export type CreatorFeaturedItem = CatalogCreatorFeaturedItem;

export interface CreatorContentCard {
  id: string;
  title: string;
  thumbnail: string;
  kind: 'video' | 'reel' | 'blog';
  views?: string;
  url?: string;
}

export interface CreatorEditorModel {
  id: string;
  name: string;
  handle: string;
  slug: string;
  avatar: string;
  /** The ORIGINAL (uncropped) upload behind `avatar` — see CatalogCreator.avatarOriginal. */
  avatarOriginal?: string;
  /** Scale/position of the avatar against `avatarOriginal` — see CatalogCreator.avatarCrop. */
  avatarCrop?: ProfileImageCropParams;
  coverImage: string;
  title: string;
  location: string;
  bio: string;
  bestFor: string;
  bestForTags: string[];
  platforms: string[];
  email: string;
  phone: string;
  responseTime: string;
  preferredContact: string;
  /** Creator-chosen extra contact methods (see CatalogCreator.customContacts). */
  customContacts: Array<{ label: string; value: string }>;
  /** Creator Overview sections after the bio (see CatalogCreator.overviewSections). */
  overviewSections: Array<{ id: string; title: string; body: string }>;
  brandPartners: CreatorBrandPartner[];
  collabTypes: string[];
  socialLinks: {
    facebook?: string;
    instagram?: string;
    youtube?: string;
    linkedin?: string;
    tiktok?: string;
    custom?: Array<{ label: string; url: string }>;
  };
  /** Creator-curated Featured Content (own Guides + external links). */
  featuredContent: CreatorFeaturedItem[];
  score: number;
  verified: boolean;
  status: CreatorEditorStatus;
  videos: CreatorContentCard[];
  reels: CreatorContentCard[];
  blogs: CreatorContentCard[];
  followerTotal: string;
}

function mapMedia(items: CatalogMediaItem[] | undefined, kind: CreatorContentCard['kind']): CreatorContentCard[] {
  if (!Array.isArray(items)) return [];
  return items.map((m) => ({
    id: m.id,
    title: m.title || 'Untitled',
    thumbnail: m.thumbnail || '',
    kind,
    views: m.views,
    url: m.url,
  }));
}

/** Normalize catalog score (0–5 or 0–100) to a 0–5 display value. */
export function normalizeTrustScore(score: number): number {
  if (!Number.isFinite(score) || score <= 0) return 0;
  if (score <= 5) return Math.round(score * 10) / 10;
  return Math.round((score / 20) * 10) / 10;
}

/** "12.5K" / "1,200" / 300 → a number (same parsing as the storefront's listing ranking). */
function parseCountLabel(raw: unknown): number {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? raw : 0;
  const m = String(raw ?? '').replace(/,/g, '').trim().toUpperCase().match(/([\d.]+)\s*([KMB])?/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * (m[2] === 'K' ? 1e3 : m[2] === 'M' ? 1e6 : m[2] === 'B' ? 1e9 : 1));
}

/** Total followers across platforms, compact ("12.5K"), or '' when none are recorded. */
function followerTotal(followers: CatalogCreator['followers'] | undefined): string {
  if (!followers || typeof followers !== 'object') return '';
  const total = Object.values(followers).reduce((sum, v) => sum + parseCountLabel(v), 0);
  if (total <= 0) return '';
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(total);
}

export function createBlankCreatorModel(id = 'new'): CreatorEditorModel {
  return {
    id,
    name: '',
    handle: '',
    slug: '',
    avatar: '',
    coverImage: '',
    title: '',
    location: '',
    bio: '',
    bestFor: '',
    bestForTags: [],
    platforms: [],
    email: '',
    phone: '',
    responseTime: '',
    preferredContact: '',
    customContacts: [],
    overviewSections: [],
    brandPartners: [],
    collabTypes: [],
    socialLinks: {},
    featuredContent: [],
    score: 0,
    verified: false,
    status: 'DRAFT',
    videos: [],
    reels: [],
    blogs: [],
    followerTotal: '',
  };
}

export function mapCatalogCreatorToEditor(creator: CatalogCreator): CreatorEditorModel {
  const status: CreatorEditorStatus =
    creator.status === 'live' ? 'LIVE' : creator.status === 'archived' ? 'ARCHIVED' : 'DRAFT';

  return {
    id: creator.id,
    name: creator.name || '',
    handle: creator.handle || '',
    slug: creator.slug || '',
    avatar: creator.avatar || '',
    avatarOriginal: creator.avatarOriginal || '',
    avatarCrop: creator.avatarCrop,
    coverImage: creator.coverImage || '',
    title: creator.role || creator.category || '',
    location: creator.location || '',
    bio: creator.bio || '',
    bestFor: creator.bestFor || '',
    bestForTags: Array.isArray(creator.bestForTags) ? creator.bestForTags.map(String) : [],
    platforms: Array.isArray(creator.platforms) ? creator.platforms.map(String) : [],
    email: creator.email || '',
    phone: creator.phone || '',
    responseTime: creator.responseTime || '',
    preferredContact: creator.preferredContact || '',
    customContacts: Array.isArray(creator.customContacts)
      ? creator.customContacts.map((c) => ({ label: c.label, value: c.value }))
      : [],
    overviewSections: Array.isArray(creator.overviewSections)
      ? creator.overviewSections.map((o) => ({ id: o.id, title: o.title, body: o.body }))
      : [],
    brandPartners: Array.isArray(creator.brandPartners)
      ? creator.brandPartners.map((b) => ({
          name: b.name,
          color: b.color,
          brandId: b.brandId,
          logo: b.logo,
        }))
      : [],
    collabTypes: Array.isArray(creator.collabTypes) ? creator.collabTypes.map(String) : [],
    socialLinks: {
      facebook: creator.socialLinks?.facebook || '',
      instagram: creator.socialLinks?.instagram || '',
      youtube: creator.socialLinks?.youtube || '',
      linkedin: creator.socialLinks?.linkedin || '',
      tiktok: creator.socialLinks?.tiktok || '',
      custom: Array.isArray(creator.socialLinks?.custom)
        ? creator.socialLinks!.custom!.map((c) => ({ label: c.label, url: c.url }))
        : [],
    },
    featuredContent: Array.isArray(creator.featuredContent)
      ? creator.featuredContent.map((f) => ({ ...f }))
      : [],
    score: typeof creator.score === 'number' ? creator.score : 0,
    verified: !!creator.verifiedStatus,
    status,
    videos: mapMedia(creator.videos, 'video'),
    reels: mapMedia(creator.reels, 'reel'),
    blogs: mapMedia(creator.blogs, 'blog'),
    followerTotal: followerTotal(creator.followers),
  };
}

export function editorModelToCreatorPayload(model: CreatorEditorModel): Partial<CatalogCreator> {
  return {
    name: model.name,
    handle: model.handle,
    avatar: storableImage(model.avatar),
    avatarOriginal: storableImage(model.avatarOriginal),
    // `null` clears the stored framing (avatar removed, or replaced without adjusting).
    avatarCrop: (model.avatar ? model.avatarCrop ?? null : null) as CatalogCreator['avatarCrop'],
    coverImage: storableImage(model.coverImage),
    // Empty strings (not undefined) so clearing a field persists — see changedFields.
    role: model.title.trim(),
    location: model.location.trim(),
    bio: model.bio,
    bestFor: (model.bestFor || model.bestForTags[0] || '').trim(),
    bestForTags: model.bestForTags,
    platforms: model.platforms,
    email: model.email.trim(),
    phone: model.phone.trim(),
    responseTime: model.responseTime.trim(),
    preferredContact: model.preferredContact.trim(),
    customContacts: (model.customContacts ?? [])
      .map((c) => ({ label: (c.label || '').trim(), value: (c.value || '').trim() }))
      .filter((c) => c.label || c.value),
    overviewSections: (model.overviewSections ?? [])
      .map((o) => ({ id: o.id, title: (o.title || '').trim(), body: (o.body || '').trim() }))
      .filter((o) => o.title || o.body),
    brandPartners: model.brandPartners.map((b) => ({
      name: b.name,
      ...(b.color ? { color: b.color } : {}),
      ...(b.brandId ? { brandId: b.brandId } : {}),
      ...(b.logo ? { logo: b.logo } : {}),
    })),
    collabTypes: model.collabTypes,
    socialLinks: {
      facebook: (model.socialLinks.facebook || '').trim(),
      instagram: (model.socialLinks.instagram || '').trim(),
      youtube: (model.socialLinks.youtube || '').trim(),
      linkedin: (model.socialLinks.linkedin || '').trim(),
      tiktok: (model.socialLinks.tiktok || '').trim(),
      custom: (model.socialLinks.custom ?? [])
        .map((c) => ({ label: (c.label || '').trim(), url: (c.url || '').trim() }))
        .filter((c) => c.label || c.url),
    },
    featuredContent: model.featuredContent
      .map((f) => ({
        id: f.id,
        source: f.source,
        kind: f.kind,
        ...(f.contentId ? { contentId: f.contentId } : {}),
        title: (f.title || '').trim(),
        thumbnail: (f.thumbnail || '').trim(),
        url: (f.url || '').trim(),
      }))
      .filter((f) => f.title && f.url),
    verifiedStatus: model.verified,
    status: model.status === 'LIVE' ? 'live' : model.status === 'ARCHIVED' ? 'archived' : 'draft',
  };
}

/**
 * Payload for a section-level canonical PATCH. Same editable fields as
 * `editorModelToCreatorPayload` minus `status` / `verifiedStatus` — lifecycle and
 * verification are server-authoritative and never ride along with a profile edit.
 */
export function editorModelToCreatorSectionPatch(model: CreatorEditorModel): Partial<CatalogCreator> {
  const { status: _status, verifiedStatus: _verified, ...rest } = editorModelToCreatorPayload(model);
  return rest;
}
