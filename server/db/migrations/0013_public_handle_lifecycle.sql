-- Public Identity Phase C — public handle lifecycle foundation.
-- Purely additive: creates two new tables. public_handles (0012) and its rows are
-- not altered; no other table, column or row is touched. No backfill. Idempotent,
-- matching the convention of 0001-0012.
--
--  * public_handle_requests — an owner's request for a Brand / Creator handle,
--    decided by a Super Admin. A pending request does NOT hold the handle:
--    availability is re-checked when it is approved. At most one pending request
--    per entity. Every decision is final (no transition out of approved, rejected,
--    cancelled or superseded is ever written by code).
--  * public_handle_events — attributable history of every handle and request
--    change. APPEND-ONLY BY CODE CONTRACT: the application only ever inserts rows;
--    it has no update or delete path for this table. (The project uses no
--    triggers and one database role, so the database itself cannot forbid it.)
--  * No foreign keys on user, request or entity columns (as entitlement_audit_events
--    and public_handles.created_by_user_id): history must survive user deletion and
--    never be rewritten by ON DELETE; entity ids are catalog JSON ids, not rows.
--  * requested_handle uses the same format CHECK as public_handles.handle (0012).
--    Reserved names and reserved prefixes are enforced by the shared validator
--    (shared/publicHandles/rules.ts), not the database, exactly as in 0012.
--
-- Rollback (only while no deployed code reads or writes these tables):
--   DROP TABLE IF EXISTS "public_handle_events";
--   DROP TABLE IF EXISTS "public_handle_requests";
--   DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1788760000000;
-- Dropping a table removes its indexes and constraints with it; no other object
-- depends on either table.

CREATE TABLE IF NOT EXISTS "public_handle_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entity_type" varchar(16) NOT NULL,
  "entity_id" varchar(128) NOT NULL,
  "requested_handle" varchar(30) NOT NULL,
  "status" varchar(16) NOT NULL,
  "requested_by_user_id" uuid NOT NULL,
  "requested_real_actor_user_id" uuid,
  "decided_by_user_id" uuid,
  "decision_note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "decided_at" timestamp with time zone,
  CONSTRAINT "public_handle_requests_entity_type_check" CHECK ("entity_type" IN ('brand', 'creator')),
  CONSTRAINT "public_handle_requests_entity_id_check" CHECK (length(trim("entity_id")) > 0),
  CONSTRAINT "public_handle_requests_handle_format_check" CHECK (
    char_length("requested_handle") BETWEEN 3 AND 30
    AND octet_length("requested_handle") = char_length("requested_handle")
    AND "requested_handle" ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'
  ),
  CONSTRAINT "public_handle_requests_status_check" CHECK ("status" IN ('pending', 'approved', 'rejected', 'cancelled', 'superseded')),
  CONSTRAINT "public_handle_requests_decided_at_check" CHECK (("status" = 'pending') = ("decided_at" IS NULL)),
  CONSTRAINT "public_handle_requests_rejection_note_check" CHECK (
    "status" <> 'rejected' OR length(trim(coalesce("decision_note", ''))) > 0
  )
);

-- At most one PENDING request per Brand / Creator.
CREATE UNIQUE INDEX IF NOT EXISTS "public_handle_requests_one_pending"
  ON "public_handle_requests" USING btree ("entity_type", "entity_id") WHERE "status" = 'pending';

-- Review queue (by status, oldest first) and per-entity request history.
CREATE INDEX IF NOT EXISTS "public_handle_requests_status_created_idx"
  ON "public_handle_requests" USING btree ("status", "created_at");
CREATE INDEX IF NOT EXISTS "public_handle_requests_entity_idx"
  ON "public_handle_requests" USING btree ("entity_type", "entity_id", "created_at");

CREATE TABLE IF NOT EXISTS "public_handle_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "action" varchar(32) NOT NULL,
  "entity_type" varchar(16),
  "entity_id" varchar(128),
  "from_handle" varchar(30),
  "to_handle" varchar(30),
  "request_id" uuid,
  "actor_user_id" uuid,
  "real_actor_user_id" uuid,
  "reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "public_handle_events_action_check" CHECK ("action" IN (
    'assigned', 'renamed', 'retired', 'reserved', 'reserved_assigned', 'released',
    'request_submitted', 'request_approved', 'request_rejected', 'request_cancelled', 'request_superseded'
  )),
  CONSTRAINT "public_handle_events_entity_type_check" CHECK ("entity_type" IS NULL OR "entity_type" IN ('brand', 'creator')),
  -- An event is either about one Brand / Creator (both set) or about a bare
  -- reserved name (both null).
  CONSTRAINT "public_handle_events_entity_pair_check" CHECK (("entity_type" IS NULL) = ("entity_id" IS NULL))
);

-- Entity history (newest last), and "who held this handle" lookups.
CREATE INDEX IF NOT EXISTS "public_handle_events_entity_created_idx"
  ON "public_handle_events" USING btree ("entity_type", "entity_id", "created_at");
CREATE INDEX IF NOT EXISTS "public_handle_events_to_handle_idx"
  ON "public_handle_events" USING btree ("to_handle");
CREATE INDEX IF NOT EXISTS "public_handle_events_from_handle_idx"
  ON "public_handle_events" USING btree ("from_handle");
