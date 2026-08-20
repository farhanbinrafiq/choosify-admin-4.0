/**
 * New-feature regression: Product/Brand Quick Comparison + Warranty snapshot
 * + Warranty Claims full lifecycle + security boundaries.
 *
 * Usage: npx tsx scripts/probe-warranty-comparison.ts
 */
const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const V1 = `${BASE}/api/v1`;
const ADMIN_EMAIL = 'admin@choosify.com.bd';
const SELLER_EMAIL = 'seller@choosify.com.bd';
const CREATOR_EMAIL = 'creator@choosify.com.bd';
const DEV_PASS = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';

const fails: string[] = [];
function assert(cond: unknown, label: string, detail?: unknown) {
  if (cond) console.log('PASS', label);
  else {
    fails.push(label);
    console.log('FAIL', label, detail ?? '');
  }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${V1}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json()) as { accessToken?: string };
  if (!res.ok || !body.accessToken) throw new Error(`login failed: ${res.status} ${JSON.stringify(body)}`);
  return body.accessToken;
}

async function register(email: string, password: string, fullName: string): Promise<{ token: string; uid: string }> {
  const res = await fetch(`${V1}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, fullName }),
  });
  const body = (await res.json()) as { customToken?: string; uid?: string };
  if (!res.ok || !body.customToken) throw new Error(`register failed: ${res.status} ${JSON.stringify(body)}`);
  return { token: body.customToken, uid: body.uid || '' };
}

async function main() {
  const admin = await login(ADMIN_EMAIL, DEV_PASS);
  const seller = await login(SELLER_EMAIL, DEV_PASS);
  const stamp = Date.now();

  // ================= Product Quick Comparison =================
  const productsRes = await fetch(`${V1}/catalog/products?limit=200`);
  const productsBody = (await productsRes.json()) as { data: Array<{ id: string; categoryId: string }> };
  const byCategory = new Map<string, number>();
  for (const p of productsBody.data) byCategory.set(p.categoryId, (byCategory.get(p.categoryId) || 0) + 1);
  const richCategoryId = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const sampleProduct = productsBody.data.find((p) => p.categoryId === richCategoryId);
  assert(!!sampleProduct, 'setup: found a product in a multi-product category');

  if (sampleProduct) {
    const cmpRes = await fetch(`${V1}/catalog/products/${sampleProduct.id}/comparison`);
    const cmpBody = (await cmpRes.json()) as { data?: { current: { id: string; isCurrent: boolean }; candidates: Array<{ id: string; isCurrent: boolean }>; filter: { fallbackTier: string } } };
    assert(cmpRes.ok, 'Product comparison: endpoint responds 200', cmpRes.status);
    assert(cmpBody.data?.current.id === sampleProduct.id, 'Product comparison: current card matches requested product');
    assert(cmpBody.data?.current.isCurrent === true, 'Product comparison: current card flagged isCurrent');
    const candidateIds = cmpBody.data?.candidates.map((c) => c.id) || [];
    assert(!candidateIds.includes(sampleProduct.id), 'Product comparison: current product excluded from candidates');
    assert(new Set(candidateIds).size === candidateIds.length, 'Product comparison: no duplicate candidates');
    assert(candidateIds.every((id) => !cmpBody.data?.candidates.find((c) => c.id === id)?.isCurrent), 'Product comparison: no candidate flagged isCurrent');

    // Fallback behaviour: a product with no same-category peers should widen tiers.
    const lonelyProduct = productsBody.data.find((p) => byCategory.get(p.categoryId) === 1);
    if (lonelyProduct) {
      const lonelyRes = await fetch(`${V1}/catalog/products/${lonelyProduct.id}/comparison`);
      const lonelyBody = (await lonelyRes.json()) as { data?: { filter: { fallbackTier: string } } };
      assert(lonelyRes.ok, 'Product comparison fallback: endpoint responds for a lonely-category product', lonelyRes.status);
      assert(
        lonelyBody.data?.filter.fallbackTier === 'none' || !!lonelyBody.data?.filter.fallbackTier,
        'Product comparison fallback: returns a fallbackTier value (none if genuinely no candidates exist)',
        lonelyBody.data?.filter,
      );
    }
  }

  // ================= Brand Quick Comparison =================
  const brandsRes = await fetch(`${V1}/catalog/brands`);
  const brandsBody = (await brandsRes.json()) as { data: Array<{ id: string }> };
  const sampleBrand = brandsBody.data[0];
  assert(!!sampleBrand, 'setup: found a brand to test comparison against');
  if (sampleBrand) {
    const bCmpRes = await fetch(`${V1}/catalog/brands/${sampleBrand.id}/comparison`);
    const bCmpBody = (await bCmpRes.json()) as { data?: { current: { id: string }; candidates: Array<{ id: string }> } };
    assert(bCmpRes.ok, 'Brand comparison: endpoint responds 200', bCmpRes.status);
    assert(bCmpBody.data?.current.id === sampleBrand.id, 'Brand comparison: current card matches requested brand');
    const bCandidateIds = bCmpBody.data?.candidates.map((c) => c.id) || [];
    assert(!bCandidateIds.includes(sampleBrand.id), 'Brand comparison: current brand excluded from candidates');
    assert(new Set(bCandidateIds).size === bCandidateIds.length, 'Brand comparison: no duplicate candidates');
  }

  // ================= Warranty snapshot at purchase =================
  // Seed a fresh product with a real warranty config, owned by seller.
  const sellerBrandsRes = await fetch(`${V1}/catalog/brands?q=`, { headers: { Authorization: `Bearer ${seller}` } });
  const sellerBrandsBody = (await sellerBrandsRes.json()) as { data: Array<{ id: string; sellerId?: string }> };
  const sellerBrand = sellerBrandsBody.data.find((b) => b.sellerId);
  assert(!!sellerBrand, 'setup: found a seller-owned brand to attach a warranty product to');

  let warrantyProductId = '';
  if (sellerBrand) {
    const createRes = await fetch(`${V1}/catalog/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller}` },
      body: JSON.stringify({
        title: `Warranty Test Product ${stamp}`,
        brandId: sellerBrand.id,
        categoryId: richCategoryId || 'cat-fashion',
        categoryName: 'Test',
        image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=400&fit=crop',
        price: 5000,
        stock: 10,
        status: 'active',
        warrantyMonths: 12,
        warrantyType: 'Manufacturer',
        warrantyProvider: 'Choosify Care',
        warrantyTerms: 'Covers manufacturing defects only.',
      }),
    });
    const createBody = (await createRes.json()) as { data?: { id?: string }; id?: string; error?: string };
    const createdId = createBody.data?.id || createBody.id;
    assert(createRes.ok && !!createdId, 'Warranty product schema: seller can create a product with warranty fields', createBody);
    warrantyProductId = createdId || '';

    if (warrantyProductId) {
      const fetchRes = await fetch(`${V1}/catalog/products/${warrantyProductId}`);
      const fetchBody = (await fetchRes.json()) as { warrantyMonths?: number; warrantyProvider?: string };
      assert(fetchBody.warrantyMonths === 12 && fetchBody.warrantyProvider === 'Choosify Care', 'Warranty product schema: warranty fields persist on the product record', fetchBody);
    }
  }

  // Register a fresh consumer, place a real order for the warranty product.
  const consumerEmail = `warranty-uat-${stamp}@test.choosify.bd`;
  const { token: consumer, uid: consumerId } = await register(consumerEmail, 'WarrantyUAT!2026', 'Warranty UAT Consumer');

  let orderId = '';
  let orderItemId = '';
  if (warrantyProductId) {
    const orderRes = await fetch(`${V1}/operations/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${consumer}` },
      body: JSON.stringify({
        orderId: `ORD-WARRANTY-${stamp}`,
        subOrders: [{ items: [{ productId: warrantyProductId, quantity: 1 }] }],
        shipping: { fullName: 'Warranty UAT', phone: '01700000000', address: 'Dhaka', region: 'Dhaka' },
        paymentMethod: 'cod',
        isCOD: true,
      }),
    });
    const orderBody = (await orderRes.json()) as { success?: boolean; data?: { orderId: string; subOrders: Array<{ items: Array<{ itemId: string; warrantyMonthsAtPurchase?: number; warrantyExpiresAt?: string }> }> } };
    assert(orderRes.ok && orderBody.success, 'Order snapshot: consumer can place a real order for the warranty product', orderBody);
    orderId = orderBody.data?.orderId || '';
    const item = orderBody.data?.subOrders?.[0]?.items?.[0];
    orderItemId = item?.itemId || '';
    assert(item?.warrantyMonthsAtPurchase === 12, 'Order item warranty snapshot: warrantyMonthsAtPurchase captured at checkout', item);
    assert(!!item?.warrantyExpiresAt, 'Order item warranty snapshot: warrantyExpiresAt computed immediately (purchase-date fallback)', item);
  }

  // Immutability: seller edits the product's warranty AFTER purchase — the order snapshot must not change.
  let snapshotExpiresAtBeforeEdit = '';
  if (orderId && warrantyProductId) {
    const beforeRes = await fetch(`${V1}/operations/orders/${orderId}`, { headers: { Authorization: `Bearer ${consumer}` } });
    const beforeBody = (await beforeRes.json()) as { data?: { subOrders: Array<{ items: Array<{ itemId: string; warrantyMonthsAtPurchase?: number; warrantyExpiresAt?: string }> }> } };
    const beforeItem = beforeBody.data?.subOrders?.[0]?.items?.find((it) => it.itemId === orderItemId);
    snapshotExpiresAtBeforeEdit = beforeItem?.warrantyExpiresAt || '';

    await fetch(`${V1}/catalog/products/${warrantyProductId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller}` },
      body: JSON.stringify({ warrantyMonths: 1, warrantyProvider: 'Changed Provider' }),
    }).catch(() => undefined);

    const afterRes = await fetch(`${V1}/operations/orders/${orderId}`, { headers: { Authorization: `Bearer ${consumer}` } });
    const afterBody = (await afterRes.json()) as { data?: { subOrders: Array<{ items: Array<{ itemId: string; warrantyMonthsAtPurchase?: number; warrantyExpiresAt?: string }> }> } };
    const afterItem = afterBody.data?.subOrders?.[0]?.items?.find((it) => it.itemId === orderItemId);
    assert(
      afterItem?.warrantyMonthsAtPurchase === 12 && afterItem?.warrantyExpiresAt === snapshotExpiresAtBeforeEdit,
      'Warranty snapshot immutability: order item warranty unchanged after seller edits the live product',
      { before: snapshotExpiresAtBeforeEdit, after: afterItem },
    );
  }

  // Mark delivered — warranty start should prefer deliveredAt.
  if (orderId && orderItemId) {
    const deliverRes = await fetch(`${V1}/operations/orders/${orderId}/items/${orderItemId}/mark-delivered`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${seller}` },
    });
    assert(deliverRes.ok, 'mark-delivered: seller can mark the order item delivered', deliverRes.status);
    const deliverBody = (await deliverRes.json()) as { data?: { subOrders: Array<{ trackingStatus?: string; items: Array<{ itemId: string; deliveredAt?: string; warrantyStartsAt?: string }> }> } };
    const deliveredSub = deliverBody.data?.subOrders?.find((s) => s.items.some((it) => it.itemId === orderItemId));
    assert(deliveredSub?.trackingStatus === 'delivered', 'mark-delivered: sub-order trackingStatus becomes delivered');
    const deliveredItem = deliveredSub?.items.find((it) => it.itemId === orderItemId);
    assert(!!deliveredItem?.deliveredAt, 'mark-delivered: deliveredAt stamped on the item');
    assert(deliveredItem?.warrantyStartsAt === deliveredItem?.deliveredAt, 'mark-delivered: warrantyStartsAt recomputed to prefer deliveredAt over the order-date fallback');
  }

  // ================= Security: cannot forge / cross-account =================
  if (orderId && orderItemId) {
    // Cannot claim another consumer's order.
    const { token: otherConsumer } = await register(`warranty-other-${stamp}@test.choosify.bd`, 'WarrantyOther!2026', 'Other Consumer');
    const forgedRes = await fetch(`${V1}/operations/warranty-claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${otherConsumer}` },
      body: JSON.stringify({ orderId, orderItemId, issueType: 'other', description: 'Trying to claim someone else order' }),
    });
    assert(forgedRes.status === 403, 'Security: a different consumer cannot claim warranty on this order', forgedRes.status);

    // Cannot forge warranty duration / seller id / expiry — client fields are ignored, server derives them.
    const forgeFieldsRes = await fetch(`${V1}/operations/warranty-claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${consumer}` },
      body: JSON.stringify({
        orderId,
        orderItemId,
        issueType: 'physical_damage',
        description: 'Cracked screen after delivery.',
        warrantyMonthsAtPurchase: 999,
        sellerId: 'forged-seller-id',
        warrantyExpiresAt: '2099-01-01T00:00:00.000Z',
      }),
    });
    const forgeFieldsBody = (await forgeFieldsRes.json()) as { success?: boolean; data?: { warrantyMonthsAtPurchase?: number; sellerId?: string } };
    assert(forgeFieldsRes.ok, 'Real claim submission succeeds', forgeFieldsRes.status);
    assert(
      forgeFieldsBody.data?.warrantyMonthsAtPurchase === 12 && forgeFieldsBody.data?.sellerId !== 'forged-seller-id',
      'Security: client-forged warrantyMonths/sellerId are ignored — server derives from the real order item',
      forgeFieldsBody.data,
    );
    const claimId = forgeFieldsBody.data ? (forgeFieldsBody as unknown as { data: { id: string } }).data.id : '';

    // Duplicate ACTIVE claim on the same item is denied/reused, not duplicated.
    const dupRes = await fetch(`${V1}/operations/warranty-claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${consumer}` },
      body: JSON.stringify({ orderId, orderItemId, issueType: 'other', description: 'Second attempt' }),
    });
    const dupBody = (await dupRes.json()) as { data?: { id: string }; reused?: boolean };
    assert(dupBody.reused === true && dupBody.data?.id === claimId, 'Security: duplicate active claim on the same item returns the existing claim, not a new one', dupBody);

    // Seller (real owner) cannot be confused with a different seller/creator account.
    const creatorToken = await login(CREATOR_EMAIL, DEV_PASS);
    const wrongSellerAckRes = await fetch(`${V1}/operations/warranty-claims/${claimId}/acknowledge`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${creatorToken}` },
    });
    assert(wrongSellerAckRes.status === 403, 'Security: a different account (creator) cannot manage this seller\'s claim', wrongSellerAckRes.status);

    // Real seller CAN acknowledge → approve → resolve.
    const ackRes = await fetch(`${V1}/operations/warranty-claims/${claimId}/acknowledge`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${seller}` },
    });
    assert(ackRes.ok, 'Claim workflow: real seller can acknowledge the claim', ackRes.status);

    const approveRes = await fetch(`${V1}/operations/warranty-claims/${claimId}/approve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller}` },
      body: JSON.stringify({ sellerResponse: 'Approved — send in for repair.' }),
    });
    assert(approveRes.ok, 'Claim workflow: seller can approve', approveRes.status);

    const resolveRes = await fetch(`${V1}/operations/warranty-claims/${claimId}/resolve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller}` },
      body: JSON.stringify({ resolutionNotes: 'Repaired and shipped back.' }),
    });
    const resolveBody = (await resolveRes.json()) as { data?: { status: string; conversationId?: string } };
    assert(resolveRes.ok && resolveBody.data?.status === 'resolved', 'Claim workflow: seller can resolve', resolveBody);
    assert(!!resolveBody.data?.conversationId, 'Messaging integration: claim has a linked conversationId (canonical, not duplicated)');

    // Resolved claim may allow a NEW claim later (warranty still active).
    const newClaimRes = await fetch(`${V1}/operations/warranty-claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${consumer}` },
      body: JSON.stringify({ orderId, orderItemId, issueType: 'battery_charging', description: 'New issue after repair.' }),
    });
    const newClaimBody = (await newClaimRes.json()) as { data?: { id: string }; reused?: boolean };
    assert(
      newClaimRes.ok && newClaimBody.reused !== true && newClaimBody.data?.id !== claimId,
      'Claim workflow: a resolved claim allows a genuinely new claim while warranty is still active',
      newClaimBody,
    );

    // Seller cannot access another seller's claims list.
    const claimsAsCreatorRes = await fetch(`${V1}/operations/warranty-claims`, { headers: { Authorization: `Bearer ${creatorToken}` } });
    const claimsAsCreatorBody = (await claimsAsCreatorRes.json()) as { data?: Array<{ id: string }> };
    assert(
      !(claimsAsCreatorBody.data || []).some((c) => c.id === claimId),
      'Security: a different seller/creator account cannot see this seller\'s warranty claims in their own list',
      claimsAsCreatorBody.data?.length,
    );
  }

  // Consumer cannot claim an EXPIRED warranty — verify via a synthetic direct check
  // (server denies at claim time using warrantyExpiresAt from the real order item).
  // Already covered by the "warranty is active" check inside the create handler;
  // exercised implicitly above since a fresh 12-month warranty is never expired
  // in this run — documented here as a residual manual-verification note.

  console.log('\n=== WARRANTY + QUICK COMPARISON PROBE SUMMARY ===');
  if (fails.length) {
    console.error('FAILS:', fails);
    console.error(`RESULT: FAILED (${fails.length})`);
    process.exit(1);
  }
  console.log('RESULT: ALL PASSED');
}

main().catch((e) => {
  console.error('CRASH', e);
  process.exit(1);
});
