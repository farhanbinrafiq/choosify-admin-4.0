/** Read-only verification of the 0007_subscription_plans migration on local dev DB. */
import { db } from '../server/db/client';

async function main() {
  const tables = await db.execute(
    "select table_name from information_schema.tables where table_schema='public' and table_name in ('workspaces','plan_versions','plan_version_offers','plan_entitlements','plan_limits','subscriptions','subscription_events','subscription_payments','subscription_billing_documents') order by table_name",
  );
  console.log('NEW TABLES:', JSON.stringify(tables.rows.map((r: any) => r.table_name)));

  const cols = await db.execute(
    "select column_name, data_type, is_nullable from information_schema.columns where table_name='plans' order by ordinal_position",
  );
  console.log('PLANS COLUMNS:', JSON.stringify(cols.rows));

  const fks = await db.execute(
    "select conname, conrelid::regclass::text as table_name, confrelid::regclass::text as ref_table, confdeltype from pg_constraint where contype='f' and (conname like 'plans_current%' or conrelid::regclass::text in ('subscriptions','subscription_payments','subscription_billing_documents','workspaces'))",
  );
  console.log('KEY FKS:', JSON.stringify(fks.rows));

  const idx = await db.execute(
    "select indexname, tablename from pg_indexes where tablename in ('workspaces','subscriptions','plan_versions','plan_version_offers') order by tablename, indexname",
  );
  console.log('INDEXES:', JSON.stringify(idx.rows));

  const enums = await db.execute(
    "select t.typname, e.enumlabel from pg_type t join pg_enum e on t.oid = e.enumtypid where t.typname in ('workspace_type','plan_lifecycle_state','subscription_status','subscription_event_type') order by t.typname, e.enumsortorder",
  );
  console.log('ENUMS:', JSON.stringify(enums.rows));

  process.exit(0);
}

main().catch((e) => {
  console.error('VERIFY FAILED:', e);
  process.exit(1);
});
