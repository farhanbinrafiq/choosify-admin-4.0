import { eq, like } from 'drizzle-orm';
import { db } from '../server/db/client';
import { plans } from '../server/db/schema';

async function main() {
  const rows = await db.select().from(plans).where(like(plans.name, 'QA UI%'));
  for (const p of rows) await db.delete(plans).where(eq(plans.id, p.id));
  console.log('Removed:', rows.map((p) => p.name));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
