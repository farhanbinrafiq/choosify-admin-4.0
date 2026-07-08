import { z } from 'zod';
import { emailValidator } from '../shared/validators';

export const DevLoginBodySchema = z.object({
  email: emailValidator.optional(),
  role: z.string().trim().optional(),
});
