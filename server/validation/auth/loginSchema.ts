import { z } from 'zod';
import { emailValidator, passwordValidator } from '../shared/validators';

export const LoginBodySchema = z.object({
  email: emailValidator,
  password: passwordValidator,
});
