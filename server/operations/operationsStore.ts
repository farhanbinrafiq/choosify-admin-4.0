import type {
  OpsCoupon,
  OpsCouponUsage,
  OpsJobApplication,
  OpsJobPosting,
  OpsLead,
  OpsReview,
  OpsStorefrontOrder,
  RolePermissionsMap,
} from './types';

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

export const DEFAULT_ROLE_PERMISSIONS: RolePermissionsMap = {
  super_admin: { content: true, users: true, finance: true, brand: true, system: true, analytics: true },
  admin: { content: true, users: true, finance: false, brand: true, system: true, analytics: true },
  seller: { content: true, users: false, finance: false, brand: false, system: false, analytics: true },
  creator: { content: true, users: false, finance: false, brand: false, system: false, analytics: true },
  moderator: { content: true, users: false, finance: false, brand: true, system: false, analytics: true },
  finance_manager: { content: false, users: false, finance: true, brand: false, system: false, analytics: true },
  support_agent: { content: false, users: true, finance: false, brand: false, system: false, analytics: true },
  marketing_manager: { content: true, users: false, finance: false, brand: false, system: false, analytics: true },
};

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
  sellerOffers: import('./operationsFirestore').OpsSellerOfferRow[];
} = {
  orders: [],
  coupons: defaultCoupons(),
  couponUsage: [],
  reviews: [],
  leads: [],
  jobPostings: defaultJobPostings(),
  jobApplications: [],
  permissions: structuredClone(DEFAULT_ROLE_PERMISSIONS),
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
    if (snapshot.orders) state.orders = snapshot.orders;
    if (snapshot.coupons?.length) state.coupons = snapshot.coupons;
    if (snapshot.couponUsage) state.couponUsage = snapshot.couponUsage;
    if (snapshot.reviews) state.reviews = snapshot.reviews;
    if (snapshot.leads) state.leads = snapshot.leads;
    if (snapshot.jobPostings?.length) state.jobPostings = snapshot.jobPostings;
    if (snapshot.jobApplications) state.jobApplications = snapshot.jobApplications;
    if (snapshot.permissions) state.permissions = snapshot.permissions;
    if (snapshot.featureFlags) state.featureFlags = snapshot.featureFlags;
    if (snapshot.sellerOffers) state.sellerOffers = snapshot.sellerOffers;
  },

  listCouponUsage: () => [...state.couponUsage],
  listOrders: () => [...state.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  getOrder: (id: string) => state.orders.find((order) => order.id === id || order.orderId === id) ?? null,
  createOrder: (payload: Omit<OpsStorefrontOrder, 'id' | 'updatedAt'>) => {
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

  listReviews: (filters?: { productId?: string; status?: string }) => {
    let rows = [...state.reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filters?.productId) {
      rows = rows.filter((review) => review.productId === filters.productId);
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
    payload: Omit<import('./operationsFirestore').OpsSellerOfferRow, 'id' | 'status' | 'createdAt' | 'updatedAt'>,
  ) => {
    const row: import('./operationsFirestore').OpsSellerOfferRow = {
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
  updateSellerOffer: (id: string, patch: Partial<import('./operationsFirestore').OpsSellerOfferRow>) => {
    const idx = state.sellerOffers.findIndex((row) => row.id === id);
    if (idx < 0) return null;
    state.sellerOffers[idx] = { ...state.sellerOffers[idx], ...patch, updatedAt: nowIso() };
    touch();
    return state.sellerOffers[idx];
  },

  getPermissions: () => structuredClone(state.permissions),
  updatePermissions: (permissions: RolePermissionsMap) => {
    state.permissions = structuredClone(permissions);
    touch();
    return state.permissions;
  },
};
