/**
 * Permanent security + behaviour probe for the modernized Messaging / Inbox pass
 * (IS-005 §13). Canonical System A only.
 *
 * Proves:
 *  - support opener/audience is server-stamped; Creator sender role stays 'creator'
 *  - Consumer A cannot read Consumer B's support thread
 *  - Seller cannot read Creator support; Creator cannot read Seller support
 *  - normal user cannot use Admin support endpoints / user search
 *  - forged conversation id → 404; client senderId is ignored
 *  - Admin can read + reply to support
 *  - Admin does NOT auto-read private Buyer↔Seller commerce; explicit enter does
 *  - Admin-initiated support resolves the correct user, ignores forged role/audience,
 *    rejects nonexistent / self targets, and de-dupes to one active thread
 *  - mark-read only works for an authorized actor
 *  - staff CFID/name search (exact CFID first); non-staff denied
 *
 * Usage: npx tsx scripts/probe-messaging-inbox.ts   (or npm run test:messaging-inbox)
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
    console.log('FAIL', label, detail !== undefined ? JSON.stringify(detail).slice(0, 240) : '');
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
const H = (t?: string) => ({ 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) });
async function req(method: string, path: string, token?: string, body?: unknown) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: H(token),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, body: await j(r) };
}
async function login(email: string, password = 'ChoosifyDev!2026') {
  const b = await j(
    await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),
  );
  const token = b.accessToken || b.token || b.data?.accessToken;
  if (!token) throw new Error(`login failed for ${email}: ${JSON.stringify(b).slice(0, 160)}`);
  return { token, uid: b.uid || b.data?.uid || b.userId };
}
async function registerConsumer(tag: string) {
  const email = `zzz-probe-msg-${tag}-${Date.now()}@probe.local`;
  const password = 'ChoosifyProbe!2026';
  const r = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, fullName: `Probe ${tag}` }),
  });
  const b = await j(r);
  const uid = b.uid || b.data?.uid;
  const cfid = b.choosifyUserId || b.data?.choosifyUserId;
  if (!uid) throw new Error(`register failed for ${email}: ${r.status} ${JSON.stringify(b).slice(0, 160)}`);
  const { token } = await login(email, password);
  return { email, token, uid, cfid };
}

async function main() {
  const admin = await login('admin@choosify.com.bd');
  const support = await login('support@choosify.com.bd');
  const seller = await login('seller@choosify.com.bd');
  const creator = await login('creator@choosify.com.bd');
  const cA = await registerConsumer('a');
  const cB = await registerConsumer('b');

  // ── 1. support opener/audience server-stamped ────────────────────────
  const openA = await req('POST', '/support/conversations/ensure', cA.token, {
    subject: 'Probe A',
    body: 'Hello from consumer A',
  });
  const convA = openA.body?.data?.conversation;
  check(openA.status === 201 || openA.status === 200, 'consumer A opens a support conversation', openA.status);
  check(convA?.contextType === 'support_ticket', 'consumer A thread is a support_ticket', convA?.contextType);
  check(
    convA?.metadata?.audience === 'consumer' && (openA.body?.data?.ticket?.audience === 'consumer'),
    'support audience stamped as consumer (server-side)',
    { m: convA?.metadata?.audience, t: openA.body?.data?.ticket?.audience },
  );
  check(
    openA.body?.data?.message?.senderRole === 'consumer' &&
      openA.body?.data?.message?.senderId === cA.uid,
    'first support message senderRole/senderId are server-stamped',
    openA.body?.data?.message,
  );

  const openCreator = await req('POST', '/support/conversations/ensure', creator.token, {
    body: 'Creator needs help',
  });
  const convCreator = openCreator.body?.data?.conversation;
  const creatorMsgs =
    (await req('GET', `/support/conversations/${convCreator.id}/messages`, creator.token)).body?.data || [];
  check(
    openCreator.body?.data?.message?.senderRole === 'creator' ||
      creatorMsgs.some((m: any) => m.senderRole === 'creator'),
    'Creator sender role is "creator" (no longer coerced to consumer)',
    { firstMsg: openCreator.body?.data?.message?.senderRole, roles: creatorMsgs.map((m: any) => m.senderRole) },
  );
  check(
    convCreator?.metadata?.audience === 'creator' &&
      convCreator?.participants?.some((p: any) => p.userId === creator.uid && p.role === 'creator'),
    'Creator support conversation carries audience=creator + creator participant role',
    { audience: convCreator?.metadata?.audience, participants: convCreator?.participants },
  );

  const openSeller = await req('POST', '/support/conversations/ensure', seller.token, {
    body: 'Seller needs help',
  });
  const convSeller = openSeller.body?.data?.conversation;
  check(convSeller?.metadata?.audience === 'seller', 'Seller support audience=seller', convSeller?.metadata?.audience);

  const openB = await req('POST', '/support/conversations/ensure', cB.token, { body: 'Consumer B here' });
  const convB = openB.body?.data?.conversation;

  // ── 2. cross-actor read isolation ───────────────────────────────────
  check(
    (await req('GET', `/support/conversations/${convB.id}/messages`, cA.token)).status === 403,
    'Consumer A cannot read Consumer B support thread',
  );
  check(
    (await req('GET', `/support/conversations/${convCreator.id}/messages`, seller.token)).status === 403,
    'Seller cannot read Creator support thread',
  );
  check(
    (await req('GET', `/support/conversations/${convSeller.id}/messages`, creator.token)).status === 403,
    'Creator cannot read Seller support thread',
  );
  check(
    (await req('GET', `/support/conversations/${convA.id}/messages`, creator.token)).status === 403,
    'Creator cannot read a Consumer support thread',
  );

  // ── 3. forged ids / impersonation ──────────────────────────────────
  check(
    (await req('GET', `/support/conversations/conv_forged_${Date.now()}/messages`, admin.token)).status === 404,
    'forged conversation id → 404',
  );
  check(
    (await req('GET', '/admin/support/conversations', cA.token)).status === 403,
    'normal user cannot list the Admin support inbox',
  );
  check(
    (await req('POST', '/admin/support/conversations', cA.token, { targetUserId: cB.uid })).status === 403,
    'normal user cannot start an Admin-initiated support conversation',
  );
  check(
    (await req('GET', `/operations/users?context=messaging&q=${cB.cfid || 'x'}`, cA.token)).status === 403,
    'normal user cannot use the staff user directory search',
  );

  // ── 4. client senderId is ignored ──────────────────────────────────
  const forgedSend = await req('POST', `/support/conversations/${convA.id}/messages`, cA.token, {
    body: 'trying to forge',
    senderId: 'attacker-user-id',
    senderRole: 'admin',
  });
  const forgedMsg = forgedSend.body?.data?.message;
  check(
    forgedMsg?.senderId === cA.uid && forgedMsg?.senderRole === 'consumer',
    'server ignores client senderId/senderRole — stamps the authenticated actor',
    forgedMsg,
  );

  // ── 5. Admin can read + reply to support ───────────────────────────
  const adminInbox = await req('GET', '/admin/support/conversations', admin.token);
  check(adminInbox.status === 200 && Array.isArray(adminInbox.body?.data), 'Admin lists the support inbox', adminInbox.status);
  const rowA = (adminInbox.body?.data || []).find((r: any) => r.conversation?.id === convA.id);
  check(
    rowA && rowA.audience === 'consumer' && rowA.opener?.id === cA.uid,
    'Admin inbox row resolves opener identity + audience',
    rowA?.opener,
  );
  const adminReply = await req('POST', `/support/conversations/${convA.id}/messages`, admin.token, {
    body: 'Choosify Support here — how can we help?',
  });
  check(
    adminReply.status === 201 && adminReply.body?.data?.message?.senderRole === 'admin',
    'Admin replies to a support thread (senderRole admin, no separate enter)',
    adminReply.status,
  );
  check(
    (await req('GET', `/support/conversations/${convA.id}/messages`, support.token)).status === 200,
    'support_agent can also read the support thread',
  );

  // ── 6. Admin NOT auto-reading private commerce; explicit enter grants it ─
  // Blanket-read removal at the list level: a staff actor who has entered nothing
  // sees ONLY support_ticket + external_social in /conversations — not every
  // private Buyer↔Seller thread in the platform. (support_agent enters nothing
  // in this probe, unlike admin which enters a commerce conv below.)
  const staffConvList = (await req('GET', '/conversations', support.token)).body?.data || [];
  check(
    Array.isArray(staffConvList) &&
      staffConvList.every((c: any) => c.contextType === 'support_ticket' || c.contextType === 'external_social'),
    'staff /conversations list is scoped to support/external-social — not a feed of all marketplace chats',
    staffConvList.map((c: any) => c.contextType).slice(0, 12),
  );

  // Deterministically produce a private Buyer↔Seller commerce conversation:
  // admin places a manual order for a product the seed seller owns → System A
  // creates a manual_order conversation the seller (participant) can see.
  const ownProducts = (await req('GET', '/catalog/products', seller.token)).body?.data || [];
  const sellerProduct = ownProducts.find((p: any) => p?.id && p?.brandId && p?.sellerId === seller.uid) || null;
  let commerceConv: any = null;
  if (sellerProduct) {
    const manual = await req('POST', '/orders/manual', admin.token, {
      sellerId: sellerProduct.sellerId,
      brandId: sellerProduct.brandId,
      listingType: 'product',
      listingId: sellerProduct.id,
      quantity: 1,
      source: 'external_whatsapp',
      shipping: { fullName: 'Probe Buyer', phone: '01700000000', address: 'Dhaka' },
      notes: 'messaging probe manual order',
    });
    const mOrderId = manual.body?.data?.id;
    const sellerCommerce = (await req('GET', '/conversations?contextType=manual_order', seller.token)).body?.data || [];
    commerceConv = sellerCommerce.find((c: any) => c.orderId === mOrderId) || sellerCommerce[0] || null;
  }
  const sellerConvList = (await req('GET', '/conversations', seller.token)).body?.data || [];
  if (commerceConv) {
    check(
      (await req('GET', `/conversations/${commerceConv.id}`, admin.token)).status === 403,
      'Admin does NOT auto-read a private Buyer↔Seller commerce conversation',
    );
    const enter = await req('POST', `/admin/conversations/${commerceConv.id}/enter`, admin.token, {
      reason: 'dispute probe',
    });
    check(enter.status === 201, 'Admin can enter a commerce conversation (audited)', enter.status);
    check(
      (await req('GET', `/conversations/${commerceConv.id}`, admin.token)).status === 200,
      'after an audited enter, Admin can read that commerce conversation',
    );
    check(
      (await req('GET', `/conversations/${commerceConv.id}`, support.token)).status === 403,
      'a different staffer still cannot auto-read it (per-admin entry)',
    );
  } else {
    console.log('SKIP commerce-conversation checks — no System-A commerce conversation in this environment');
  }

  // seller commerce inbox must not contain creator/consumer support threads
  const sellerConvs = (await req('GET', '/conversations', seller.token)).body?.data || [];
  check(
    !sellerConvs.some((c: any) => c.id === convCreator.id || c.id === convB.id),
    "Seller's conversation list excludes other users' support threads",
  );

  // ── 7. Admin-initiated support: correct target, forged fields ignored ─
  const init1 = await req('POST', '/admin/support/conversations', admin.token, {
    targetUserId: cB.uid,
    role: 'admin', // forged — must be ignored
    audience: 'seller', // forged — must be ignored
    body: 'Hi from Choosify, following up.',
  });
  check(
    (init1.status === 200 || init1.status === 201) &&
      init1.body?.data?.target?.id === cB.uid &&
      init1.body?.data?.target?.audience === 'consumer',
    'Admin-initiated support resolves target server-side + ignores forged role/audience',
    init1.body?.data?.target,
  );
  const initConvId = init1.body?.data?.conversation?.id;
  check(
    init1.body?.data?.conversation?.consumerId === cB.uid &&
      init1.body?.data?.message?.senderRole === 'admin',
    'Admin-initiated first message is server-stamped as admin, thread owned by target',
    { consumerId: init1.body?.data?.conversation?.consumerId, sr: init1.body?.data?.message?.senderRole },
  );
  check(
    (await req('POST', '/admin/support/conversations', admin.token, { targetUserId: `00000000-0000-4000-8000-${Date.now().toString().padStart(12, '0')}` }))
      .status === 404,
    'Admin-initiated support to a nonexistent user → 404',
  );
  check(
    [400, 404].includes(
      (await req('POST', '/admin/support/conversations', admin.token, { targetUserId: admin.uid })).status,
    ),
    'Admin cannot start a support conversation targeting themselves / a system identity',
  );

  // dedup: a second open for cB resolves to the SAME active thread
  const init2 = await req('POST', '/admin/support/conversations', admin.token, { targetUserId: cB.uid });
  check(
    init2.body?.data?.conversation?.id === initConvId,
    'profile-open and inbox-search-open resolve to ONE active support thread (dedup)',
    { first: initConvId, second: init2.body?.data?.conversation?.id },
  );
  // and the target sees it as their active support conversation
  const cbActive = await req('GET', '/support/conversations/active', cB.token);
  check(
    cbActive.status === 200 && cbActive.body?.data?.conversation?.id === initConvId,
    'target user sees the Admin-initiated thread as their active support conversation',
    cbActive.body?.data?.conversation?.id,
  );

  // ── 8. mark-read authorization ─────────────────────────────────────
  check(
    (await req('POST', `/support/conversations/${convA.id}/read`, cB.token)).status === 403,
    'mark-read is rejected for an actor not authorized to read the conversation',
  );
  const readA = await req('POST', `/support/conversations/${convA.id}/read`, cA.token);
  check(readA.status === 200 && typeof readA.body?.data?.marked === 'number', 'authorized actor can mark a conversation read', readA.body);
  check(
    (await req('POST', `/support/conversations/${convA.id}/read`, cA.token)).body?.data?.marked === 0,
    'a second mark-read marks 0 (idempotent, canonical readBy state)',
  );

  // ── 9. staff user directory search (CFID exact first) ──────────────
  if (cB.cfid) {
    const search = await req('GET', `/operations/users?context=messaging&q=${encodeURIComponent(cB.cfid)}`, admin.token);
    const first = (search.body?.data || [])[0];
    check(
      search.status === 200 && first?.id === cB.uid && first?.role === 'Consumer',
      'exact CFID search ranks the right user first',
      first,
    );
    const miss = await req('GET', '/operations/users?context=messaging&q=CF-99999999', admin.token);
    check(
      miss.status === 200 && Array.isArray(miss.body?.data) && miss.body.data.length === 0,
      'a nonexistent CFID returns a safe empty result',
      miss.body?.data,
    );
  } else {
    console.log('SKIP CFID search checks (register did not return a CFID)');
  }

  console.log(`\n=== ${PASS.length} passed, ${FAIL.length} failed ===`);
  if (FAIL.length) {
    console.log('FAILURES:');
    for (const f of FAIL) console.log(' -', f);
    process.exit(1);
  }
  console.log('ALL MESSAGING INBOX CHECKS PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
