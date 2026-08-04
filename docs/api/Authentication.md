# Authentication API

This document records the request/response contract for every authentication endpoint. Each entry states its implementation status explicitly.

---

## POST /auth/register

**Status:** Designed — not yet implemented (Sprint 2A, Task 2)

### Purpose

Register a standard Customer account.

### Authentication

Public. No bearer token or session required.

### Request Body

| Field | Type | Required |
|---|---|---|
| `fullName` | string | Yes |
| `email` | string | Yes |
| `password` | string | Yes |

### Validation

- `password` — minimum 8 characters (same rule enforced by `POST /auth/seller-register` via the shared `passwordValidator`)
- `email` — must be unique; registration fails if an account already exists for the given email

### Database Actions

- Creates a new row in `users` only
- `role` is set to `user`
- Does **not** create a `seller_profiles` row
- Does **not** fabricate `storeName`
- Does **not** fabricate `phone`
- Does **not** fabricate `city`
- Does **not** fabricate `category`

This is the corrective counterpart to `POST /auth/seller-register`, which requires all four of those fields because it is creating a seller identity. `POST /auth/register` creates a bare customer identity and stores nothing beyond what a customer actually provided.

### Success Response

`201 Created`

Matches the existing response contract used by `POST /auth/seller-register` for Closed Beta — same field names, including the `customToken` key for the access JWT (not `accessToken`), so both endpoints remain consistent for the frontend during this phase.

```json
{
  "uid": "b2b6b1de-....",
  "email": "shopper@example.com",
  "displayName": "Jane Rahman",
  "role": "user",
  "customToken": "eyJhbGciOi...",
  "dashboardPath": null
}
```

`dashboardPath` is expected to be `null` (or omitted) for the `user` role, unlike `seller-register`'s `/seller/products`, since a plain customer has no dashboard to route to.

### Error Responses

| Status | Condition |
|---|---|
| `400` | Validation error — missing/invalid `fullName`, `email`, or `password` (password under 8 characters, malformed email, etc.) |
| `409` | Email already exists — an account (of any role) already exists for the given email |
| `500` | Internal server error — unexpected failure creating the account |

---

## POST /auth/seller-register

**Status:** Implemented (Sprint 2A, Task 1)

Registers a Seller account.

### Purpose

Register a Seller account with business/store details.

### Authentication

Public.

### Request Body

| Field | Type | Required |
|---|---|---|
| `email` | string | Yes |
| `password` | string | Yes (as of Task 1 — no longer optional) |
| `displayName` | string | Yes |
| `storeName` | string | Yes |
| `phone` | string | Yes |
| `category` | string | Yes |
| `city` | string | Yes |
| `website` | string | No |

### Validation

- `password` — minimum 8 characters, required. A missing or short password now fails with `400` — there is no fallback that generates a password on the caller's behalf.
- `email` — must be unique among seller/verified-seller accounts (`409 SELLER_EXISTS`); unique among all roles otherwise (`409 EMAIL_IN_USE`)

### Database Actions

- Creates a `users` row (`role: 'seller'`)
- Creates a matching `seller_profiles` row (`storeName`, `phone`, `category`, `city`, `website`)

### Success Response

`201 Created`

```json
{
  "uid": "5ce780c9-....",
  "email": "seller@example.com",
  "displayName": "Jane Rahman",
  "role": "seller",
  "customToken": "eyJhbGciOi...",
  "dashboardPath": "/seller/products"
}
```

### Error Responses

| Status | Condition |
|---|---|
| `400` | Validation error — missing/invalid field, password under 8 characters |
| `409 SELLER_EXISTS` | A seller/verified-seller account already exists for this email |
| `409 EMAIL_IN_USE` | This email is already registered under a different role |
| `500` | Internal server error |

---

## POST /auth/login

**Status:** Implemented

### Purpose

Authenticate an existing account of any role.

### Authentication

Public.

### Request Body

| Field | Type | Required |
|---|---|---|
| `email` | string | Yes |
| `password` | string | Yes |

### Success Response

`200 OK`

```json
{
  "uid": "5ce780c9-....",
  "email": "seller@example.com",
  "displayName": "Jane Rahman",
  "role": "seller",
  "accessToken": "eyJhbGciOi..."
}
```

Sets an httpOnly `choosify_refresh` cookie (30-day refresh token) alongside the response body.

### Error Responses

| Status | Condition |
|---|---|
| `400` | Validation error |
| `401` | Invalid email or password |
| `500` | Internal server error |

---

## POST /auth/refresh

**Status:** Implemented

Reads the httpOnly refresh cookie, rotates it, and issues a new access token.

**Success:** `200 { accessToken }` + rotated refresh cookie
**Errors:** `401` missing/invalid/expired refresh token, `500`

---

## POST /auth/logout

**Status:** Implemented

Revokes the current refresh token and clears the refresh cookie.

**Success:** `200 { ok: true }`
**Errors:** `500` (cookie is cleared regardless)

---

## GET /auth/me

**Status:** Implemented

Resolves the authenticated profile from a bearer access token.

**Success:** `200 { uid, email, displayName, role }` — only for roles other than bare `user`
**Errors:** `401` missing/invalid/expired token, `403` authenticated but not an admin/seller/staff role, `500`

---

## POST /auth/dev-login

**Status:** Implemented — development/testing only

Issues a session for any role without credentials. Disabled in production unless `ALLOW_DEV_LOGIN=true`.

---

## GET /auth/seller-status

**Status:** Implemented

Public, low-information lookup used by the storefront's dual-account UI: returns whether a seller account exists for a given email, without revealing profile details.
