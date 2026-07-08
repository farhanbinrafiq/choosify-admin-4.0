# API Validation Framework

Sprint 3 introduces a centralized validation framework for the Choosify admin backend. Existing APIs are unchanged unless explicitly migrated. The framework is designed for gradual adoption.

## Architecture

```
Request
  -> requestId middleware (Sprint 1)
  -> authentication middleware (optional, Sprint 2)
  -> validate({ body, params, query }) middleware (Sprint 3)
  -> route handler
  -> apiResponse helpers
```

Validation happens before business logic. Invalid requests are rejected with standardized `400` responses and machine-readable error codes.

## Flow

1. Route defines a Zod schema for `req.body`, `req.params`, and/or `req.query`.
2. `validate()` runs `safeParse()` for each configured section.
3. On success, parsed values replace the request section (coercion and trimming included).
4. On failure, the middleware returns:

```json
{
  "success": false,
  "error": "Invalid request body",
  "code": "VALIDATION_ERROR",
  "details": [
    { "path": "code", "message": "Promo code is required", "code": "too_small" }
  ],
  "requestId": "..."
}
```

5. Successful handlers continue to use their existing response shapes unless explicitly migrated to `apiResponse` helpers.

## Folder Structure

```
server/
  lib/
    apiErrorCodes.ts
    apiResponse.ts
  middleware/
    validate.ts
  validation/
    shared/
      validators.ts
      schemas.ts
      formatZodError.ts
    common/
      pagination.ts
      search.ts
    auth/
      devLoginSchema.ts
    catalog/
      productSchemas.ts
    seller/
      sellerSchemas.ts
    operations/
      couponValidateSchema.ts
    messaging/
      sendMessageSchema.ts
docs/
  API_VALIDATION.md
  examples/
    validation-route-examples.ts
```

## Shared Validators

Reusable Zod building blocks in `server/validation/shared/validators.ts`:

- `emailValidator`
- `passwordValidator`
- `phoneValidator`
- `slugValidator`
- `uuidValidator`
- `booleanValidator`
- `positiveIntegerValidator`
- `priceValidator`
- `dateValidator`
- `urlValidator`
- `paginationValidator`
- `searchValidator`
- `sortValidator`

## Shared Schema Examples

Defined in `server/validation/shared/schemas.ts`:

- `PaginationSchema`
- `SearchSchema`
- `SlugSchema`
- `ProductIdSchema`
- `SellerIdSchema`
- `BrandIdSchema`
- `CategoryIdSchema`
- `UserIdSchema`

## API Error Codes

Defined in `server/lib/apiErrorCodes.ts`:

- `VALIDATION_ERROR`
- `INVALID_EMAIL`
- `INVALID_PHONE`
- `INVALID_PRICE`
- `INVALID_SLUG`
- `INVALID_QUERY`
- `INVALID_PARAMETER`
- `RESOURCE_NOT_FOUND`
- `PERMISSION_DENIED`
- `TOKEN_EXPIRED`
- `AUTH_REQUIRED`
- `SERVER_ERROR`
- `CONFLICT`
- `BAD_REQUEST`

## Response Helpers

Enhanced helpers in `server/lib/apiResponse.ts`:

- `success()`
- `created()`
- `accepted()`
- `validationError()`
- `unauthorized()`
- `forbidden()`
- `notFound()`
- `conflict()`
- `serverError()`
- `badRequest()`

All helpers support `requestId` when Sprint 1 middleware is active.

## Middleware Usage

```ts
import { validate } from '../middleware/validate';
import { CouponValidateBodySchema } from '../validation/operations/couponValidateSchema';

router.post(
  '/operations/coupons/validate',
  validate({ body: CouponValidateBodySchema }),
  handler,
);
```

Validate multiple sections:

```ts
validate({
  params: CatalogProductParamsSchema,
  query: CatalogProductListQuerySchema,
  body: CreateProductBodySchema,
})
```

## Best Practices

1. Keep schemas close to their domain (`auth/`, `catalog/`, `operations/`).
2. Reuse shared validators instead of duplicating regex and coercion logic.
3. Validate at the route edge; keep business rules in services.
4. Prefer `validate()` middleware over inline `if (!body.foo)` checks.
5. Migrate one route group at a time.
6. Preserve successful response contracts during migration.
7. Use `apiResponse` helpers for new routes; adopt gradually on legacy routes.

## Migration Strategy

1. Add schema in the appropriate `server/validation/*` folder.
2. Attach `validate()` middleware to the route.
3. Remove duplicate manual checks in the handler.
4. Keep successful response JSON unchanged unless the route is being modernized intentionally.
5. Document the route in the validation report below.

## Representative Routes Migrated (Sprint 3)

| Domain | Route | Validation |
|--------|-------|------------|
| Auth | `POST /api/v1/auth/dev-login` | `DevLoginBodySchema` |
| Catalog | `GET /api/v1/catalog/products/:id` | `CatalogProductParamsSchema` |
| Operations | `POST /api/v1/operations/coupons/validate` | `CouponValidateBodySchema` |
| Messaging | `POST /api/messages/send` | `SendMessageBodySchema` |

Successful responses for these routes are unchanged. Validation failures now use the standardized error envelope.

## Validation Audit

### Routes already validating input

| Area | Pattern | Notes |
|------|---------|-------|
| Catalog writes | `normalize*Input()` in `server/catalogContract.ts` | Zod-backed normalization inside handlers |
| Auth | `GET /auth/me` token presence check | Manual auth validation |
| Operations | Multiple `if (!body.field)` guards | Manual inline validation |
| Messaging | Manual required-field checks | Pre-Sprint 3 |
| Meta webhooks | Signature verification | Integration-specific validation |

### Routes migrated in Sprint 3

- `POST /api/v1/auth/dev-login`
- `GET /api/v1/catalog/products/:id`
- `POST /api/v1/operations/coupons/validate`
- `POST /api/messages/send`

### Routes with duplicate validation logic

- Catalog POST/PUT/PATCH routes: handler normalization plus ad hoc query parsing in list routes
- Operations coupon/review/lead routes: repeated `if (!body.x)` patterns
- Messaging conversation patch routes: repeated required-field checks
- `catalogRouter.ts` `parseLimit` / `parseOffset` duplicated query coercion logic

### Routes missing validation

Most routes still rely on manual checks or no validation:

- Catalog mutation routes (`POST`, `PUT`, `PATCH`, `DELETE` under `/catalog/*`)
- Operations routes (orders, coupons CRUD, reviews, leads, permissions, analytics, shipments)
- Messaging routes (`/conversation/status`, `/conversation/assign-agent`)
- Logistics simulator route
- Deprecated `/api/products` routes
- `GET /api/admin/stats`

### Recommended migration order

1. **High-risk write routes** — catalog mutations, operations coupon/review writes
2. **Public-facing inputs** — order creation, review submission, lead capture
3. **Admin configuration routes** — permissions, feature flags, homepage writes
4. **Read routes with query params** — product lists, analytics filters
5. **Webhook/integration routes** — keep signature checks; add payload schemas where useful

### Estimated migration effort

| Phase | Scope | Effort |
|-------|-------|--------|
| Phase 1 | Operations write routes (~15 routes) | 1-2 days |
| Phase 2 | Catalog mutations (~20 routes) | 1-2 days |
| Phase 3 | Messaging routes (~6 routes) | 0.5-1 day |
| Phase 4 | Read/query routes (~15 routes) | 1 day |
| Phase 5 | Legacy/deprecated routes | 0.5 day |

Total estimated effort: **4-6 days** for full backend adoption.

## Performance Notes

The validation middleware adds negligible runtime overhead:

- Each migrated route performs one `safeParse()` per configured request section.
- Zod parsing is in-process and typically completes in sub-millisecond time for small payloads.
- No additional network or database calls are introduced.
- Overhead is only incurred on routes that opt into the middleware.

For representative routes, the added cost is not measurable in normal operation and is far cheaper than fixing bad data inside business logic.

## Developer Examples

See `docs/examples/validation-route-examples.ts` for:

- Creating schemas
- Applying middleware
- Handling validation errors
- Returning standardized responses

## Breaking Changes

**None for successful requests.**

Validation failures on the four migrated routes now return the standardized error envelope (`success`, `error`, `code`, `details`, `requestId`) instead of legacy `{ error: string }` responses. Clients sending valid payloads are unaffected.
