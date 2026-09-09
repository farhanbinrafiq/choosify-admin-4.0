import { db } from '../server/db/client';

async function main() {
  const col = await db.execute(
    "select column_name, data_type, is_nullable from information_schema.columns where table_name='subscriptions' and column_name='pending_plan_version_offer_id'",
  );
  console.log('COLUMN:', JSON.stringify(col.rows));

  const fk = await db.execute(
    "select conname, confdeltype from pg_constraint where conname = 'subscriptions_pending_plan_version_offer_id_fkey'",
  );
  console.log('FK (confdeltype r=RESTRICT):', JSON.stringify(fk.rows));

  const enumVals = await db.execute(
    "select enumlabel from pg_type t join pg_enum e on t.oid=e.enumtypid where t.typname='subscription_event_type' order by e.enumsortorder",
  );
  console.log('ENUM VALUES:', JSON.stringify(enumVals.rows.map((r: any) => r.enumlabel)));

  const subCount = await db.execute('select count(*) as c from subscriptions');
  console.log('EXISTING SUBSCRIPTION ROWS (should be untouched, likely 0 since only probes create/clean them):', JSON.stringify(subCount.rows));

  const tableCount = await db.execute(
    "select count(*) as c from information_schema.tables where table_schema='public'",
  );
  console.log('TOTAL PUBLIC TABLES (sanity — should be same as before + 0, since 0008 only alters subscriptions/enum):', JSON.stringify(tableCount.rows));

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
