import { db } from '../server/db/client.ts';
import { users } from '../server/db/schema.ts';
import { eq } from 'drizzle-orm';
import { signAccessToken } from '../server/auth/jwtTokens.ts';

async function main() {
  const admin = (await db.select().from(users).where(eq(users.email, 'admin@choosify.com.bd')).limit(1))[0];
  const all = await db.select().from(users).limit(200);
  const seller = all.find((u) => String(u.role) === 'seller') || null;
  const creator = all.find((u) => String(u.role) === 'creator') || null;

  console.log({
    admin: admin && { id: admin.id, cf: (admin as { choosifyUserId?: string }).choosifyUserId, role: admin.role },
    seller: seller && { id: seller.id, cf: (seller as { choosifyUserId?: string }).choosifyUserId, email: seller.email },
    creator: creator && {
      id: creator.id,
      cf: (creator as { choosifyUserId?: string }).choosifyUserId,
      email: creator.email,
    },
    roles: [...new Set(all.map((u) => String(u.role)))],
  });

  if (!admin) throw new Error('no admin');
  const token = signAccessToken({
    id: admin.id,
    email: admin.email,
    emailVerified: !!admin.emailVerified,
  });
  const me = await fetch('http://localhost:3001/api/v1/auth/me', {
    headers: { Authorization: 'Bearer ' + token },
  });
  console.log('me', me.status, (await me.text()).slice(0, 500));

  if (creator) {
    const u = await fetch('http://localhost:3001/api/v1/auth/users/' + creator.id, {
      headers: { Authorization: 'Bearer ' + token },
    });
    console.log('creator_lookup', u.status, (await u.text()).slice(0, 400));
  }

  if (seller) {
    const st = signAccessToken({
      id: seller.id,
      email: seller.email,
      emailVerified: !!seller.emailVerified,
    });
    const sme = await fetch('http://localhost:3001/api/v1/auth/me', {
      headers: { Authorization: 'Bearer ' + st },
    });
    console.log('seller_me', sme.status, (await sme.text()).slice(0, 400));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
