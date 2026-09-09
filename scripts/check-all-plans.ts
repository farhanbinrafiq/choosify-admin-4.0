import { db } from '../server/db/client';
import { plans } from '../server/db/schema';

async function main() {
  const rows = await db.select().from(plans);
  console.log('ALL plans in DB:', JSON.stringify(rows.map((p) => ({ id: p.id, name: p.name, lifecycleState: p.lifecycleState })), null, 2));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
