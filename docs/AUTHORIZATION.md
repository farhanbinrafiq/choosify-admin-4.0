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

These definitions are available for future APIs. Existing APIs were not rewritten to enforce every permission in this sprint.

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

No existing API contracts or route behavior were changed in this sprint.

### Protected Routes

- `GET /api/v1/auth/me` verifies the Firebase bearer token and resolves the admin profile.
- `POST /api/webhooks/meta` is protected by Meta webhook signature verification.
- `GET /api/webhooks/meta` is protected by Meta verify token challenge behavior.
- `POST /api/v1/auth/dev-login` is disabled in production unless `ALLOW_DEV_LOGIN=true`.

### Routes Missing Protection

These routes currently do not require Firebase authentication in the Express layer and should be candidates for future authorization work:

- Catalog management routes under `/api/v1/catalog/*`, including product, category, brand, deal, homepage, media, and brand post mutations.
- Operations routes under `/api/v1/operations/*`, including orders, coupons, reviews, leads, permissions, analytics, shipments, feature flags, users, and seller offers.
- Messaging console routes under `/api/conversations`, `/api/messages/*`, `/api/conversation/*`, and `/api/agents`.
- Logistics simulator route `POST /api/logistics/simulate-webhook`.
- Deprecated product compatibility routes under `/api/products`.
- Admin stats route `GET /api/admin/stats`.

### Admin Routes

Likely future admin or super-admin candidates:

- Catalog write operations.
- CMS/homepage write operations.
- Operations permissions endpoints.
- Feature flag writes.
- Admin stats and analytics endpoints.
- User management endpoints.

### Seller Routes

Likely future seller candidates:

- Product create/edit operations scoped to seller ownership.
- Seller offers.
- Seller order and shipment views scoped to seller ownership.
- Seller analytics scoped to seller ownership.

### Moderator Routes

Likely future moderator candidates:

- Review moderation endpoints.
- Messaging assignment/status endpoints.
- Seller approval/suspension workflows.
- CMS moderation workflows.

### Public Routes

Routes that currently appear intentionally public or integration-facing:

- `GET /health`
- Public catalog read routes.
- Public review submission and public review listing routes.
- Coupon validation.
- Storefront order creation.
- Meta webhook verification endpoints.
- Logistics webhook receiver endpoints.

Future hardening should apply middleware route-by-route to avoid breaking the current frontend or third-party integrations.
