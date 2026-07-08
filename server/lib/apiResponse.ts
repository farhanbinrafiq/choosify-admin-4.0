import type { Response } from 'express';

type ErrorBody = {
  success: false;
  error: string;
  requestId?: string;
  details?: unknown;
  stack?: string;
};

type SuccessBody<T> = {
  success: true;
  data: T;
  requestId?: string;
};

function attachRequestId<T extends Record<string, unknown>>(res: Response, body: T): T {
  const requestId = res.locals.requestId as string | undefined;
  if (!requestId) return body;
  return { ...body, requestId };
}

export function success<T>(res: Response, data: T, status = 200) {
  return res.status(status).json(
    attachRequestId(res, {
      success: true,
      data,
    } satisfies SuccessBody<T>),
  );
}

export function created<T>(res: Response, data: T) {
  return success(res, data, 201);
}

export function error(
  res: Response,
  message: string,
  status = 500,
  details?: unknown,
) {
  const body: ErrorBody = attachRequestId(res, {
    success: false,
    error: message,
    ...(details !== undefined ? { details } : {}),
  });
  return res.status(status).json(body);
}

export function notFound(res: Response, message = 'Resource not found') {
  return error(res, message, 404);
}

export function validationError(res: Response, message: string, details?: unknown) {
  return error(res, message, 400, details);
}
