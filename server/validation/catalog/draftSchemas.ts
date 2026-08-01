import { z } from 'zod';

export const DraftEntityTypeSchema = z.enum(['brand', 'product', 'creator', 'guide']);

export const EntityDraftParamsSchema = z.object({
  entityType: DraftEntityTypeSchema,
  id: z.string().trim().min(1, 'Identifier is required').max(128),
});

export const EntityDraftBodySchema = z.object({
  data: z.record(z.string(), z.unknown()),
});

export const EntityVersionBodySchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(200),
  snapshot: z.record(z.string(), z.unknown()),
});
