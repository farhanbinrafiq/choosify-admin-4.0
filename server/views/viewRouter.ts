/**
 * Page-view endpoints (public; counts are de-duplicated per visitor per day).
 *   POST /views/:kind/:id  -> { count }   kind = product | brand
 *   GET  /views/:kind/:id  -> { count }
 * A seller viewing their own product or brand is not counted.
 */
import { Router, type Request, type Response } from 'express';
import { softAuthenticateRequest } from '../middleware/auth';
import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import { recordView, viewCount, visitorKey, type ViewKind } from './viewStore';

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
  const count = recordView(kind, id, visitorKey({ userId: req.userId, ip: req.ip, userAgent: req.get('user-agent') }));
  res.json({ count });
});
