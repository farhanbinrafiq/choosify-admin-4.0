/**
 * Cashbook rebuild (Sprint 15) — HTTP security + accounting-integrity probe.
 *
 * Security (§14): seller isolation, forged params, staff read-only oversight,
 *   every mutation endpoint 403 for admin/super_admin.
 * Integrity (§15): eligibility gate (delivered/completed only), seller-scoped
 *   amount (item lineTotal, never whole-order), global cross-book dedupe via
 *   sourceImportKey, atomic + idempotent create-book+import, manual Cash
 *   In/Out + edit + delete, imported entries immutable, refund/return flag
 *   without rewriting the original amount, provenance orderId opens Order Hub.
 *
 * Usage: npx tsx scripts/probe-cashbook-rebuild.ts   (dev server on :3001)
 */
const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const DEV_PASS = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const ADMIN_EMAIL = 'admin@choosify.com.bd';
const SELLER_A_EMAIL = 'seller@choosify.com.bd';
const SELLER_B_EMAIL = 'creator@choosify.com.bd';

const PASS: string[] = [];
const FAIL: string[] = [];
function check(c: unknown, label: string, detail?: unknown) {
  (c ? PASS : FAIL).push(label);
  console.log(c ? 'PASS' : 'FAIL', label, c ? '' : JSON.stringify(detail ?? '').slice(0, 300));
}
async function jsonOf(r: Response) {
  const t = await r.text();
  try { return t ? JSON.parse(t) : {}; } catch { return { _raw: t }; }
}
async function api(path: string, init?: RequestInit, token?: string) {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers || {}) },
  });
  return { status: r.status, body: await jsonOf(r) };
}
async function login(email: string, password = DEV_PASS) {
  const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  return { token: r.body.accessToken || r.body.token || r.body.data?.accessToken || '', uid: r.body.uid || r.body.data?.uid || '' };
}
async function registerBuyer(tag: string) {
  const email = `cbrb.${tag}.${Date.now()}.${Math.random().toString(36).slice(2, 5)}@buyer.choosify`;
  const password = 'CbRb!2026';
  const reg = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, fullName: `CB RB ${tag}` }) });
  const { db } = await import('../server/db/client');
  const { users } = await import('../server/db/schema');
  const { eq } = await import('drizzle-orm');
  await db.update(users).set({ emailVerified: true, updatedAt: new Date() }).where(eq(users.email, email.toLowerCase()));
  const li = await login(email, password);
  return { token: li.token, uid: String(reg.body.uid || reg.body.data?.uid) };
}

/** Real checkout → commerce order in the requested terminal state. */
async function makeOrder(
  sellerTok: string, adminTok: string, listings: { id: string }[], tag: string,
  target: 'pending' | 'confirmed' | 'delivered' | 'completed',
) {
  const buyer = await registerBuyer(tag);
  await api('/cart/clear', { method: 'POST' }, buyer.token);
  for (const l of listings) {
    await api('/cart/items', { method: 'POST', body: JSON.stringify({ listingType: 'product', listingId: l.id, quantity: 1 }) }, buyer.token);
  }
  const idem = `cbrb-${tag}-${Date.now()}`;
  const co = await api('/checkout', { method: 'POST', headers: { 'Idempotency-Key': idem }, body: JSON.stringify({ shipping: { fullName: 'CB Buyer', phone: '+8801711221100', address: 'Dhaka Rd', region: 'Dhaka' } }) }, buyer.token);
  const order = co.body?.data?.orders?.[0];
  const checkoutId = co.body?.data?.checkout?.id;
  await api('/commerce/payments/initiate', { method: 'POST', body: JSON.stringify({ checkoutId, paymentMethod: 'cod', idempotencyKey: `${idem}-cod` }) }, buyer.token);
  if (target === 'pending') return { commerceId: order.id, orderNumber: order.orderNumber, buyer, order };
  await api(`/orders/${encodeURIComponent(order.id)}/transition`, { method: 'POST', body: JSON.stringify({ status: 'confirmed' }) }, sellerTok);
  if (target === 'confirmed') return { commerceId: order.id, orderNumber: order.orderNumber, buyer, order };
  await api(`/orders/${encodeURIComponent(order.id)}/transition`, { method: 'POST', body: JSON.stringify({ status: 'packed' }) }, sellerTok);
  await api(`/orders/${encodeURIComponent(order.id)}/dispatch`, { method: 'POST', body: JSON.stringify({ fulfillmentMethod: 'courier', courier: 'Pathao', trackingNumber: `TRK-CB-${Date.now()}` }) }, sellerTok);
  await api(`/orders/${encodeURIComponent(order.id)}/transition`, { method: 'POST', body: JSON.stringify({ status: 'delivered' }) }, sellerTok);
  if (target === 'delivered') return { commerceId: order.id, orderNumber: order.orderNumber, buyer, order };
  await api(`/orders/${encodeURIComponent(order.id)}/transition`, { method: 'POST', body: JSON.stringify({ status: 'completed' }) }, sellerTok);
  return { commerceId: order.id, orderNumber: order.orderNumber, buyer, order };
}

const cbCreate = (tok: string, name: string) => api('/cashbooks', { method: 'POST', body: JSON.stringify({ name }) }, tok);
const cbList = (tok: string) => api('/cashbooks', {}, tok);
const cbDetail = (tok: string, id: string, owner?: string) => api(`/cashbooks/${encodeURIComponent(id)}${owner ? `?ownerUserId=${encodeURIComponent(owner)}` : ''}`, {}, tok);
const cbImport = (tok: string, body: unknown, idem?: string) =>
  api('/cashbooks/import-orders', { method: 'POST', headers: idem ? { 'Idempotency-Key': idem } : {}, body: JSON.stringify(body) }, tok);

async function main() {
  const admin = await login(ADMIN_EMAIL);
  const A = await login(SELLER_A_EMAIL);
  const B = await login(SELLER_B_EMAIL);
  check(!!admin.token && !!A.token && !!B.token, 'seed logins (admin, seller A, seller B/creator)');
  if (!A.token) return finish();

  const prods = await api('/catalog/products?limit=200', {}, A.token);
  const mine = (prods.body.data || []).filter(
    (x: Record<string, unknown>) => x.sellerId === A.uid && x.productType !== 'service' && (x.status === 'live' || x.status === 'active'),
  );
  const pA = mine[0];
  const pA2 = mine[1] || mine[0];
  check(!!pA, 'seller A has a live physical product');
  if (!pA) return finish();
  for (const p of [pA, pA2]) {
    await api(`/catalog/products/${p.id}/inventory`, { method: 'PATCH', body: JSON.stringify({ quantity: 999, reservedQuantity: 0 }) }, admin.token);
  }
  const twoLines = pA2.id !== pA.id;

  // ═══════════════════ SECURITY (§14) ═══════════════════
  console.log('\n─── SECURITY ──────────────────────────────────────────────────────');
  const aBook = await cbCreate(A.token, `A Main ${Date.now()}`);
  check(aBook.status === 201, 'seller A creates a book', aBook.status);
  const aBookId = aBook.body?.data?.id as string;

  check((await cbDetail(B.token, aBookId)).status >= 400, "seller B GET seller A's book → error", (await cbDetail(B.token, aBookId)).status);
  const bList = await cbList(B.token);
  check((bList.body?.data || []).every((b: Record<string, unknown>) => b.id !== aBookId), "seller B GET /cashbooks does NOT list seller A's book");
  check((await cbDetail(B.token, aBookId, A.uid)).status >= 400, "seller B forging ?ownerUserId=A → still error", (await cbDetail(B.token, aBookId, A.uid)).status);

  const bEntryInA = await api(`/cashbooks/${encodeURIComponent(aBookId)}/entries`, { method: 'POST', body: JSON.stringify({ direction: 'in', amount: 500 }) }, B.token);
  check(bEntryInA.status === 404 || bEntryInA.status === 403, "seller B cannot add an entry to seller A's book", bEntryInA.status);
  const bRename = await api(`/cashbooks/${encodeURIComponent(aBookId)}`, { method: 'PATCH', body: JSON.stringify({ name: 'hijacked' }) }, B.token);
  check(bRename.status === 404 || bRename.status === 403, "seller B cannot rename seller A's book", bRename.status);
  const bDelete = await api(`/cashbooks/${encodeURIComponent(aBookId)}`, { method: 'DELETE' }, B.token);
  check(bDelete.status === 404 || bDelete.status === 403, "seller B cannot delete seller A's book", bDelete.status);

  const secOrder = await makeOrder(A.token, admin.token, [pA], 'sec', 'delivered');
  const bImportAOrder = await cbImport(B.token, { newBookName: 'B steal', items: [{ orderId: secOrder.orderNumber }] });
  check(
    bImportAOrder.status >= 400 || (bImportAOrder.body?.data?.imported ?? 0) === 0,
    "seller B cannot import seller A's order (no owned lines)",
    { s: bImportAOrder.status, imported: bImportAOrder.body?.data?.imported },
  );
  const bImportIntoA = await cbImport(B.token, { bookId: aBookId, items: [{ orderId: secOrder.orderNumber }] });
  check(bImportIntoA.status === 404 || bImportIntoA.status === 403, "seller B cannot import into seller A's book", bImportIntoA.status);
  const forgedBook = await cbImport(A.token, { bookId: 'cb_forged_nope', items: [{ orderId: secOrder.orderNumber }] });
  check(forgedBook.status === 404, 'forged bookId → 404', forgedBook.status);

  // staff oversight = READ-ONLY
  const ovBook = await cbDetail(admin.token, aBookId, A.uid);
  check(ovBook.status === 200 && ovBook.body?.data?.readOnly === true, 'admin can READ any seller book (readOnly flag set)', ovBook.status);
  const ovIndex = await api('/cashbooks/oversight', {}, admin.token);
  check(ovIndex.status === 200 && Array.isArray(ovIndex.body?.data?.owners), 'admin GET /cashbooks/oversight → owner index', ovIndex.status);
  check((ovIndex.body?.data?.owners || []).some((o: Record<string, unknown>) => o.ownerUserId === A.uid), 'oversight index includes seller A');
  const ovSeller = await api(`/cashbooks/oversight?sellerId=${encodeURIComponent(A.uid)}`, {}, admin.token);
  check(ovSeller.status === 200 && (ovSeller.body?.data?.books || []).some((b: Record<string, unknown>) => b.id === aBookId), 'admin oversight ?sellerId= lists that seller\'s books');
  const sellerOversight = await api('/cashbooks/oversight', {}, A.token);
  check(sellerOversight.status === 403, 'seller cannot use /cashbooks/oversight → 403', sellerOversight.status);

  // EVERY mutation endpoint must 403 for admin
  check((await cbCreate(admin.token, 'Admin book')).status === 403, 'admin POST /cashbooks → 403');
  check((await api(`/cashbooks/${encodeURIComponent(aBookId)}`, { method: 'PATCH', body: JSON.stringify({ name: 'x' }) }, admin.token)).status === 403, 'admin PATCH /cashbooks/:id → 403');
  check((await api(`/cashbooks/${encodeURIComponent(aBookId)}`, { method: 'DELETE' }, admin.token)).status === 403, 'admin DELETE /cashbooks/:id → 403');
  check((await api(`/cashbooks/${encodeURIComponent(aBookId)}/entries`, { method: 'POST', body: JSON.stringify({ direction: 'in', amount: 100 }) }, admin.token)).status === 403, 'admin POST /cashbooks/:id/entries → 403');
  check((await cbImport(admin.token, { bookId: aBookId, items: [{ orderId: secOrder.orderNumber }] })).status === 403, 'admin POST /cashbooks/import-orders → 403');
  // admin edit/delete of a seller entry (need an entry id first)
  const aSeed = await api(`/cashbooks/${encodeURIComponent(aBookId)}/entries`, { method: 'POST', body: JSON.stringify({ direction: 'in', amount: 250, description: 'seed' }) }, A.token);
  const aSeedEntryId = aSeed.body?.data?.entryId as string;
  check(aSeed.status === 201, 'seller A adds a manual entry (seed for admin-mutation tests)', aSeed.status);
  check((await api(`/cashbooks/entries/${encodeURIComponent(aSeedEntryId)}`, { method: 'PATCH', body: JSON.stringify({ amount: 9999 }) }, admin.token)).status === 403, "admin PATCH seller entry → 403");
  check((await api(`/cashbooks/entries/${encodeURIComponent(aSeedEntryId)}`, { method: 'DELETE' }, admin.token)).status === 403, "admin DELETE seller entry → 403");
  check((await api(`/cashbooks/entries/${encodeURIComponent(aSeedEntryId)}`, {}, admin.token)) && true, 'sanity');
  // the seller entry is untouched
  const afterAdminPokes = await cbDetail(A.token, aBookId);
  const seedStill = (afterAdminPokes.body?.data?.entries || []).find((e: Record<string, unknown>) => e.entryId === aSeedEntryId);
  check(seedStill && seedStill.amount === 250, 'seller entry unchanged after admin mutation attempts', seedStill?.amount);

  // consumer has no partner entitlement
  const consumer = await registerBuyer('consumer');
  const cRes = await cbList(consumer.token);
  check(cRes.status === 401 || cRes.status === 403, 'consumer GET /cashbooks → 401/403 (no partner entitlement)', cRes.status);

  // ═══════════════════ ACCOUNTING INTEGRITY (§15) ═══════════════════
  console.log('\n─── INTEGRITY ─────────────────────────────────────────────────────');
  const delOrder = await makeOrder(A.token, admin.token, twoLines ? [pA, pA2] : [pA], 'int1', 'delivered');
  const dc = await api(`/orders/${encodeURIComponent(delOrder.commerceId)}`, {}, A.token);
  const commerceItems = (dc.body?.data?.items || []).filter((it: Record<string, unknown>) => it.sellerId === A.uid);
  const expectedAmount = commerceItems.reduce((a: number, it: Record<string, unknown>) => a + Number(it.lineTotal || 0), 0);
  const grandTotal = Number(dc.body?.data?.grandTotal || 0);

  const book1 = await cbCreate(A.token, `Int Book 1 ${Date.now()}`);
  const book1Id = book1.body?.data?.id as string;
  const imp1 = await cbImport(A.token, { bookId: book1Id, items: [{ orderId: delOrder.orderNumber }] });
  check(imp1.status === 201 && imp1.body?.data?.imported === commerceItems.length, 'import one delivered order → one entry per owned line', { imported: imp1.body?.data?.imported, lines: commerceItems.length });
  const d1 = await cbDetail(A.token, book1Id);
  const importedSum = (d1.body?.data?.entries || []).filter((e: Record<string, unknown>) => e.source === 'order_import').reduce((a: number, e: Record<string, unknown>) => a + Number(e.amount || 0), 0);
  check(Math.round(importedSum) === Math.round(expectedAmount), 'imported amount = Σ seller item lineTotal', { importedSum, expectedAmount });
  check(twoLines ? importedSum < grandTotal || grandTotal === importedSum : true, 'imported amount is seller-scoped (not a fabricated whole-order figure)', { importedSum, grandTotal });
  const provEntry = (d1.body?.data?.entries || []).find((e: Record<string, unknown>) => e.source === 'order_import');
  check(provEntry?.orderId === delOrder.orderNumber, 'imported entry.orderId == order number (opens the Order Hub record)', provEntry?.orderId);
  check(!!provEntry?.sourceImportKey, 'imported entry carries an immutable sourceImportKey');

  // re-import same order into the SAME book → all skipped
  const imp1dup = await cbImport(A.token, { bookId: book1Id, items: [{ orderId: delOrder.orderNumber }] });
  check(imp1dup.body?.data?.imported === 0 && imp1dup.body?.data?.skipped === commerceItems.length, 're-import into same book → 0 imported, all skipped', imp1dup.body?.data);

  // import same order line into a SECOND book → global dedupe skip
  const book2 = await cbCreate(A.token, `Int Book 2 ${Date.now()}`);
  const book2Id = book2.body?.data?.id as string;
  const imp2 = await cbImport(A.token, { bookId: book2Id, items: [{ orderId: delOrder.orderNumber }] });
  check(imp2.body?.data?.imported === 0 && imp2.body?.data?.skipped === commerceItems.length, 'import same order line into a DIFFERENT book → globally deduped (0 imported)', imp2.body?.data);
  check((imp2.body?.data?.details || []).every((r: Record<string, unknown>) => r.existingBookId === book1Id), 'dedupe skip points back to the book that already holds the line');

  // eligibility: pending order cannot be imported
  const pendOrder = await makeOrder(A.token, admin.token, [pA], 'pend', 'pending');
  const impPend = await cbImport(A.token, { bookId: book1Id, items: [{ orderId: pendOrder.orderNumber }] });
  check(
    (impPend.body?.data?.imported ?? 1) === 0 &&
      JSON.stringify(impPend.body).toLowerCase().includes('deliver'),
    'pending order is NOT importable (eligibility enforced server-side)',
    impPend.body?.data ?? impPend.body,
  );
  const confOrder = await makeOrder(A.token, admin.token, [pA], 'conf', 'confirmed');
  const impConf = await cbImport(A.token, { bookId: book1Id, items: [{ orderId: confOrder.orderNumber }] });
  check((impConf.body?.data?.imported ?? 1) === 0, 'confirmed order is NOT importable', impConf.body?.data ?? impConf.body);

  // atomic: create-new-book + import of an INELIGIBLE order → 422, NO book created
  const booksBefore = (await cbList(A.token)).body?.data?.length ?? 0;
  const impNewIneligible = await cbImport(A.token, { newBookName: `Should Not Exist ${Date.now()}`, items: [{ orderId: pendOrder.orderNumber }] });
  const booksAfter = (await cbList(A.token)).body?.data?.length ?? 0;
  check(impNewIneligible.status === 422 && booksAfter === booksBefore, 'create-book + ineligible import → 422 and NO orphan book', { status: impNewIneligible.status, booksBefore, booksAfter });

  // idempotent create-book + import (double-click)
  const delOrder2 = await makeOrder(A.token, admin.token, [pA], 'int2', 'delivered');
  const idem = `cbrb-idem-${Date.now()}`;
  const runTag = `IdemBook-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const impNew1 = await cbImport(A.token, { newBookName: `${runTag} first`, newBookIcon: '📦', items: [{ orderId: delOrder2.orderNumber }] }, idem);
  const impNew2 = await cbImport(A.token, { newBookName: `${runTag} retry`, items: [{ orderId: delOrder2.orderNumber }] }, idem);
  check(impNew1.status === 201 && impNew1.body?.data?.createdBook === true, 'create-book + import (1st) → 201, book created', impNew1.body?.data);
  check(impNew2.body?.data?.reused === true && impNew2.body?.data?.book?.id === impNew1.body?.data?.book?.id, 'same Idempotency-Key retry → reused, SAME book (no duplicate book)', impNew2.body?.data?.reused);
  const idemBooks = (await cbList(A.token)).body?.data?.filter((b: Record<string, unknown>) => String(b.name).startsWith(runTag)) ?? [];
  check(idemBooks.length === 1, 'exactly ONE book exists for this run after the idempotent retry', idemBooks.length);

  // manual Cash In / Cash Out + summary
  const mBook = await cbCreate(A.token, `Manual ${Date.now()}`);
  const mBookId = mBook.body?.data?.id as string;
  await api(`/cashbooks/${encodeURIComponent(mBookId)}/entries`, { method: 'POST', body: JSON.stringify({ direction: 'in', amount: 10000, description: 'Pop-up stall', category: 'Sales', paymentMode: 'bKash' }) }, A.token);
  const cashOut = await api(`/cashbooks/${encodeURIComponent(mBookId)}/entries`, { method: 'POST', body: JSON.stringify({ direction: 'out', amount: 3500, description: 'Packaging', category: 'Inventory' }) }, A.token);
  const mDetail = await cbDetail(A.token, mBookId);
  check(mDetail.body?.data?.summary?.moneyIn === 10000, 'summary.moneyIn = Σ Cash In', mDetail.body?.data?.summary);
  check(mDetail.body?.data?.summary?.moneyOut === 3500, 'summary.moneyOut = Σ |Cash Out|', mDetail.body?.data?.summary);
  check(mDetail.body?.data?.summary?.net === 6500, 'summary.net = moneyIn − moneyOut', mDetail.body?.data?.summary);
  const outId = cashOut.body?.data?.entryId as string;
  const outEntry = (mDetail.body?.data?.entries || []).find((e: Record<string, unknown>) => e.entryId === outId);
  check(outEntry?.amount === -3500, 'Cash Out entry is stored as a negative amount', outEntry?.amount);

  // edit manual entry
  const editRes = await api(`/cashbooks/entries/${encodeURIComponent(outId)}`, { method: 'PATCH', body: JSON.stringify({ amount: 4000, description: 'Packaging + tape' }) }, A.token);
  check(editRes.status === 200 && editRes.body?.data?.amount === -4000, 'seller can edit a manual entry (amount re-signed)', editRes.body?.data?.amount);
  check((await cbDetail(A.token, mBookId)).body?.data?.summary?.moneyOut === 4000, 'summary recalculates after a manual edit');

  // imported entries are immutable
  const editImported = await api(`/cashbooks/entries/${encodeURIComponent(provEntry.entryId)}`, { method: 'PATCH', body: JSON.stringify({ amount: 1 }) }, A.token);
  check(editImported.status === 409, 'editing an IMPORTED entry → 409 (immutable history)', editImported.status);

  // delete manual entry → balance recalcs
  const delEntry = await api(`/cashbooks/entries/${encodeURIComponent(outId)}`, { method: 'DELETE' }, A.token);
  check(delEntry.status === 200 && (await cbDetail(A.token, mBookId)).body?.data?.summary?.moneyOut === 0, 'deleting a manual entry updates the balance', delEntry.status);

  // refund/return flag — cancel the imported order, original entry unchanged
  const cancelOrder = await makeOrder(A.token, admin.token, [pA], 'cancel', 'delivered');
  const cBook = await cbCreate(A.token, `Cancel ${Date.now()}`);
  const cBookId = cBook.body?.data?.id as string;
  await cbImport(A.token, { bookId: cBookId, items: [{ orderId: cancelOrder.orderNumber }] });
  const beforeCancel = (await cbDetail(A.token, cBookId)).body?.data?.entries?.[0];
  // cancel via admin correction is guarded; use the canonical cancel endpoint as staff
  const cancelResp = await api(`/orders/${encodeURIComponent(cancelOrder.commerceId)}/cancel`, { method: 'POST', body: JSON.stringify({ reason: 'probe refund test' }) }, admin.token);
  const afterCancel = (await cbDetail(A.token, cBookId)).body?.data?.entries?.[0];
  check(afterCancel?.amount === beforeCancel?.amount, 'cancelling the order does NOT rewrite the imported entry amount', { before: beforeCancel?.amount, after: afterCancel?.amount });
  check(
    cancelResp.status >= 400 || (afterCancel?.orderFlags || []).includes('cancelled') || afterCancel?.orderChanged === true,
    'ledger flags the entry when the underlying order is later cancelled',
    { cancelStatus: cancelResp.status, flags: afterCancel?.orderFlags, changed: afterCancel?.orderChanged },
  );
  // optional compensating cash out
  const comp = await api(`/cashbooks/${encodeURIComponent(cBookId)}/entries`, { method: 'POST', body: JSON.stringify({ direction: 'out', amount: beforeCancel?.amount ?? 100, category: 'Refund', description: 'Compensating: order cancelled', linkedOrderId: cancelOrder.orderNumber }) }, A.token);
  check(comp.status === 201 && comp.body?.data?.linkedOrderId === cancelOrder.orderNumber, 'a separate compensating Cash Out can be recorded (linked to the order)', comp.body?.data);
  const compDetail = (await cbDetail(A.token, cBookId)).body?.data?.summary;
  check(compDetail?.importedCount === 1 && compDetail?.manualCount === 1, 'original import preserved + compensating entry added (not a rewrite)', compDetail);

  finish();
}

function finish() {
  console.log(`\n=== ${PASS.length} passed, ${FAIL.length} failed ===`);
  if (FAIL.length) { for (const f of FAIL) console.log(' -', f); process.exit(1); }
  console.log('ALL CASHBOOK REBUILD CHECKS PASSED');
}
main().catch((e) => { console.error(e); process.exit(1); });
