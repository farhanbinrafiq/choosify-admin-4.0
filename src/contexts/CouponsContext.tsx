import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { operationsApi } from '../services/operationsApi';

export type CouponType = 'percentage' | 'fixed_amount' | 'free_shipping' | 'buy_x_get_y';
export type DiscountTarget = 'all_products' | 'specific_product' | 'specific_category' | 'specific_brand';

export interface CouponRule {
  minPurchaseAmount?: number;
  maxDiscountAmount?: number;
  maxUsages?: number;
  maxUsagesPerUser?: number;
  applicableCategories?: string[]; // category IDs or names
  applicableProducts?: string[]; // product IDs
  applicableBrands?: string[]; // brand IDs or names
  excludeCategories?: string[];
  excludeProducts?: string[];
  excludeBrands?: string[];
  allowStackWith?: string[]; // other coupon codes
  buyQuantity?: number; // for BOGO
  getQuantity?: number; // for BOGO
}

export interface Coupon {
  id: string;
  code: string; // e.g., "SUMMER2026", "WELCOME25"
  type: CouponType;
  discountTarget: DiscountTarget;
  
  // Discount details
  discountValue: number; // % or fixed amount
  discountAmount?: number; // for fixed_amount type
  
  // Validity
  validFrom: string; // YYYY-MM-DD
  validUntil: string; // YYYY-MM-DD
  active: boolean;
  deleted?: boolean; // soft delete support
  
  // Rules
  rules: CouponRule;
  
  // Usage tracking
  totalUsages: number;
  totalRedemptions: number; // successful uses
  totalDiscountGiven: number; // sum of all discounts
  
  // Metadata
  description: string;
  createdBy: string; // admin ID
  createdAt: string;
  updatedAt: string;
  
  // Analytics
  conversionRate?: number; // redemptions / views
  avgOrderValue?: number; // average order value when used
  usageByDate?: { date: string; count: number }[];
}

export interface CouponUsage {
  id: string;
  couponId: string;
  couponCode: string;
  orderId: string;
  userId: string;
  discountAmount: number;
  originalAmount: number;
  finalAmount: number;
  timestamp: string;
  status: 'applied' | 'redeemed' | 'failed'; // failed if rule check failed
}

interface CouponsContextType {
  coupons: Coupon[];
  couponUsage: CouponUsage[];
  validateCoupon: (
    code: string,
    cartTotal: number,
    userId?: string,
    cartItems?: { id: string; price: number; category?: string; brand?: string; quantity?: number }[]
  ) => { valid: boolean; discount: number; reason?: string };
  createCoupon: (coupon: Omit<Coupon, 'id' | 'totalUsages' | 'totalRedemptions' | 'totalDiscountGiven' | 'createdAt' | 'updatedAt'>) => void;
  updateCoupon: (id: string, updates: Partial<Coupon>) => void;
  deleteCoupon: (id: string) => void;
  deactivateCoupon: (id: string) => void;
  reactivateCoupon: (id: string) => void;
  generateBulkCoupons: (
    baseCode: string,
    quantity: number,
    type: CouponType,
    discountValue: number,
    rules?: CouponRule,
    validFrom?: string,
    validUntil?: string
  ) => string[];
  applyCoupon: (couponCode: string, orderId: string, cartTotal: number, userId?: string, discountAmount?: number) => void;
  getCouponStats: (couponId: string) => { usages: number; redemptions: number; conversionRate: number; totalDiscountGiven: number; avgOrderValue: number };
  getExpiringCoupons: (daysUntilExpiry: number) => Coupon[];
  exportCouponCodes: (couponId?: string) => void;
}

const CouponsContext = createContext<CouponsContextType | undefined>(undefined);

export const useCoupons = () => {
  const context = useContext(CouponsContext);
  if (!context) throw new Error('useCoupons must be used within a CouponsProvider');
  return context;
};

// Seed initial default coupons for immediate system usability
const seedCoupons: Coupon[] = [
  {
    id: 'coup_1',
    code: 'WELCOME250',
    type: 'fixed_amount',
    discountTarget: 'all_products',
    discountValue: 250,
    validFrom: '2026-01-01',
    validUntil: '2026-12-31',
    active: true,
    rules: {
      minPurchaseAmount: 1000,
      maxUsages: 100,
      maxUsagesPerUser: 1,
    },
    totalUsages: 14,
    totalRedemptions: 12,
    totalDiscountGiven: 3000,
    description: 'Welcome discount for new accounts with minimum spend',
    createdBy: 'usr_admin_001',
    createdAt: '2026-01-01T10:00:00Z',
    updatedAt: '2026-01-01T10:00:00Z',
    conversionRate: 0.12,
    avgOrderValue: 1850,
    usageByDate: [
      { date: '2026-06-25', count: 2 },
      { date: '2026-06-26', count: 3 },
      { date: '2026-06-27', count: 4 },
      { date: '2026-06-28', count: 3 }
    ]
  },
  {
    id: 'coup_2',
    code: 'SUMMER2026',
    type: 'percentage',
    discountTarget: 'all_products',
    discountValue: 15,
    validFrom: '2026-06-01',
    validUntil: '2026-08-31',
    active: true,
    rules: {
      minPurchaseAmount: 500,
      maxDiscountAmount: 600,
      maxUsages: 500,
    },
    totalUsages: 88,
    totalRedemptions: 82,
    totalDiscountGiven: 24600,
    description: 'Peak summer seasonal promotional campaign code',
    createdBy: 'usr_admin_001',
    createdAt: '2026-06-01T09:00:00Z',
    updatedAt: '2026-06-01T09:00:00Z',
    conversionRate: 0.18,
    avgOrderValue: 2000,
    usageByDate: [
      { date: '2026-06-25', count: 12 },
      { date: '2026-06-26', count: 15 },
      { date: '2026-06-27', count: 22 },
      { date: '2026-06-28', count: 18 }
    ]
  },
  {
    id: 'coup_3',
    code: 'FREESHIP',
    type: 'free_shipping',
    discountTarget: 'all_products',
    discountValue: 120,
    validFrom: '2026-05-01',
    validUntil: '2026-07-05', // Expiring soon!
    active: true,
    rules: {
      minPurchaseAmount: 400,
    },
    totalUsages: 145,
    totalRedemptions: 140,
    totalDiscountGiven: 16800,
    description: 'Free logistics shipping voucher code across Bangladesh subzones',
    createdBy: 'usr_admin_001',
    createdAt: '2026-05-01T08:00:00Z',
    updatedAt: '2026-05-01T08:00:00Z',
    conversionRate: 0.25,
    avgOrderValue: 1200,
    usageByDate: [
      { date: '2026-06-25', count: 20 },
      { date: '2026-06-26', count: 25 },
      { date: '2026-06-27', count: 32 },
      { date: '2026-06-28', count: 28 }
    ]
  },
  {
    id: 'coup_4',
    code: 'BOGO2026',
    type: 'buy_x_get_y',
    discountTarget: 'specific_category',
    discountValue: 1, // Get 1 free
    validFrom: '2026-06-15',
    validUntil: '2026-09-30',
    active: true,
    rules: {
      buyQuantity: 1,
      getQuantity: 1,
      applicableCategories: ['Fashion'],
    },
    totalUsages: 10,
    totalRedemptions: 8,
    totalDiscountGiven: 3200,
    description: 'Buy 1 Get 1 free for specific fashion items list',
    createdBy: 'usr_admin_001',
    createdAt: '2026-06-15T12:00:00Z',
    updatedAt: '2026-06-15T12:00:00Z',
    conversionRate: 0.05,
    avgOrderValue: 4200,
    usageByDate: [
      { date: '2026-06-25', count: 1 },
      { date: '2026-06-26', count: 2 },
      { date: '2026-06-27', count: 3 },
      { date: '2026-06-28', count: 2 }
    ]
  }
];

const seedUsage: CouponUsage[] = [
  {
    id: 'usg_1',
    couponId: 'coup_1',
    couponCode: 'WELCOME250',
    orderId: 'CSS-9921',
    userId: 'cust_001',
    discountAmount: 250,
    originalAmount: 4200,
    finalAmount: 3950,
    timestamp: '2026-06-25T11:30:00Z',
    status: 'redeemed'
  },
  {
    id: 'usg_2',
    couponId: 'coup_2',
    couponCode: 'SUMMER2026',
    orderId: 'CSS-8812',
    userId: 'cust_002',
    discountAmount: 525,
    originalAmount: 3500,
    finalAmount: 2975,
    timestamp: '2026-06-27T14:45:00Z',
    status: 'redeemed'
  }
];

export const CouponsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [coupons, setCoupons] = useState<Coupon[]>(() => {
    const saved = localStorage.getItem('choosify_coupons');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading coupons from localStorage:', e);
      }
    }
    return seedCoupons;
  });

  const [couponUsage, setCouponUsage] = useState<CouponUsage[]>(() => {
    const saved = localStorage.getItem('choosify_coupon_usage');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading usage from localStorage:', e);
      }
    }
    return seedUsage;
  });

  useEffect(() => {
    localStorage.setItem('choosify_coupons', JSON.stringify(coupons));
  }, [coupons]);

  useEffect(() => {
    localStorage.setItem('choosify_coupon_usage', JSON.stringify(couponUsage));
  }, [couponUsage]);

  useEffect(() => {
    operationsApi
      .listCoupons()
      .then((apiCoupons) => {
        if (!apiCoupons.length) return;
        setCoupons((prev) => {
          const merged = [...prev];
          apiCoupons.forEach((apiCoupon) => {
            const idx = merged.findIndex(
              (coupon) => coupon.code.toUpperCase() === apiCoupon.code.toUpperCase(),
            );
            const mapped: Coupon = {
              ...(merged[idx] || {}),
              id: apiCoupon.id,
              code: apiCoupon.code,
              type: apiCoupon.type as CouponType,
              discountTarget: apiCoupon.discountTarget as DiscountTarget,
              discountValue: apiCoupon.discountValue,
              validFrom: apiCoupon.validFrom,
              validUntil: apiCoupon.validUntil,
              active: apiCoupon.active,
              rules: apiCoupon.rules as CouponRule,
              description: apiCoupon.description,
              totalUsages: apiCoupon.totalUsages,
              totalRedemptions: apiCoupon.totalRedemptions,
              totalDiscountGiven: apiCoupon.totalDiscountGiven,
              createdBy: merged[idx]?.createdBy || 'operations-api',
              createdAt: apiCoupon.createdAt,
              updatedAt: apiCoupon.updatedAt,
            };
            if (idx >= 0) merged[idx] = mapped;
            else merged.push(mapped);
          });
          return merged;
        });
      })
      .catch(() => {});
  }, []);

  // Helper date function
  const parseLocalDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  };

  const validateCoupon = (
    code: string,
    cartTotal: number,
    userId: string = 'cust_001',
    cartItems?: { id: string; price: number; category?: string; brand?: string; quantity?: number }[]
  ): { valid: boolean; discount: number; reason?: string } => {
    const upperCode = code.toUpperCase().trim();
    
    // Code validation
    if (upperCode.length < 3 || upperCode.length > 20 || !/^[A-Z0-9\-_]+$/.test(upperCode)) {
      return { valid: false, discount: 0, reason: 'Invalid coupon format. Must be alphanumeric (3-20 uppercase chars).' };
    }

    const coupon = coupons.find(c => c.code.toUpperCase() === upperCode && !c.deleted);
    if (!coupon) {
      return { valid: false, discount: 0, reason: 'Voucher code does not exist.' };
    }

    if (!coupon.active) {
      return { valid: false, discount: 0, reason: 'This promotion code is currently disabled.' };
    }

    // Date check
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const fromDate = parseLocalDate(coupon.validFrom);
    const untilDate = parseLocalDate(coupon.validUntil);
    untilDate.setHours(23, 59, 59, 999);

    if (today < fromDate) {
      return { valid: false, discount: 0, reason: `This promo is only valid starting ${coupon.validFrom}.` };
    }

    if (today > untilDate) {
      return { valid: false, discount: 0, reason: 'Voucher code has expired.' };
    }

    // Rules validation
    const { rules } = coupon;

    if (rules.minPurchaseAmount && cartTotal < rules.minPurchaseAmount) {
      return { valid: false, discount: 0, reason: `Minimum order total of ৳${rules.minPurchaseAmount} is required.` };
    }

    if (rules.maxUsages && coupon.totalUsages >= rules.maxUsages) {
      return { valid: false, discount: 0, reason: 'Voucher limit has been completely reached.' };
    }

    if (rules.maxUsagesPerUser) {
      const userCount = couponUsage.filter(
        u => u.couponId === coupon.id && u.userId === userId && u.status === 'redeemed'
      ).length;
      if (userCount >= rules.maxUsagesPerUser) {
        return { valid: false, discount: 0, reason: 'You have already redeemed this promo maximum times.' };
      }
    }

    // Target Filtering
    let targetSubtotal = cartTotal;
    if (cartItems && cartItems.length > 0) {
      let applicableItems = [...cartItems];

      // Exclude logic
      if (rules.excludeProducts && rules.excludeProducts.length > 0) {
        applicableItems = applicableItems.filter(item => !rules.excludeProducts?.includes(item.id));
      }
      if (rules.excludeCategories && rules.excludeCategories.length > 0) {
        applicableItems = applicableItems.filter(item => !item.category || !rules.excludeCategories?.includes(item.category));
      }
      if (rules.excludeBrands && rules.excludeBrands.length > 0) {
        applicableItems = applicableItems.filter(item => !item.brand || !rules.excludeBrands?.includes(item.brand));
      }

      // Applicable logic
      if (coupon.discountTarget === 'specific_product' && rules.applicableProducts && rules.applicableProducts.length > 0) {
        applicableItems = applicableItems.filter(item => rules.applicableProducts?.includes(item.id));
      } else if (coupon.discountTarget === 'specific_category' && rules.applicableCategories && rules.applicableCategories.length > 0) {
        applicableItems = applicableItems.filter(item => item.category && rules.applicableCategories?.some(cat => cat.toLowerCase() === item.category?.toLowerCase()));
      } else if (coupon.discountTarget === 'specific_brand' && rules.applicableBrands && rules.applicableBrands.length > 0) {
        applicableItems = applicableItems.filter(item => item.brand && rules.applicableBrands?.some(br => br.toLowerCase() === item.brand?.toLowerCase()));
      }

      if (applicableItems.length === 0) {
        return { valid: false, discount: 0, reason: 'This coupon is not applicable to any products in your cart.' };
      }

      targetSubtotal = applicableItems.reduce((acc, item) => acc + (item.price * (item.quantity || 1)), 0);
    }

    // Calculate discount amount
    let discount = 0;
    if (coupon.type === 'percentage') {
      discount = Math.round(targetSubtotal * (coupon.discountValue / 100));
      if (rules.maxDiscountAmount && discount > rules.maxDiscountAmount) {
        discount = rules.maxDiscountAmount;
      }
    } else if (coupon.type === 'fixed_amount') {
      discount = coupon.discountValue;
    } else if (coupon.type === 'free_shipping') {
      discount = 120; // Default flat delivery charge
    } else if (coupon.type === 'buy_x_get_y') {
      const buyQ = rules.buyQuantity || 1;
      const getQ = rules.getQuantity || 1;
      if (cartItems && cartItems.length > 0) {
        const sorted = [...cartItems].sort((a, b) => a.price - b.price);
        const totalQty = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
        if (totalQty >= (buyQ + getQ)) {
          discount = sorted[0].price * getQ;
        } else {
          return { valid: false, discount: 0, reason: `Buy ${buyQ} Get ${getQ} promo requires at least ${buyQ + getQ} items.` };
        }
      } else {
        discount = 0;
      }
    }

    // Cannot exceed total
    if (discount > cartTotal) {
      discount = cartTotal;
    }

    return { valid: true, discount, reason: undefined };
  };

  const createCoupon = (newCouponData: Omit<Coupon, 'id' | 'totalUsages' | 'totalRedemptions' | 'totalDiscountGiven' | 'createdAt' | 'updatedAt'>) => {
    // Check code uniqueness
    const codeUpper = newCouponData.code.toUpperCase().trim();
    if (coupons.some(c => c.code.toUpperCase() === codeUpper && !c.deleted)) {
      toast.error(`A coupon with code '${codeUpper}' already exists.`);
      throw new Error('Code duplicate error');
    }

    const newCoupon: Coupon = {
      ...newCouponData,
      id: 'coup_' + Math.floor(100000 + Math.random() * 900000),
      code: codeUpper,
      totalUsages: 0,
      totalRedemptions: 0,
      totalDiscountGiven: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      conversionRate: 0,
      avgOrderValue: 0,
      usageByDate: []
    };

    setCoupons(prev => [newCoupon, ...prev]);
    operationsApi.upsertCoupon(newCoupon).catch(() => {});
    toast.success(`Coupon code ${codeUpper} created successfully!`);
  };

  const updateCoupon = (id: string, updates: Partial<Coupon>) => {
    setCoupons(prev => prev.map(c => {
      if (c.id === id) {
        if (updates.code) {
          updates.code = updates.code.toUpperCase().trim();
        }
        const next = {
          ...c,
          ...updates,
          updatedAt: new Date().toISOString()
        };
        operationsApi.upsertCoupon(next).catch(() => {});
        return next;
      }
      return c;
    }));
    toast.success('Coupon parameters updated.');
  };

  const deleteCoupon = (id: string) => {
    // Soft delete so we retain history
    const target = coupons.find(c => c.id === id);
    if (!target) return;

    setCoupons(prev => prev.map(c => {
      if (c.id === id) {
        return { ...c, deleted: true, active: false };
      }
      return c;
    }));
    operationsApi.deleteCoupon(id).catch(() => {});

    toast.success(
      <div className="flex items-center gap-2">
        <span>Coupon {target.code} archived.</span>
        <button
          onClick={() => {
            setCoupons(prev => prev.map(c => c.id === id ? { ...c, deleted: false, active: true } : c));
            toast.success(`Restored coupon ${target.code}.`);
          }}
          className="underline text-xs text-amber-500 font-bold ml-2 cursor-pointer"
        >
          UNDO
        </button>
      </div>,
      { duration: 6000 }
    );
  };

  const deactivateCoupon = (id: string) => {
    setCoupons(prev => prev.map(c => c.id === id ? { ...c, active: false } : c));
    toast.success('Coupon paused & deactivated.');
  };

  const reactivateCoupon = (id: string) => {
    setCoupons(prev => prev.map(c => c.id === id ? { ...c, active: true } : c));
    toast.success('Coupon is now active.');
  };

  const generateBulkCoupons = (
    baseCode: string,
    quantity: number,
    type: CouponType,
    discountValue: number,
    rules: CouponRule = {},
    validFrom: string = new Date().toISOString().split('T')[0],
    validUntil: string = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  ): string[] => {
    const codes: string[] = [];
    const newCoupons: Coupon[] = [];

    for (let i = 0; i < quantity; i++) {
      const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const code = `${baseCode.toUpperCase().trim()}-${suffix}`;
      codes.push(code);

      const newC: Coupon = {
        id: 'coup_' + Math.floor(100000 + Math.random() * 900000),
        code,
        type,
        discountTarget: 'all_products',
        discountValue,
        validFrom,
        validUntil,
        active: true,
        rules,
        totalUsages: 0,
        totalRedemptions: 0,
        totalDiscountGiven: 0,
        description: `Bulk generated code matching base ${baseCode}`,
        createdBy: 'usr_admin_001',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        conversionRate: 0,
        avgOrderValue: 0,
        usageByDate: []
      };
      newCoupons.push(newC);
    }

    setCoupons(prev => [...prev, ...newCoupons]);
    toast.success(`Successfully generated ${quantity} bulk coupon codes!`);
    return codes;
  };

  const applyCoupon = (
    couponCode: string, 
    orderId: string, 
    cartTotal: number, 
    userId: string = 'cust_001',
    customDiscountAmount?: number
  ) => {
    const upper = couponCode.toUpperCase().trim();
    const coupon = coupons.find(c => c.code.toUpperCase() === upper && !c.deleted);
    if (!coupon) return;

    // Determine the discount value applied
    let appliedDiscount = 120; // fallback default
    if (customDiscountAmount !== undefined) {
      appliedDiscount = customDiscountAmount;
    } else {
      const result = validateCoupon(coupon.code, cartTotal, userId);
      appliedDiscount = result.discount;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Log the usage
    const newUsage: CouponUsage = {
      id: 'usg_' + Math.floor(100000 + Math.random() * 900000),
      couponId: coupon.id,
      couponCode: coupon.code,
      orderId,
      userId,
      discountAmount: appliedDiscount,
      originalAmount: cartTotal,
      finalAmount: cartTotal - appliedDiscount,
      timestamp: new Date().toISOString(),
      status: 'redeemed'
    };

    setCouponUsage(prev => [newUsage, ...prev]);

    // Update the coupon metrics
    setCoupons(prev => prev.map(c => {
      if (c.id === coupon.id) {
        // update chart usage list
        const usageByDate = c.usageByDate ? [...c.usageByDate] : [];
        const dateIdx = usageByDate.findIndex(u => u.date === todayStr);
        if (dateIdx !== -1) {
          usageByDate[dateIdx].count += 1;
        } else {
          usageByDate.push({ date: todayStr, count: 1 });
        }

        const newUsages = c.totalUsages + 1;
        const newRedemptions = c.totalRedemptions + 1;
        const newDiscountGiven = c.totalDiscountGiven + appliedDiscount;
        const currentTotalRevenue = (c.avgOrderValue || 0) * c.totalRedemptions;
        const newTotalRevenue = currentTotalRevenue + cartTotal;
        const newAvgOrder = Math.round(newTotalRevenue / newRedemptions);

        return {
          ...c,
          totalUsages: newUsages,
          totalRedemptions: newRedemptions,
          totalDiscountGiven: newDiscountGiven,
          avgOrderValue: newAvgOrder,
          usageByDate
        };
      }
      return c;
    }));
  };

  const getCouponStats = (couponId: string) => {
    const coupon = coupons.find(c => c.id === couponId);
    if (!coupon) return { usages: 0, redemptions: 0, conversionRate: 0, totalDiscountGiven: 0, avgOrderValue: 0 };
    return {
      usages: coupon.totalUsages,
      redemptions: coupon.totalRedemptions,
      conversionRate: coupon.conversionRate || 0,
      totalDiscountGiven: coupon.totalDiscountGiven,
      avgOrderValue: coupon.avgOrderValue || 0
    };
  };

  const getExpiringCoupons = (daysUntilExpiry: number) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limitDate = new Date();
    limitDate.setDate(today.getDate() + daysUntilExpiry);
    limitDate.setHours(23, 59, 59, 999);

    return coupons.filter(c => {
      if (c.deleted || !c.active) return false;
      const untilDate = parseLocalDate(c.validUntil);
      return untilDate >= today && untilDate <= limitDate;
    });
  };

  const exportCouponCodes = (couponId?: string) => {
    let list = coupons.filter(c => !c.deleted);
    if (couponId) {
      list = list.filter(c => c.id === couponId);
    }

    const headers = 'ID,Code,Type,Discount Value,Target,Valid From,Valid Until,Status,Total Usages,Total Redemptions,Total Discount Given (BDT),Description\n';
    const rows = list.map(c => {
      return `"${c.id}","${c.code}","${c.type}",${c.discountValue},"${c.discountTarget}","${c.validFrom}","${c.validUntil}","${c.active ? 'active' : 'paused'}",${c.totalUsages},${c.totalRedemptions},${c.totalDiscountGiven},"${c.description.replace(/"/g, '""')}"`;
    }).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Choosify_Coupons_Registry_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Vouchers list downloaded as CSV.');
  };

  return (
    <CouponsContext.Provider value={{
      coupons,
      couponUsage,
      validateCoupon,
      createCoupon,
      updateCoupon,
      deleteCoupon,
      deactivateCoupon,
      reactivateCoupon,
      generateBulkCoupons,
      applyCoupon,
      getCouponStats,
      getExpiringCoupons,
      exportCouponCodes
    }}>
      {children}
    </CouponsContext.Provider>
  );
};
