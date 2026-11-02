-- Two-level brand category picker — seller sign-up keeps the chosen category.
-- Purely additive: three nullable columns on partner_applications. No existing
-- column, row or table is altered; no backfill (older applications keep only the
-- free-text `category`). Idempotent, matching the convention of 0001-0013.
--
--  * category_id      — Category Management id of the main category.
--  * subcategory_id   — optional subcategory (child of category_id).
--  * category_request — "couldn't find my category" text, reviewed by staff.

ALTER TABLE "partner_applications" ADD COLUMN IF NOT EXISTS "category_id" varchar(64);--> statement-breakpoint
ALTER TABLE "partner_applications" ADD COLUMN IF NOT EXISTS "subcategory_id" varchar(120);--> statement-breakpoint
ALTER TABLE "partner_applications" ADD COLUMN IF NOT EXISTS "category_request" varchar(80);
