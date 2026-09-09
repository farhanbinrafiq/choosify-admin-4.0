import { like } from 'drizzle-orm';
import { db } from '../server/db/client';
import { plans } from '../server/db/schema';

async function main() {
  const leftover = await db.select().from(plans).where(like(plans.name, 'PROBE%'));
  console.log('Leftover PROBE plans (should be empty):', JSON.stringify(leftover.map((p) => p.name)));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
