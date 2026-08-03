/**
 * Seed DEV_ROLE_MAP accounts into Postgres for local ALLOW_DEV_LOGIN / probe flows.
 * Usage: npx tsx server/db/seedDevUsers.ts
 */
import dotenv from 'dotenv';
import { eq } from 'drizzle-orm';

dotenv.config();
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const { db } = await import('./client');
const { users } = await import('./schema');
const { DEV_ROLE_MAP } = await import('../auth/authProfile');
const { hashPassword } = await import('../auth/jwtTokens');

/** Shared local-only password for all seeded DEV_ROLE_MAP users. */
export const DEV_SEED_PASSWORD = 'ChoosifyDev!2026';

async function main() {
  const passwordHash = await hashPassword(DEV_SEED_PASSWORD);
  const now = new Date();
  let upserted = 0;

  for (const [email, role] of Object.entries(DEV_ROLE_MAP)) {
    const displayName = role.replace(/_/g, ' ');
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (existing[0]) {
      await db
        .update(users)
        .set({
          role,
          passwordHash,
          displayName,
          updatedAt: now,
        })
        .where(eq(users.id, existing[0].id));
    } else {
      await db.insert(users).values({
        email,
        passwordHash,
        displayName,
        role,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      });
    }
    upserted += 1;
    console.log(`seeded ${email} -> ${role}`);
  }

  console.log(`Done. Upserted ${upserted} users. Dev password is set (not printed).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
