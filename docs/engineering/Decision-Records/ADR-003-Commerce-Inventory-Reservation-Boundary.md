# ADR-003: Commerce Inventory Reservation Boundary

**Status:** Accepted  
**Date:** 2026-08-08  
**Sprint:** Conversation Sprint 5 / IS-010 Sprint 8 — Commerce

## Context

IS-004 / BP-006 require inventory validation at checkout and discuss reservation so stock is not oversold between checkout and payment. Payments/Escrow are explicitly deferred to later sprints (IS-010 Sprint 10). SSLCommerz must not be rewritten in Sprint 5.

## Decision

1. **At checkout (this sprint):** revalidate available quantity and, for Product lines, increase `CatalogInventory.reservedQuantity` by the ordered quantity (reuse Sprint 3 `inventoryStore`). Checkout fails deterministically if stock is insufficient — no silent oversell and no invented auto-adjustment.
2. **Idempotent checkout:** durable idempotency is checked **before** reservation. Retries reuse the prior checkout and must not reserve again. If commerce durable write fails after reservation, reservations are compensated (released) immediately — this is incomplete-transaction rollback, not payment-failure release.
3. **Not in this sprint:** payment capture, escrow hold, release of reservation on payment failure/timeout, shipment decrement of `quantity`, or a second inventory ledger.
4. **Service lines:** no physical stock reservation; create minimal `CommerceBookingRequest` (`pending_seller_review`) linked to the split Order.
5. **Persistence:** Cart, Checkout, Order, Booking Request, and idempotency keys use Firestore Admin when platform Firestore is configured (`COMMERCE_USE_FIRESTORE` / `CATALOG_USE_FIRESTORE` + credentials); otherwise durable memory-disk under `.data/commerce-memory-snapshot.json` for local/dev only. Production Firestore failures fail closed (no silent memory fallback). Checkout commerce entities are committed in one Firestore batch.
6. **Split Order Engine:** split by **Brand** (IS-004 §9 / §335), which also yields separate Seller Orders in the multi-Seller acceptance case.
7. **Anonymous cart merge:** not specified as required by current docs/architecture for this admin-backed API; not invented. Report as gap if storefront later needs guest carts.

## Consequences

- Orders enter commerce state `pending` (payment lifecycle owned by later sprint).
- Existing SSLCommerz / `paymentsRouter` untouched.
- Full Order lifecycle (dispatch, delivery, returns, refunds) remains Sprint 6 / IS-010 Sprint 9+.

## Sprint 6 / IS-010 Sprint 9 addendum

- **Cancel before consumption:** release `reservedQuantity` for product lines (idempotent via `inventoryReserved`).
- **At Packed:** convert reservation into sold stock (`quantity` and `reservedQuantity` decrease); idempotent via `inventoryConsumed`.
- **Cancel after Packed:** restock `quantity` (seller may cancel until dispatch per ES-005 §33).
- **Payment-failure reservation release:** still Sprint 10. Confirm is Seller/Admin status path until Payments hardens payment-gated Confirm.
- **Do not emit** `PaymentCaptured` / escrow / refund events in Orders sprint.

## Sprint 7 / IS-010 Sprint 10 addendum

- **Payment-failure / cancel / timeout before consumption:** Payments releases `reservedQuantity` (idempotent via Payment.`reservationReleased` + Order.`inventoryReserved`).
- **Successful PaymentCaptured:** reservation remains until Pack (no release).
- **Prepaid Confirm:** Pending → Confirmed only after Payment Captured (server gate).
- **COD:** Confirm allowed under COD policy without fabricating gateway Captured for the due-on-delivery balance.
