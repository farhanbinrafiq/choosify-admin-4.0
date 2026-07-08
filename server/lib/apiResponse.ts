import type { Response } from 'express';
import { API_ERROR_CODES, type ApiErrorCode } from './apiErrorCodes';

type ErrorBody = {
  success: false;
  error: string;
  code?: ApiErrorCode;
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
  const requestId = (res.locals.requestId as string | undefined) || undefined;
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

export function accepted<T>(res: Response, data: T) {
  return success(res, data, 202);
}

export function error(
  res: Response,
  message: string,
  status = 500,
  details?: unknown,
  code?: ApiErrorCode,
) {
  const body: ErrorBody = attachRequestId(res, {
    success: false,
    error: message,
    ...(code ? { code } : {}),
    ...(details !== undefined ? { details } : {}),
  });
  return res.status(status).json(body);
}

export function badRequest(
  res: Response,
  message = 'Bad request',
  details?: unknown,
  code: ApiErrorCode = API_ERROR_CODES.BAD_REQUEST,
) {
  return error(res, message, 400, details, code);
}

export function validationError(
  res: Response,
  message: string,
  details?: unknown,
  code: ApiErrorCode = API_ERROR_CODES.VALIDATION_ERROR,
) {
  return error(res, message, 400, details, code);
}

export function unauthorized(
  res: Response,
  message = 'Authentication required',
  code: ApiErrorCode = API_ERROR_CODES.AUTH_REQUIRED,
) {
  return error(res, message, 401, undefined, code);
}

export function forbidden(
  res: Response,
  message = 'Permission denied',
  code: ApiErrorCode = API_ERROR_CODES.PERMISSION_DENIED,
) {
  return error(res, message, 403, undefined, code);
}

export function notFound(
  res: Response,
  message = 'Resource not found',
  code: ApiErrorCode = API_ERROR_CODES.RESOURCE_NOT_FOUND,
) {
  return error(res, message, 404, undefined, code);
}

export function conflict(
  res: Response,
  message = 'Resource conflict',
  details?: unknown,
  code: ApiErrorCode = API_ERROR_CODES.CONFLICT,
) {
  return error(res, message, 409, details, code);
}

export function serverError(
  res: Response,
  message = 'Internal server error',
  details?: unknown,
  code: ApiErrorCode = API_ERROR_CODES.SERVER_ERROR,
) {
  return error(res, message, 500, details, code);
}
