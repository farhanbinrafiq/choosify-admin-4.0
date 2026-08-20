import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { media as mediaTable } from '../db/schema';
import { visibilityForCategory, type MediaCategory } from '../lib/mediaStorage';

export type MediaRecord = typeof mediaTable.$inferSelect;

export async function createMediaRecord(input: {
  uploadedByUserId: string;
  category: MediaCategory;
  mediaType: 'image' | 'video' | 'document';
  provider: 'local' | 'cloudinary';
  relativePath?: string;
  publicUrl?: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
  originalFilename?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}): Promise<MediaRecord> {
  const rows = await db
    .insert(mediaTable)
    .values({
      uploadedByUserId: input.uploadedByUserId,
      category: input.category,
      visibility: visibilityForCategory(input.category),
      mediaType: input.mediaType,
      provider: input.provider,
      relativePath: input.relativePath,
      publicUrl: input.publicUrl,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      width: input.width,
      height: input.height,
      durationSeconds: input.durationSeconds,
      originalFilename: input.originalFilename,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
    })
    .returning();
  return rows[0];
}

export async function getMediaRecord(id: string): Promise<MediaRecord | null> {
  const rows = await db.select().from(mediaTable).where(eq(mediaTable.id, id)).limit(1);
  return rows[0] || null;
}

export async function deleteMediaRecord(id: string): Promise<boolean> {
  const rows = await db.delete(mediaTable).where(eq(mediaTable.id, id)).returning();
  return rows.length > 0;
}

export async function markMediaStatus(id: string, status: string): Promise<MediaRecord | null> {
  const rows = await db.update(mediaTable).set({ status }).where(eq(mediaTable.id, id)).returning();
  return rows[0] || null;
}

/** Attaches an already-uploaded media row to an entity (e.g. a warranty claim) via the polymorphic association. */
export async function linkMediaToEntity(
  mediaId: string,
  relatedEntityType: string,
  relatedEntityId: string,
): Promise<MediaRecord | null> {
  const rows = await db
    .update(mediaTable)
    .set({ relatedEntityType, relatedEntityId })
    .where(eq(mediaTable.id, mediaId))
    .returning();
  return rows[0] || null;
}
