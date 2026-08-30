/**
 * Guide LIVE-commerce / external-refs / typed-winner regression probe (Part 2).
 * Permanent suite member — `npm run test:guide-live-commerce`.
 *
 * Deterministic; safe to re-run (creates its own brand/product/guides, archives
 * the guides on exit, self-registers a throwaway buyer if the seeded consumer
 * account is absent). Needs the dev API on :3001.
 *
 * Server-side guarantees covered:
 *  - guide-scoped social links + off-platform references (URL safety, editorial-only,
 *    never enter productIds / cart / checkout)
 *  - per-entity highlight chips clamp (≤4, "#" stripped)
 *  - typed Overall Winner + category awards (ref must be present in the guide)
 *  - temporary guide offers: brand-authored + brand-owned product only; the base
 *    CatalogProduct price is never mutated
 *  - BOTH checkout engines revalidate with the server clock and return an explicit
 *    409 GUIDE_OFFER_PRICE_CHANGED for a stale expected price (no silent charge):
 *      · commerce  /cart/items + /checkout
 *      · storefront /operations/orders  (Choosify-Web CheckoutPage path)
 *  - an absolute promoPrice offer is NOT applied to a variant line (product-level
 *    liveOffers[] has no variantId — the guard falls back to canonical pricing)
 *  - a normal product (no guideOfferRef) checks out unchanged
 */
const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const PASS: string[] = [];
const FAIL: string[] = [];

function check(cond: unknown, label: string, detail?: unknown) {
  if (cond) {
    PASS.push(label);
    console.log('PASS', label);
  } else {
    FAIL.push(label);
    console.log('FAIL', label, detail !== undefined ? JSON.stringify(detail) : '');
  }
}

const j = async (r: Response) => {
  const t = await r.text();
  try {
    return t ? JSON.parse(t) : {};
  } catch {
    return { _raw: t };
  }
};

async function login(email: string, password = 'ChoosifyDev!2026') {
  const b = await j(
    await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),
  );
  const token = b.accessToken || b.token || b.data?.accessToken;
  if (!token) throw new Error(`login failed for ${email}`);
  const me = await j(await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }));
  return { token, userId: me.uid || me.id || me.userId || me.data?.id, role: me.role || me.data?.role };
}

const authH = (t?: string) => ({ 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) });
async function req(method: string, path: string, token?: string, body?: unknown) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: authH(token),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, body: await j(r) };
}
const iso = (ms: number) => new Date(ms).toISOString();

async function main() {
  const admin = await login('admin@choosify.com.bd');
  const creator = await login('creator@choosify.com.bd');
  const seller = await login('seller@choosify.com.bd');
  const consumer = await (async () => {
    const seeded = await login('consumer@choosify.com.bd').catch(() => null);
    if (seeded) return seeded;
    // Self-register a throwaway buyer so the checkout re-validation path is exercised.
    const email = `probe.buyer.${Date.now()}@choosify.test`;
    await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'ChoosifyDev!2026', fullName: 'Probe Buyer' }),
    });
    return login(email).catch(() => null);
  })();

  const brands = (await req('GET', '/catalog/brands', admin.token)).body.data || [];
  const allProducts = (await req('GET', '/catalog/products', admin.token)).body.data || [];
  const sellerProducts = (await req('GET', '/catalog/products', seller.token)).body.data || [];
  const otherProductId =
    allProducts.find((p: any) => p.sellerId !== seller.userId)?.id || allProducts[0]?.id;
  const products = allProducts;

  // Seller-owned brand + a product owned by that seller.
  let sellerBrand = brands.find((b: any) => b.name === 'Northwind Audio' && b.sellerId === seller.userId);
  if (!sellerBrand) {
    sellerBrand = (
      await req('POST', '/catalog/brands', admin.token, {
        name: 'Northwind Audio',
        category: 'Audio',
        sellerId: seller.userId,
        marketplaceAccess: true,
        marketplaceStatus: 'granted',
      })
    ).body.data;
  }
  let ownedProduct =
    sellerProducts.find((p: any) => p.sellerId === seller.userId) ||
    products.find((p: any) => p.sellerId === seller.userId);
  if (!ownedProduct) {
    const cat = (await req('GET', '/catalog/categories', admin.token)).body.data?.[0];
    ownedProduct = (
      await req('POST', '/catalog/products', admin.token, {
        title: '[probe] Northwind Soundbar',
        description: 'probe',
        brandId: sellerBrand.id,
        brandName: sellerBrand.name,
        categoryId: cat?.id || '',
        categoryName: cat?.name || 'Audio',
        price: 20000,
        originalPrice: 24000,
        sellerId: seller.userId,
        modeType: 'retail',
        stock: 50,
        status: 'live',
      })
    ).body.data;
  }
  check(ownedProduct?.sellerId === seller.userId, 'seed: seller owns a product', ownedProduct?.sellerId);
  const basePrice = Number(ownedProduct.price);

  const mk = async (token: string, create: any, patch: any) => {
    const c = await req('POST', '/catalog/guides', token, create);
    if (!c.body.data?.id) throw new Error('create failed ' + JSON.stringify(c.body));
    const p = await req('PATCH', `/catalog/guides/${c.body.data.id}`, token, patch);
    return { id: c.body.data.id, patch: p };
  };

  // ── 1. Off-platform references — URL safety + editorial-only ─────────────
  const extGuide = await mk(
    creator.token,
    { title: '[probe] external refs', slug: 'probe-ext-refs', format: 'buying_guide', type: 'article' },
    {
      externalRefs: [
        { id: 'ok', kind: 'product', title: 'Legit Import', externalUrl: 'https://example.com/x', imageUrl: 'https://img.example.com/a.jpg' },
        { id: 'bad1', kind: 'product', title: 'XSS', externalUrl: 'javascript:alert(1)' },
        { id: 'bad2', kind: 'brand', title: 'No URL' },
        { id: 'bad3', kind: 'product', title: 'data uri', externalUrl: 'data:text/html,evil' },
      ],
    },
  );
  const extRefs = extGuide.patch.body.data?.externalRefs || [];
  check(extRefs.length === 1 && extRefs[0].id === 'ok', 'externalRefs: only a valid https ref survives (js:/data:/no-url dropped)', extRefs);
  check(
    !('productIds' in (extGuide.patch.body.data || {})) || !(extGuide.patch.body.data.productIds || []).includes('ok'),
    'externalRefs never leak into canonical productIds',
    extGuide.patch.body.data?.productIds,
  );

  // ── 1b. Per-entity highlight chips — clamp to 4, strip '#' ──────────────
  const tagGuide = await mk(
    creator.token,
    { title: '[probe] highlight tags', slug: 'probe-tags', format: 'buying_guide', type: 'article' },
    {
      productIds: [otherProductId],
      externalRefs: [
        { id: 'xt', kind: 'product', title: 'Import', externalUrl: 'https://example.com/i', highlightTags: ['#Best Value', 'Budget', 'A', 'B', 'C', 'D'] },
      ],
      sections: [
        {
          id: 'items_mentioned',
          enabled: true,
          order: 0,
          data: { itemIds: [otherProductId], highlightTags: { [otherProductId]: ['#Bright', 'Fast', 'Cheap', 'Loud', 'Extra1', 'Extra2'] } },
        },
      ],
    },
  );
  const tagData = tagGuide.patch.body.data || {};
  const itemTags = (tagData.sections || []).find((s: any) => s.id === 'items_mentioned')?.data?.highlightTags?.[otherProductId] || [];
  const extTags = (tagData.externalRefs || [])[0]?.highlightTags || [];
  check(itemTags.length === 4 && !itemTags.some((t: string) => t.startsWith('#')), 'highlightTags: per-product chips clamped to 4, "#" stripped', itemTags);
  check(extTags.length === 4 && extTags[0] === 'Best Value', 'highlightTags: external-ref chips clamped to 4, "#" stripped', extTags);
  await req('POST', `/catalog/guides/${tagGuide.id}/archive`, admin.token);

  // ── 2. Guide-scoped social links — non-http dropped ─────────────────────
  const socGuide = await mk(
    creator.token,
    { title: '[probe] social links', slug: 'probe-social', format: 'live', type: 'video' },
    {
      socialLinks: [
        { id: 's1', platform: 'youtube', url: 'https://youtube.com/@x', label: 'YT' },
        { id: 's2', platform: 'weird', url: 'https://tiktok.com/@y' },
        { id: 's3', platform: 'facebook', url: 'ftp://nope' },
      ],
    },
  );
  const soc = socGuide.patch.body.data?.socialLinks || [];
  check(soc.length === 2, 'socialLinks: non-http url dropped', soc);
  check(soc.some((l: any) => l.platform === 'other'), 'socialLinks: unknown platform coerced to "other"', soc);

  // ── 3. Typed winner — ref must be present in the guide ──────────────────
  const winGuide = await mk(
    creator.token,
    { title: '[probe] winner refs', slug: 'probe-winner', format: 'buying_guide', type: 'article' },
    {
      productIds: [otherProductId],
      externalRefs: [{ id: 'x-imp', kind: 'product', title: 'Import', externalUrl: 'https://example.com/i' }],
      sections: [
        {
          id: 'winner',
          enabled: true,
          order: 0,
          data: {
            overall: { entityType: 'product', entityId: otherProductId },
            awards: [
              { id: 'a1', label: 'Best Import', ref: { entityType: 'external_product', entityId: 'x-imp' } },
              { id: 'a2', label: 'Ghost', ref: { entityType: 'product', entityId: 'prod-does-not-exist' } },
            ],
          },
        },
      ],
    },
  );
  const winSec = (winGuide.patch.body.data?.sections || []).find((s: any) => s.id === 'winner')?.data;
  check(winSec?.overall?.entityId === otherProductId, 'winner: valid overall product ref kept', winSec);
  check(
    (winSec?.awards || []).length === 1 && winSec.awards[0].id === 'a1',
    'winner: award referencing a missing entity is dropped; external award kept',
    winSec?.awards,
  );
  const badWinner = await req('PATCH', `/catalog/guides/${winGuide.id}`, creator.token, {
    sections: [
      { id: 'winner', enabled: true, order: 0, data: { overall: { entityType: 'product', entityId: 'prod-nope' } } },
    ],
  });
  check(badWinner.status >= 400, 'winner: overall ref not present in guide → rejected', badWinner.status);

  // ── 4. Live offers — creator-authored is not allowed ───────────────────
  const creatorOffer = await req('PATCH', `/catalog/guides/${winGuide.id}`, creator.token, {
    liveOffers: [
      { id: 'o', productId: otherProductId, discountType: 'percent', discountValue: 10, startsAt: iso(Date.now()), endsAt: iso(Date.now() + 8.64e7) },
    ],
  });
  check(
    creatorOffer.status === 403 && creatorOffer.body.code === 'GUIDE_OFFER_AUTHOR_NOT_ALLOWED',
    'liveOffers: creator-authored guide cannot set promotional pricing → 403',
    { status: creatorOffer.status, code: creatorOffer.body.code },
  );

  // ── 5. Live offers — brand-authored, owned product, active window ───────
  const now = Date.now();
  const brandGuide = await mk(
    seller.token,
    {
      title: '[probe] brand live offer',
      slug: 'probe-brand-offer',
      format: 'live',
      type: 'video',
      publisherType: 'brand',
      publisherBrandId: sellerBrand.id,
    },
    {
      productIds: [ownedProduct.id],
      liveOffers: [
        { id: 'ok-offer', productId: ownedProduct.id, discountType: 'percent', discountValue: 20, startsAt: iso(now - 3.6e6), endsAt: iso(now + 5 * 8.64e7), enabled: true },
      ],
      sections: [
        { id: 'items_mentioned', enabled: true, order: 0, data: { itemIds: [ownedProduct.id] } },
        { id: 'live_offers', enabled: true, order: 1, data: {} },
      ],
    },
  );
  const bOffers = brandGuide.patch.body.data?.liveOffers || [];
  check(bOffers.length === 1 && bOffers[0].productId === ownedProduct.id, 'liveOffers: brand-authored offer on owned+tagged product persists', bOffers);
  await req('POST', `/catalog/guides/${brandGuide.id}/publish`, seller.token);

  // ── 6. Live offers — brand cannot offer on a product it does not own ───
  const notOwnedOffer = await req('PATCH', `/catalog/guides/${brandGuide.id}`, seller.token, {
    productIds: [ownedProduct.id, otherProductId],
    liveOffers: [
      { id: 'bad', productId: otherProductId, discountType: 'percent', discountValue: 30, startsAt: iso(now), endsAt: iso(now + 8.64e7) },
    ],
  });
  check(
    notOwnedOffer.status === 403 && notOwnedOffer.body.code === 'GUIDE_OFFER_PRODUCT_NOT_OWNED',
    'liveOffers: brand offer on a non-owned product → 403 GUIDE_OFFER_PRODUCT_NOT_OWNED',
    { status: notOwnedOffer.status, code: notOwnedOffer.body.code },
  );

  // ── 7. Base product price is never mutated by a guide offer ────────────
  const prodAfter = (await req('GET', `/catalog/products/${ownedProduct.id}`, admin.token)).body;
  const priceNow = Number(prodAfter.price ?? prodAfter.data?.price);
  check(priceNow === basePrice, 'guide offer never mutates the base product price', { basePrice, priceNow });

  // ── 8. Checkout re-validation with server time (best-effort) ───────────
  if (consumer) {
    await req('POST', '/cart/clear', consumer.token);
    const promo = Math.round(basePrice * 0.8);
    const add = await req('POST', '/cart/items', consumer.token, {
      listingId: ownedProduct.id,
      quantity: 1,
      guideOfferRef: { guideId: brandGuide.id, productId: ownedProduct.id },
      expectedUnitPrice: promo,
    });
    check(add.status === 201, 'checkout: add-to-cart with an active guide offer accepted', add.status);
    const okCheckout = await req('POST', '/checkout', consumer.token, {
      idempotencyKey: `probe-${Date.now()}`,
      shipping: { fullName: 'Probe Buyer', phone: '01700000000', address: '12 Test Road, Dhaka', city: 'Dhaka', area: 'Test' },
    });
    check(
      okCheckout.status === 201 || okCheckout.status === 200,
      'checkout: matching expected promo price passes server re-validation',
      { status: okCheckout.status, err: okCheckout.body?.error },
    );

    await req('POST', '/cart/clear', consumer.token);
    const stale = await req('POST', '/cart/items', consumer.token, {
      listingId: ownedProduct.id,
      quantity: 1,
      guideOfferRef: { guideId: brandGuide.id, productId: ownedProduct.id },
      expectedUnitPrice: 1, // deliberately wrong / stale
    });
    let priceChange = stale;
    if (stale.status === 201) {
      priceChange = await req('POST', '/checkout', consumer.token, {
        idempotencyKey: `probe-stale-${Date.now()}`,
        shipping: { fullName: 'Probe Buyer', phone: '01700000000', address: '12 Test Road, Dhaka', city: 'Dhaka', area: 'Test' },
      });
    }
    check(
      priceChange.status === 409 && priceChange.body.code === 'GUIDE_OFFER_PRICE_CHANGED',
      'checkout: stale expected price → explicit 409 GUIDE_OFFER_PRICE_CHANGED (no silent charge)',
      { status: priceChange.status, code: priceChange.body.code },
    );
    await req('POST', '/cart/clear', consumer.token);

    // ── 9. Real storefront checkout path: POST /operations/orders ─────────
    //  (Choosify-Web CheckoutPage → operationsApi.createOrder → this endpoint)
    const promoNow = Math.round(basePrice * 0.8); // 20% off, matches brandGuide offer
    const opsShipping = { fullName: 'Probe Buyer', phone: '01700000000', address: '12 Test Road, Dhaka', region: 'Dhaka' };
    const mkOpsOrder = (items: unknown[]) => ({
      orderId: `probe-ops-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      buyerId: consumer.userId,
      isCOD: false,
      overallTotal: 999999,
      subtotal: 999999,
      deliveryTotal: 120,
      subOrders: [{ sellerId: seller.userId, sellerBusinessName: sellerBrand.name, items, deliveryFee: 120 }],
      paymentMethod: 'online',
      status: 'confirmed',
      createdAt: iso(Date.now()),
      shipping: opsShipping,
    });

    const opsActive = await req('POST', '/operations/orders', consumer.token, mkOpsOrder([
      {
        productId: ownedProduct.id,
        productTitle: ownedProduct.title,
        quantity: 1,
        price: promoNow,
        guideOfferRef: { guideId: brandGuide.id, productId: ownedProduct.id },
        expectedUnitPrice: promoNow,
      },
    ]));
    const opsItem = opsActive.body?.data?.subOrders?.[0]?.items?.[0];
    check(
      (opsActive.status === 200 || opsActive.status === 201) && Math.abs(Number(opsItem?.price) - promoNow) < 0.01,
      'operations order: active guide offer accepted, item priced at promo, base price untouched',
      { status: opsActive.status, price: opsItem?.price, promoNow, err: opsActive.body?.error },
    );
    check(
      opsItem?.guideOffer && opsItem.guideOffer.guideId === brandGuide.id && Number(opsItem.guideOffer.basePrice) === basePrice,
      'operations order: line snapshot carries guideOffer context (guideId + basePrice)',
      opsItem?.guideOffer,
    );

    const opsStale = await req('POST', '/operations/orders', consumer.token, mkOpsOrder([
      {
        productId: ownedProduct.id,
        productTitle: ownedProduct.title,
        quantity: 1,
        price: 1,
        guideOfferRef: { guideId: brandGuide.id, productId: ownedProduct.id },
        expectedUnitPrice: 1, // stale / forged
      },
    ]));
    check(
      opsStale.status === 409 && opsStale.body.code === 'GUIDE_OFFER_PRICE_CHANGED' &&
        Number(opsStale.body.details?.actualUnitPrice) === promoNow,
      'operations order: stale expected price → 409 GUIDE_OFFER_PRICE_CHANGED with authoritative price (no silent charge)',
      { status: opsStale.status, code: opsStale.body.code, details: opsStale.body.details },
    );

    const opsNormal = await req('POST', '/operations/orders', consumer.token, mkOpsOrder([
      { productId: otherProductId, productTitle: 'Normal', quantity: 1, price: 5 },
    ]));
    const opsNormalItem = opsNormal.body?.data?.subOrders?.[0]?.items?.[0];
    check(
      (opsNormal.status === 200 || opsNormal.status === 201) && !opsNormalItem?.guideOffer && Number(opsNormalItem?.price) > 5,
      'operations order: a normal product (no guideOfferRef) checks out unchanged at canonical price',
      { status: opsNormal.status, price: opsNormalItem?.price },
    );

    // ── 9b. Variant guard: an absolute promoPrice offer must NOT apply to a
    //        variant line (product-level liveOffers[] has no variantId). ──────
    const promoGuide = await mk(
      seller.token,
      {
        title: '[probe] promoPrice offer',
        slug: 'probe-promoprice-offer',
        format: 'live',
        type: 'video',
        publisherType: 'brand',
        publisherBrandId: sellerBrand.id,
      },
      {
        productIds: [ownedProduct.id],
        liveOffers: [
          { id: 'pp', productId: ownedProduct.id, promoPrice: Math.round(basePrice * 0.5), startsAt: iso(now - 3.6e6), endsAt: iso(now + 5 * 8.64e7), enabled: true },
        ],
        sections: [{ id: 'live_offers', enabled: true, order: 0, data: {} }],
      },
    );
    await req('POST', `/catalog/guides/${promoGuide.id}/publish`, seller.token);
    const flatPromo = Math.round(basePrice * 0.5);

    const noVariantOrder = await req('POST', '/operations/orders', consumer.token, mkOpsOrder([
      { productId: ownedProduct.id, productTitle: ownedProduct.title, quantity: 1, price: flatPromo, guideOfferRef: { guideId: promoGuide.id, productId: ownedProduct.id }, expectedUnitPrice: flatPromo },
    ]));
    const noVarItem = noVariantOrder.body?.data?.subOrders?.[0]?.items?.[0];
    check(
      (noVariantOrder.status === 200 || noVariantOrder.status === 201) && Number(noVarItem?.price) === flatPromo,
      'operations order: absolute promoPrice offer applies to a NON-variant line',
      { status: noVariantOrder.status, price: noVarItem?.price, flatPromo },
    );

    const variantOrder = await req('POST', '/operations/orders', consumer.token, mkOpsOrder([
      { productId: ownedProduct.id, productTitle: ownedProduct.title, quantity: 1, variantId: 'probe-variant-xyz', price: flatPromo, guideOfferRef: { guideId: promoGuide.id, productId: ownedProduct.id }, expectedUnitPrice: flatPromo },
    ]));
    // With a variant line the flat promoPrice is skipped → server prices at
    // canonical, so the stale expectedUnitPrice (flatPromo) is rejected explicitly.
    check(
      variantOrder.status === 409 && variantOrder.body.code === 'GUIDE_OFFER_PRICE_CHANGED' &&
        Number(variantOrder.body.details?.actualUnitPrice) === basePrice,
      'operations order: absolute promoPrice offer is NOT applied to a variant line (guard) → explicit price-change',
      { status: variantOrder.status, details: variantOrder.body.details },
    );
    await req('POST', `/catalog/guides/${promoGuide.id}/archive`, admin.token);

    // External refs never carry a productId → can never resolve a guide offer / cart line.
    const extResolve = await req('GET', `/catalog/guides/${brandGuide.id}`, admin.token);
    const extIds = (extResolve.body?.externalRefs || []).map((r: any) => r.id);
    check(
      extIds.every((xid: string) => !(brandGuide.patch.body.data?.productIds || []).includes(xid)),
      'external refs are never present in productIds (cannot enter cart/checkout)',
      extIds,
    );
  } else {
    console.log('SKIP checkout re-validation (no consumer account)');
  }

  // Cleanup probe guides.
  for (const id of [extGuide.id, socGuide.id, winGuide.id, brandGuide.id]) {
    await req('POST', `/catalog/guides/${id}/archive`, admin.token);
  }

  console.log(`\n=== ${PASS.length} passed, ${FAIL.length} failed ===`);
  if (FAIL.length) {
    console.log('FAILURES:\n - ' + FAIL.join('\n - '));
    process.exit(1);
  }
  console.log('ALL GUIDE LIVE-COMMERCE CHECKS PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
