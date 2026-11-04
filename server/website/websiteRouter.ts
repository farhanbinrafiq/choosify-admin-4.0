/**
 * Website Studio API (Phase 1 foundation).
 *
 *   Staff (cms:edit):            read documents/versions, save/discard draft, restore defaults as a
 *                                DRAFT, request a preview token.
 *   Publishers (cms:publish):    publish a draft, roll back to an earlier version (non-legal docs).
 *   Legal (cms:legal_publish):   the same for legal:* documents (Terms, Privacy).
 *   Public:                      published content only; drafts only with a valid scoped preview token.
 *
 * Every permission is enforced HERE, server-side — the Admin UI only mirrors it.
 */
import { Router, type Request, type Response } from 'express';
import { authenticateRequest } from '../middleware/auth';
import { requirePartnerEntitlement } from '../entitlements/entitlementMiddleware';
import { requireAnyPermission } from '../middleware/authorization';
import { hasPermission } from '../permissions/authorization';
import { PERMISSIONS } from '../permissions/permissions';
import { Logger } from '../lib/logger';
import {
  EDITABLE_KINDS,
  WebsiteContentError,
  defaultsForKind,
  isLegalKind,
  kindForKey,
  validateContent,
  type WebsiteDocumentKind,
} from './websiteContent';
import {
  WebsiteStoreError,
  discardDraft,
  ensureDocument,
  getDocument,
  getPublished,
  getVersion,
  listDocuments,
  listRecentPublications,
  listVersions,
  publishVersion,
  saveDraft,
} from './websiteStore';
import { PREVIEW_TOKEN_TTL_SECONDS, signPreviewToken, verifyPreviewToken } from './previewTokens';

export const websiteRouter = Router();

const requireCmsEdit = [authenticateRequest, requirePartnerEntitlement, requireAnyPermission([PERMISSIONS.CMS_EDIT])];

const noStore = (res: Response) => res.setHeader('Cache-Control', 'no-store, max-age=0');

function canPublish(req: Request, kind: WebsiteDocumentKind): boolean {
  return hasPermission(req.userRole, isLegalKind(kind) ? PERMISSIONS.CMS_LEGAL_PUBLISH : PERMISSIONS.CMS_PUBLISH, req.permissions);
}

function sendError(res: Response, error: unknown) {
  if (error instanceof WebsiteContentError) {
    res.status(400).json({ error: error.message, code: 'INVALID_CONTENT', field: error.field ?? null });
    return;
  }
  if (error instanceof WebsiteStoreError) {
    res.status(error.status).json({ error: error.message, code: error.code });
    return;
  }
  Logger.error('website_studio.error', { message: error instanceof Error ? error.message : String(error) });
  res.status(500).json({ error: 'Website Studio request failed', code: 'INTERNAL' });
}

/** Resolves :key to its kind or answers 404. */
function resolveKey(req: Request, res: Response): { key: string; kind: WebsiteDocumentKind } | null {
  const key = String(req.params.key || '').trim();
  const kind = kindForKey(key);
  if (!kind) {
    res.status(404).json({ error: 'Unknown website document', code: 'UNKNOWN_DOCUMENT' });
    return null;
  }
  return { key, kind };
}

const changeNoteOf = (req: Request): string | null => {
  const note = String(req.body?.changeNote ?? '').trim().replace(/\s+/g, ' ');
  return note.length >= 3 && note.length <= 300 ? note : null;
};

const revisionOf = (req: Request): number | null => {
  const r = Number(req.body?.expectedRevision);
  return Number.isInteger(r) && r >= 0 ? r : null;
};

function documentView(doc: Awaited<ReturnType<typeof getDocument>>, kind: WebsiteDocumentKind) {
  return {
    key: doc?.key,
    kind,
    editable: EDITABLE_KINDS.has(kind),
    draft: doc?.draft ?? null,
    hasDraft: Boolean(doc && doc.draft !== null),
    draftRevision: doc?.draftRevision ?? 0,
    draftBaseVersion: doc?.draftBaseVersion ?? null,
    draftUpdatedAt: doc?.draftUpdatedAt ?? null,
    draftUpdatedByUserId: doc?.draftUpdatedByUserId ?? null,
    publishedVersion: doc?.publishedVersion ?? null,
  };
}

// ---------------------------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------------------------

/** What the signed-in staff member may do (the UI mirrors this; the routes enforce it). */
websiteRouter.get('/website/capabilities', ...requireCmsEdit, (req, res) => {
  noStore(res);
  res.json({
    data: {
      canEdit: true,
      canPublish: hasPermission(req.userRole, PERMISSIONS.CMS_PUBLISH, req.permissions),
      canPublishLegal: hasPermission(req.userRole, PERMISSIONS.CMS_LEGAL_PUBLISH, req.permissions),
    },
  });
});

websiteRouter.get('/website/documents', ...requireCmsEdit, async (_req, res) => {
  noStore(res);
  try {
    const docs = await listDocuments();
    res.json({
      data: docs.map((d) => ({
        key: d.key,
        kind: d.kind,
        editable: EDITABLE_KINDS.has(d.kind as WebsiteDocumentKind),
        hasDraft: d.draft !== null,
        draftRevision: d.draftRevision,
        draftUpdatedAt: d.draftUpdatedAt,
        publishedVersion: d.publishedVersion,
        updatedAt: d.updatedAt,
      })),
    });
  } catch (e) {
    sendError(res, e);
  }
});

websiteRouter.get('/website/history', ...requireCmsEdit, async (_req, res) => {
  noStore(res);
  try {
    res.json({ data: await listRecentPublications(100) });
  } catch (e) {
    sendError(res, e);
  }
});

websiteRouter.get('/website/documents/:key', ...requireCmsEdit, async (req, res) => {
  noStore(res);
  const r = resolveKey(req, res);
  if (!r) return;
  try {
    const doc = await getDocument(r.key);
    const published = doc?.publishedVersion ? await getVersion(r.key, doc.publishedVersion) : null;
    res.json({
      data: {
        ...documentView(doc, r.kind),
        key: r.key,
        published: published ? { version: published.version, content: published.content, publishedAt: published.publishedAt, publishedByUserId: published.publishedByUserId } : null,
        defaults: defaultsForKind(r.kind),
      },
    });
  } catch (e) {
    sendError(res, e);
  }
});

websiteRouter.get('/website/documents/:key/versions', ...requireCmsEdit, async (req, res) => {
  noStore(res);
  const r = resolveKey(req, res);
  if (!r) return;
  try {
    res.json({ data: await listVersions(r.key) });
  } catch (e) {
    sendError(res, e);
  }
});

websiteRouter.get('/website/documents/:key/versions/:version', ...requireCmsEdit, async (req, res) => {
  noStore(res);
  const r = resolveKey(req, res);
  if (!r) return;
  const v = Number(req.params.version);
  if (!Number.isInteger(v) || v < 1) {
    res.status(400).json({ error: 'Invalid version', code: 'INVALID_VERSION' });
    return;
  }
  try {
    const version = await getVersion(r.key, v);
    if (!version) {
      res.status(404).json({ error: 'Version not found', code: 'VERSION_NOT_FOUND' });
      return;
    }
    res.json({ data: version });
  } catch (e) {
    sendError(res, e);
  }
});

/** Save Draft — never changes public content. */
websiteRouter.put('/website/documents/:key/draft', ...requireCmsEdit, async (req, res) => {
  noStore(res);
  const r = resolveKey(req, res);
  if (!r) return;
  if (!EDITABLE_KINDS.has(r.kind)) {
    res.status(409).json({ error: 'This part of the website is not editable yet', code: 'NOT_EDITABLE_YET' });
    return;
  }
  const expected = revisionOf(req);
  if (expected === null) {
    res.status(400).json({ error: 'expectedRevision is required', code: 'REVISION_REQUIRED' });
    return;
  }
  try {
    const content = validateContent(r.kind, req.body?.content);
    const doc = await saveDraft(r.key, r.kind, content, expected, req.userId ?? null);
    Logger.audit('website.draft_saved', { actorId: req.userId, key: r.key, revision: doc.draftRevision });
    res.json({ data: documentView(doc, r.kind) });
  } catch (e) {
    sendError(res, e);
  }
});

websiteRouter.delete('/website/documents/:key/draft', ...requireCmsEdit, async (req, res) => {
  noStore(res);
  const r = resolveKey(req, res);
  if (!r) return;
  const expected = Number(req.query.expectedRevision);
  if (!Number.isInteger(expected) || expected < 0) {
    res.status(400).json({ error: 'expectedRevision is required', code: 'REVISION_REQUIRED' });
    return;
  }
  try {
    const doc = await discardDraft(r.key, expected);
    Logger.audit('website.draft_discarded', { actorId: req.userId, key: r.key });
    res.json({ data: documentView(doc, r.kind) });
  } catch (e) {
    sendError(res, e);
  }
});

/** Reset Defaults — puts the defaults into the DRAFT only; publishing stays a separate step. */
websiteRouter.post('/website/documents/:key/restore-defaults', ...requireCmsEdit, async (req, res) => {
  noStore(res);
  const r = resolveKey(req, res);
  if (!r) return;
  const defaults = defaultsForKind(r.kind);
  if (!EDITABLE_KINDS.has(r.kind) || defaults === null) {
    res.status(409).json({ error: 'No defaults to restore for this part of the website', code: 'NO_DEFAULTS' });
    return;
  }
  const expected = revisionOf(req);
  if (expected === null) {
    res.status(400).json({ error: 'expectedRevision is required', code: 'REVISION_REQUIRED' });
    return;
  }
  try {
    const doc = await saveDraft(r.key, r.kind, validateContent(r.kind, defaults), expected, req.userId ?? null);
    Logger.audit('website.defaults_restored_to_draft', { actorId: req.userId, key: r.key });
    res.json({ data: documentView(doc, r.kind) });
  } catch (e) {
    sendError(res, e);
  }
});

/** Publish the current draft as a new immutable version. */
websiteRouter.post('/website/documents/:key/publish', ...requireCmsEdit, async (req, res) => {
  noStore(res);
  const r = resolveKey(req, res);
  if (!r) return;
  if (!canPublish(req, r.kind)) {
    res.status(403).json({ error: isLegalKind(r.kind) ? 'Publishing legal documents needs the legal publishing permission' : 'You can save drafts, but publishing needs the publishing permission', code: 'PUBLISH_FORBIDDEN' });
    return;
  }
  const note = changeNoteOf(req);
  const expected = revisionOf(req);
  if (!note) {
    res.status(400).json({ error: 'Describe what changed (3–300 characters)', code: 'CHANGE_NOTE_REQUIRED' });
    return;
  }
  if (expected === null) {
    res.status(400).json({ error: 'expectedRevision is required', code: 'REVISION_REQUIRED' });
    return;
  }
  try {
    const doc = await getDocument(r.key);
    if (!doc || doc.draft === null) {
      res.status(409).json({ error: 'There is no draft to publish', code: 'NO_DRAFT' });
      return;
    }
    const content = validateContent(r.kind, doc.draft);
    const out = await publishVersion({ key: r.key, content, source: 'publish', changeNote: note, actorUserId: req.userId ?? null, fromDraftRevision: expected });
    Logger.audit('website.published', { actorId: req.userId, realActorId: req.realActorUserId ?? null, key: r.key, version: out.version.version, changeNote: note });
    res.json({ data: { ...documentView(out.doc, r.kind), published: { version: out.version.version, publishedAt: out.version.publishedAt } } });
  } catch (e) {
    sendError(res, e);
  }
});

/** Rollback = publish a NEW version copied from an earlier one (history is never rewritten). */
websiteRouter.post('/website/documents/:key/rollback', ...requireCmsEdit, async (req, res) => {
  noStore(res);
  const r = resolveKey(req, res);
  if (!r) return;
  if (!canPublish(req, r.kind)) {
    res.status(403).json({ error: 'Restoring a version needs the publishing permission', code: 'PUBLISH_FORBIDDEN' });
    return;
  }
  const from = Number(req.body?.version);
  const note = changeNoteOf(req);
  if (!Number.isInteger(from) || from < 1) {
    res.status(400).json({ error: 'version is required', code: 'INVALID_VERSION' });
    return;
  }
  if (!note) {
    res.status(400).json({ error: 'Describe why you are restoring this version (3–300 characters)', code: 'CHANGE_NOTE_REQUIRED' });
    return;
  }
  try {
    const old = await getVersion(r.key, from);
    if (!old) {
      res.status(404).json({ error: 'Version not found', code: 'VERSION_NOT_FOUND' });
      return;
    }
    // Re-validate: an old version must still satisfy today's rules before it goes public again.
    const content = validateContent(r.kind, old.content);
    const out = await publishVersion({ key: r.key, content, source: 'rollback', restoredFromVersion: from, changeNote: note, actorUserId: req.userId ?? null });
    Logger.audit('website.rolled_back', { actorId: req.userId, realActorId: req.realActorUserId ?? null, key: r.key, fromVersion: from, newVersion: out.version.version, changeNote: note });
    res.json({ data: { ...documentView(out.doc, r.kind), published: { version: out.version.version, publishedAt: out.version.publishedAt } } });
  } catch (e) {
    sendError(res, e);
  }
});

/** Signed, short-lived preview token scoped to ONE document's draft. */
websiteRouter.post('/website/documents/:key/preview-token', ...requireCmsEdit, async (req, res) => {
  noStore(res);
  const r = resolveKey(req, res);
  if (!r) return;
  try {
    const doc = await getDocument(r.key);
    if (!doc || doc.draft === null) {
      res.status(409).json({ error: 'There is no draft to preview', code: 'NO_DRAFT' });
      return;
    }
    const { token, expiresAt } = signPreviewToken(r.key, doc.draftRevision, req.userId ?? null);
    Logger.audit('website.preview_token_issued', { actorId: req.userId, key: r.key });
    res.json({ data: { token, expiresAt, ttlSeconds: PREVIEW_TOKEN_TTL_SECONDS } });
  } catch (e) {
    sendError(res, e);
  }
});

// ---------------------------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------------------------

/** Published content only. Drafts and never-published documents are 404. */
websiteRouter.get('/website/published/:key', async (req, res) => {
  const r = resolveKey(req, res);
  if (!r) return;
  try {
    const pub = await getPublished(r.key);
    if (!pub) {
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      res.status(404).json({ error: 'Not published', code: 'NOT_PUBLISHED' });
      return;
    }
    // Short public cache so a publish shows up within seconds, not after a deploy.
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.json({ data: { key: r.key, kind: r.kind, version: pub.version.version, publishedAt: pub.version.publishedAt, content: pub.version.content } });
  } catch (e) {
    sendError(res, e);
  }
});

/** Draft content for a valid preview token scoped to this document. Never cached or indexed. */
websiteRouter.get('/website/preview/:key', async (req, res) => {
  noStore(res);
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const r = resolveKey(req, res);
  if (!r) return;
  const token = String(req.query.token || req.get('x-preview-token') || '');
  const claims = token ? verifyPreviewToken(token, r.key) : null;
  if (!claims) {
    res.status(401).json({ error: 'Preview link is invalid or has expired', code: 'PREVIEW_TOKEN_INVALID' });
    return;
  }
  try {
    const doc = await getDocument(r.key);
    if (!doc || doc.draft === null) {
      res.status(404).json({ error: 'There is no draft to preview', code: 'NO_DRAFT' });
      return;
    }
    res.json({ data: { key: r.key, kind: r.kind, draftRevision: doc.draftRevision, content: doc.draft } });
  } catch (e) {
    sendError(res, e);
  }
});

export { ensureDocument };
