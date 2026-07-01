import type { VercelRequest, VercelResponse } from '@vercel/node';

export const setCorsHeaders = (res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
