import { like } from 'drizzle-orm';
import { db } from '../server/db/client';
import { plans } from '../server/db/schema';

async function main() {
  const rows = await db.select().from(plans).where(like(plans.name, 'QA UI%'));
  console.log('Leftover QA UI plans (should be empty):', JSON.stringify(rows.map((p) => ({ id: p.id, name: p.name }))));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
