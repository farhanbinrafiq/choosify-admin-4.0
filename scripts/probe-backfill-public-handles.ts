/**
 * Public Identity — initial backfill plan probe (scripts/backfill-public-handles.ts).
 *
 * Runs the REAL backfill script as a child process:
 *  - plan checks against a fixture catalog (the reviewed production identity
 *    extract, 13 Brands + 6 Creators) with --no-db: no database at all;
 *  - database checks against a TEMPORARY database created on the disposable local
 *    cluster in PROBE_DISPOSABLE_DATABASE_URL (127.0.0.1 / localhost only) from
 *    migration 0012's own SQL, and dropped at the end. DATABASE_URL is always set
 *    explicitly for the child (never inherited), so .env is never used.
 *
 *  1  plan: exactly 7 approved assignments, each the entity's own slug
 *  2  12 exclusions: the 7 original ones + 5 owner-choice profiles (exact ids)
 *  3  the Choosify Brand can never receive @test (nor @choosifybd) from this plan
 *  4  no username is generated or substituted (changed slug → refused)
 *  5  dry run is read-only (database + catalog file unchanged)
 *  6  fail-closed guard: an approved entity holding a different handle, or a
 *     planned handle held by someone else → refused, nothing written
 *  7  owner-set handle on an excluded profile (production state) is not touched
 *  8  --apply on the temporary database inserts exactly the 7, then is idempotent
 *
 *   PROBE_DISPOSABLE_DATABASE_URL=postgres://postgres@127.0.0.1:55499/choosify_qa \
 *     npx tsx scripts/probe-backfill-public-handles.ts
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';

const FAIL: string[] = [];
let passes = 0;
function check(c: unknown, label: string, detail?: unknown) {
  if (c) passes += 1;
  else FAIL.push(label);
  console.log(c ? 'PASS' : 'FAIL', label, c ? '' : JSON.stringify(detail ?? '').slice(0, 400));
}

// The reviewed production identity extract (2026-10-01; unchanged on 2026-10-02).
const BRANDS: Array<[string, string]> = [
  ['brand-walton', 'walton'],
  ['brand-samsung', 'samsung'],
  ['brand-apple', 'apple'],
  ['brand-apex', 'apex'],
  ['brand-994a25dc-284e-4163-904a-dcedeb34d870', 'qa-sprint3-test-store-synthetic-safe-to-delete'],
  ['brand-dcba022e-09d2-4e63-a59c-acbcae856496', 'qa-sprint6-test-store-synthetic-safe-to-delete'],
  ['brand-0f8ad6d4-fbd2-45dc-a261-90395525ca06', 'qa-sprint6-test-store-b-synthetic-safe-to-delete'],
  ['brand-cb4ec847-ee87-4184-8659-84959c4c9ef9', 'test'],
  ['brand-3f9bfca3-8b9c-4485-b996-ee299bcfa022', 'abcd'],
  ['brand-b1dbd4bf-57bf-4c6a-b6fe-91067c7046f3', 'fff'],
  ['brand-545a04a2-2622-454e-a821-47b6753e9a60', 'sprint13-qa-store-a-1787840573356'],
  ['brand-3ad26933-23fb-4ae8-84cc-f601b0036cbb', 'sprint13-qa-store-b-1787840573356'],
  ['brand-2eec9bab-9dd1-4d36-8a13-2bd749983ae0', 'artveen'],
];
const CREATORS: Array<[string, string]> = [
  ['creator-techtalks', 'tech-talks-bd'],
  ['creator-farhan', 'farhan-bin-rafiq'],
  ['creator-sarah', 'sarah-jenkins'],
  ['creator-1787574771519', 'qa-sprint4-test-channel-synthetic-safe-to-delete'],
  ['creator-1788872945569', 'creator'],
  ['creator-1790540879009', 'adiba-prionty'],
];
const EXPECT_APPROVED = [
  'brand brand-walton @walton',
  'brand brand-samsung @samsung',
  'brand brand-apple @apple',
  'brand brand-apex @apex',
  'creator creator-techtalks @tech-talks-bd',
  'creator creator-farhan @farhan-bin-rafiq',
  'creator creator-sarah @sarah-jenkins',
];
const ORIGINAL_EXCLUSIONS = [
  'brand-994a25dc-284e-4163-904a-dcedeb34d870',
  'brand-dcba022e-09d2-4e63-a59c-acbcae856496',
  'brand-0f8ad6d4-fbd2-45dc-a261-90395525ca06',
  'brand-545a04a2-2622-454e-a821-47b6753e9a60',
  'brand-3ad26933-23fb-4ae8-84cc-f601b0036cbb',
  'creator-1787574771519',
  'creator-1788872945569',
];
const OWNER_CHOICE: Array<[string, string]> = [
  ['brand-cb4ec847-ee87-4184-8659-84959c4c9ef9', 'owner_choice_reserved'],
  ['brand-3f9bfca3-8b9c-4485-b996-ee299bcfa022', 'owner_choice_reserved'],
  ['brand-b1dbd4bf-57bf-4c6a-b6fe-91067c7046f3', 'owner_choice_reserved'],
  ['brand-2eec9bab-9dd1-4d36-8a13-2bd749983ae0', 'owner_choice_reserved'],
  ['creator-1790540879009', 'owner_choice_reserved_draft'],
];
const CHOOSIFY = 'brand-cb4ec847-ee87-4184-8659-84959c4c9ef9';

const dir = mkdtempSync(join(tmpdir(), 'pi-backfill-probe-'));
const catalogFile = (name: string, brands = BRANDS, creators = CREATORS) => {
  const file = join(dir, `${name}.json`);
  writeFileSync(
    file,
    JSON.stringify({
      savedAt: '2026-10-02T00:00:00.000Z',
      brands: brands.map(([id, slug]) => ({ id, slug, name: `Fixture ${slug}` })),
      creators: creators.map(([id, slug]) => ({ id, slug, name: `Fixture ${slug}` })),
    }),
  );
  return file;
};
const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

type Run = { code: number; out: string; inserts: string[]; already: string[]; left: Array<{ id: string; why: string }>; unplanned: number };
function runBackfill(args: string[], databaseUrl: string | null): Run {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.DATABASE_URL;
  if (databaseUrl) env.DATABASE_URL = databaseUrl;
  const r = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/backfill-public-handles.ts', ...args], { env, cwd: process.cwd(), encoding: 'utf8' });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const section = (title: string) => {
    const start = out.indexOf(title);
    if (start < 0) return [] as string[];
    const rest = out.slice(start).split('\n').slice(1);
    const lines: string[] = [];
    for (const l of rest) {
      if (!/^\s{2}[+=?-] /.test(l)) break;
      lines.push(l);
    }
    return lines;
  };
  const norm = (l: string) => l.trim().slice(2).trim().replace(/\s+/g, ' ');
  return {
    code: r.status ?? -1,
    out,
    inserts: section('WOULD INSERT').map(norm),
    already: section('ALREADY ASSIGNED').map(norm),
    left: section('LEFT UNASSIGNED').map((l) => {
      const m = /^\s+-\s+\w+\s+(\S+)\s+slug="[^"]*"\s+—\s+(.*)$/.exec(l);
      return { id: m?.[1] ?? '?', why: m?.[2] ?? '?' };
    }),
    unplanned: section('NOT IN THE APPROVED PLAN').length,
  };
}

async function main() {
  // ── 1–4. plan (no database) ──
  const fixture = catalogFile('prod-extract');
  const before = sha(fixture);
  const plan = runBackfill(['--catalog', fixture, '--no-db'], null);
  check(plan.code === 0 && /DRY RUN: nothing was written\./.test(plan.out), '1 dry run (no database) exits 0 and writes nothing', plan.out.slice(-300));
  check(JSON.stringify(plan.inserts) === JSON.stringify(EXPECT_APPROVED), '1 exactly the 7 approved assignments, in plan order', plan.inserts);
  check(plan.inserts.every((l) => { const [, id, h] = l.split(' '); return [...BRANDS, ...CREATORS].find(([e]) => e === id)?.[1] === h.slice(1); }), '1 every assignment is the entity’s own catalog slug (nothing generated)');
  check(plan.left.length === 12 && plan.unplanned === 0, '2 12 exclusions, nothing outside the plan', { left: plan.left.length, unplanned: plan.unplanned });
  check(ORIGINAL_EXCLUSIONS.every((id) => plan.left.some((l) => l.id === id && !l.why.startsWith('owner_choice'))), '2 the 7 original exclusions remain with their original reasons');
  for (const [id, code] of OWNER_CHOICE) check(plan.left.some((l) => l.id === id && l.why.startsWith(`${code}:`)), `2 ${id} excluded as ${code}`);
  check(!plan.inserts.some((l) => /@(test|choosifybd)$/.test(l) || l.includes(CHOOSIFY)), '3 the Choosify Brand receives neither @test nor @choosifybd');
  check(!plan.inserts.some((l) => /@(abcd|fff|artveen|adiba-prionty)$/.test(l)), '3 the four other owned profiles receive no automatic handle');
  // Even if the Choosify Brand's slug became a perfectly valid "choosifybd", the plan never assigns it.
  const renamedChoosify = catalogFile('choosify-slug', BRANDS.map(([id, slug]) => [id, id === CHOOSIFY ? 'choosifybd' : slug]) as Array<[string, string]>);
  const rc = runBackfill(['--catalog', renamedChoosify, '--no-db'], null);
  check(rc.code === 0 && !rc.inserts.some((l) => l.includes(CHOOSIFY)) && rc.inserts.length === 7, '3 with slug "choosifybd" the Choosify Brand is still not assigned');
  // A changed slug on an approved entity is refused — never substituted.
  const changed = catalogFile('changed-slug', BRANDS.map(([id, slug]) => [id, id === 'brand-apple' ? 'apple-bd' : slug]) as Array<[string, string]>);
  const cs = runBackfill(['--catalog', changed, '--no-db'], null);
  check(cs.code === 1 && /REFUSED: approved brand brand-apple slug changed/.test(cs.out) && /Nothing was written/.test(cs.out), '4 a changed slug is refused (no substitute username)', cs.out.slice(-200));
  const missing = catalogFile('missing', BRANDS.filter(([id]) => id !== 'brand-apex'));
  check(/REFUSED: approved brand brand-apex is no longer in the catalog/.test(runBackfill(['--catalog', missing, '--no-db'], null).out), '4 a missing approved entity is refused');
  check(/REFUSED: --apply cannot be combined with --no-db/.test(runBackfill(['--catalog', fixture, '--no-db', '--apply'], null).out), '4 --apply without the database is refused');
  check(sha(fixture) === before, '5 the catalog file is unchanged (byte-identical)');

  // ── 5–8. database checks on a temporary database ──
  const adminUrl = process.env.PROBE_DISPOSABLE_DATABASE_URL || '';
  let parsed: URL | null = null;
  try {
    parsed = new URL(adminUrl);
  } catch {}
  if (!parsed || !['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
    console.error('REFUSING database checks: set PROBE_DISPOSABLE_DATABASE_URL to a disposable LOCAL cluster.');
    process.exit(2);
  }
  if (parsed.port === '55432') {
    console.error('REFUSING: 55432 is the local development database, not a disposable cluster.');
    process.exit(2);
  }
  const tmpDb = `pi_backfill_${Date.now().toString(36)}`;
  const admin = new pg.Client({ connectionString: adminUrl, ssl: false as unknown as undefined });
  await admin.connect();
  await admin.query(`create database ${tmpDb}`);
  const dbUrl = new URL(adminUrl);
  dbUrl.pathname = `/${tmpDb}`;
  const db = new pg.Client({ connectionString: dbUrl.toString() });
  try {
    await db.connect();
    await db.query(readFileSync(join(process.cwd(), 'server/db/migrations/0012_public_handles.sql'), 'utf8'));
    const q = async <T = Record<string, any>>(sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows as T[];
    const snapshot = async () => JSON.stringify(await q(`select handle, entity_type, entity_id, status from public_handles order by handle`));
    const url = dbUrl.toString();

    const empty = await snapshot();
    const d1 = runBackfill(['--catalog', fixture], url);
    check(d1.code === 0 && d1.inserts.length === 7 && d1.already.length === 0, '5 dry run with the database: 7 would insert', d1.out.slice(-300));
    check((await snapshot()) === empty, '5 the dry run wrote no row');

    // 7. production-like state: the Choosify Brand already holds its owner-set @choosifybd
    await q(`insert into public_handles (handle, entity_type, entity_id, status) values ('choosifybd','brand',$1,'active')`, [CHOOSIFY]);
    const ownerState = await snapshot();
    const d2 = runBackfill(['--catalog', fixture], url);
    check(d2.code === 0 && JSON.stringify(d2.inserts) === JSON.stringify(EXPECT_APPROVED), '7 an owner-set handle on an excluded profile does not block or change the plan');
    check((await snapshot()) === ownerState, '7 …and is left untouched');

    // 6. fail-closed guards
    await q(`insert into public_handles (handle, entity_type, entity_id, status) values ('walton-old','brand','brand-walton','active')`);
    const g1Before = await snapshot();
    const g1 = runBackfill(['--catalog', fixture], url);
    check(g1.code === 1 && /REFUSED: brand brand-walton already has a different active handle "walton-old"/.test(g1.out) && /Nothing was written/.test(g1.out), '6 an approved entity with a different active handle → whole run refused', g1.out.slice(-250));
    check((await snapshot()) === g1Before, '6 …nothing written');
    const g1Apply = runBackfill(['--catalog', fixture, '--apply'], url);
    check(g1Apply.code === 1 && (await snapshot()) === g1Before, '6 the same guard stops --apply, nothing written');
    await q(`delete from public_handles where handle='walton-old'`);
    await q(`insert into public_handles (handle, entity_type, entity_id, status) values ('samsung','creator','creator-someone-else','active')`);
    const g2 = runBackfill(['--catalog', fixture], url);
    check(g2.code === 1 && /REFUSED: handle "samsung" is already held \(creator creator-someone-else, active\)/.test(g2.out), '6 a planned handle held by another entity → refused', g2.out.slice(-250));
    await q(`delete from public_handles where handle='samsung'`);
    await q(`insert into public_handles (handle, entity_type, entity_id, status, retired_at) values ('apex','brand','brand-apex','retired', now())`);
    const g3 = runBackfill(['--catalog', fixture], url);
    check(g3.code === 1 && /REFUSED: handle "apex" is already held \(brand brand-apex, retired\)/.test(g3.out), '6 a retired handle is never reused, not even for its former holder', g3.out.slice(-250));
    await q(`delete from public_handles where handle='apex'`);

    // 8. apply on the temporary database
    const ap = runBackfill(['--catalog', fixture, '--apply'], url);
    check(ap.code === 0 && /APPLIED: inserted 7 handle\(s\)\./.test(ap.out), '8 --apply inserts exactly the 7 approved handles', ap.out.slice(-250));
    const rows = await q<{ handle: string; entity_id: string }>(`select handle, entity_id from public_handles where status='active' order by handle`);
    check(rows.length === 8 && rows.some((r) => r.handle === 'choosifybd' && r.entity_id === CHOOSIFY), '8 the owner-set handle is still the Choosify Brand’s only handle (7 new + 1 existing)', rows);
    check(!rows.some((r) => ['test', 'abcd', 'fff', 'artveen', 'adiba-prionty'].includes(r.handle)), '8 no owner-choice slug was inserted');
    const again = runBackfill(['--catalog', fixture, '--apply'], url);
    check(again.code === 0 && again.already.length === 7 && again.inserts.length === 0 && /APPLY: nothing to insert\./.test(again.out), '8 a second apply is idempotent');
    check(sha(fixture) === before, '5 the catalog file is still unchanged after every run');
  } finally {
    await db.end().catch(() => undefined);
    await admin.query(`drop database if exists ${tmpDb}`).catch((e) => console.log('cleanup:', e.message));
    const left = (await admin.query(`select count(*)::int n from pg_database where datname=$1`, [tmpDb])).rows[0].n;
    check(left === 0, 'cleanup: temporary database dropped');
    await admin.end();
    rmSync(dir, { recursive: true, force: true });
  }

  console.log(`\n${FAIL.length === 0 ? 'PASS' : 'FAIL'} probe-backfill-public-handles (${passes} passed, ${FAIL.length} failed)`);
  if (FAIL.length) for (const f of FAIL) console.log(`  - ${f}`);
  process.exit(FAIL.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('PROBE ERROR', error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
