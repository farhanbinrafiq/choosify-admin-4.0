import { Router } from 'express';
import {
  DEV_ROLE_MAP,
  getBearerToken,
  resolveAuthenticatedUserFromToken,
} from './auth/authProfile';
import { validate } from './middleware/validate';
import { DevLoginBodySchema } from './validation/auth/devLoginSchema';

export const authRouter = Router();

authRouter.get('/auth/me', async (req, res) => {
  const token = getBearerToken(req.headers.authorization);

  if (!token) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }

  try {
    const user = await resolveAuthenticatedUserFromToken(token);
    if (user) {
      res.json({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      });
      return;
    }

    res.status(403).json({ error: 'User is not registered as an admin.' });
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : 'Invalid token' });
  }
});

authRouter.post('/auth/dev-login', validate({ body: DevLoginBodySchema }), (req, res) => {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_LOGIN !== 'true') {
    res.status(403).json({ error: 'Dev login disabled in production' });
    return;
  }
  const { email, role } = req.body as { email?: string; role?: string };
  const resolvedRole =
    role ||
    (email ? DEV_ROLE_MAP[email.toLowerCase()] : undefined) ||
    'admin';
  res.json({
    uid: `dev_${resolvedRole}`,
    email: email || `${resolvedRole}@choosify.com.bd`,
    displayName: resolvedRole.replace(/_/g, ' '),
    role: resolvedRole,
    mode: 'dev',
  });
});
