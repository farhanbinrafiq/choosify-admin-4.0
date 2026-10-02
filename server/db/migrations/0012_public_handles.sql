-- Public Identity Phase B — global public handle namespace (Brands + Creators).
-- Purely additive: creates one new table. No existing table, column or row is
-- altered or removed; catalog Brand/Creator records (JSON snapshot) and their
-- slugs are untouched. No backfill. Idempotent, matching the convention of
-- 0001-0011.
--
-- One handle namespace shared by BRANDS and CREATORS only (a Brand is the
-- seller's public storefront — there are no seller/user/product/guide handles).
-- The handle is a presentation identifier; the canonical identity stays the
-- catalog entity id (a string such as 'brand-<uuid>' or 'creator-farhan', NOT a
-- Postgres uuid — hence varchar).
--
--  * handle is GLOBALLY unique across every row — active, retired and reserved —
--    so a retired or reserved handle can never be issued to anyone else until a
--    future, explicit release policy deletes or changes that row.
--  * one ACTIVE handle per (entity_type, entity_id); retired rows keep the
--    entity's history (old handles redirect in a later phase).
--  * reserved rows (entity_type = 'reserved', status = 'reserved') hold names no
--    entity may claim; they have no entity_id.
--  * A Brand handle belongs to the Brand (entity_id is the Brand id), never to
--    its current owner, so an ownership transfer leaves it unchanged.
--  * created_by_user_id has NO foreign key (as entitlement_audit_events): the
--    attribution must survive user deletion and never be rewritten by ON DELETE.
--  * Handle format mirrors shared/publicHandles/rules.ts (Admin) and lib/publicHandles.ts
--    (Web), which share one set of test vectors: 3–30 chars, ASCII a-z 0-9
--    and single hyphens, starts with a letter, no leading/trailing or doubled hyphen.
--
-- Rollback (only while no deployed code reads or writes the table):
--   DROP TABLE IF EXISTS "public_handles";
--   DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1788750000000;
-- Dropping the table removes its indexes and constraints with it; no other
-- object depends on it.

CREATE TABLE IF NOT EXISTS "public_handles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "handle" varchar(30) NOT NULL,
  "entity_type" varchar(16) NOT NULL,
  "entity_id" varchar(128),
  "status" varchar(16) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "retired_at" timestamp with time zone,
  "created_by_user_id" uuid,
  CONSTRAINT "public_handles_handle_format_check" CHECK (
    char_length("handle") BETWEEN 3 AND 30
    AND octet_length("handle") = char_length("handle")
    AND "handle" ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'
  ),
  CONSTRAINT "public_handles_entity_type_check" CHECK ("entity_type" IN ('brand', 'creator', 'reserved')),
  CONSTRAINT "public_handles_status_check" CHECK ("status" IN ('active', 'retired', 'reserved')),
  CONSTRAINT "public_handles_reserved_check" CHECK (("entity_type" = 'reserved') = ("status" = 'reserved')),
  CONSTRAINT "public_handles_entity_id_check" CHECK (
    CASE WHEN "entity_type" = 'reserved' THEN "entity_id" IS NULL
         ELSE "entity_id" IS NOT NULL AND length(trim("entity_id")) > 0 END
  ),
  CONSTRAINT "public_handles_retired_at_check" CHECK (("status" = 'retired') = ("retired_at" IS NOT NULL))
);

-- Global uniqueness (all statuses, all entity types). Handles are stored in
-- normalized lowercase (enforced above), so this is case-insensitive in effect.
CREATE UNIQUE INDEX IF NOT EXISTS "public_handles_handle_unique"
  ON "public_handles" USING btree ("handle");

-- At most one ACTIVE handle per Brand / Creator.
CREATE UNIQUE INDEX IF NOT EXISTS "public_handles_entity_active_unique"
  ON "public_handles" USING btree ("entity_type", "entity_id") WHERE "status" = 'active';

-- Entity lookup (current handle + history).
CREATE INDEX IF NOT EXISTS "public_handles_entity_idx"
  ON "public_handles" USING btree ("entity_type", "entity_id");
