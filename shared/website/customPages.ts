/**
 * Website Studio "your own pages" (/pages/<slug>): a top section plus an ordered list of blocks.
 * Structured content only (no HTML); the storefront draws every block in the Choosify style.
 * normalizeCustomPage() is the single source of truth for the shape — the server stores only what
 * it returns, so a saved page always renders.
 */

export type CustomCardItem = { id: string; enabled: boolean; icon: string; title: string; text: string; imageUrl: string; href: string };
export type CustomFaqItem = { id: string; enabled: boolean; question: string; answer: string };

export type CustomBlock =
  | { id: string; type: 'text'; enabled: boolean; heading: string; body: string }
  | { id: string; type: 'image'; enabled: boolean; imageUrl: string; alt: string; caption: string }
  | { id: string; type: 'cards'; enabled: boolean; heading: string; items: CustomCardItem[] }
  | { id: string; type: 'cta'; enabled: boolean; heading: string; text: string; buttonLabel: string; buttonHref: string }
  | { id: string; type: 'faq'; enabled: boolean; heading: string; items: CustomFaqItem[] };

export type CustomBlockType = CustomBlock['type'];

export type CustomPageContent = {
  title: string;
  seoDescription: string;
  hero: { eyebrow: string; heading: string; text: string; imageUrl: string; buttonLabel: string; buttonHref: string };
  blocks: CustomBlock[];
};

export const CUSTOM_BLOCK_LABELS: Record<CustomBlockType, string> = {
  text: 'Text',
  image: 'Image',
  cards: 'Cards',
  cta: 'Call-to-action button',
  faq: 'Questions & answers',
};

/** Page addresses: lowercase words joined by hyphens (e.g. "summer-sale"). */
export const CUSTOM_SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** Slugs the built-in pages already use as page:<slug> documents. */
export const RESERVED_CUSTOM_SLUGS = new Set(['about', 'contact', 'suggest-brand', 'partnership', 'advertise', 'terms', 'privacy', 'new', 'preview']);

const newId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function blankBlock(type: CustomBlockType): CustomBlock {
  switch (type) {
    case 'text':
      return { id: newId('text'), type, enabled: true, heading: '', body: '' };
    case 'image':
      return { id: newId('image'), type, enabled: true, imageUrl: '', alt: '', caption: '' };
    case 'cards':
      return { id: newId('cards'), type, enabled: true, heading: '', items: [blankCard(), blankCard(), blankCard()] };
    case 'cta':
      return { id: newId('cta'), type, enabled: true, heading: '', text: '', buttonLabel: 'Learn more', buttonHref: '/' };
    default:
      return { id: newId('faq'), type: 'faq', enabled: true, heading: 'Questions & answers', items: [blankFaq()] };
  }
}
export const blankCard = (): CustomCardItem => ({ id: newId('card'), enabled: true, icon: '⭐', title: '', text: '', imageUrl: '', href: '' });
export const blankFaq = (): CustomFaqItem => ({ id: newId('faq'), enabled: true, question: '', answer: '' });

export function defaultCustomPage(title: string): CustomPageContent {
  return {
    title,
    seoDescription: '',
    hero: { eyebrow: '', heading: title, text: '', imageUrl: '', buttonLabel: '', buttonHref: '' },
    blocks: [{ id: 'intro', type: 'text', enabled: true, heading: '', body: 'Write the page here.' }],
  };
}

const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const b = (v: unknown) => v !== false;
const id = (v: unknown, p: string) => (typeof v === 'string' && /^[a-z0-9-]{1,60}$/i.test(v) ? v : newId(p));

/** Complete, well-formed page content (unknown block types and fields are dropped). */
export function normalizeCustomPage(raw: unknown): CustomPageContent {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const h = (r.hero && typeof r.hero === 'object' ? r.hero : {}) as Record<string, unknown>;
  const blocks: CustomBlock[] = [];
  for (const x of Array.isArray(r.blocks) ? r.blocks.slice(0, 40) : []) {
    const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    const base = { id: id(o.id, String(o.type || 'block')), enabled: b(o.enabled) };
    if (o.type === 'text') blocks.push({ ...base, type: 'text', heading: s(o.heading, 160), body: s(o.body, 8000) });
    else if (o.type === 'image') blocks.push({ ...base, type: 'image', imageUrl: s(o.imageUrl, 600), alt: s(o.alt, 200), caption: s(o.caption, 300) });
    else if (o.type === 'cta') blocks.push({ ...base, type: 'cta', heading: s(o.heading, 160), text: s(o.text, 600), buttonLabel: s(o.buttonLabel, 40), buttonHref: s(o.buttonHref, 600) });
    else if (o.type === 'cards')
      blocks.push({
        ...base,
        type: 'cards',
        heading: s(o.heading, 160),
        items: (Array.isArray(o.items) ? o.items.slice(0, 24) : []).map((c) => {
          const it = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
          return { id: id(it.id, 'card'), enabled: b(it.enabled), icon: s(it.icon, 8), title: s(it.title, 120), text: s(it.text, 600), imageUrl: s(it.imageUrl, 600), href: s(it.href, 600) };
        }),
      });
    else if (o.type === 'faq')
      blocks.push({
        ...base,
        type: 'faq',
        heading: s(o.heading, 160),
        items: (Array.isArray(o.items) ? o.items.slice(0, 40) : []).map((c) => {
          const it = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
          return { id: id(it.id, 'faq'), enabled: b(it.enabled), question: s(it.question, 300), answer: s(it.answer, 3000) };
        }),
      });
  }
  const title = s(r.title, 120) || 'Untitled page';
  return {
    title,
    seoDescription: s(r.seoDescription, 300),
    hero: {
      eyebrow: s(h.eyebrow, 60),
      heading: s(h.heading, 160) || title,
      text: s(h.text, 800),
      imageUrl: s(h.imageUrl, 600),
      buttonLabel: s(h.buttonLabel, 40),
      buttonHref: s(h.buttonHref, 600),
    },
    blocks,
  };
}
