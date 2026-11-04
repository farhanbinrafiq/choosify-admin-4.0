-- Website Studio / CMS foundation (Phase 1) — durable, versioned website documents.
-- Purely additive: creates three new tables, one trigger function and one trigger.
-- No existing table, column or row is altered. No data is written here: the
-- initial content is copied from the live catalog settings by the separate,
-- reviewed backfill script (scripts/website-backfill.ts), not by this migration.
-- Idempotent, matching the convention of 0001-0014.
--
--  * website_documents — one row per website document ("company", "brand_assets",
--    "homepage", "navigation", "page:about", "legal:terms", ...). Holds the editable
--    DRAFT (never public) and a pointer to the current PUBLISHED version. draft_revision
--    increases on every draft save so concurrent editors get a stale-write error
--    instead of silently overwriting each other.
--  * website_versions — immutable, numbered published versions (1, 2, 3 ... per
--    document). Publish, rollback and backfill each INSERT a new row; a rollback copies
--    an older version's content into a NEW version, so history is never rewritten.
--    UPDATE and DELETE are rejected by a trigger. The actor column has NO foreign key
--    (as entitlement_audit_events): history must survive user deletion.
--  * website_pages — routing for content pages only (slug, type, status). The page
--    CONTENT lives in its website_documents row and versions — never duplicated here.
--
-- Rollback (only while no deployed code reads or writes these tables):
--   DROP TABLE IF EXISTS "website_pages";
--   DROP TABLE IF EXISTS "website_versions";
--   DROP TABLE IF EXISTS "website_documents";
--   DROP FUNCTION IF EXISTS "website_versions_reject_change"();
--   DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1788780000000;

CREATE TABLE IF NOT EXISTS "website_documents" (
  "key" varchar(80) PRIMARY KEY NOT NULL,
  "kind" varchar(24) NOT NULL,
  "draft" jsonb,
  "draft_revision" integer DEFAULT 0 NOT NULL,
  "draft_base_version" integer,
  "draft_updated_at" timestamp with time zone,
  "draft_updated_by_user_id" uuid,
  "published_version" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "website_documents_key_format_check" CHECK ("key" ~ '^[a-z][a-z0-9_]*(:[a-z0-9]+(-[a-z0-9]+)*)?$'),
  CONSTRAINT "website_documents_kind_check" CHECK ("kind" IN (
    'company', 'brand_assets', 'homepage', 'navigation', 'footer', 'social', 'seo',
    'page', 'legal', 'filters', 'features'
  )),
  CONSTRAINT "website_documents_draft_revision_check" CHECK ("draft_revision" >= 0),
  CONSTRAINT "website_documents_published_version_check" CHECK ("published_version" IS NULL OR "published_version" >= 1)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "website_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "document_key" varchar(80) NOT NULL REFERENCES "website_documents"("key") ON DELETE RESTRICT,
  "version" integer NOT NULL,
  "content" jsonb NOT NULL,
  "source" varchar(16) NOT NULL,
  "restored_from_version" integer,
  "change_note" text NOT NULL,
  "published_by_user_id" uuid,
  "published_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "website_versions_version_check" CHECK ("version" >= 1),
  CONSTRAINT "website_versions_source_check" CHECK ("source" IN ('publish', 'rollback', 'backfill')),
  CONSTRAINT "website_versions_rollback_check" CHECK (("source" = 'rollback') = ("restored_from_version" IS NOT NULL)),
  CONSTRAINT "website_versions_change_note_check" CHECK (length(trim("change_note")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "website_versions_document_version_unique" ON "website_versions" ("document_key", "version");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "website_versions_published_at_idx" ON "website_versions" ("published_at" DESC);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "website_versions_reject_change"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'website_versions rows are immutable (% rejected)', TG_OP;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "website_versions_immutable" ON "website_versions";
--> statement-breakpoint
CREATE TRIGGER "website_versions_immutable" BEFORE UPDATE OR DELETE ON "website_versions"
  FOR EACH ROW EXECUTE FUNCTION "website_versions_reject_change"();
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "website_pages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" varchar(120) NOT NULL,
  "document_key" varchar(80) NOT NULL REFERENCES "website_documents"("key") ON DELETE RESTRICT,
  "page_type" varchar(16) NOT NULL,
  "status" varchar(16) DEFAULT 'draft' NOT NULL,
  "created_by_user_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "website_pages_slug_format_check" CHECK (
    char_length("slug") BETWEEN 2 AND 120 AND "slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  CONSTRAINT "website_pages_page_type_check" CHECK ("page_type" IN ('system', 'custom')),
  CONSTRAINT "website_pages_status_check" CHECK ("status" IN ('draft', 'published', 'unpublished', 'archived'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "website_pages_slug_unique" ON "website_pages" ("slug");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "website_pages_document_key_unique" ON "website_pages" ("document_key");
