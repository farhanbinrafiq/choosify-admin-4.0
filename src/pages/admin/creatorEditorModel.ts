import type { CatalogCreator, CatalogMediaItem } from '../../types/catalog';

export type CreatorEditorStatus = 'DRAFT' | 'LIVE' | 'ARCHIVED';

export type CreatorEditSection =
  | 'cover'
  | 'identity'
  | 'social'
  | 'expertise'
  | 'contact'
  | 'partnerships'
  | 'overview';

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
  brandPartners: { name: string; color?: string }[];
  collabTypes: string[];
  socialLinks: {
    facebook?: string;
    instagram?: string;
    youtube?: string;
    linkedin?: string;
    tiktok?: string;
  };
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

function followerTotal(followers: CatalogCreator['followers'] | undefined): string {
  if (!followers || typeof followers !== 'object') return '';
  const vals = Object.values(followers).filter(Boolean);
  if (!vals.length) return '';
  return String(vals[0]);
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
    brandPartners: [],
    collabTypes: [],
    socialLinks: {},
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
    brandPartners: Array.isArray(creator.brandPartners)
      ? creator.brandPartners.map((b) => ({ name: b.name, color: b.color }))
      : [],
    collabTypes: Array.isArray(creator.collabTypes) ? creator.collabTypes.map(String) : [],
    socialLinks: {
      facebook: creator.socialLinks?.facebook || '',
      instagram: creator.socialLinks?.instagram || '',
      youtube: creator.socialLinks?.youtube || '',
      linkedin: creator.socialLinks?.linkedin || '',
      tiktok: creator.socialLinks?.tiktok || '',
    },
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
    avatar: model.avatar || undefined,
    coverImage: model.coverImage || undefined,
    role: model.title || undefined,
    location: model.location || undefined,
    bio: model.bio || undefined,
    bestFor: model.bestFor || model.bestForTags[0] || undefined,
    bestForTags: model.bestForTags,
    platforms: model.platforms,
    email: model.email || undefined,
    phone: model.phone || undefined,
    responseTime: model.responseTime || undefined,
    preferredContact: model.preferredContact || undefined,
    brandPartners: model.brandPartners,
    collabTypes: model.collabTypes,
    socialLinks: {
      facebook: model.socialLinks.facebook || undefined,
      instagram: model.socialLinks.instagram || undefined,
      youtube: model.socialLinks.youtube || undefined,
      linkedin: model.socialLinks.linkedin || undefined,
      tiktok: model.socialLinks.tiktok || undefined,
    },
    verifiedStatus: model.verified,
    status: model.status === 'LIVE' ? 'live' : model.status === 'ARCHIVED' ? 'archived' : 'draft',
  };
}
