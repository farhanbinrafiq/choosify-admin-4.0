import type { ZodError } from 'zod';
import { API_ERROR_CODES } from '../../lib/apiErrorCodes';

export type ValidationIssue = {
  path: string;
  message: string;
  code: string;
};

export function formatZodIssues(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || 'root',
    message: issue.message,
    code: issue.code,
  }));
}

export function resolveValidationErrorCode(issues: ValidationIssue[]): (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES] {
  const joined = issues.map((issue) => `${issue.path}:${issue.message}`).join(' ').toLowerCase();

  if (joined.includes('email')) return API_ERROR_CODES.INVALID_EMAIL;
  if (joined.includes('phone')) return API_ERROR_CODES.INVALID_PHONE;
  if (joined.includes('price')) return API_ERROR_CODES.INVALID_PRICE;
  if (joined.includes('slug')) return API_ERROR_CODES.INVALID_SLUG;
  if (issues.some((issue) => issue.path.startsWith('query') || issue.path === 'q')) {
    return API_ERROR_CODES.INVALID_QUERY;
  }
  if (issues.some((issue) => issue.path.length > 0 && issue.path !== 'root')) {
    return API_ERROR_CODES.INVALID_PARAMETER;
  }

  return API_ERROR_CODES.VALIDATION_ERROR;
}
