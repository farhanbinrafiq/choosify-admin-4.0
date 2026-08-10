# ADR-004 — Messaging API Path Compatibility

## Status

Accepted — Conversation Sprint 9 / IS-010 Sprint 12

## Context

IS-005 §56 defines the authoritative Messaging surface under `/api/v1/conversations…`.

The repository already exposes legacy Meta/omni routes at:

- `GET /api/conversations`
- `GET /api/conversations/:id`
- `GET /api/messages/:conversationId`
- `POST /api/messages/send`

These legacy routes historically served the Unified Inbox UI and Meta adapters. They must not be broken during the Messaging SoT cutover.

## Decision

1. **Authoritative SoT and API:** Commerce-bound Conversations/Messages live in `server/messaging/conversations/*` and are exposed at `/api/v1/...` per IS-005.
2. **Legacy compatibility:** Existing `/api/conversations` and `/api/messages` routes remain mounted for Meta omni + UI transitional reads. Platform commerce threads are dual-written into omni store so the frozen Messages UI continues to list Order Conversations without a redesign.
3. **No second Messaging SoT:** Legacy paths do not invent a parallel conversation identity for Order/Booking contexts; Order Conversations are created only via the authoritative service (`ensureOrderConversation` / reconcile).
4. **Auth direction:** New `/api/v1` routes require Bearer auth and ownership checks. Legacy Meta send paths retain prior adapter behavior for non-platform channels; platform commerce sends should prefer `/api/v1/conversations/:id/messages`.

## Consequences

- Clients should migrate to `/api/v1/conversations`.
- Probes assert both authoritative `/api/v1` behavior and that legacy list endpoints still respond.
- Meta webhook endpoints remain under existing `/api` messaging hub paths (and any `/api/v1/webhooks/meta/*` aliases if added later) with fail-closed signature verification when live.
