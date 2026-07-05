import type { OpsCoupon, OpsCouponRule } from './types';

export interface CouponCartItem {
  id: string;
  price: number;
  category?: string;
  brand?: string;
  quantity?: number;
}

export interface CouponValidationResult {
  valid: boolean;
  discount: number;
  type?: OpsCoupon['type'];
  code?: string;
  reason?: string;
}

const today = () => new Date().toISOString().slice(0, 10);

export function validateCoupon(
  coupon: OpsCoupon,
  cartTotal: number,
  userId?: string,
  cartItems?: CouponCartItem[],
  userUsageCount = 0,
): CouponValidationResult {
  const code = coupon.code.toUpperCase();

  if (coupon.deleted) {
    return { valid: false, discount: 0, reason: 'This promo code is no longer available.' };
  }
  if (!coupon.active) {
    return { valid: false, discount: 0, reason: 'This promo code is currently inactive.' };
  }

  const now = today();
  if (now < coupon.validFrom) {
    return { valid: false, discount: 0, reason: 'This promo code is not active yet.' };
  }
  if (now > coupon.validUntil) {
    return { valid: false, discount: 0, reason: 'This promo code has expired.' };
  }

  const rules: OpsCouponRule = coupon.rules ?? {};

  if (rules.minPurchaseAmount && cartTotal < rules.minPurchaseAmount) {
    return {
      valid: false,
      discount: 0,
      reason: `Minimum purchase of ৳${rules.minPurchaseAmount.toLocaleString()} required.`,
    };
  }

  if (rules.maxUsages && coupon.totalRedemptions >= rules.maxUsages) {
    return { valid: false, discount: 0, reason: 'This promo code has reached its usage limit.' };
  }

  if (rules.maxUsagesPerUser && userId && userUsageCount >= rules.maxUsagesPerUser) {
    return { valid: false, discount: 0, reason: 'You have already redeemed this promo maximum times.' };
  }

  let targetSubtotal = cartTotal;
  if (cartItems && cartItems.length > 0) {
    let applicableItems = [...cartItems];

    if (rules.excludeProducts?.length) {
      applicableItems = applicableItems.filter((item) => !rules.excludeProducts?.includes(item.id));
    }
    if (rules.excludeCategories?.length) {
      applicableItems = applicableItems.filter(
        (item) => !item.category || !rules.excludeCategories?.includes(item.category),
      );
    }
    if (rules.excludeBrands?.length) {
      applicableItems = applicableItems.filter(
        (item) => !item.brand || !rules.excludeBrands?.includes(item.brand),
      );
    }

    if (coupon.discountTarget === 'specific_product' && rules.applicableProducts?.length) {
      applicableItems = applicableItems.filter((item) => rules.applicableProducts?.includes(item.id));
    } else if (coupon.discountTarget === 'specific_category' && rules.applicableCategories?.length) {
      applicableItems = applicableItems.filter(
        (item) =>
          item.category &&
          rules.applicableCategories?.some((cat) => cat.toLowerCase() === item.category?.toLowerCase()),
      );
    } else if (coupon.discountTarget === 'specific_brand' && rules.applicableBrands?.length) {
      applicableItems = applicableItems.filter(
        (item) =>
          item.brand && rules.applicableBrands?.some((brand) => brand.toLowerCase() === item.brand?.toLowerCase()),
      );
    }

    if (applicableItems.length === 0) {
      return { valid: false, discount: 0, reason: 'This coupon is not applicable to any products in your cart.' };
    }

    targetSubtotal = applicableItems.reduce((acc, item) => acc + item.price * (item.quantity || 1), 0);
  }

  let discount = 0;
  if (coupon.type === 'percentage') {
    discount = Math.round(targetSubtotal * (coupon.discountValue / 100));
    if (rules.maxDiscountAmount && discount > rules.maxDiscountAmount) {
      discount = rules.maxDiscountAmount;
    }
  } else if (coupon.type === 'fixed_amount') {
    discount = coupon.discountValue;
  } else if (coupon.type === 'free_shipping') {
    discount = 120;
  } else if (coupon.type === 'buy_x_get_y') {
    const buyQ = rules.buyQuantity || 1;
    const getQ = rules.getQuantity || 1;
    if (cartItems && cartItems.length > 0) {
      const sorted = [...cartItems].sort((a, b) => a.price - b.price);
      const totalQty = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
      if (totalQty >= buyQ + getQ) {
        discount = sorted[0].price * getQ;
      } else {
        return {
          valid: false,
          discount: 0,
          reason: `Buy ${buyQ} Get ${getQ} promo requires at least ${buyQ + getQ} items.`,
        };
      }
    }
  }

  if (discount > cartTotal) {
    discount = cartTotal;
  }

  return { valid: true, discount, type: coupon.type, code };
}
