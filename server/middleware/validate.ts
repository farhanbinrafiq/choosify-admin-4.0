import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { validationError } from '../lib/apiResponse';
import type { ApiErrorCode } from '../lib/apiErrorCodes';
import {
  formatZodIssues,
  resolveValidationErrorCode,
  type ValidationIssue,
} from '../validation/shared/formatZodError';

export type ValidationSchemas = {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
};

function rejectValidation(
  res: Response,
  message: string,
  issues: ValidationIssue[],
  code: ApiErrorCode,
) {
  validationError(res, message, issues, code);
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        const issues = formatZodIssues(result.error);
        rejectValidation(
          res,
          'Invalid request parameters',
          issues,
          resolveValidationErrorCode(issues),
        );
        return;
      }
      req.params = result.data as Request['params'];
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        const issues = formatZodIssues(result.error);
        rejectValidation(
          res,
          'Invalid query parameters',
          issues,
          resolveValidationErrorCode(issues),
        );
        return;
      }
      req.query = result.data as Request['query'];
    }

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        const issues = formatZodIssues(result.error);
        rejectValidation(
          res,
          'Invalid request body',
          issues,
          resolveValidationErrorCode(issues),
        );
        return;
      }
      req.body = result.data;
    }

    next();
  };
}
