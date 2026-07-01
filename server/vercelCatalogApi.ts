import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureCatalogSeedData } from './catalogMemoryStore';

let seeded = false;

export const setCorsHeaders = (res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

export const ensureSeeded = async () => {
  if (seeded) return;
  await ensureCatalogSeedData();
  seeded = true;
};

export const readJsonBody = async <T>(req: VercelRequest): Promise<T> => {
  if (req.body && typeof req.body === 'object') {
    return req.body as T;
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body) as T;
  }
  return {} as T;
};

export const sendError = (res: VercelResponse, status: number, message: string) => {
  res.status(status).json({ error: message });
};

export const withCatalogApi = (
  handler: (req: VercelRequest, res: VercelResponse) => Promise<void | VercelResponse>,
) => async (req: VercelRequest, res: VercelResponse) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  try {
    await ensureSeeded();
    await handler(req, res);
  } catch (error) {
    if (!res.writableEnded) {
      sendError(res, 500, error instanceof Error ? error.message : 'Unexpected server error');
    }
  }
};
