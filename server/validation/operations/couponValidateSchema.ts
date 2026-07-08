import { z } from 'zod';
import { priceValidator } from '../shared/validators';

const cartItemSchema = z.object({
  id: z.string().trim().min(1),
  price: priceValidator,
  category: z.string().trim().optional(),
  brand: z.string().trim().optional(),
  quantity: z.coerce.number().int().positive().optional(),
});

export const CouponValidateBodySchema = z.object({
  code: z.string().trim().min(1, 'Promo code is required'),
  cartTotal: z.coerce.number().nonnegative().optional(),
  userId: z.string().trim().optional(),
  cartItems: z.array(cartItemSchema).optional(),
});
