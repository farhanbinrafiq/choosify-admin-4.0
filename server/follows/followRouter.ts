/**
 * Brand follow endpoints. Following needs a signed-in account; counts are public.
 *   GET    /follows/brands/:brandId   -> { count, following }   (following only when signed in)
 *   POST   /follows/brands/:brandId   -> { count, following: true }
 *   DELETE /follows/brands/:brandId   -> { count, following: false }
 *   GET    /follows/me/brands         -> { brandIds }
 */
import { Router, type Request, type Response } from 'express';
import { authenticateRequest, softAuthenticateRequest } from '../middleware/auth';
import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import {
  brandFollowerCount,
  brandsFollowedBy,
  followBrand,
  isFollowingBrand,
  unfollowBrand,
} from './brandFollowStore';

export const followRouter = Router();

async function brandExists(brandId: string): Promise<boolean> {
  return Boolean(brandId && (await catalogStore.getBrand(brandId)));
}

followRouter.get('/follows/brands/:brandId', softAuthenticateRequest, async (req: Request, res: Response) => {
  const { brandId } = req.params;
  if (!(await brandExists(brandId))) {
    res.status(404).json({ error: 'Brand not found' });
    return;
  }
  res.json({
    count: brandFollowerCount(brandId),
    following: req.userId ? isFollowingBrand(req.userId, brandId) : false,
  });
});

followRouter.post('/follows/brands/:brandId', authenticateRequest, async (req: Request, res: Response) => {
  const { brandId } = req.params;
  if (!(await brandExists(brandId))) {
    res.status(404).json({ error: 'Brand not found' });
    return;
  }
  try {
    res.json({ count: followBrand(req.userId as string, brandId), following: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Could not follow the brand' });
  }
});

followRouter.delete('/follows/brands/:brandId', authenticateRequest, async (req: Request, res: Response) => {
  const { brandId } = req.params;
  try {
    res.json({ count: unfollowBrand(req.userId as string, brandId), following: false });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Could not unfollow the brand' });
  }
});

followRouter.get('/follows/me/brands', authenticateRequest, (req: Request, res: Response) => {
  res.json({ brandIds: brandsFollowedBy(req.userId as string) });
});

/** Staff read-only: the brands a given user follows (Super Admin consumer profile). */
followRouter.get('/follows/users/:userId/brands', authenticateRequest, (req: Request, res: Response) => {
  const role = req.userRole;
  const staff = role === 'super_admin' || role === 'admin' || role === 'support_agent' || role === 'moderator';
  if (!staff) {
    res.status(403).json({ error: 'Not authorized to view another user’s follows' });
    return;
  }
  res.json({ brandIds: brandsFollowedBy(req.params.userId) });
});
