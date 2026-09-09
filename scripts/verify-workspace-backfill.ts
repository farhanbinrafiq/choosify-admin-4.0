import { db } from '../server/db/client';

async function main() {
  const byType = await db.execute("select type, count(*) as c from workspaces group by type");
  console.log('BY TYPE:', JSON.stringify(byType.rows));
  const dupes = await db.execute(
    "select owner_user_id, type, count(*) from workspaces group by owner_user_id, type having count(*) > 1",
  );
  console.log('DUPLICATES (should be empty):', JSON.stringify(dupes.rows));
  const sample = await db.execute("select id, type, owner_user_id, display_name, status from workspaces limit 3");
  console.log('SAMPLE:', JSON.stringify(sample.rows));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
