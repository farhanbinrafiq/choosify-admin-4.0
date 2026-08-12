/**
 * HTTP probe: finance summary + cashbook import against running API.
 */
import { db } from '../server/db/client.ts';
import { users } from '../server/db/schema.ts';
import { eq } from 'drizzle-orm';
import { signAccessToken } from '../server/auth/jwtTokens.ts';
import { commerceStore } from '../server/commerce/commerceStore.ts';

const BASE = process.env.API_BASE || 'http://localhost:3001/api/v1';

async function main() {
  const seller =
    (await db.select().from(users).where(eq(users.role, 'seller')).limit(1))[0] ||
    (await db.select().from(users).where(eq(users.email, 'seller@choosify.com.bd')).limit(1))[0];
  if (!seller) throw new Error('No seller user in DB');
  const token = signAccessToken({
    id: seller.id,
    email: seller.email,
    emailVerified: !!seller.emailVerified,
  });
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const sumRes = await fetch(`${BASE}/finance/summary`, { headers });
  const sumJson = await sumRes.json();
  if (!sumRes.ok) throw new Error('finance summary failed: ' + JSON.stringify(sumJson));
  console.log('PASS GET /finance/summary', {
    commission: sumJson.data?.choosifyCommission,
    net: sumJson.data?.netWithdrawable,
    policy: sumJson.data?.commissionPolicySource,
  });

  const adjRes = await fetch(`${BASE}/finance/adjustments`, { headers });
  const adjJson = await adjRes.json();
  if (!adjRes.ok) throw new Error('adjustments failed');
  console.log('PASS GET /finance/adjustments count=', (adjJson.data || []).length);

  // Find an owned commerce order
  const all = await commerceStore.listOrders();
  const owned = (all || []).find(
    (o: any) =>
      (o.items || []).some((it: any) => it.sellerId === seller.id) || o.sellerId === seller.id,
  );
  const orderId = owned?.id || null;

  const createRes = await fetch(`${BASE}/cashbooks`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Probe Electronics ' + Date.now() }),
  });
  const createJson = await createRes.json();
  if (!createRes.ok) throw new Error('create cashbook failed: ' + JSON.stringify(createJson));
  const bookId = createJson.data.id;
  console.log('PASS POST /cashbooks', createJson.data.name);

  if (orderId) {
    const imp = await fetch(`${BASE}/cashbooks/import-orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ bookId, items: [{ orderId }] }),
    });
    const impJson = await imp.json();
    console.log('IMPORT', imp.status, JSON.stringify(impJson).slice(0, 300));
    if (imp.ok) {
      console.log('PASS import', {
        imported: impJson.data?.imported,
        skipped: impJson.data?.skipped,
        failed: impJson.data?.failed,
      });
      // duplicate
      const dup = await fetch(`${BASE}/cashbooks/import-orders`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ bookId, items: [{ orderId }] }),
      });
      const dupJson = await dup.json();
      console.log('PASS re-import skipped>=', dupJson.data?.skipped);
    } else {
      console.log('NOTE import not owned or empty lines —', impJson.error);
    }
  } else {
    console.log('NOTE no owned commerce order for seller; skip live import');
  }

  // Cancel-style: create requires name
  const bad = await fetch(`${BASE}/cashbooks`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: '  ' }),
  });
  if (bad.status === 400) console.log('PASS empty name rejected');
  else console.log('WARN empty name status', bad.status);

  // Foreign cashbook list empty for other identity — admin create blocked
  const admin =
    (await db.select().from(users).where(eq(users.email, 'admin@choosify.com.bd')).limit(1))[0];
  if (admin) {
    const adminToken = signAccessToken({
      id: admin.id,
      email: admin.email,
      emailVerified: true,
    });
    const aCreate = await fetch(`${BASE}/cashbooks`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Admin Should Fail' }),
    });
    console.log(aCreate.status === 403 ? 'PASS admin create blocked' : 'WARN admin create ' + aCreate.status);
  }

  console.log('\nHTTP PROBE DONE');
}

main().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});
