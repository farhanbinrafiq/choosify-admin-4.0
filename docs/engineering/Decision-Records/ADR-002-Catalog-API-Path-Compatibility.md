# ADR-002: Catalog API Path Compatibility (`/api/v1/catalog/*`)

**Status:** Accepted (Sprint 3)
**Date:** August 2026
**Affected Documents:** IS-003 §54 (API Endpoints examples), ES-002 conventions

---

## Context

IS-003 documents Product/Service endpoints under `/api/v1/products` and `/api/v1/services`.
The running codebase (and all clients) already use the integrated family:

- `/api/v1/catalog/products`
- `/api/v1/catalog/services` (Sprint 3 foundation)
- `/api/v1/catalog/products/:id/inventory`
- related `/api/v1/catalog/*` resources

A breaking rename during Sprint 3 would churn every client, probe, and storefront integration without business benefit.

## Decision

Keep `/api/v1/catalog/*` as the production API family.

IS-003 path examples are treated as conceptual resource names, not a mandatory URL migration in this sprint.

## Consequences

- No `/api/v1/products` migration in Sprint 3.
- New inventory and service foundation endpoints extend the existing catalog family.
- Documentation may later be amended to show `/catalog` paths explicitly; this ADR records the compatibility choice.
