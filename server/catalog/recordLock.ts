import type { Request, Response } from 'express';

/**
 * Phase C.1 — per-record write serialization for the Studio-guarded catalog writes.
 *
 * GUARANTEE (current architecture: ONE Node process — PM2 `fork` mode, single
 * instance — and the in-memory catalog store): while a request holds the lock for
 * a record key, no other request that takes the same key can run. Each guarded
 * handler reads the current record, validates, runs its version check
 * (`rejectStaleWrite`) and writes — all inside the lock — so two requests with
 * the same expected version can never both pass the check and both write, no
 * matter what I/O (database, files) the handler awaits in between.
 *
 * LIMITS — not guaranteed:
 *  - across processes / PM2 cluster instances / multiple servers (the lock is
 *    process-local memory; the in-memory catalog store would also diverge);
 *  - against writers that do not take the lock: unguarded routes (e.g. product
 *    PUT, lifecycle and marketplace-access routes), legacy CMS-mirror callers of
 *    those routes, and server-internal writers (inventory sync, guide-publish
 *    creator promotion, reference-id stamping). Those remain last-write-wins.
 *  - across restarts (no persistence; a restart simply drops queued waiters'
 *    connections like any other in-flight request).
 *  - all-or-nothing beyond validation: the Product Studio save
 *    (POST /catalog/products/:id/studio-save) writes the product and the detail
 *    record only after both pass every check, and writes both records before any
 *    side-effect I/O (inventory, events). With the in-memory store those two
 *    writes cannot fail independently; there is no rollback, so in the optional
 *    Firestore persistence mode (two network writes) a failure of the second
 *    write would leave the first in place.
 *
 * ORDER inside a guarded handler: 404 → authorization / ownership → validation
 * → version check (409 STALE_WRITE) → write. A stale request that is also
 * unauthorized or invalid gets the 403 / 400 / 422, not the 409.
 *
 * Keys are acquired in sorted order, so multi-record writers (product + detail)
 * cannot deadlock with single-record writers.
 */
const tails = new Map<string, Promise<void>>();

async function acquire(key: string): Promise<() => void> {
  const previous = tails.get(key) ?? Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => mine);
  tails.set(key, tail);
  await previous;
  return () => {
    release();
    if (tails.get(key) === tail) tails.delete(key);
  };
}

export type RecordKind = 'product' | 'productDetail' | 'brand' | 'creator' | 'guide';

export const recordKey = (kind: RecordKind, id: string) => `${kind}:${id}`;

/** Run `fn` while holding every key (deduplicated, acquired in sorted order). */
export async function withRecordLocks<T>(keys: string[], fn: () => Promise<T>): Promise<T> {
  const ordered = [...new Set(keys.filter(Boolean))].sort();
  const releases: Array<() => void> = [];
  try {
    for (const key of ordered) releases.push(await acquire(key));
    return await fn();
  } finally {
    for (const release of releases.reverse()) release();
  }
}

/** Express handler wrapper: the whole handler runs inside the record lock(s). */
export function lockedHandler(
  keysFor: (req: Request) => string[],
  handler: (req: Request, res: Response) => Promise<void>,
) {
  return (req: Request, res: Response) => withRecordLocks(keysFor(req), () => handler(req, res));
}
