import type { Response } from 'express';

export const AUTH_ERROR_CODES = {
  MISSING_TOKEN: 'AUTH_MISSING_TOKEN',
  INVALID_TOKEN: 'AUTH_INVALID_TOKEN',
  EXPIRED_TOKEN: 'AUTH_EXPIRED_TOKEN',
  UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  FORBIDDEN: 'AUTH_FORBIDDEN',
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

type AuthErrorBody = {
  success: false;
  error: string;
  code: AuthErrorCode;
  requestId?: string;
};

export function sendAuthError(
  res: Response,
  status: 401 | 403,
  code: AuthErrorCode,
  message: string,
) {
  const requestId = res.locals.requestId as string | undefined;
  const body: AuthErrorBody = {
    success: false,
    error: message,
    code,
    ...(requestId ? { requestId } : {}),
  };

  return res.status(status).json(body);
}

export function isExpiredFirebaseTokenError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return (
    candidate.code === 'auth/id-token-expired' ||
    (typeof candidate.message === 'string' &&
      candidate.message.toLowerCase().includes('expired'))
  );
}
