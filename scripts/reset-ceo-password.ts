/**
 * One-time admin script: reset password_hash for ceo@choosify.bd
 * using the existing Argon2 hashPassword() helper.
 *
 * Does not change application or authentication logic.
 *
 * Usage (from repo root, with DATABASE_URL set in .env):
 *   npx tsx scripts/reset-ceo-password.ts
 *
 * Optional override:
 *   CEO_RESET_PASSWORD='YourPasswordHere' npx tsx scripts/reset-ceo-password.ts
 */
import dotenv from 'dotenv';
import { eq } from 'drizzle-orm';

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Add it to .env before running this script.');
  process.exit(1);
}

const TARGET_EMAIL = 'ceo@choosify.bd';
/** Default one-time password; override with CEO_RESET_PASSWORD if needed. */
const NEW_PASSWORD = process.env.CEO_RESET_PASSWORD?.trim() || 'ChoosifyDev!2026';

if (NEW_PASSWORD.length < 8) {
  console.error('Password must be at least 8 characters (matches passwordValidator).');
  process.exit(1);
}

const { db } = await import('../server/db/client');
const { users } = await import('../server/db/schema');
const { hashPassword, verifyPassword } = await import('../server/auth/jwtTokens');

async function main() {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(eq(users.email, TARGET_EMAIL))
    .limit(1);

  const user = rows[0];
  if (!user) {
    console.error(`No public.users row found for ${TARGET_EMAIL}`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(NEW_PASSWORD);
  const ok = await verifyPassword(passwordHash, NEW_PASSWORD);
  if (!ok) {
    console.error('hashPassword/verifyPassword round-trip failed; aborting without write.');
    process.exit(1);
  }

  await db
    .update(users)
    .set({
      passwordHash,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  console.log(
    JSON.stringify({
      updated: true,
      email: user.email,
      id: user.id,
      role: user.role,
      passwordSet: true,
      // password value intentionally not printed
    }),
  );
  console.log('Done. Sign in with the password configured for this run (default ChoosifyDev!2026 unless CEO_RESET_PASSWORD was set).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
