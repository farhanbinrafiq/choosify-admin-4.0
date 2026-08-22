-- Sprint 10/11 durability migration — Partner Applications, Feature Entitlements,
-- Feature Requests, Notifications, Plans, and Account Plans (all previously
-- in-memory/JSON-snapshot only, per the comments in server/db/schema.ts).
-- Written idempotently (IF NOT EXISTS / DO-block guards), matching the
-- convention already used by 0001_choosify_user_id.sql, 0002_choosify_reference_ids.sql,
-- and 0003_self_hosted_media_and_auth.sql.

DO $$ BEGIN
  CREATE TYPE "public"."feature_entitlement_scope" AS ENUM ('role', 'plan', 'account');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."feature_request_status" AS ENUM ('pending', 'approved', 'declined', 'contacted');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "plans" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "role" varchar(16) NOT NULL,
  "name" varchar(120) NOT NULL,
  "price_label" varchar(64),
  "active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "plans_role_idx" ON "plans" ("role");

CREATE TABLE IF NOT EXISTS "account_plans" (
  "user_id" uuid PRIMARY KEY NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
  "plan_id" varchar(64) NOT NULL REFERENCES "public"."plans"("id"),
  "status" varchar(16) NOT NULL DEFAULT 'active',
  "assigned_at" timestamp NOT NULL DEFAULT now(),
  "assigned_by_user_id" uuid REFERENCES "public"."users"("id") ON DELETE SET NULL,
  "expires_at" timestamp,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "feature_entitlements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scope" "public"."feature_entitlement_scope" NOT NULL,
  "scope_key" varchar(120) NOT NULL,
  "feature_key" varchar(80) NOT NULL,
  "enabled" boolean NOT NULL DEFAULT false,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "feature_entitlements_scope_key_feature_unique" ON "feature_entitlements" ("scope", "scope_key", "feature_key");

CREATE TABLE IF NOT EXISTS "feature_requests" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
  "role" varchar(16) NOT NULL,
  "feature_key" varchar(80) NOT NULL,
  "message" text,
  "status" "public"."feature_request_status" NOT NULL DEFAULT 'pending',
  "reviewed_at" timestamp,
  "reviewed_by_user_id" uuid REFERENCES "public"."users"("id") ON DELETE SET NULL,
  "review_note" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "feature_requests_user_feature_pending_unique" ON "feature_requests" ("user_id", "feature_key") WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS "feature_requests_status_idx" ON "feature_requests" ("status");

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
  "type" varchar(64) NOT NULL,
  "category" varchar(64) NOT NULL,
  "priority" varchar(32) NOT NULL DEFAULT 'normal',
  "title" varchar(320) NOT NULL,
  "summary" text,
  "action_url" varchar(500),
  "channels" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "read" boolean NOT NULL DEFAULT false,
  "dismissed" boolean NOT NULL DEFAULT false,
  "archived" boolean NOT NULL DEFAULT false,
  "pinned" boolean NOT NULL DEFAULT false,
  "metadata" jsonb,
  "read_at" timestamp,
  "dismissed_at" timestamp,
  "archived_at" timestamp,
  "expires_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "notifications_user_id_idx" ON "notifications" ("user_id");
CREATE INDEX IF NOT EXISTS "notifications_user_read_idx" ON "notifications" ("user_id", "read");

CREATE TABLE IF NOT EXISTS "partner_applications" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "applicant_type" varchar(16) NOT NULL,
  "status" varchar(16) NOT NULL DEFAULT 'pending',
  "email" varchar(320) NOT NULL,
  "password_hash" varchar(255),
  "display_name" varchar(120) NOT NULL,
  "phone" varchar(24) NOT NULL,
  "business_or_channel_name" varchar(160) NOT NULL,
  "category" varchar(120) NOT NULL,
  "city" varchar(80) NOT NULL,
  "website" varchar(320),
  "niche" varchar(160),
  "content_focus" varchar(160),
  "social_primary" varchar(320),
  "audience_size" varchar(64),
  "notes" text,
  "existing_user_id" uuid REFERENCES "public"."users"("id") ON DELETE SET NULL,
  "provisioned_user_id" uuid REFERENCES "public"."users"("id") ON DELETE SET NULL,
  "catalog_entity_id" varchar(120),
  "admin_notes" text,
  "resubmission_requested" boolean NOT NULL DEFAULT false,
  "reviewed_at" timestamp,
  "reviewed_by_user_id" uuid REFERENCES "public"."users"("id") ON DELETE SET NULL,
  "review_note" text,
  "review_history" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "partner_applications_status_idx" ON "partner_applications" ("status");
CREATE INDEX IF NOT EXISTS "partner_applications_email_idx" ON "partner_applications" ("email");
CREATE INDEX IF NOT EXISTS "partner_applications_provisioned_user_idx" ON "partner_applications" ("provisioned_user_id");
