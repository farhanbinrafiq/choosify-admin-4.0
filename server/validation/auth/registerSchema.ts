import { z } from 'zod';
import { emailValidator, passwordValidator } from '../shared/validators';

export const RegisterBodySchema = z.object({
  email: emailValidator,
  password: passwordValidator,
  fullName: z.string().trim().min(2, 'Your name is required').max(120),
});
