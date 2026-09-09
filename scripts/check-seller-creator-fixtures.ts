import { eq } from 'drizzle-orm';
import { db } from '../server/db/client';
import { users, workspaces } from '../server/db/schema';

async function main() {
  const seller = await db.select().from(users).where(eq(users.email, 'seller@choosify.com.bd')).limit(1);
  const creator = await db.select().from(users).where(eq(users.email, 'creator@choosify.com.bd')).limit(1);
  console.log('seller user:', seller[0] ? { id: seller[0].id, role: seller[0].role } : null);
  console.log('creator user:', creator[0] ? { id: creator[0].id, role: creator[0].role } : null);
  if (seller[0]) {
    const ws = await db.select().from(workspaces).where(eq(workspaces.ownerUserId, seller[0].id));
    console.log('seller workspaces:', ws.map((w) => ({ id: w.id, type: w.type, name: w.displayName })));
  }
  if (creator[0]) {
    const ws = await db.select().from(workspaces).where(eq(workspaces.ownerUserId, creator[0].id));
    console.log('creator workspaces:', ws.map((w) => ({ id: w.id, type: w.type, name: w.displayName })));
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
