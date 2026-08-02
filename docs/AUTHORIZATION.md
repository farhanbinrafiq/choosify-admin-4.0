# Authentication & Authorization Framework

This document describes the current Choosify admin authentication flow and the reusable backend authorization framework introduced for future APIs.

## Authentication Flow

The current login flow is unchanged.

1. The admin frontend signs users in with Firebase Authentication.
2. The frontend calls `firebaseUser.getIdToken()` and stores the Firebase ID token in local storage as `choosify_auth_token`.
3. The frontend calls `GET /api/v1/auth/me` with `Authorization: Bearer <token>`.
4. The backend verifies the Firebase ID token with Firebase Admin when service account credentials are configured.
5. After token verification, the backend resolves the platform profile from the existing `admin_users` lookup by Firebase UID or email.
6. If no stored admin profile exists, the existing development email-to-role fallback map is still supported.
7. The response shape from `GET /api/v1/auth/me` remains unchanged: `uid`, `email`, `displayName`, and `role`.

Authorization begins after step 4, when Firebase has verified the token and the backend has a trusted Firebase UID. The new `authenticateRequest` middleware centralizes that boundary for future protected APIs.

## Authorization Flow

Future protected routes should compose middleware in this order:

```ts
import { authenticateRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';

router.post('/admin/example', authenticateRequest, requireAdmin, handler);
```

The authentication middleware:

- Reads `Authorization: Bearer <token>`.
- Verifies the token with Firebase Admin.
- Rejects missing, invalid, and expired tokens.
- Resolves the Choosify role without changing the existing login flow.
- Attaches `req.user`, `req.userId`, `req.userRole`, and `req.permissions`.

The authorization middleware:

- Requires `authenticateRequest` to run first.
- Checks reusable role or permission helpers.
- Returns standardized `401` or `403` JSON errors.
- Includes `requestId` when Sprint 1 request IDs are present.

## Role Definitions

Core roles:

- `USER`
- `SELLER`
- `VERIFIED_SELLER`
- `MODERATOR`
- `ADMIN`
- `SUPER_ADMIN`

Compatibility roles retained for existing admin behavior:

- `CREATOR`
- `FINANCE_MANAGER`
- `SUPPORT_AGENT`
- `MARKETING_MANAGER`

Role constants live in `server/permissions/roles.ts`. Use `ROLES.ADMIN` instead of magic strings such as `"admin"`.

## Role Hierarchy

- `SUPER_ADMIN` inherits all roles.
- `ADMIN` inherits `MODERATOR` and `USER`.
- `MODERATOR` inherits `USER`.
- `VERIFIED_SELLER` inherits `SELLER` and `USER`.
- `SELLER`, `CREATOR`, and operations roles inherit `USER`.

Use `hasRole(userRole, requiredRole)` for hierarchy-aware checks.

## Permission Definitions

Permission constants live in `server/permissions/permissions.ts`.

Current definitions:

- `PRODUCT_READ`
- `PRODUCT_CREATE`
- `PRODUCT_EDIT`
- `PRODUCT_DELETE`
- `SELLER_APPROVE`
- `SELLER_SUSPEND`
- `USER_MANAGE`
- `CMS_EDIT`
- `ANALYTICS_VIEW`
- `ROLE_MANAGE`

These definitions back role→permission maps and are enforced on catalog write
routes (and selected operations routes) via `requireAnyPermission` / role
middleware. Remaining APIs may still use custom in-handler checks.

## Permission Helpers

Reusable helpers live in `server/permissions/authorization.ts`.

```ts
hasRole(userRole, ROLES.ADMIN);
hasPermission(userRole, PERMISSIONS.CMS_EDIT);
hasAnyPermission(userRole, [PERMISSIONS.PRODUCT_EDIT, PERMISSIONS.CMS_EDIT]);
hasAllPermissions(userRole, [PERMISSIONS.PRODUCT_READ, PERMISSIONS.PRODUCT_EDIT]);
```

## Middleware

Available middleware:

- `authenticateRequest`
- `requireAdmin`
- `requireSeller`
- `requireModerator`
- `requireSuperAdmin`
- `requireVerifiedSeller`
- `requireRole`
- `requireAnyPermission`
- `requireAllPermissions`

Example:

```ts
import { authenticateRequest } from '../middleware/auth';
import { requireAnyPermission } from '../middleware/authorization';
import { PERMISSIONS } from '../permissions/permissions';

router.patch(
  '/catalog/products/:id',
  authenticateRequest,
  requireAnyPermission([PERMISSIONS.PRODUCT_EDIT]),
  handler,
);
```

## Auth Error Responses

New auth middleware returns consistent JSON responses:

```json
{
  "success": false,
  "error": "Missing bearer token",
  "code": "AUTH_MISSING_TOKEN",
  "requestId": "..."
}
```

Status codes:

- `401` for missing token, invalid token, expired token, and unauthenticated access.
- `403` for authenticated users who do not have the required role or permission.

## Route Audit Summary

Catalog and operations write routes were audited against live handlers in
`server/catalogRouter.ts` and `server/operationsRouter.ts`. Middleware confirms
role/permission; seller-scoped resources also enforce ownership in the handler
(`req.userId` must own the row). Public routes below are intentionally
unauthenticated or auth-only customer flows.

### Catalog (`/api/v1/catalog/*`)

Mounted under the v1 API prefix. Public **GET** list/detail routes are unchanged
(no auth). Writes:

| Route | Classification | Protection |
| --- | --- | --- |
| `PUT /catalog/home` | Admin / CMS | `authenticateRequest` + `requireAnyPermission([CMS_EDIT])` |
| `POST/PUT/PATCH/DELETE /catalog/products` | Seller-scoped (+ admin) | Product create/edit/delete permissions; sellers stamped with `sellerId = req.userId` on create; mutate/delete only when `product.sellerId === req.userId` (legacy rows without `sellerId` are admin-only) |
| `PUT/PATCH /catalog/product-details/:productId` | Seller-scoped (+ admin) | `PRODUCT_EDIT` + ownership of parent product |
| `POST/PUT/PATCH/DELETE /catalog/categories` | CMS | `CMS_EDIT` |
| `POST/PUT/PATCH/DELETE /catalog/brands` | CMS | `CMS_EDIT` |
| `POST/PUT/PATCH/DELETE /catalog/deals` | CMS (platform) | `CMS_EDIT` |
| `POST/PUT/PATCH/DELETE /catalog/deals-banners` | CMS | `CMS_EDIT` |
| `PUT /catalog/site` | CMS | `CMS_EDIT` |
| `PUT/PATCH /catalog/creators/:id` | CMS | `CMS_EDIT` |
| `PUT/PATCH /catalog/guides/:id` | CMS | `CMS_EDIT` |
| `PUT/PATCH /catalog/placements/:id` | CMS | `CMS_EDIT` |
| `POST/PUT/PATCH/DELETE /catalog/brand-posts` | CMS | `CMS_EDIT` |
| `POST /catalog/media/upload` | Staff / seller media | `PRODUCT_CREATE` \| `PRODUCT_EDIT` \| `CMS_EDIT` |
| `PUT …/draft`, `POST …/versions` | Mixed | `PRODUCT_EDIT` \| `CMS_EDIT`; product drafts require ownership (or admin); brand/creator/guide drafts require `CMS_EDIT` |
| `GET …/draft`, `GET …/versions` | Auth | `authenticateRequest` only (read staging data) |

### Operations (`/api/v1/operations/*`)

| Route | Classification | Protection |
| --- | --- | --- |
| `POST /operations/orders` | Customer (+ staff manual) | Auth; buyer bound to `req.userId` (manual orders: staff only, `buyerId=unclaimed`) |
| `POST /operations/orders/claim/:token/confirm` | Customer | Auth + claim-token ownership |
| `PATCH /operations/orders/:id` | Buyer / seller / staff | Auth + `userCanMutateOrder` (buyer, order seller, or staff) |
| `POST /operations/orders/:id/cancel` | Buyer / seller / staff | Auth + cancel eligibility helpers |
| `POST /operations/returns` | Customer | Auth; `buyerId` must equal `req.userId` |
| `PATCH/POST …/returns/:id/*` | Seller-scoped / staff | Auth + return seller/admin helpers (`userCanManageReturnAsSellerOrAdmin` / note helper) |
| `POST/PATCH/DELETE /operations/coupons` | Admin / seller / marketing | Auth + `userCanManageCoupons` (platform-wide coupons, not seller-owned rows) |
| `POST /operations/coupons/validate` | Public | No auth (checkout) |
| `POST/PATCH/DELETE /operations/fee-charges` | Admin | `requireAdmin` |
| `PUT /operations/payment-options` | Admin | `requireAdmin` |
| `POST /operations/reviews` | Customer | Auth; purchase check; `userId` from token |
| `PATCH/DELETE /operations/reviews/:id` | Author / moderator / staff | Auth + `userCanModerateOrEditReview` |
| `POST /operations/leads` | Public | Rate-limited; no auth |
| `PATCH /operations/leads/:id` | Admin | `requireAdmin` |
| `POST/PATCH/DELETE /operations/jobs` | Admin | `requireAdmin` |
| `POST /operations/job-applications` | Customer | Auth |
| `PATCH /operations/job-applications/:id` | Admin | `requireAdmin` |
| `POST /operations/media/upload-resume` | Customer | Auth |
| `PUT /operations/permissions` | Admin | `requireAdmin` |
| `PATCH /operations/shipments/:id` | Seller / staff | Auth + `userCanUpdateShipment` |
| `POST /operations/platform-messages` | Customer (+ staff) | Auth; non-staff `buyerId` forced to `req.userId` |
| `PUT /operations/feature-flags` | Admin | `requireAdmin` |
| `POST /operations/seller-offers` | Public | Rate-limited intake; no auth |
| `PATCH /operations/seller-offers/:id` | Admin | `requireAdmin` |
| `POST /operations/media/upload-verification` | Applicant | Auth |
| `POST /operations/verifications` | Applicant | Auth; submitter bound to token |
| `PATCH /operations/verifications/:id/submit` | Applicant | Auth + ownership of request |
| `PATCH …/verifications/:id/document/:docId` | Moderator+ | `requireModerator` + `userCanManageVerifications` |
| `PATCH …/verifications/:id/review` | Moderator+ | `requireModerator` + `userCanManageVerifications` |

### Other routes (outside this audit’s write pass)

Still candidates for separate hardening (not changed here):

- Messaging console (`/api/conversations`, `/api/messages/*`, etc.)
- Logistics simulator / webhooks
- Deprecated `/api/products` compatibility routes
- `GET /api/admin/stats` and some analytics GETs

### Intentionally public / customer-facing

- `GET /health`, public catalog GETs, `GET /operations/reviews/public`
- `POST /operations/coupons/validate`, `POST /operations/leads`, `POST /operations/seller-offers`
- Authenticated customer writes: checkout orders, reviews, returns create, claim confirm, job applications, verification submit, platform messages (own inbox)

### Ownership notes

- **Products** use optional `sellerId` on `CatalogProduct`. Sellers always get `sellerId = req.userId` on create. Updates cannot reassign `sellerId` except by admin. Products without `sellerId` are treated as platform/legacy and are admin-only to mutate.
- **Orders / returns / shipments / reviews / verifications** keep existing in-handler ownership helpers; middleware alone is not sufficient for seller scoping.
