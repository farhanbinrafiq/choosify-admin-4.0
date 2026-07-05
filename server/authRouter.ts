import { Router } from 'express';
import { getAdminAuth, hasFirebaseAdminCredentials } from './firebaseAdmin';
import { loadAdminUser, loadAdminUserByEmail } from './operations/operationsFirestore';

export const authRouter = Router();

const DEV_ROLE_MAP: Record<string, string> = {
  'admin@choosify.com.bd': 'super_admin',
  'finance@choosify.com.bd': 'finance_manager',
  'support@choosify.com.bd': 'support_agent',
  'marketing@choosify.com.bd': 'marketing_manager',
  'moderator@choosify.com.bd': 'moderator',
  'seller@choosify.com.bd': 'seller',
  'creator@choosify.com.bd': 'creator',
};

authRouter.get('/auth/me', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }

  try {
    if (hasFirebaseAdminCredentials()) {
      const auth = await getAdminAuth();
      if (auth) {
        const decoded = await auth.verifyIdToken(token);
        const profile =
          (await loadAdminUser(decoded.uid)) ||
          (decoded.email ? await loadAdminUserByEmail(decoded.email) : null);

        if (profile) {
          res.json({
            uid: decoded.uid,
            email: profile.email || decoded.email,
            displayName: profile.displayName,
            role: profile.role,
          });
          return;
        }

        const mappedRole = decoded.email ? DEV_ROLE_MAP[decoded.email.toLowerCase()] : undefined;
        if (mappedRole) {
          res.json({
            uid: decoded.uid,
            email: decoded.email,
            displayName: decoded.name || decoded.email,
            role: mappedRole,
          });
          return;
        }
      }
    }

    res.status(403).json({ error: 'User is not registered as an admin.' });
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : 'Invalid token' });
  }
});

authRouter.post('/auth/dev-login', (req, res) => {
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
