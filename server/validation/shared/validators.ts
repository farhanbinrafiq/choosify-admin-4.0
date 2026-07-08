import { z } from 'zod';

export const emailValidator = z
  .string()
  .trim()
  .email('Invalid email address')
  .max(320);

export const passwordValidator = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128);

export const phoneValidator = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9\s-]{6,18}$/, 'Invalid phone number');

export const slugValidator = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format');

export const uuidValidator = z.string().uuid('Invalid UUID');

export const booleanValidator = z.union([
  z.boolean(),
  z.enum(['true', 'false']).transform((value) => value === 'true'),
  z.literal('1').transform(() => true),
  z.literal('0').transform(() => false),
]);

export const positiveIntegerValidator = z.coerce
  .number()
  .int('Must be an integer')
  .positive('Must be a positive integer');

export const priceValidator = z.coerce
  .number()
  .nonnegative('Price must be zero or greater')
  .finite('Price must be a finite number');

export const dateValidator = z.union([
  z.string().datetime({ message: 'Invalid ISO date' }),
  z.string().date('Invalid date'),
]);

export const urlValidator = z.string().trim().url('Invalid URL');

export const paginationValidator = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

export const searchValidator = z.object({
  q: z.string().trim().max(200).optional(),
});

export const sortValidator = z.object({
  sortBy: z.string().trim().min(1).max(64).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});
