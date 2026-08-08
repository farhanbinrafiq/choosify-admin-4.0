import type { CatalogGuide } from '../../types/catalog';

export type GuideEditorStatus = 'DRAFT' | 'LIVE' | 'ARCHIVED';

export type GuideEditSection =
  | 'media'
  | 'header'
  | 'content'
  | 'verdict'
  | 'associations'
  | 'seo';

export interface GuideEditorModel {
  id: string;
  slug: string;
  title: string;
  author: string;
  authorAvatar: string;
  category: string;
  excerpt: string;
  image: string;
  videoUrl: string;
  type: CatalogGuide['type'];
  format: NonNullable<CatalogGuide['format']>;
  readTime: string;
  views: string;
  tags: string[];
  creatorId: string;
  productIds: string[];
  brandIds: string[];
  verdict: string;
  whatWeLike: string[];
  whatToConsider: string[];
  bodyText: string;
  watchUrl: string;
  status: GuideEditorStatus;
  seoTitle: string;
  seoDescription: string;
  publishedAt: string;
  updatedAt: string;
}

export function createBlankGuideModel(id = 'new'): GuideEditorModel {
  return {
    id,
    slug: '',
    title: '',
    author: '',
    authorAvatar: '',
    category: '',
    excerpt: '',
    image: '',
    videoUrl: '',
    type: 'article',
    format: 'buying_guide',
    readTime: '',
    views: '0',
    tags: [],
    creatorId: '',
    productIds: [],
    brandIds: [],
    verdict: '',
    whatWeLike: [],
    whatToConsider: [],
    bodyText: '',
    watchUrl: '',
    status: 'DRAFT',
    seoTitle: '',
    seoDescription: '',
    publishedAt: '',
    updatedAt: '',
  };
}

function sectionBullets(guide: CatalogGuide, sectionId: string, key: string): string[] {
  const section = (guide.sections || []).find((s) => s.id === sectionId);
  const data = section?.data;
  if (!data || typeof data !== 'object') return [];
  const val = (data as Record<string, unknown>)[key];
  return Array.isArray(val) ? val.map(String).filter(Boolean) : [];
}

export function mapCatalogGuideToEditor(guide: CatalogGuide): GuideEditorModel {
  const status: GuideEditorStatus =
    guide.status === 'live' ? 'LIVE' : guide.status === 'archived' ? 'ARCHIVED' : 'DRAFT';

  const brandIds = sectionBullets(guide, 'brands_mentioned', 'brandIds');
  const takeawayBody = sectionBullets(guide, 'takeaways', 'takeawayBody');
  const bodyFromSections =
    takeawayBody.length === 1
      ? takeawayBody[0]
      : takeawayBody.join('\n');

  return {
    id: guide.id,
    slug: guide.slug || '',
    title: guide.title || '',
    author: guide.author || '',
    authorAvatar: guide.authorAvatar || '',
    category: guide.category || '',
    excerpt: guide.excerpt || '',
    image: guide.image || '',
    videoUrl: guide.videoUrl || '',
    type: guide.type || 'article',
    format: guide.format || 'buying_guide',
    readTime: guide.readTime || '',
    views: guide.views || '0',
    tags: Array.isArray(guide.tags) ? guide.tags.map(String) : [],
    creatorId: guide.creatorId || '',
    productIds: Array.isArray(guide.productIds) ? guide.productIds.map(String) : [],
    brandIds,
    verdict: guide.verdict || '',
    whatWeLike: Array.isArray(guide.whatWeLike) ? guide.whatWeLike.map(String) : [],
    whatToConsider: Array.isArray(guide.whatToConsider) ? guide.whatToConsider.map(String) : [],
    bodyText: bodyFromSections || guide.excerpt || '',
    watchUrl: guide.live?.embedUrl || guide.videoUrl || '',
    status,
    seoTitle: guide.seoTitle || '',
    seoDescription: guide.seoDescription || '',
    publishedAt: guide.publishedAt || '',
    updatedAt: guide.updatedAt || '',
  };
}

export function editorModelToGuidePayload(model: GuideEditorModel): Partial<CatalogGuide> {
  return {
    id: model.id,
    slug: model.slug || model.id,
    title: model.title,
    author: model.author,
    authorAvatar: model.authorAvatar || undefined,
    category: model.category,
    excerpt: model.excerpt || undefined,
    image: model.image || undefined,
    videoUrl: model.videoUrl || model.watchUrl || undefined,
    type: model.type,
    format: model.format,
    readTime: model.readTime || undefined,
    views: model.views || '0',
    tags: model.tags,
    creatorId: model.creatorId || undefined,
    productIds: model.productIds,
    verdict: model.verdict || undefined,
    whatWeLike: model.whatWeLike,
    whatToConsider: model.whatToConsider,
    seoTitle: model.seoTitle || undefined,
    seoDescription: model.seoDescription || undefined,
    status: model.status === 'LIVE' ? 'live' : model.status === 'ARCHIVED' ? 'archived' : 'draft',
    sections: [
      {
        id: 'verdict',
        enabled: !!(model.verdict || model.whatWeLike.length || model.whatToConsider.length),
        order: 1,
        data: {
          whatWeLike: model.whatWeLike,
          whatToConsider: model.whatToConsider,
          takeawayBody: model.verdict,
        },
      },
      {
        id: 'takeaways',
        enabled: !!model.bodyText,
        order: 2,
        data: { takeawayBody: model.bodyText },
      },
      {
        id: 'items_mentioned',
        enabled: model.productIds.length > 0,
        order: 3,
        data: { itemIds: model.productIds },
      },
      {
        id: 'brands_mentioned',
        enabled: model.brandIds.length > 0,
        order: 4,
        data: { brandIds: model.brandIds },
      },
    ],
    live: model.watchUrl
      ? { platform: 'youtube', embedUrl: model.watchUrl, status: 'replay' }
      : undefined,
    updatedAt: new Date().toISOString(),
    publishedAt: model.status === 'LIVE' ? model.publishedAt || new Date().toISOString() : model.publishedAt,
  };
}
