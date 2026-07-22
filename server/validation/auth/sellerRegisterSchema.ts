import { z } from 'zod';
import { emailValidator, passwordValidator } from '../shared/validators';

export const SellerRegisterBodySchema = z.object({
  email: emailValidator,
  /** Optional — application form uses custom-token sign-in; server generates one if omitted. */
  password: passwordValidator.optional(),
  displayName: z.string().trim().min(2, 'Your name is required').max(120),
  storeName: z.string().trim().min(2, 'Business/brand name is required').max(160),
  phone: z
    .string()
    .trim()
    .min(8, 'Phone number is required')
    .max(24)
    .regex(/^\+?[0-9][0-9\s-]{6,22}$/, 'Invalid phone number'),
  category: z.string().trim().min(1, 'Category is required').max(120),
  city: z.string().trim().min(2, 'City is required').max(80),
  website: z
    .string()
    .trim()
    .max(320)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
});
