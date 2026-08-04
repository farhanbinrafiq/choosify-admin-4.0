# ADR-015 — DRY Authentication

**Status:** Accepted

**Date:** 2026-08-04

---

## Context

Choosify currently has multiple authentication endpoints. Examples include:

- `POST /auth/login`
- `POST /auth/register`
- `POST /auth/seller-register`
- `POST /auth/logout`
- `POST /auth/refresh`

As the platform grows, duplicated authentication logic would increase maintenance cost and the risk of inconsistent behavior.

---

## Decision

Choosify will maintain a single shared authentication implementation.

Authentication endpoints should reuse shared logic for:

- Password hashing
- Password verification
- JWT creation
- Refresh token creation
- Session creation
- Cookie handling
- Common validation

Endpoints should only orchestrate business flow, not duplicate authentication logic.

---

## Consequences

### Benefits

- Reduced duplication
- Easier maintenance
- Consistent authentication behavior
- Lower risk of bugs
- Simpler future expansion

---

This ADR is a long-term architectural direction only. No implementation is required during Sprint 2.
