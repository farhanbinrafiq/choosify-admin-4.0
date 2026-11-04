/**
 * Website Studio — initial backfill (Phase 1). Copies the CURRENTLY AUTHORITATIVE live settings
 * into version 1 of each website document, so the CMS starts from exactly what shoppers see today.
 *
 *   npx tsx scripts/website-backfill.ts            # DRY RUN (default): prints the plan, writes nothing
 *   npx tsx scripts/website-backfill.ts --apply    # writes; skips any document that already has versions
 *
 * Reads the catalog snapshot JSON READ-ONLY (CATALOG_MEMORY_SNAPSHOT_PATH or the default path).
 * Writes only website_documents / website_versions rows. Never touches the catalog snapshot, and
 * the storefront keeps reading its current sources until later phases switch it over — so running
 * this changes nothing public.
 *
 * "Authoritative" = what the storefront actually displays today (audit 2026-11-04):
 *  - navigation: the storefront ignores the stored list and hardcodes PRIMARY_NAV_ITEMS (Web
 *    lib/navigation.ts) — that list is copied here, not the stale stored one.
 *  - footer columns / description / newsletter, social links, SEO entries, popular searches,
 *    homepage config: the stored catalog values ARE what the storefront renders.
 *  - company: the storefront displays hardcoded contact details (support@choosify.bd,
 *    +88 0141 0474014, USA + Bangladesh offices). The stored websiteName/supportEmail/supportPhone
 *    are not displayed anywhere (owner confirmed support@choosify.bd, 2026-11-04). The copyright
 *    holder is the live footer's "Choosify Technologies Ltd" (owner decision 2026-11-04: keep it).
 *    Registered legal name and business identifiers stay BLANK / unverified.
 *  - brand assets: none are set live (storefront uses built-in files) → empty slots.
 *  - pages + legal documents: NOT backfilled (storefront keeps its built-in page content until
 *    Phase 4; legal documents are prepared there as drafts only).
 */
import fs from 'node:fs';
import path from 'node:path';
import { ensureDocument, getDocument, publishVersion } from '../server/website/websiteStore';
import { validateContent, type WebsiteDocumentKind } from '../server/website/websiteContent';
import { db } from '../server/db/client';

const APPLY = process.argv.includes('--apply');
const NOTE = 'Initial import of the live storefront settings (Website Studio backfill)';

const snapshotPath = process.env.CATALOG_MEMORY_SNAPSHOT_PATH?.trim() || path.join(process.cwd(), '.data', 'catalog-memory-snapshot.json');
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) as { site?: Record<string, any>; homepage?: Record<string, any> };
const site = snapshot.site ?? {};
const homepage = snapshot.homepage ?? null;

/** Mirrors Web lib/navigation.ts PRIMARY_NAV_ITEMS — the navbar shoppers see today. */
const LIVE_NAVIGATION = [
  { id: 'home', label: 'Home', path: '/' },
  { id: 'categories', label: 'Categories', path: '/categories' },
  { id: 'products', label: 'Products & Services', path: '/products' },
  { id: 'brands', label: 'Brands', path: '/brands' },
  { id: 'recommendations', label: 'Recommendations', path: '/spotlight' },
  { id: 'deals', label: 'Deals', path: '/deals' },
  { id: 'creators', label: 'Creators', path: '/creators' },
  { id: 'compare', label: 'Compare', path: '/compare' },
].map((item, order) => ({ ...item, order, enabled: true, type: 'system' as const }));

/** Mirrors the contact details the Web footer + Contact page display today (Footer.tsx fallbacks). */
const LIVE_COMPANY = {
  displayName: 'Choosify',
  legalName: '',
  supportEmail: 'support@choosify.bd',
  supportPhone: '+88 0141 0474014',
  offices: [
    { id: 'usa', label: 'USA Office', lines: ['New York, NY', 'United States'], enabled: true },
    { id: 'bangladesh', label: 'Bangladesh Office', lines: ['House-744 & 746, Road-10, Avenue-4', 'Mirpur DOHS, Dhaka-1216', 'Bangladesh'], enabled: true },
  ],
  identifiers: { dbid: { value: '', verified: false }, tradeLicense: { value: '', verified: false } },
  // Footer renders "© {current year} {copyrightText}. All rights reserved." (as it does today).
  copyrightText: 'Choosify Technologies Ltd',
};

const plan: Array<{ key: string; kind: WebsiteDocumentKind; content: unknown; from: string }> = [
  { key: 'company', kind: 'company', content: LIVE_COMPANY, from: 'storefront-displayed contact details' },
  { key: 'brand_assets', kind: 'brand_assets', content: {}, from: 'none set live (built-in files stay as fallbacks)' },
  {
    key: 'navigation',
    kind: 'navigation',
    content: {
      items: LIVE_NAVIGATION,
      announcementBar: { text: String(site.announcementBarText ?? ''), enabled: Boolean(site.announcementBarEnabled) },
    },
    from: 'storefront PRIMARY_NAV_ITEMS + stored announcement bar',
  },
  {
    key: 'footer',
    kind: 'footer',
    content: {
      description: String(site.footer?.description ?? ''),
      newsletterEnabled: site.footer?.newsletterEnabled !== false,
      columns: Array.isArray(site.footer?.columns) ? site.footer.columns : [],
    },
    from: 'stored footer (rendered by the storefront)',
  },
  { key: 'social', kind: 'social', content: { links: Array.isArray(site.socialLinks) ? site.socialLinks : [] }, from: 'stored social links' },
  {
    key: 'seo',
    kind: 'seo',
    content: {
      pages: Array.isArray(site.seoEntries) ? site.seoEntries : [],
      popularSearches: Array.isArray(site.popularSearches) ? site.popularSearches : [],
    },
    from: 'stored SEO entries + popular searches',
  },
  ...(homepage ? [{ key: 'homepage', kind: 'homepage' as WebsiteDocumentKind, content: homepage, from: 'stored homepage config' }] : []),
];

async function main() {
  console.log(`Website Studio backfill — ${APPLY ? 'APPLY' : 'DRY RUN (nothing is written)'}`);
  console.log(`catalog snapshot (read-only): ${snapshotPath}`);
  let created = 0;
  let skipped = 0;
  for (const item of plan) {
    const content = validateContent(item.kind, item.content); // fails loudly on anything unsafe
    const existing = await getDocument(item.key);
    const bytes = Buffer.byteLength(JSON.stringify(content), 'utf8');
    if (existing?.publishedVersion) {
      skipped++;
      console.log(`  skip   ${item.key.padEnd(13)} already at version ${existing.publishedVersion}`);
      continue;
    }
    console.log(`  ${APPLY ? 'create' : 'would create'} ${item.key.padEnd(13)} v1  ${bytes} bytes  ← ${item.from}`);
    if (APPLY) {
      await ensureDocument(item.key, item.kind);
      await publishVersion({ key: item.key, content, source: 'backfill', changeNote: NOTE, actorUserId: null, onlyIfUnpublished: true });
      created++;
    }
  }
  console.log(`done: ${APPLY ? `${created} created` : `${plan.length - skipped} would be created`}, ${skipped} already present`);
}

main()
  .catch((e) => {
    console.error('BACKFILL FAILED:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => (db as unknown as { $client?: { end?: () => Promise<void> } }).$client?.end?.());
