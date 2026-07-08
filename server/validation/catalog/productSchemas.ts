import { z } from 'zod';
import { ProductIdSchema } from '../shared/schemas';
import { paginationValidator, searchValidator } from '../shared/validators';

export const CatalogProductParamsSchema = z.object({
  id: ProductIdSchema,
});

export const CatalogProductListQuerySchema = paginationValidator
  .merge(searchValidator)
  .extend({
    categoryId: z.string().trim().max(128).optional(),
    brandId: z.string().trim().max(128).optional(),
    status: z.string().trim().max(64).optional(),
    modeType: z.string().trim().max(64).optional(),
  });
