import { z } from 'zod';
import { emailValidator, passwordValidator } from '../shared/validators';

export const SellerRegisterBodySchema = z.object({
  email: emailValidator,
  password: passwordValidator,
  displayName: z.string().trim().min(2, 'Display name is required').max(120),
  storeName: z.string().trim().max(160).optional(),
});
