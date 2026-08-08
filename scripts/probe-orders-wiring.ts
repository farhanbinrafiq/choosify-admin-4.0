/**
 * Sprint 6 wiring verification — Commerce API + client surface checks.
 * Does not perform manual UAT. Uses HTTP against running API.
 */
import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { readFileSync } from 'fs';
import { join } from 'path';

dotenv.config({ path: '.env' });
if (existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const base = process.env.PROBE_BASE_URL || 'http://localhost:3001/api/v1';
const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
let failed = 0;
function assert(c: boolean, label: string, d?: unknown) {
  if (c) console.log('PASS', label);
  else {
    failed += 1;
    console.log('FAIL', label, d ?? '');
  }
}

async function json(res: Response) {
  return res.json().catch(() => ({}));
}

async function main() {
  console.log('=== Orders UI/API wiring probe ===');

  // Static: commerceApi + adapter + routes exist
  const apiSrc = readFileSync(join(process.cwd(), 'src/services/commerceApi.ts'), 'utf8');
  assert(apiSrc.includes('transitionOrder') && apiSrc.includes('cancelOrder'), '1. commerceApi exposes lifecycle methods');
  const ctx = readFileSync(join(process.cwd(), 'src/contexts/OrdersContext.tsx'), 'utf8');
  assert(ctx.includes('commerceAuthoritative') && ctx.includes('commerceApi.listOrders'), '2. OrdersContext loads Commerce API');
  assert(!ctx.includes('mergePlatformOrders'), '3. operations merge no longer authoritative path');
  const app = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8');
  assert(app.includes('path="/admin/orders"') && app.includes('<Orders'), '4. /admin/orders cut over to React Orders');
  assert(app.includes('path="/admin/invoice/:id"'), '5. invoice route wired');
  const consumer = readFileSync(join(process.cwd(), 'src/pages/dashboards/ConsumerDashboard.tsx'), 'utf8');
  assert(consumer.includes('profile?.id') && consumer.includes('cancelOrder'), '6. Consumer history uses auth id + cancel');
  const adapter = readFileSync(join(process.cwd(), 'src/lib/commerceOrderAdapter.ts'), 'utf8');
  assert(adapter.includes("paymentStatus: 'Pending'") && adapter.includes('never invent Paid'), '7. payment placeholder stays Pending');

  // Live API smoke (same SoT screens call)
  const login = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@choosify.com.bd', password: DEV_PASSWORD }),
  });
  const loginBody = (await json(login)) as { accessToken?: string };
  assert(login.ok && !!loginBody.accessToken, '8. admin login for platform list', login.status);
  const token = loginBody.accessToken!;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const list = await fetch(`${base}/orders`, { headers });
  const listBody = (await json(list)) as { data?: unknown[] };
  assert(list.status === 200 && Array.isArray(listBody.data), '9. Admin platform Orders list API', list.status);

  const noAuth = await fetch(`${base}/orders/x/transition`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'confirmed' }),
  });
  assert(noAuth.status === 401 || noAuth.status === 403, '10. lifecycle write requires Bearer', noAuth.status);

  const foreign = await fetch(`${base}/orders/nonexistent-order-xyz`, { headers });
  assert(foreign.status === 404 || foreign.status === 403, '11. missing/foreign denied', foreign.status);

  console.log(`\n=== Done: ${failed} failure(s) ===`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
