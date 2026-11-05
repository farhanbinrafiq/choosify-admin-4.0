/**
 * "Your own pages" (/pages/<slug>) — routing rows in website_pages (pageType 'custom') with their
 * content in a page:<slug> website document (drafts / versions / publish like every document).
 *
 * The set of live custom page keys is cached in memory (refreshed every 60 s and on every change)
 * so key resolution stays synchronous. Archived pages leave the set: their public URL 404s, their
 * version history is kept.
 */
import { and, eq, ne } from 'drizzle-orm';
import { db } from '../db/client';
import { websiteDocuments, websitePages, websiteVersions } from '../db/schema';
import { CUSTOM_SLUG_RE, RESERVED_CUSTOM_SLUGS, defaultCustomPage, normalizeCustomPage } from '../../shared/website/customPages';
import { WebsiteStoreError, ensureDocument, saveDraft } from './websiteStore';

const TTL_MS = 60_000;
let cache: { at: number; keys: Set<string> } | null = null;

export const customDocKey = (slug: string) => `page:${slug}`;

export async function loadCustomPageKeys(force = false): Promise<Set<string>> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.keys;
  const rows = await db
    .select({ documentKey: websitePages.documentKey })
    .from(websitePages)
    .where(and(eq(websitePages.pageType, 'custom'), ne(websitePages.status, 'archived')));
  cache = { at: Date.now(), keys: new Set(rows.map((r) => r.documentKey)) };
  return cache.keys;
}

/** Synchronous check against the cache (call loadCustomPageKeys() first in the request). */
export const isCustomPageKey = (key: string) => Boolean(cache?.keys.has(key));
export const customPageKeysSync = () => [...(cache?.keys ?? [])];

export type CustomPageRow = {
  slug: string;
  docKey: string;
  title: string;
  status: string;
  publishedVersion: number | null;
  hasDraft: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function listCustomPages(): Promise<CustomPageRow[]> {
  const rows = await db
    .select({ page: websitePages, doc: websiteDocuments })
    .from(websitePages)
    .innerJoin(websiteDocuments, eq(websiteDocuments.key, websitePages.documentKey))
    .where(eq(websitePages.pageType, 'custom'));
  // Publishing clears the draft: take the title from the live version then.
  const liveTitles = new Map<string, string>();
  for (const { doc } of rows) {
    if (doc.draft !== null || !doc.publishedVersion) continue;
    const v = await db
      .select({ content: websiteVersions.content })
      .from(websiteVersions)
      .where(and(eq(websiteVersions.documentKey, doc.key), eq(websiteVersions.version, doc.publishedVersion)))
      .limit(1);
    const t = (v[0]?.content as { title?: string } | undefined)?.title;
    if (t) liveTitles.set(doc.key, t);
  }
  return rows
    .map(({ page, doc }) => {
      const content = (doc.draft ?? { title: liveTitles.get(doc.key) }) as { title?: string } | null;
      return {
        slug: page.slug,
        docKey: page.documentKey,
        title: content?.title || page.slug,
        status: page.status,
        publishedVersion: doc.publishedVersion,
        hasDraft: doc.draft !== null,
        createdAt: page.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export async function createCustomPage(slugIn: string, titleIn: string, userId: string | null): Promise<{ slug: string; docKey: string }> {
  const slug = String(slugIn || '').trim().toLowerCase();
  const title = String(titleIn || '').trim().slice(0, 120);
  if (!CUSTOM_SLUG_RE.test(slug) || slug.length > 60) throw new WebsiteStoreError('Use lowercase letters, numbers and hyphens for the address (e.g. summer-sale)', 400, 'INVALID_SLUG');
  if (RESERVED_CUSTOM_SLUGS.has(slug)) throw new WebsiteStoreError('That address is already used by a built-in page', 409, 'SLUG_TAKEN');
  if (title.length < 2) throw new WebsiteStoreError('Give the page a title', 400, 'INVALID_TITLE');
  const docKey = customDocKey(slug);
  const existing = await db.select().from(websitePages).where(eq(websitePages.slug, slug)).limit(1);
  if (existing[0]) throw new WebsiteStoreError('A page with that address already exists', 409, 'SLUG_TAKEN');
  await ensureDocument(docKey, 'page');
  await db.insert(websitePages).values({ slug, documentKey: docKey, pageType: 'custom', status: 'draft', createdByUserId: userId });
  await saveDraft(docKey, 'page', normalizeCustomPage(defaultCustomPage(title)), 0, userId);
  await loadCustomPageKeys(true);
  return { slug, docKey };
}

export async function setCustomPageStatus(docKey: string, status: 'published' | 'archived' | 'draft'): Promise<void> {
  await db.update(websitePages).set({ status, updatedAt: new Date() }).where(and(eq(websitePages.documentKey, docKey), eq(websitePages.pageType, 'custom')));
  await loadCustomPageKeys(true);
}

/** Restore an archived page (it stays unpublished until published again). */
export async function restoreCustomPage(slug: string): Promise<void> {
  await db.update(websitePages).set({ status: 'draft', updatedAt: new Date() }).where(and(eq(websitePages.slug, slug), eq(websitePages.pageType, 'custom')));
  await loadCustomPageKeys(true);
}
