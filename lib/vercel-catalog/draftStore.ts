import { randomUUID } from 'crypto';
import {
  getDocumentById,
  listWhereOrdered,
  upsertDocument,
  upsertDocumentById,
} from '../../server/lib/firestore/queryHelpers';
import { hasFirebaseAdminCredentials } from './firebaseAdmin';

export type DraftEntityType = 'brand' | 'product' | 'creator' | 'guide';

export interface EntityDraft {
  id: string;
  entityType: DraftEntityType;
  entityId: string;
  data: Record<string, unknown>;
  updatedAt: string;
  updatedBy: string;
}

export interface EntityVersion {
  id: string;
  entityType: DraftEntityType;
  entityId: string;
  label: string;
  snapshot: Record<string, unknown>;
  createdAt: string;
  createdBy: string;
  createdByName?: string;
}

const DRAFTS_COLLECTION = 'catalog_drafts';
const VERSIONS_COLLECTION = 'catalog_versions';
const DEFAULT_VERSION_LIMIT = 15;

const useAdminFirestore =
  process.env.CATALOG_USE_FIRESTORE === 'true' && hasFirebaseAdminCredentials();

// Drafts/versions are opaque, in-progress data (never run through the publish-time
// normalizeXInput validators), so unlike catalogStore this module doesn't need a
// per-entity switch — one generic collection each, entity-typed via a field.
const memoryDrafts = new Map<string, EntityDraft>();
const memoryVersions: EntityVersion[] = [];

function draftDocId(entityType: DraftEntityType, entityId: string): string {
  return `${entityType}_${entityId}`;
}

export const draftStore = {
  async getDraft(entityType: DraftEntityType, entityId: string): Promise<EntityDraft | null> {
    const docId = draftDocId(entityType, entityId);
    if (useAdminFirestore) {
      return getDocumentById<EntityDraft>(DRAFTS_COLLECTION, docId);
    }
    return memoryDrafts.get(docId) ?? null;
  },

  async upsertDraft(
    entityType: DraftEntityType,
    entityId: string,
    data: Record<string, unknown>,
    updatedBy: string,
  ): Promise<EntityDraft> {
    const docId = draftDocId(entityType, entityId);
    const draft: EntityDraft = {
      id: docId,
      entityType,
      entityId,
      data,
      updatedAt: new Date().toISOString(),
      updatedBy,
    };
    if (useAdminFirestore) {
      return upsertDocumentById(DRAFTS_COLLECTION, docId, draft);
    }
    memoryDrafts.set(docId, draft);
    return draft;
  },

  async listVersions(
    entityType: DraftEntityType,
    entityId: string,
    limit = DEFAULT_VERSION_LIMIT,
  ): Promise<EntityVersion[]> {
    if (useAdminFirestore) {
      return listWhereOrdered<EntityVersion>(
        VERSIONS_COLLECTION,
        [
          { field: 'entityType', operator: '==', value: entityType },
          { field: 'entityId', operator: '==', value: entityId },
        ],
        'createdAt',
        { direction: 'desc', limit },
      );
    }
    return memoryVersions
      .filter((version) => version.entityType === entityType && version.entityId === entityId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  },

  async createVersion(
    entityType: DraftEntityType,
    entityId: string,
    label: string,
    snapshot: Record<string, unknown>,
    createdBy: string,
    createdByName?: string,
  ): Promise<EntityVersion> {
    const version: EntityVersion = {
      id: `ver-${randomUUID()}`,
      entityType,
      entityId,
      label,
      snapshot,
      createdAt: new Date().toISOString(),
      createdBy,
      createdByName,
    };
    if (useAdminFirestore) {
      await upsertDocument(VERSIONS_COLLECTION, version);
    } else {
      memoryVersions.unshift(version);
    }
    return version;
  },
};
