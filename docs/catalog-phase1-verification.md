# Catalog Phase 1 verification checklist

## Prerequisites

1. Start admin backend:
   - `npm run dev`
2. Seed catalog baseline (one-time for empty database):
   - `npm run seed:catalog`
3. Start storefront app (`choosify-web`) with API base:
   - `VITE_API_BASE_URL=http://localhost:3000/api/v1 npm run dev`

## Smoke flow

1. Open admin Products and create a new product.
2. Verify API persistence:
   - `GET /api/v1/catalog/products` includes the new product.
3. Open storefront `/products` and `/`:
   - confirm new product appears in listings.
4. Open admin Deals and create/update a deal.
5. Verify API persistence:
   - `GET /api/v1/catalog/deals` includes changes.
6. Open storefront `/deals`:
   - confirm updated deal/promo visibility.
7. Open admin Categories and Brands and perform one update each.
8. Verify storefront `/categories` and `/brands` reflect updates.
9. Open admin Website CMS Studio and click **Publish All Changes**.
10. Verify homepage payload:
    - `GET /api/v1/catalog/home` returns updated `homepage` config.

## Compatibility fallback behavior

- Storefront defaults to existing static catalog constants when API is unavailable.
- Admin category/brand local state remains as a temporary fallback if API calls fail.
