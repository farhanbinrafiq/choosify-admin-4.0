/**
 * Sprint 3 validation framework examples.
 * Reference-only patterns for future route migration.
 */

import { Router } from 'express';
import { validate } from '../../server/middleware/validate';
import { authenticateRequest } from '../../server/middleware/auth';
import { requireAdmin } from '../../server/middleware/requireAdmin';
import { created, notFound, success, validationError } from '../../server/lib/apiResponse';
import { API_ERROR_CODES } from '../../server/lib/apiErrorCodes';
import { ProductIdSchema } from '../../server/validation/shared/schemas';
import { z } from 'zod';
import { emailValidator, paginationValidator } from '../../server/validation/shared/validators';

const exampleRouter = Router();

const CreateWidgetBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  ownerEmail: emailValidator,
});

const WidgetParamsSchema = z.object({
  id: ProductIdSchema,
});

const WidgetListQuerySchema = paginationValidator;

exampleRouter.get(
  '/example/widgets',
  validate({ query: WidgetListQuerySchema }),
  (req, res) => {
  return success(res, { items: [], query: req.query });
  },
);

exampleRouter.post(
  '/example/widgets',
  authenticateRequest,
  requireAdmin,
  validate({ body: CreateWidgetBodySchema }),
  (req, res) => {
    return created(res, { id: 'widget_1', ...req.body });
  },
);

exampleRouter.get(
  '/example/widgets/:id',
  validate({ params: WidgetParamsSchema }),
  (req, res) => {
    const widget = null;
    if (!widget) {
      return notFound(res, 'Widget not found');
    }
    return success(res, widget);
  },
);

// Manual validation error usage (prefer validate middleware instead)
exampleRouter.post('/example/manual-validation', (req, res) => {
  if (!req.body?.name) {
    return validationError(
      res,
      'Invalid request body',
      [{ path: 'name', message: 'Name is required', code: 'too_small' }],
      API_ERROR_CODES.VALIDATION_ERROR,
    );
  }

  return success(res, { ok: true });
});

export { exampleRouter };
