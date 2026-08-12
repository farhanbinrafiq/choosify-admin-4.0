/**
 * Unified Choosify Platform Reference ID allocator.
 * User (CF) continues to use existing choosifyUserId counter — never renumbers.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { choosifyReferenceIdCounters } from '../db/schema';
import { Logger } from '../lib/logger';
import {
  allocateNextChoosifyUserId,
  ensureChoosifyUserIdSchema,
} from '../auth/choosifyUserId';
import {
  formatReferenceId,
  parseReferenceId,
  normalizeReferenceIdQuery,
  type ReferenceEntityType,
  REFERENCE_ENTITY_TYPES,
  REFERENCE_PREFIX,
} from '../../shared/referenceIds/registry';

export {
  formatReferenceId,
  parseReferenceId,
  normalizeReferenceIdQuery,
  REFERENCE_ENTITY_TYPES,
  REFERENCE_PREFIX,
  REFERENCE_FIELD,
  type ReferenceEntityType,
} from '../../shared/referenceIds/registry';

const INDEX_PATH =
  process.env.CHOOSIFY_REFERENCE_ID_INDEX_PATH?.trim() ||
  join(process.cwd(), '.data', 'reference-id-index.json');

const MIRROR_PATH =
  process.env.CHOOSIFY_REFERENCE_ID_SEQUENCE_PATH?.trim() ||
  join(process.cwd(), '.data', 'reference-id-sequences.json');

type IndexEntry = {
  entityType: ReferenceEntityType;
  internalId: string;
  assignedAt: string;
};

type IndexSnapshot = {
  version: 1;
  savedAt: string;
  byRef: Record<string, IndexEntry>;
};

type MirrorSnapshot = {
  version: 1;
  updatedAt: string;
  nextByType: Record<string, number>;
};

const indexState: { byRef: Record<string, IndexEntry>; hydrated: boolean } = {
  byRef: {},
  hydrated: false,
};

let schemaReady: Promise<void> | null = null;
const allocateLocks = new Map<ReferenceEntityType, Promise<unknown>>();

function writeMirror(nextByType: Record<string, number>): void {
  try {
    mkdirSync(dirname(MIRROR_PATH), { recursive: true });
    const snap: MirrorSnapshot = {
      version: 1,
      updatedAt: new Date().toISOString(),
      nextByType,
    };
    writeFileSync(MIRROR_PATH, JSON.stringify(snap, null, 2), 'utf8');
  } catch (error) {
    Logger.warn('referenceId sequence mirror save failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function readMirror(): MirrorSnapshot | null {
  if (!existsSync(MIRROR_PATH)) return null;
  try {
    return JSON.parse(readFileSync(MIRROR_PATH, 'utf8')) as MirrorSnapshot;
  } catch {
    return null;
  }
}

function ensureIndexHydrated(): void {
  if (indexState.hydrated) return;
  indexState.hydrated = true;
  if (!existsSync(INDEX_PATH)) return;
  try {
    const parsed = JSON.parse(readFileSync(INDEX_PATH, 'utf8')) as IndexSnapshot;
    if (parsed?.version === 1 && parsed.byRef) {
      indexState.byRef = parsed.byRef;
    }
  } catch (error) {
    Logger.warn('referenceId index load failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function persistIndex(): void {
  try {
    mkdirSync(dirname(INDEX_PATH), { recursive: true });
    const snap: IndexSnapshot = {
      version: 1,
      savedAt: new Date().toISOString(),
      byRef: indexState.byRef,
    };
    writeFileSync(INDEX_PATH, JSON.stringify(snap), 'utf8');
  } catch (error) {
    Logger.warn('referenceId index save failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function registerReferenceAssignment(
  entityType: ReferenceEntityType,
  refId: string,
  internalId: string,
): void {
  ensureIndexHydrated();
  const canonical = normalizeReferenceIdQuery(refId, entityType);
  if (!canonical) throw new Error(`Invalid reference id: ${refId}`);
  const existing = indexState.byRef[canonical];
  if (existing && existing.internalId !== internalId) {
    throw new Error(`Reference ID collision: ${canonical}`);
  }
  if (!existing) {
    indexState.byRef[canonical] = {
      entityType,
      internalId,
      assignedAt: new Date().toISOString(),
    };
    persistIndex();
  }
}

export function lookupReferenceIndex(raw: string): IndexEntry & { referenceId: string } | null {
  ensureIndexHydrated();
  const parsed = parseReferenceId(raw);
  if (!parsed) return null;
  const hit = indexState.byRef[parsed.canonical];
  if (!hit) return null;
  return { ...hit, referenceId: parsed.canonical };
}

export function listReferenceIndexByType(entityType: ReferenceEntityType): Array<{
  referenceId: string;
  internalId: string;
}> {
  ensureIndexHydrated();
  return Object.entries(indexState.byRef)
    .filter(([, v]) => v.entityType === entityType)
    .map(([referenceId, v]) => ({ referenceId, internalId: v.internalId }));
}

export async function ensureReferenceIdSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await ensureChoosifyUserIdSchema();
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS choosify_reference_id_counters (
          entity_type varchar(32) PRIMARY KEY,
          next_value bigint NOT NULL DEFAULT 1,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      for (const t of REFERENCE_ENTITY_TYPES) {
        if (t === 'user') continue; // CF counter remains authoritative for users
        await db.execute(sql`
          INSERT INTO choosify_reference_id_counters (entity_type, next_value)
          VALUES (${t}, 1)
          ON CONFLICT (entity_type) DO NOTHING
        `);
      }
      // Raise counters from durable index max so restarts never reuse.
      ensureIndexHydrated();
      const maxByType: Record<string, number> = {};
      for (const [ref, entry] of Object.entries(indexState.byRef)) {
        const parsed = parseReferenceId(ref);
        if (!parsed || parsed.entityType === 'user') continue;
        maxByType[parsed.entityType] = Math.max(
          maxByType[parsed.entityType] || 0,
          parsed.sequence,
        );
      }
      const mirror = readMirror();
      for (const t of REFERENCE_ENTITY_TYPES) {
        if (t === 'user') continue;
        const desired = Math.max(
          (maxByType[t] || 0) + 1,
          mirror?.nextByType?.[t] || 1,
          1,
        );
        await db.execute(sql`
          UPDATE choosify_reference_id_counters
          SET next_value = GREATEST(next_value, ${desired}),
              updated_at = now()
          WHERE entity_type = ${t}
        `);
      }
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function allocateFromCounter(entityType: ReferenceEntityType, tx?: DbTx): Promise<string> {
  await ensureReferenceIdSchema();
  if (entityType === 'user') {
    return allocateNextChoosifyUserId(tx);
  }

  const runner = tx || db;
  const rows = await runner
    .update(choosifyReferenceIdCounters)
    .set({
      nextValue: sql`${choosifyReferenceIdCounters.nextValue} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(choosifyReferenceIdCounters.entityType, entityType))
    .returning({ nextValue: choosifyReferenceIdCounters.nextValue });

  let after = Number(rows[0]?.nextValue);
  if (!Number.isFinite(after) || after < 2) {
    await runner
      .insert(choosifyReferenceIdCounters)
      .values({ entityType, nextValue: 2, updatedAt: new Date() })
      .onConflictDoNothing();
    const retry = await runner
      .update(choosifyReferenceIdCounters)
      .set({
        nextValue: sql`${choosifyReferenceIdCounters.nextValue} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(choosifyReferenceIdCounters.entityType, entityType))
      .returning({ nextValue: choosifyReferenceIdCounters.nextValue });
    after = Number(retry[0]?.nextValue);
    if (!Number.isFinite(after) || after < 2) {
      throw new Error(`Failed to allocate reference id for ${entityType}`);
    }
  }

  const allocated = after - 1;
  const mirror = readMirror() || { version: 1 as const, updatedAt: '', nextByType: {} };
  mirror.nextByType[entityType] = after;
  writeMirror(mirror.nextByType);
  return formatReferenceId(entityType, allocated);
}

/**
 * Atomically allocate next reference ID for entity type.
 * User type delegates to existing CF allocator (preserves all CF IDs).
 */
export async function allocateReferenceId(
  entityType: ReferenceEntityType,
  tx?: DbTx,
): Promise<string> {
  const prev = allocateLocks.get(entityType) || Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  allocateLocks.set(
    entityType,
    prev.then(() => gate),
  );
  await prev;
  try {
    return await allocateFromCounter(entityType, tx);
  } finally {
    release();
  }
}

/**
 * Ensure entity has a reference ID. Never mutates an existing valid assignment.
 */
export async function ensureEntityReferenceId(params: {
  entityType: ReferenceEntityType;
  internalId: string;
  current?: string | null;
}): Promise<string> {
  const { entityType, internalId, current } = params;
  if (current) {
    const canonical = normalizeReferenceIdQuery(current, entityType);
    if (canonical) {
      registerReferenceAssignment(entityType, canonical, internalId);
      return canonical;
    }
  }
  const ref = await allocateReferenceId(entityType);
  registerReferenceAssignment(entityType, ref, internalId);
  return ref;
}

export type DomainBackfillResult = {
  entityType: ReferenceEntityType;
  total: number;
  alreadyHadId: number;
  assigned: number;
  duplicates: string[];
};

export async function backfillEntityList(params: {
  entityType: ReferenceEntityType;
  rows: Array<{ internalId: string; createdAt?: string; current?: string | null }>;
  apply: (internalId: string, refId: string) => void | Promise<void>;
}): Promise<DomainBackfillResult> {
  const sorted = [...params.rows].sort((a, b) => {
    const ca = a.createdAt || '';
    const cb = b.createdAt || '';
    if (ca !== cb) return ca.localeCompare(cb);
    return a.internalId.localeCompare(b.internalId);
  });

  let alreadyHadId = 0;
  let assigned = 0;
  const duplicates: string[] = [];
  const seen = new Map<string, string>();

  for (const row of sorted) {
    if (row.current) {
      const canonical = normalizeReferenceIdQuery(row.current, params.entityType) || row.current;
      alreadyHadId += 1;
      if (seen.has(canonical) && seen.get(canonical) !== row.internalId) {
        duplicates.push(`${canonical} → ${seen.get(canonical)} and ${row.internalId}`);
      } else {
        seen.set(canonical, row.internalId);
        registerReferenceAssignment(params.entityType, canonical, row.internalId);
      }
      continue;
    }
    const ref = await ensureEntityReferenceId({
      entityType: params.entityType,
      internalId: row.internalId,
      current: null,
    });
    await params.apply(row.internalId, ref);
    assigned += 1;
    seen.set(ref, row.internalId);
  }

  return {
    entityType: params.entityType,
    total: sorted.length,
    alreadyHadId,
    assigned,
    duplicates,
  };
}
