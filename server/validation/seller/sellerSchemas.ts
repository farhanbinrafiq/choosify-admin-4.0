import { z } from 'zod';
import { SellerIdSchema } from '../shared/schemas';

export const SellerProfileParamsSchema = z.object({
  sellerId: SellerIdSchema,
});
