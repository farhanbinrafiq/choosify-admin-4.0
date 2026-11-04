/**
 * Website Studio persistence (migration 0015). Drafts live on website_documents; published
 * content lives ONLY in immutable website_versions rows. Publish / rollback / backfill each
 * insert a new version inside a transaction that locks the document row, so version numbers
 * never collide and history is never rewritten.
 */
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { users, websiteDocuments, websiteVersions } from '../db/schema';
import { type WebsiteDocumentKind } from './websiteContent';

export class WebsiteStoreError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
  }
}

export type WebsiteDocumentRow = typeof websiteDocuments.$inferSelect;
export type WebsiteVersionRow = typeof websiteVersions.$inferSelect;

export async function getDocument(key: string): Promise<WebsiteDocumentRow | null> {
  const rows = await db.select().from(websiteDocuments).where(eq(websiteDocuments.key, key)).limit(1);
  return rows[0] ?? null;
}

export async function listDocuments(): Promise<WebsiteDocumentRow[]> {
  return db.select().from(websiteDocuments).orderBy(websiteDocuments.key);
}

export async function getVersion(key: string, version: number): Promise<WebsiteVersionRow | null> {
  const rows = await db
    .select()
    .from(websiteVersions)
    .where(and(eq(websiteVersions.documentKey, key), eq(websiteVersions.version, version)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getPublished(key: string): Promise<{ doc: WebsiteDocumentRow; version: WebsiteVersionRow } | null> {
  const doc = await getDocument(key);
  if (!doc || !doc.publishedVersion) return null;
  const version = await getVersion(key, doc.publishedVersion);
  return version ? { doc, version } : null;
}

/** Version list WITHOUT content (history view); newest first. */
export async function listVersions(key: string, limit = 100) {
  return db
    .select({
      version: websiteVersions.version,
      source: websiteVersions.source,
      restoredFromVersion: websiteVersions.restoredFromVersion,
      changeNote: websiteVersions.changeNote,
      publishedByUserId: websiteVersions.publishedByUserId,
      publishedByName: users.displayName,
      publishedAt: websiteVersions.publishedAt,
    })
    .from(websiteVersions)
    // Name is looked up live (no FK on the version row): a deleted account shows no name, history stays.
    .leftJoin(users, eq(users.id, websiteVersions.publishedByUserId))
    .where(eq(websiteVersions.documentKey, key))
    .orderBy(desc(websiteVersions.version))
    .limit(limit);
}

/** Recent publications across all documents (Publish History). */
export async function listRecentPublications(limit = 50) {
  return db
    .select({
      documentKey: websiteVersions.documentKey,
      version: websiteVersions.version,
      source: websiteVersions.source,
      restoredFromVersion: websiteVersions.restoredFromVersion,
      changeNote: websiteVersions.changeNote,
      publishedByUserId: websiteVersions.publishedByUserId,
      publishedByName: users.displayName,
      publishedAt: websiteVersions.publishedAt,
    })
    .from(websiteVersions)
    .leftJoin(users, eq(users.id, websiteVersions.publishedByUserId))
    .orderBy(desc(websiteVersions.publishedAt))
    .limit(limit);
}

/** Creates the document row if missing (no draft, unpublished). Returns the row. */
export async function ensureDocument(key: string, kind: WebsiteDocumentKind): Promise<WebsiteDocumentRow> {
  await db.insert(websiteDocuments).values({ key, kind }).onConflictDoNothing();
  const doc = await getDocument(key);
  if (!doc) throw new WebsiteStoreError('Document could not be created', 500, 'DOCUMENT_CREATE_FAILED');
  if (doc.kind !== kind) throw new WebsiteStoreError('Document kind mismatch', 409, 'KIND_MISMATCH');
  return doc;
}

/**
 * Saves the draft. `expectedRevision` must match the stored draft_revision (stale-tab guard),
 * so two editors never silently overwrite each other.
 */
export async function saveDraft(
  key: string,
  kind: WebsiteDocumentKind,
  content: unknown,
  expectedRevision: number,
  actorUserId: string | null,
): Promise<WebsiteDocumentRow> {
  await ensureDocument(key, kind);
  const updated = await db
    .update(websiteDocuments)
    .set({
      draft: content as object,
      draftRevision: sql`${websiteDocuments.draftRevision} + 1`,
      draftBaseVersion: sql`${websiteDocuments.publishedVersion}`,
      draftUpdatedAt: new Date(),
      draftUpdatedByUserId: actorUserId,
      updatedAt: new Date(),
    })
    .where(and(eq(websiteDocuments.key, key), eq(websiteDocuments.draftRevision, expectedRevision)))
    .returning();
  if (!updated[0]) {
    throw new WebsiteStoreError('Someone else saved this draft since you opened it. Reload to see their changes.', 409, 'STALE_DRAFT');
  }
  return updated[0];
}

export async function discardDraft(key: string, expectedRevision: number): Promise<WebsiteDocumentRow> {
  const updated = await db
    .update(websiteDocuments)
    .set({
      draft: null,
      draftRevision: sql`${websiteDocuments.draftRevision} + 1`,
      draftBaseVersion: null,
      draftUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(websiteDocuments.key, key), eq(websiteDocuments.draftRevision, expectedRevision)))
    .returning();
  if (!updated[0]) throw new WebsiteStoreError('The draft changed since you opened it. Reload first.', 409, 'STALE_DRAFT');
  return updated[0];
}

type PublishInput = {
  key: string;
  content: unknown;
  source: 'publish' | 'rollback' | 'backfill';
  changeNote: string;
  actorUserId: string | null;
  restoredFromVersion?: number;
  /** Publish of the draft: require this draft revision and clear the draft afterwards. */
  fromDraftRevision?: number;
  /** Backfill only: refuse if the document already has any version. */
  onlyIfUnpublished?: boolean;
};

/** Inserts the next immutable version and points the document at it — atomically. */
export async function publishVersion(input: PublishInput): Promise<{ doc: WebsiteDocumentRow; version: WebsiteVersionRow }> {
  return db.transaction(async (tx) => {
    const locked = await tx.execute(sql`SELECT key, draft_revision, published_version FROM website_documents WHERE key = ${input.key} FOR UPDATE`);
    const row = (locked as unknown as { rows: Array<{ draft_revision: number; published_version: number | null }> }).rows[0];
    if (!row) throw new WebsiteStoreError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    if (input.onlyIfUnpublished && row.published_version) {
      throw new WebsiteStoreError('Document already has published versions', 409, 'ALREADY_PUBLISHED');
    }
    if (input.fromDraftRevision !== undefined && row.draft_revision !== input.fromDraftRevision) {
      throw new WebsiteStoreError('The draft changed since you opened it. Review it again before publishing.', 409, 'STALE_DRAFT');
    }
    const maxRes = await tx.execute(sql`SELECT COALESCE(MAX(version), 0) AS max FROM website_versions WHERE document_key = ${input.key}`);
    const next = Number((maxRes as unknown as { rows: Array<{ max: number | string }> }).rows[0]?.max ?? 0) + 1;
    const [version] = await tx
      .insert(websiteVersions)
      .values({
        documentKey: input.key,
        version: next,
        content: input.content as object,
        source: input.source,
        restoredFromVersion: input.source === 'rollback' ? input.restoredFromVersion ?? null : null,
        changeNote: input.changeNote,
        publishedByUserId: input.actorUserId,
      })
      .returning();
    const clearDraft = input.fromDraftRevision !== undefined;
    const [doc] = await tx
      .update(websiteDocuments)
      .set({
        publishedVersion: next,
        updatedAt: new Date(),
        ...(clearDraft
          ? { draft: null, draftBaseVersion: null, draftRevision: sql`${websiteDocuments.draftRevision} + 1`, draftUpdatedAt: new Date() }
          : {}),
      })
      .where(eq(websiteDocuments.key, input.key))
      .returning();
    return { doc, version };
  });
}
