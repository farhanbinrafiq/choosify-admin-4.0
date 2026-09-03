import type {
  OpsCoupon,
  OpsCouponUsage,
  OpsFeeCharge,
  OpsJobApplication,
  OpsJobPosting,
  OpsLead,
  OpsPaymentOptionsConfig,
  OpsReturnRequest,
  OpsWarrantyClaim,
  OpsReview,
  OpsSellerBookingSettings,
  OpsStorefrontOrder,
  OpsVerificationDocument,
  OpsVerificationRequest,
  OpsVerificationReview,
  RolePermissionsMap,
} from './types';
import { OPEN_WARRANTY_CLAIM_STATUSES } from './types';

const nowIso = () => new Date().toISOString();

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || `job-${Date.now()}`;

const defaultJobPostings = (): OpsJobPosting[] => {
  const ts = nowIso();
  return [
    {
      id: 'job-frontend-engineer',
      slug: 'frontend-engineer',
      title: 'Frontend Engineer',
      department: 'Engineering',
      location: 'Dhaka / Hybrid',
      employmentType: 'full_time',
      summary:
        'Build and polish the Choosify storefront experience — discovery feeds, product detail, and buyer dashboard.',
      description:
        'As a Frontend Engineer at Choosify, you will ship high-quality React interfaces that help millions of shoppers discover verified brands across Bangladesh. You will work closely with design and product to turn marketplace ideas into fast, accessible UI.',
      responsibilities:
        '- Own features across Choosify-Web (React, TypeScript, Vite)\n- Collaborate with design on feed layouts, cards, and forms\n- Improve performance, accessibility, and SEO for public pages\n- Partner with backend on public API contracts',
      requirements:
        '- Strong React + TypeScript experience\n- Comfortable with modern CSS / design systems\n- Experience shipping consumer-facing web products\n- Clear written communication',
      status: 'open',
      postedAt: ts,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'job-product-designer',
      slug: 'product-designer',
      title: 'Product Designer',
      department: 'Design',
      location: 'Remote',
      employmentType: 'full_time',
      summary: 'Shape Choosify’s visual system and craft clear buyer/seller flows across web and dashboard.',
      description:
        'We are looking for a Product Designer who can balance brand expression with practical marketplace UX. You will design flows for discovery, careers, seller tools, and more.',
      responsibilities:
        '- Design end-to-end product flows and high-fidelity UI\n- Maintain and evolve the Choosify design system\n- Prototype and validate with stakeholders\n- Partner with engineering for polished implementation',
      requirements:
        '- Portfolio showing marketplace or consumer product work\n- Strong Figma skills\n- Systems thinking around components and tokens\n- Comfortable iterating quickly with engineers',
      status: 'open',
      postedAt: ts,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'job-growth-marketing-intern',
      slug: 'growth-marketing-intern',
      title: 'Growth Marketing Intern',
      department: 'Growth',
      location: 'Dhaka',
      employmentType: 'internship',
      summary: 'Support campaigns, content experiments, and community outreach that grow Choosify awareness.',
      description:
        'Join the Growth team for a hands-on internship. You will help run experiments across social, partnerships, and content while learning how a marketplace brand scales in Bangladesh.',
      responsibilities:
        '- Assist with social content calendars and campaign tracking\n- Support creator/brand outreach lists\n- Help analyze simple performance metrics\n- Contribute ideas for seasonal campaigns',
      requirements:
        '- Currently studying marketing, communications, or related field\n- Strong Bangla + English writing\n- Curious about e-commerce and social platforms\n- Reliable and organized',
      status: 'open',
      postedAt: ts,
      createdAt: ts,
      updatedAt: ts,
    },
  ];
};

const defaultCoupons = (): OpsCoupon[] => {
  const ts = nowIso();
  return [
    {
      id: 'coup_welcome250',
      code: 'WELCOME250',
      type: 'fixed_amount',
      discountTarget: 'all_products',
      discountValue: 250,
      validFrom: '2026-01-01',
      validUntil: '2026-12-31',
      active: true,
      rules: { minPurchaseAmount: 1000, maxUsages: 100, maxUsagesPerUser: 1 },
      description: 'Welcome discount for new accounts',
      totalUsages: 0,
      totalRedemptions: 0,
      totalDiscountGiven: 0,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'coup_summer2026',
      code: 'SUMMER2026',
      type: 'percentage',
      discountTarget: 'all_products',
      discountValue: 15,
      validFrom: '2026-06-01',
      validUntil: '2026-12-31',
      active: true,
      rules: { minPurchaseAmount: 500, maxDiscountAmount: 600, maxUsages: 500 },
      description: 'Seasonal summer campaign',
      totalUsages: 0,
      totalRedemptions: 0,
      totalDiscountGiven: 0,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'coup_aarong15',
      code: 'AARONG15',
      type: 'percentage',
      discountTarget: 'all_products',
      discountValue: 15,
      validFrom: '2026-01-01',
      validUntil: '2026-12-31',
      active: true,
      rules: { minPurchaseAmount: 500 },
      description: 'Aarong brand promo',
      totalUsages: 0,
      totalRedemptions: 0,
      totalDiscountGiven: 0,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'coup_apexfoot26',
      code: 'APEXFOOT26',
      type: 'fixed_amount',
      discountTarget: 'all_products',
      discountValue: 500,
      validFrom: '2026-01-01',
      validUntil: '2026-12-31',
      active: true,
      rules: { minPurchaseAmount: 2000 },
      description: 'Apex footwear flat discount',
      totalUsages: 0,
      totalRedemptions: 0,
      totalDiscountGiven: 0,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'coup_sailoreid',
      code: 'SAILOREID',
      type: 'percentage',
      discountTarget: 'all_products',
      discountValue: 20,
      validFrom: '2026-01-01',
      validUntil: '2026-12-31',
      active: true,
      rules: { minPurchaseAmount: 800, maxDiscountAmount: 800 },
      description: 'Sailor Eid campaign',
      totalUsages: 0,
      totalRedemptions: 0,
      totalDiscountGiven: 0,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'coup_adiextra10',
      code: 'ADIEXTRA10',
      type: 'percentage',
      discountTarget: 'all_products',
      discountValue: 10,
      validFrom: '2026-01-01',
      validUntil: '2026-12-31',
      active: true,
      rules: { minPurchaseAmount: 300 },
      description: 'Adidas extra savings',
      totalUsages: 0,
      totalRedemptions: 0,
      totalDiscountGiven: 0,
      createdAt: ts,
      updatedAt: ts,
    },
  ];
};

const defaultFeeCharges = (): OpsFeeCharge[] => {
  const ts = nowIso();
  return [
    {
      id: 'fee_platform_commission',
      name: 'Platform Commission',
      type: 'platform_fee',
      rateType: 'percentage',
      rateValue: 8,
      scopeType: 'platform',
      active: true,
      description: 'Default platform-wide commission applied to every order.',
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'fee_service_charge',
      name: 'Service Charge',
      type: 'service_charge',
      rateType: 'flat',
      rateValue: 20,
      scopeType: 'platform',
      active: true,
      description: 'Flat service charge applied per order.',
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'fee_standard_delivery',
      name: 'Standard Delivery Fee',
      type: 'delivery',
      rateType: 'flat',
      rateValue: 60,
      scopeType: 'platform',
      active: true,
      description: 'Default flat delivery fee for platform-wide orders.',
      createdAt: ts,
      updatedAt: ts,
    },
  ];
};

const defaultPaymentOptionsConfig = (): OpsPaymentOptionsConfig => ({
  partialPaymentEnabled: true,
  minDepositPercent: 10,
  maxDepositPercent: 50,
  updatedAt: nowIso(),
});

export const DEFAULT_ROLE_PERMISSIONS: RolePermissionsMap = {
  super_admin: {
    content: true,
    users: true,
    finance: true,
    brand: true,
    system: true,
    analytics: true,
    taxonomy: true,
    impersonate: true,
  },
  admin: {
    content: true,
    users: true,
    finance: false,
    brand: true,
    system: true,
    analytics: true,
    taxonomy: true,
    impersonate: true,
  },
  // Aligned with src/lib/rbac.ts — seller/creator CMS mirror menus need these gates open
  seller: {
    content: true,
    users: true,
    finance: true,
    brand: true,
    system: true,
    analytics: true,
    taxonomy: false,
    impersonate: false,
  },
  creator: {
    content: true,
    users: true,
    finance: true,
    brand: false,
    system: true,
    analytics: true,
    taxonomy: false,
    impersonate: false,
  },
  moderator: {
    content: true,
    users: false,
    finance: false,
    brand: true,
    system: false,
    analytics: true,
    taxonomy: true,
    impersonate: false,
  },
  finance_manager: {
    content: false,
    users: false,
    finance: true,
    brand: false,
    system: false,
    analytics: true,
    taxonomy: false,
    impersonate: false,
  },
  support_agent: {
    content: false,
    users: true,
    finance: false,
    brand: false,
    system: false,
    analytics: true,
    taxonomy: false,
    impersonate: false,
  },
  marketing_manager: {
    content: true,
    users: false,
    finance: false,
    brand: false,
    system: false,
    analytics: true,
    taxonomy: false,
    impersonate: false,
  },
};

/** Ensure mirror roles keep required true-flags even when a legacy snapshot stripped them. */
function mergeRolePermissions(
  defaults: RolePermissionsMap[string],
  incoming?: Partial<RolePermissionsMap[string]> | null,
): RolePermissionsMap[string] {
  const merged = { ...defaults, ...(incoming || {}) };
  (Object.keys(defaults) as Array<keyof typeof defaults>).forEach((key) => {
    if (defaults[key]) merged[key] = true;
  });
  return merged;
}

const state: {
  orders: OpsStorefrontOrder[];
  coupons: OpsCoupon[];
  couponUsage: OpsCouponUsage[];
  reviews: OpsReview[];
  leads: OpsLead[];
  jobPostings: OpsJobPosting[];
  jobApplications: OpsJobApplication[];
  permissions: RolePermissionsMap;
  featureFlags: Record<string, boolean>;
  sellerOffers: import('./operationsDb').OpsSellerOfferRow[];
  feeCharges: OpsFeeCharge[];
  paymentOptionsConfig: OpsPaymentOptionsConfig;
  sellerBookingSettings: Record<string, OpsSellerBookingSettings>;
  returns: OpsReturnRequest[];
  verifications: OpsVerificationRequest[];
  warrantyClaims: OpsWarrantyClaim[];
} = {
  orders: [],
  coupons: defaultCoupons(),
  couponUsage: [],
  reviews: [],
  leads: [],
  jobPostings: defaultJobPostings(),
  jobApplications: [],
  permissions: structuredClone(DEFAULT_ROLE_PERMISSIONS),
  feeCharges: defaultFeeCharges(),
  paymentOptionsConfig: defaultPaymentOptionsConfig(),
  sellerBookingSettings: {},
  returns: [],
  verifications: [],
  warrantyClaims: [],
  featureFlags: {
    creator_hub: true,
    compare_tool: true,
    enable_comparison_engine: true,
    enable_creator_marketplace: true,
    enable_community_submissions: true,
    enable_campaign_banners: true,
    enable_cod_only_mode: false,
    enable_promo_codes: true,
    enable_brand_deals_page: true,
    pwa_install_prompt: true,
    maintenance_mode: false,
  },
  sellerOffers: [],
};

let persistHook: (() => void) | null = null;

const touch = () => {
  persistHook?.();
};

export const operationsStore = {
  setPersistHook: (hook: () => void) => {
    persistHook = hook;
  },

  hydrate: (snapshot: Partial<typeof state>) => {
    // Pre-commit audit follow-up: coupons/jobPostings/feeCharges default to
    // non-empty seed data, so a `?.length` truthy guard here would silently
    // discard a real, legitimately-empty snapshot (e.g. an admin deleted every
    // coupon) and resurrect the demo seed rows on next restart. Trust presence
    // of the field, not its length, exactly like every other array below.
    if (snapshot.orders) state.orders = snapshot.orders;
    if (snapshot.coupons) state.coupons = snapshot.coupons;
    if (snapshot.couponUsage) state.couponUsage = snapshot.couponUsage;
    if (snapshot.reviews) state.reviews = snapshot.reviews;
    if (snapshot.leads) state.leads = snapshot.leads;
    if (snapshot.jobPostings) state.jobPostings = snapshot.jobPostings;
    if (snapshot.jobApplications) state.jobApplications = snapshot.jobApplications;
    if (snapshot.permissions) {
      // Merge so legacy snapshots cannot strip seller/creator CMS-mirror access
      state.permissions = {
        ...structuredClone(DEFAULT_ROLE_PERMISSIONS),
        ...snapshot.permissions,
        seller: mergeRolePermissions(DEFAULT_ROLE_PERMISSIONS.seller, snapshot.permissions.seller),
        creator: mergeRolePermissions(DEFAULT_ROLE_PERMISSIONS.creator, snapshot.permissions.creator),
      };
    }
    if (snapshot.featureFlags) state.featureFlags = snapshot.featureFlags;
    if (snapshot.sellerOffers) state.sellerOffers = snapshot.sellerOffers;
    if (snapshot.feeCharges) state.feeCharges = snapshot.feeCharges;
    if (snapshot.paymentOptionsConfig) state.paymentOptionsConfig = snapshot.paymentOptionsConfig;
    if (snapshot.sellerBookingSettings) state.sellerBookingSettings = snapshot.sellerBookingSettings;
    if (snapshot.returns) state.returns = snapshot.returns;
    if (snapshot.verifications) state.verifications = snapshot.verifications as OpsVerificationRequest[];
    if (snapshot.warrantyClaims) state.warrantyClaims = snapshot.warrantyClaims;
  },

  listCouponUsage: () => [...state.couponUsage],
  listOrders: (filter?: { buyerId?: string; sellerId?: string; status?: string }) => {
    let rows = [...state.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filter?.buyerId) {
      rows = rows.filter((order) => order.buyerId === filter.buyerId);
    }
    if (filter?.sellerId) {
      const sellerId = filter.sellerId;
      rows = rows.filter((order) =>
        (order.subOrders || []).some(
          (sub) => (sub as { sellerId?: string })?.sellerId === sellerId,
        ),
      );
    }
    if (filter?.status) {
      rows = rows.filter((order) => order.status.toLowerCase() === filter.status!.toLowerCase());
    }
    return rows;
  },
  getOrder: (id: string) => state.orders.find((order) => order.id === id || order.orderId === id) ?? null,
  /**
   * QA2-001 fix: this used to unconditionally unshift(), so a duplicate
   * orderId never overwrote the original in place -- it inserted a SECOND
   * row with the same id/orderId. getOrder()'s find() always resolved to
   * the newest (unshift prepends), which is what made it look like an
   * in-place overwrite from the outside; listOrders() would have shown
   * both rows. Now idempotent by orderId: an existing order is returned
   * unchanged rather than duplicated. Protects every caller of this shared
   * function (the client-facing POST /operations/orders route, plus
   * bookingService.ts and checkoutService.ts, which generate their own
   * orderId server-side and shouldn't collide, but are covered either way).
   */
  createOrder: (payload: Omit<OpsStorefrontOrder, 'id' | 'updatedAt'>) => {
    const existing = state.orders.find(
      (order) => order.id === payload.orderId || order.orderId === payload.orderId,
    );
    if (existing) return existing;
    const order: OpsStorefrontOrder = {
      ...payload,
      id: payload.orderId,
      updatedAt: nowIso(),
    };
    state.orders.unshift(order);
    touch();
    return order;
  },
  updateOrder: (id: string, patch: Partial<OpsStorefrontOrder>) => {
    const idx = state.orders.findIndex((order) => order.id === id || order.orderId === id);
    if (idx < 0) return null;
    state.orders[idx] = { ...state.orders[idx], ...patch, updatedAt: nowIso() };
    touch();
    return state.orders[idx];
  },
  getOrderByClaimToken: (token: string) =>
    state.orders.find((order) => order.claimToken === token) ?? null,
  claimOrder: (token: string, buyer: { buyerId: string; buyerName?: string }) => {
    const idx = state.orders.findIndex((order) => order.claimToken === token);
    if (idx < 0) return null;
    const order = state.orders[idx];
    if (order.claimedAt) return order; // already claimed — idempotent, return as-is
    state.orders[idx] = {
      ...order,
      buyerId: buyer.buyerId,
      claimedAt: nowIso(),
      claimedByName: buyer.buyerName,
      status: order.status === 'pending_payment' ? 'confirmed' : order.status,
      updatedAt: nowIso(),
    };
    touch();
    return state.orders[idx];
  },

  listCoupons: () => state.coupons.filter((coupon) => !coupon.deleted),
  getCoupon: (id: string) => state.coupons.find((coupon) => coupon.id === id) ?? null,
  getCouponByCode: (code: string) =>
    state.coupons.find((coupon) => coupon.code.toUpperCase() === code.toUpperCase() && !coupon.deleted) ?? null,
  upsertCoupon: (coupon: OpsCoupon) => {
    const idx = state.coupons.findIndex((row) => row.id === coupon.id);
    if (idx >= 0) {
      state.coupons[idx] = { ...state.coupons[idx], ...coupon, updatedAt: nowIso() };
      touch();
      return state.coupons[idx];
    }
    state.coupons.push({ ...coupon, createdAt: coupon.createdAt || nowIso(), updatedAt: nowIso() });
    touch();
    return coupon;
  },
  deleteCoupon: (id: string) => {
    const coupon = state.coupons.find((row) => row.id === id);
    if (!coupon) return false;
    coupon.deleted = true;
    coupon.active = false;
    coupon.updatedAt = nowIso();
    touch();
    return true;
  },
  recordCouponUsage: (usage: Omit<OpsCouponUsage, 'id' | 'timestamp'>) => {
    const row: OpsCouponUsage = {
      ...usage,
      id: `usage-${Date.now()}`,
      timestamp: nowIso(),
    };
    state.couponUsage.unshift(row);
    const coupon = state.coupons.find((c) => c.id === usage.couponId);
    if (coupon) {
      coupon.totalUsages += 1;
      if (usage.status === 'redeemed') {
        coupon.totalRedemptions += 1;
        coupon.totalDiscountGiven += usage.discountAmount;
      }
      coupon.updatedAt = nowIso();
    }
    touch();
    return row;
  },
  countCouponUsageForUser: (couponId: string, userId: string) =>
    state.couponUsage.filter(
      (usage) => usage.couponId === couponId && usage.userId === userId && usage.status === 'redeemed',
    ).length,

  listReviews: (filters?: {
    productId?: string;
    brandName?: string;
    status?: string;
    userId?: string;
  }) => {
    let rows = [...state.reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filters?.productId) {
      rows = rows.filter((review) => review.productId === filters.productId);
    }
    if (filters?.brandName) {
      const needle = filters.brandName.trim().toLowerCase();
      rows = rows.filter((review) => (review.brandName || '').trim().toLowerCase() === needle);
    }
    if (filters?.userId) {
      rows = rows.filter((review) => review.userId === filters.userId);
    }
    if (filters?.status) {
      rows = rows.filter((review) => review.status.toLowerCase() === filters.status!.toLowerCase());
    }
    return rows;
  },
  getReview: (id: string) => state.reviews.find((review) => review.id === id) ?? null,
  createReview: (payload: Omit<OpsReview, 'id' | 'createdAt' | 'updatedAt' | 'reports' | 'status'>) => {
    const review: OpsReview = {
      ...payload,
      id: `rev-${Date.now()}`,
      status: 'pending',
      reports: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.reviews.unshift(review);
    touch();
    return review;
  },
  updateReview: (id: string, patch: Partial<OpsReview>) => {
    const idx = state.reviews.findIndex((review) => review.id === id);
    if (idx < 0) return null;
    state.reviews[idx] = { ...state.reviews[idx], ...patch, updatedAt: nowIso() };
    touch();
    return state.reviews[idx];
  },
  deleteReview: (id: string) => {
    const before = state.reviews.length;
    state.reviews = state.reviews.filter((review) => review.id !== id);
    touch();
    return state.reviews.length < before;
  },

  listLeads: () => [...state.leads].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  getLead: (id: string) => state.leads.find((lead) => lead.id === id) ?? null,
  createLead: (payload: Omit<OpsLead, 'id' | 'status' | 'createdAt' | 'updatedAt'>) => {
    const lead: OpsLead = {
      ...payload,
      id: `lead-${Date.now()}`,
      status: 'new',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.leads.unshift(lead);
    touch();
    return lead;
  },
  updateLead: (id: string, patch: Partial<OpsLead>) => {
    const idx = state.leads.findIndex((lead) => lead.id === id);
    if (idx < 0) return null;
    state.leads[idx] = { ...state.leads[idx], ...patch, updatedAt: nowIso() };
    touch();
    return state.leads[idx];
  },

  listJobPostings: (options?: { publicOnly?: boolean }) => {
    const rows = [...state.jobPostings].sort((a, b) => b.postedAt.localeCompare(a.postedAt));
    if (options?.publicOnly) return rows.filter((job) => job.status === 'open');
    return rows;
  },
  getJobPosting: (idOrSlug: string) =>
    state.jobPostings.find((job) => job.id === idOrSlug || job.slug === idOrSlug) ?? null,
  createJobPosting: (
    payload: Omit<OpsJobPosting, 'id' | 'slug' | 'postedAt' | 'createdAt' | 'updatedAt'> & {
      slug?: string;
      postedAt?: string;
    },
  ) => {
    const ts = nowIso();
    const baseSlug = slugify(payload.slug || payload.title);
    let slug = baseSlug;
    let n = 2;
    while (state.jobPostings.some((job) => job.slug === slug)) {
      slug = `${baseSlug}-${n++}`;
    }
    const job: OpsJobPosting = {
      ...payload,
      id: `job-${Date.now()}`,
      slug,
      postedAt: payload.postedAt || ts,
      createdAt: ts,
      updatedAt: ts,
    };
    state.jobPostings.unshift(job);
    touch();
    return job;
  },
  updateJobPosting: (id: string, patch: Partial<OpsJobPosting>) => {
    const idx = state.jobPostings.findIndex((job) => job.id === id);
    if (idx < 0) return null;
    const next = { ...state.jobPostings[idx], ...patch, updatedAt: nowIso() };
    if (patch.title && !patch.slug) {
      // keep existing slug unless explicitly changed
    }
    if (patch.slug) {
      next.slug = slugify(patch.slug);
    }
    state.jobPostings[idx] = next;
    touch();
    return state.jobPostings[idx];
  },
  deleteJobPosting: (id: string) => {
    const before = state.jobPostings.length;
    state.jobPostings = state.jobPostings.filter((job) => job.id !== id);
    touch();
    return state.jobPostings.length < before;
  },

  listJobApplications: (jobId?: string) => {
    const rows = [...state.jobApplications].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return jobId ? rows.filter((row) => row.jobId === jobId) : rows;
  },
  createJobApplication: (
    payload: Omit<OpsJobApplication, 'id' | 'status' | 'createdAt' | 'updatedAt'>,
  ) => {
    const application: OpsJobApplication = {
      ...payload,
      id: `jobapp-${Date.now()}`,
      status: 'new',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.jobApplications.unshift(application);
    touch();
    return application;
  },
  updateJobApplication: (id: string, patch: Partial<OpsJobApplication>) => {
    const idx = state.jobApplications.findIndex((row) => row.id === id);
    if (idx < 0) return null;
    state.jobApplications[idx] = { ...state.jobApplications[idx], ...patch, updatedAt: nowIso() };
    touch();
    return state.jobApplications[idx];
  },

  getFeatureFlags: () => ({ ...state.featureFlags }),
  updateFeatureFlags: (flags: Record<string, boolean>) => {
    state.featureFlags = { ...state.featureFlags, ...flags };
    touch();
    return state.featureFlags;
  },

  listUsers: () => {
    const byKey = new Map<
      string,
      {
        id: string;
        name: string;
        email: string;
        role: 'Consumer' | 'Creator' | 'Seller' | 'Admin';
        status: 'Active' | 'Banned' | 'Inactive';
        joined: string;
        active: string;
        initials: string;
        trustScore: number;
        behaviorSegment: string;
      }
    >();

    const initials = (name: string) =>
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || '')
        .join('') || 'U';

    for (const order of state.orders) {
      const key = order.buyerId || order.orderId;
      if (byKey.has(key)) continue;
      const name = order.shipping?.fullName || order.buyerId || 'Guest';
      byKey.set(key, {
        id: key,
        name,
        email: `${key.replace(/\s+/g, '.').toLowerCase()}@orders.choosify.bd`,
        role: 'Consumer',
        status: 'Active',
        joined: order.createdAt?.split('T')[0] || '—',
        active: order.updatedAt?.split('T')[0] || order.createdAt?.split('T')[0] || '—',
        initials: initials(name),
        trustScore: 85,
        behaviorSegment: 'Retail Shopper',
      });
    }

    for (const lead of state.leads) {
      const key = lead.email.toLowerCase();
      if (byKey.has(key)) continue;
      const name = lead.contactPerson || lead.brandName;
      byKey.set(key, {
        id: key,
        name,
        email: lead.email,
        role: 'Consumer',
        status: 'Active',
        joined: lead.createdAt?.split('T')[0] || '—',
        active: lead.updatedAt?.split('T')[0] || '—',
        initials: initials(name),
        trustScore: 80,
        behaviorSegment: lead.source || 'Lead',
      });
    }

    return [...byKey.values()].sort((a, b) => b.active.localeCompare(a.active));
  },

  listSellerOffers: () =>
    [...state.sellerOffers].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  createSellerOffer: (
    payload: Omit<import('./operationsDb').OpsSellerOfferRow, 'id' | 'status' | 'createdAt' | 'updatedAt'>,
  ) => {
    const row: import('./operationsDb').OpsSellerOfferRow = {
      ...payload,
      id: `offer-${Date.now()}`,
      status: 'new',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.sellerOffers.unshift(row);
    touch();
    return row;
  },
  updateSellerOffer: (id: string, patch: Partial<import('./operationsDb').OpsSellerOfferRow>) => {
    const idx = state.sellerOffers.findIndex((row) => row.id === id);
    if (idx < 0) return null;
    state.sellerOffers[idx] = { ...state.sellerOffers[idx], ...patch, updatedAt: nowIso() };
    touch();
    return state.sellerOffers[idx];
  },

  getPermissions: () => {
    const current = structuredClone(state.permissions);
    return {
      ...structuredClone(DEFAULT_ROLE_PERMISSIONS),
      ...current,
      seller: mergeRolePermissions(DEFAULT_ROLE_PERMISSIONS.seller, current.seller),
      creator: mergeRolePermissions(DEFAULT_ROLE_PERMISSIONS.creator, current.creator),
    };
  },
  updatePermissions: (permissions: RolePermissionsMap) => {
    state.permissions = {
      ...structuredClone(DEFAULT_ROLE_PERMISSIONS),
      ...structuredClone(permissions),
      seller: mergeRolePermissions(DEFAULT_ROLE_PERMISSIONS.seller, permissions.seller),
      creator: mergeRolePermissions(DEFAULT_ROLE_PERMISSIONS.creator, permissions.creator),
    };
    touch();
    return state.permissions;
  },

  listFeeCharges: () => state.feeCharges.filter((fee) => !fee.deleted),
  getFeeCharge: (id: string) => state.feeCharges.find((fee) => fee.id === id) ?? null,
  upsertFeeCharge: (fee: OpsFeeCharge) => {
    const idx = state.feeCharges.findIndex((row) => row.id === fee.id);
    if (idx >= 0) {
      state.feeCharges[idx] = { ...state.feeCharges[idx], ...fee, updatedAt: nowIso() };
      touch();
      return state.feeCharges[idx];
    }
    state.feeCharges.push({ ...fee, createdAt: fee.createdAt || nowIso(), updatedAt: nowIso() });
    touch();
    return fee;
  },
  deleteFeeCharge: (id: string) => {
    const fee = state.feeCharges.find((row) => row.id === id);
    if (!fee) return false;
    fee.deleted = true;
    fee.active = false;
    fee.updatedAt = nowIso();
    touch();
    return true;
  },

  getPaymentOptionsConfig: () => ({ ...state.paymentOptionsConfig }),
  getAllSellerBookingSettings: () => ({ ...state.sellerBookingSettings }),
  updatePaymentOptionsConfig: (patch: Partial<OpsPaymentOptionsConfig>) => {
    state.paymentOptionsConfig = { ...state.paymentOptionsConfig, ...patch, updatedAt: nowIso() };
    touch();
    return state.paymentOptionsConfig;
  },

  /** Defaults to `autoApproveBookingsDefault: false` (require approval) for sellers who haven't set one. */
  getSellerBookingSettings: (sellerId: string): OpsSellerBookingSettings => {
    return (
      state.sellerBookingSettings[sellerId] || {
        sellerId,
        autoApproveBookingsDefault: false,
        updatedAt: nowIso(),
      }
    );
  },
  updateSellerBookingSettings: (sellerId: string, patch: Partial<OpsSellerBookingSettings>) => {
    const existing = state.sellerBookingSettings[sellerId] || {
      sellerId,
      autoApproveBookingsDefault: false,
      updatedAt: nowIso(),
    };
    const updated: OpsSellerBookingSettings = { ...existing, ...patch, sellerId, updatedAt: nowIso() };
    state.sellerBookingSettings[sellerId] = updated;
    touch();
    return updated;
  },

  listReturns: (filter?: { buyerId?: string; sellerId?: string; status?: string; orderId?: string }) => {
    let rows = [...state.returns].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filter?.buyerId) {
      rows = rows.filter((row) => row.buyerId === filter.buyerId);
    }
    if (filter?.sellerId) {
      rows = rows.filter((row) => row.sellerId === filter.sellerId);
    }
    if (filter?.orderId) {
      rows = rows.filter((row) => row.orderId === filter.orderId);
    }
    if (filter?.status) {
      rows = rows.filter((row) => row.status.toLowerCase() === filter.status!.toLowerCase());
    }
    return rows;
  },
  getReturn: (id: string) => state.returns.find((row) => row.id === id) ?? null,
  createReturn: (
    payload: Omit<OpsReturnRequest, 'id' | 'createdAt' | 'updatedAt' | 'notes'> & {
      id?: string;
      notes?: string[];
      createdAt?: string;
      updatedAt?: string;
    },
  ) => {
    const ts = nowIso();
    const row: OpsReturnRequest = {
      ...payload,
      id: payload.id || `RET-${Date.now()}`,
      notes: payload.notes ?? [],
      createdAt: payload.createdAt || ts,
      updatedAt: payload.updatedAt || ts,
    };
    state.returns.unshift(row);
    touch();
    return row;
  },
  updateReturn: (id: string, patch: Partial<OpsReturnRequest>) => {
    const idx = state.returns.findIndex((row) => row.id === id);
    if (idx < 0) return null;
    state.returns[idx] = { ...state.returns[idx], ...patch, updatedAt: nowIso() };
    touch();
    return state.returns[idx];
  },

  listWarrantyClaims: (filter?: { consumerId?: string; sellerId?: string; orderItemId?: string; status?: string }) => {
    let rows = [...state.warrantyClaims].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filter?.consumerId) rows = rows.filter((row) => row.consumerId === filter.consumerId);
    if (filter?.sellerId) rows = rows.filter((row) => row.sellerId === filter.sellerId);
    if (filter?.orderItemId) rows = rows.filter((row) => row.orderItemId === filter.orderItemId);
    if (filter?.status) rows = rows.filter((row) => row.status.toLowerCase() === filter.status!.toLowerCase());
    return rows;
  },
  getWarrantyClaim: (id: string) => state.warrantyClaims.find((row) => row.id === id) ?? null,
  /** Only one ACTIVE (open) claim may exist per order item at a time. */
  getActiveWarrantyClaimForItem: (orderItemId: string) =>
    state.warrantyClaims.find(
      (row) => row.orderItemId === orderItemId && OPEN_WARRANTY_CLAIM_STATUSES.has(row.status),
    ) ?? null,
  createWarrantyClaim: (
    payload: Omit<OpsWarrantyClaim, 'id' | 'createdAt' | 'updatedAt' | 'submittedAt'> & {
      id?: string;
      createdAt?: string;
      updatedAt?: string;
      submittedAt?: string;
    },
  ) => {
    const ts = nowIso();
    const row: OpsWarrantyClaim = {
      ...payload,
      id: payload.id || `WC-${Date.now()}`,
      submittedAt: payload.submittedAt || ts,
      createdAt: payload.createdAt || ts,
      updatedAt: payload.updatedAt || ts,
    };
    state.warrantyClaims.unshift(row);
    touch();
    return row;
  },
  updateWarrantyClaim: (id: string, patch: Partial<OpsWarrantyClaim>) => {
    const idx = state.warrantyClaims.findIndex((row) => row.id === id);
    if (idx < 0) return null;
    state.warrantyClaims[idx] = { ...state.warrantyClaims[idx], ...patch, updatedAt: nowIso() };
    touch();
    return state.warrantyClaims[idx];
  },

  listVerifications: (filter?: {
    submittedBy?: string;
    status?: string;
    entityType?: string;
    entityId?: string;
  }) => {
    let rows = [...state.verifications].sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (filter?.submittedBy) {
      rows = rows.filter((row) => row.submitted_by === filter.submittedBy);
    }
    if (filter?.status) {
      rows = rows.filter((row) => row.status.toLowerCase() === filter.status!.toLowerCase());
    }
    if (filter?.entityType) {
      rows = rows.filter((row) => row.entityType === filter.entityType);
    }
    if (filter?.entityId) {
      rows = rows.filter((row) => row.entityId === filter.entityId || row.brand_id === filter.entityId);
    }
    return rows;
  },
  getVerification: (id: string) => state.verifications.find((row) => row.id === id) ?? null,
  createVerification: (
    payload: Omit<OpsVerificationRequest, 'id' | 'created_at' | 'updated_at' | 'reviews' | 'audit_trail'> & {
      id?: string;
      reviews?: OpsVerificationReview[];
      audit_trail?: OpsVerificationRequest['audit_trail'];
      created_at?: string;
      updated_at?: string;
    },
  ) => {
    const ts = nowIso();
    const entityType = payload.entityType || 'brand';
    const entityId = payload.entityId || payload.brand_id;
    const entityName = payload.entityName || payload.brand_name;
    const row: OpsVerificationRequest = {
      ...payload,
      entityType,
      entityId,
      entityName,
      brand_id: payload.brand_id || entityId,
      brand_name: payload.brand_name || entityName,
      logo_url: payload.logo_url || '',
      id: payload.id || `vr_${Date.now()}`,
      reviews: payload.reviews ?? [],
      audit_trail: payload.audit_trail ?? [],
      created_at: payload.created_at || ts,
      updated_at: payload.updated_at || ts,
    };
    state.verifications.unshift(row);
    touch();
    return row;
  },
  updateVerification: (id: string, patch: Partial<OpsVerificationRequest>) => {
    const idx = state.verifications.findIndex((row) => row.id === id);
    if (idx < 0) return null;
    state.verifications[idx] = {
      ...state.verifications[idx],
      ...patch,
      updated_at: nowIso(),
    };
    touch();
    return state.verifications[idx];
  },
  updateVerificationDocument: (
    requestId: string,
    docId: string,
    patch: Partial<OpsVerificationDocument>,
  ) => {
    const idx = state.verifications.findIndex((row) => row.id === requestId);
    if (idx < 0) return null;
    const row = state.verifications[idx];
    const docIdx = row.documents.findIndex((d) => d.id === docId);
    if (docIdx < 0) return null;
    const documents = row.documents.map((d, i) => (i === docIdx ? { ...d, ...patch } : d));
    state.verifications[idx] = { ...row, documents, updated_at: nowIso() };
    touch();
    return state.verifications[idx];
  },
};
