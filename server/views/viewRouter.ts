/**
 * Page-view endpoints.
 *   POST /views/:kind/:id          -> { count }   kind = product | brand (public; one per visitor per day)
 *   GET  /views/:kind/:id          -> { count }   (public)
 *   GET  /views/:kind/:id/viewers  -> who viewed  (the item's seller or a Super Admin only)
 * A seller viewing their own product or brand is not counted.
 */
import { inArray } from 'drizzle-orm';
import { Router, type Request, type Response } from 'express';
import { db } from '../db/client';
import { users } from '../db/schema';
import { authenticateRequest, softAuthenticateRequest } from '../middleware/auth';
import { hasRole } from '../permissions/authorization';
import { ROLES } from '../permissions/roles';
import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import { recordView, viewCount, viewLog, visitorKey, type ViewKind } from './viewStore';

export const viewRouter = Router();

const kindOf = (raw: string): ViewKind | null => (raw === 'product' || raw === 'brand' ? raw : null);

async function ownerOf(kind: ViewKind, id: string): Promise<{ exists: boolean; sellerId?: string }> {
  if (kind === 'product') {
    const p = await catalogStore.getProduct(id);
    return { exists: Boolean(p), sellerId: p?.sellerId };
  }
  const b = await catalogStore.getBrand(id);
  return { exists: Boolean(b), sellerId: b?.sellerId };
}

/** Coarse traffic source from the page the visitor arrived from. */
function sourceOf(referrer: unknown): string {
  const raw = typeof referrer === 'string' ? referrer.trim() : '';
  if (!raw) return 'direct';
  let host = '';
  try {
    host = new URL(raw).hostname.toLowerCase();
  } catch {
    return 'other';
  }
  if (/(^|\.)choosify\.bd$/.test(host)) return 'choosify';
  if (/facebook\.com$|fb\.com$|fb\.me$|messenger\.com$/.test(host)) return 'facebook';
  if (/instagram\.com$/.test(host)) return 'instagram';
  if (/tiktok\.com$/.test(host)) return 'tiktok';
  if (/youtube\.com$|youtu\.be$/.test(host)) return 'youtube';
  if (/google\./.test(host)) return 'google';
  if (/bing\.com$|duckduckgo\.com$|yahoo\.com$/.test(host)) return 'search';
  if (/whatsapp\.com$|wa\.me$/.test(host)) return 'whatsapp';
  return 'other';
}

function deviceOf(userAgent: string | undefined): string {
  const ua = userAgent || '';
  if (/ipad|tablet/i.test(ua)) return 'tablet';
  if (/mobi|android|iphone/i.test(ua)) return 'mobile';
  return 'desktop';
}

viewRouter.get('/views/:kind/:id', async (req: Request, res: Response) => {
  const kind = kindOf(req.params.kind);
  if (!kind) {
    res.status(404).json({ error: 'Unknown view type' });
    return;
  }
  res.json({ count: viewCount(kind, req.params.id) });
});

viewRouter.post('/views/:kind/:id', softAuthenticateRequest, async (req: Request, res: Response) => {
  const kind = kindOf(req.params.kind);
  if (!kind) {
    res.status(404).json({ error: 'Unknown view type' });
    return;
  }
  const { id } = req.params;
  const owner = await ownerOf(kind, id);
  if (!owner.exists) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  // The owner opening their own page is not a view.
  if (req.userId && owner.sellerId && req.userId === owner.sellerId) {
    res.json({ count: viewCount(kind, id), counted: false });
    return;
  }
  const userAgent = req.get('user-agent');
  const count = recordView(kind, id, visitorKey({ userId: req.userId, ip: req.ip, userAgent }), {
    userId: req.userId,
    source: sourceOf((req.body as { referrer?: unknown } | undefined)?.referrer),
    device: deviceOf(userAgent),
  });
  res.json({ count });
});

/**
 * Who viewed an item — for its seller and Super Admins only. Signed-in viewers
 * are listed by name and Choosify ID (never email/phone); guests are counted.
 */
viewRouter.get('/views/:kind/:id/viewers', authenticateRequest, async (req: Request, res: Response) => {
  const kind = kindOf(req.params.kind);
  if (!kind) {
    res.status(404).json({ error: 'Unknown view type' });
    return;
  }
  const { id } = req.params;
  const owner = await ownerOf(kind, id);
  if (!owner.exists) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const isOwner = Boolean(req.userId && owner.sellerId && req.userId === owner.sellerId);
  if (!isOwner && !hasRole(req.userRole, ROLES.SUPER_ADMIN)) {
    res.status(403).json({ error: 'Only the seller or a Super Admin can see who viewed this.' });
    return;
  }

  const rows = viewLog(kind, id);
  const bySource: Record<string, number> = {};
  const byDevice: Record<string, number> = {};
  const people = new Map<string, { visits: number; lastViewedAt: string }>();
  let guestVisits = 0;
  for (const r of rows) {
    bySource[r.src || 'direct'] = (bySource[r.src || 'direct'] ?? 0) + 1;
    byDevice[r.dev || 'desktop'] = (byDevice[r.dev || 'desktop'] ?? 0) + 1;
    if (!r.u) {
      guestVisits += 1;
      continue;
    }
    const p = people.get(r.u);
    if (p) p.visits += 1;
    else people.set(r.u, { visits: 1, lastViewedAt: r.at });
  }

  const ids = [...people.keys()];
  const accounts = ids.length
    ? await db
        .select({ id: users.id, displayName: users.displayName, choosifyUserId: users.choosifyUserId })
        .from(users)
        .where(inArray(users.id, ids))
    : [];
  const byId = new Map(accounts.map((a) => [String(a.id), a]));

  res.json({
    totalViews: viewCount(kind, id),
    loggedVisits: rows.length,
    guestVisits,
    bySource,
    byDevice,
    viewers: ids.map((uid) => ({
      name: byId.get(uid)?.displayName || 'Choosify shopper',
      choosifyUserId: byId.get(uid)?.choosifyUserId || null,
      visits: people.get(uid)!.visits,
      lastViewedAt: people.get(uid)!.lastViewedAt,
    })),
  });
});
