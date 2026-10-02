/**
 * Public Identity Phase B — initial public-handle backfill. EXPLICIT ONLY: the
 * 0012 migration creates the table empty and never runs this.
 *
 * Gives each APPROVED Brand / Creator its existing catalog slug as its first
 * active handle (approved 2026-10-01). The seven decision-required records stay
 * without a handle. Catalog JSON is only read, never written (verified by hash).
 *
 * Safe to run repeatedly: a handle the entity already holds is reported as
 * "already assigned" and not inserted again. Refuses — without writing anything —
 * when an approved record is missing or its slug changed, when a handle would
 * break the shared validation contract, or when the table already holds a
 * conflicting row (the handle owned by someone else, retired or reserved, or the
 * entity already holding a different active handle).
 *
 * Usage:
 *   npx tsx scripts/backfill-public-handles.ts [--catalog <snapshot.json>] [--no-db]   (dry run)
 *   npx tsx scripts/backfill-public-handles.ts [--catalog <snapshot.json>] --apply       (writes)
 * --no-db   plan against the catalog alone (assumes an empty public_handles table)
 * --apply   insert in one transaction; refused unless DATABASE_URL is a local
 *           database (127.0.0.1 / localhost) or --allow-remote-database is given.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateHandle } from '../shared/publicHandles/rules';

type EntityType = 'brand' | 'creator';
type Planned = { entityType: EntityType; entityId: string; slug: string };

/** Approved 2026-10-01: these records receive their current slug as their initial handle. */
const APPROVED: Planned[] = [
  { entityType: 'brand', entityId: 'brand-walton', slug: 'walton' },
  { entityType: 'brand', entityId: 'brand-samsung', slug: 'samsung' },
  { entityType: 'brand', entityId: 'brand-apple', slug: 'apple' },
  { entityType: 'brand', entityId: 'brand-apex', slug: 'apex' },
  { entityType: 'brand', entityId: 'brand-cb4ec847-ee87-4184-8659-84959c4c9ef9', slug: 'test' },
  { entityType: 'brand', entityId: 'brand-3f9bfca3-8b9c-4485-b996-ee299bcfa022', slug: 'abcd' },
  { entityType: 'brand', entityId: 'brand-b1dbd4bf-57bf-4c6a-b6fe-91067c7046f3', slug: 'fff' },
  { entityType: 'brand', entityId: 'brand-2eec9bab-9dd1-4d36-8a13-2bd749983ae0', slug: 'artveen' },
  { entityType: 'creator', entityId: 'creator-techtalks', slug: 'tech-talks-bd' },
  { entityType: 'creator', entityId: 'creator-farhan', slug: 'farhan-bin-rafiq' },
  { entityType: 'creator', entityId: 'creator-sarah', slug: 'sarah-jenkins' },
  { entityType: 'creator', entityId: 'creator-1790540879009', slug: 'adiba-prionty' },
];

/** Approved 2026-10-01: these records keep no public handle (no rename, no replacement handle). */
const LEFT_UNASSIGNED: Array<{ entityType: EntityType; entityId: string; why: string }> = [
  { entityType: 'brand', entityId: 'brand-994a25dc-284e-4163-904a-dcedeb34d870', why: 'synthetic QA brand; slug longer than 30 characters' },
  { entityType: 'brand', entityId: 'brand-dcba022e-09d2-4e63-a59c-acbcae856496', why: 'synthetic QA brand; slug longer than 30 characters' },
  { entityType: 'brand', entityId: 'brand-0f8ad6d4-fbd2-45dc-a261-90395525ca06', why: 'synthetic QA brand; slug longer than 30 characters' },
  { entityType: 'brand', entityId: 'brand-545a04a2-2622-454e-a821-47b6753e9a60', why: 'synthetic QA brand; slug longer than 30 characters' },
  { entityType: 'brand', entityId: 'brand-3ad26933-23fb-4ae8-84cc-f601b0036cbb', why: 'synthetic QA brand; slug longer than 30 characters' },
  { entityType: 'creator', entityId: 'creator-1787574771519', why: 'synthetic QA creator; slug longer than 30 characters' },
  { entityType: 'creator', entityId: 'creator-1788872945569', why: 'draft creator; slug "creator" is reserved' },
];

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const APPLY = flag('--apply');
const NO_DB = flag('--no-db');
const catalogPath = resolve(option('--catalog') || '.data/catalog-memory-snapshot.json');

function refuse(message: string): never {
  console.error(`REFUSED: ${message}`);
  console.error('Nothing was written.');
  process.exit(1);
}

function readCatalog() {
  const raw = readFileSync(catalogPath);
  const json = JSON.parse(raw.toString('utf8').replace(/^﻿/, '')) as {
    brands?: Array<{ id: string; slug?: string }>;
    creators?: Array<{ id: string; slug?: string }>;
  };
  return { hash: createHash('sha256').update(raw).digest('hex'), brands: json.brands || [], creators: json.creators || [] };
}

async function main() {
  if (APPLY && NO_DB) refuse('--apply cannot be combined with --no-db');
  const catalog = readCatalog();
  const records = new Map<string, { entityType: EntityType; entityId: string; slug: string }>();
  for (const b of catalog.brands) records.set(`brand:${b.id}`, { entityType: 'brand', entityId: b.id, slug: String(b.slug ?? '') });
  for (const c of catalog.creators) records.set(`creator:${c.id}`, { entityType: 'creator', entityId: c.id, slug: String(c.slug ?? '') });
  console.log(`catalog: ${catalogPath}`);
  console.log(`catalog sha256: ${catalog.hash}  brands=${catalog.brands.length} creators=${catalog.creators.length}`);

  // 1. The approved source records must be exactly as reviewed.
  const plannedHandles = new Set<string>();
  for (const p of APPROVED) {
    const current = records.get(`${p.entityType}:${p.entityId}`);
    if (!current) refuse(`approved ${p.entityType} ${p.entityId} is no longer in the catalog`);
    if (current.slug !== p.slug) refuse(`approved ${p.entityType} ${p.entityId} slug changed: expected "${p.slug}", found "${current.slug}"`);
    const v = validateHandle(p.slug);
    if (!v.ok || v.handle !== p.slug) refuse(`approved slug "${p.slug}" (${p.entityType} ${p.entityId}) fails the handle contract`);
    if (plannedHandles.has(p.slug)) refuse(`handle "${p.slug}" is planned twice`);
    plannedHandles.add(p.slug);
  }
  const accounted = new Set([...APPROVED, ...LEFT_UNASSIGNED].map((x) => `${x.entityType}:${x.entityId}`));
  const unplanned = [...records.values()].filter((r) => !accounted.has(`${r.entityType}:${r.entityId}`));

  // 2. Compare with what the table already holds.
  type Row = { handle: string; entity_type: string; entity_id: string | null; status: string };
  let existing: Row[] = [];
  let pool: import('pg').Pool | null = null;
  if (!NO_DB) {
    const url = process.env.DATABASE_URL || '';
    if (!url) refuse('DATABASE_URL is not set (use --no-db for a catalog-only dry run)');
    const local = /@(127\.0\.0\.1|localhost)(:\d+)?\//.test(url) || /\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url);
    if (APPLY && !local && !flag('--allow-remote-database')) refuse('--apply only runs against a local database unless --allow-remote-database is given');
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } }); // same as server/db/client.ts
    const ids = APPROVED.map((p) => p.entityId);
    const { rows } = await pool.query<Row>(
      `select handle, entity_type, entity_id, status from public_handles where handle = any($1::text[]) or entity_id = any($2::text[])`,
      [[...plannedHandles], ids],
    );
    existing = rows;
  }

  const toInsert: Planned[] = [];
  const already: Planned[] = [];
  for (const p of APPROVED) {
    const byHandle = existing.find((r) => r.handle === p.slug);
    const activeForEntity = existing.find((r) => r.entity_type === p.entityType && r.entity_id === p.entityId && r.status === 'active');
    if (byHandle) {
      if (byHandle.entity_type === p.entityType && byHandle.entity_id === p.entityId && byHandle.status === 'active') {
        already.push(p);
        continue;
      }
      refuse(`handle "${p.slug}" is already held (${byHandle.entity_type} ${byHandle.entity_id ?? '-'}, ${byHandle.status}); planned for ${p.entityType} ${p.entityId}`);
    }
    if (activeForEntity) refuse(`${p.entityType} ${p.entityId} already has a different active handle "${activeForEntity.handle}"`);
    toInsert.push(p);
  }

  console.log(`\nWOULD INSERT (${toInsert.length}):`);
  for (const p of toInsert) console.log(`  + ${p.entityType.padEnd(7)} ${p.entityId.padEnd(44)} @${p.slug}`);
  console.log(`ALREADY ASSIGNED, unchanged (${already.length}):`);
  for (const p of already) console.log(`  = ${p.entityType.padEnd(7)} ${p.entityId.padEnd(44)} @${p.slug}`);
  console.log(`LEFT UNASSIGNED by decision (${LEFT_UNASSIGNED.length}):`);
  for (const u of LEFT_UNASSIGNED) {
    const r = records.get(`${u.entityType}:${u.entityId}`);
    console.log(`  - ${u.entityType.padEnd(7)} ${u.entityId.padEnd(44)} slug="${r?.slug ?? '(not in catalog)'}" — ${u.why}`);
  }
  console.log(`NOT IN THE APPROVED PLAN, not assigned (${unplanned.length}):`);
  for (const r of unplanned) console.log(`  ? ${r.entityType.padEnd(7)} ${r.entityId.padEnd(44)} slug="${r.slug}"`);

  if (APPLY && pool && toInsert.length) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`select pg_advisory_xact_lock(hashtext('public_handles:backfill'))`);
      for (const p of toInsert) {
        await client.query(
          `insert into public_handles (handle, entity_type, entity_id, status) values ($1, $2, $3, 'active')`,
          [p.slug, p.entityType, p.entityId],
        );
      }
      await client.query('COMMIT');
      console.log(`\nAPPLIED: inserted ${toInsert.length} handle(s).`);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      refuse(`database rejected the backfill, rolled back: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      client.release();
    }
  } else {
    console.log(`\n${APPLY ? 'APPLY: nothing to insert.' : 'DRY RUN: nothing was written.'}`);
  }
  await pool?.end();

  if (readCatalog().hash !== catalog.hash) refuse('the catalog file changed while the backfill ran');
  console.log('catalog unchanged (sha256 re-verified).');
}

main().catch((error) => {
  console.error('FAILED', error instanceof Error ? error.message : error);
  process.exit(1);
});
