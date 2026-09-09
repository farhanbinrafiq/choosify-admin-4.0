-- Sprint 12 — Subscription Plans + Monetization Center foundation.
-- Minimal Workspace tenant + versioned commercial Plan model (Plan vs Plan
-- Version separated so a price/feature edit never rewrites what an existing
-- subscriber purchased; version-aware grandfathering via
-- subscriptions.plan_version_offer_id). NOT Team & Access — workspaces here
-- is deliberately minimal (id/type/owner/status only), no memberships,
-- invitations, or permissions. Written idempotently (IF NOT EXISTS / DO-block
-- guards), matching the convention of 0001-0006.

-- ── Workspace (minimal, Subscription-only scope) ──
DO $$ BEGIN
  CREATE TYPE "public"."workspace_type" AS ENUM ('seller', 'creator');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."workspace_status" AS ENUM ('active', 'suspended');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "workspaces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "type" "public"."workspace_type" NOT NULL,
  "owner_user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE RESTRICT,
  "display_name" varchar(160) NOT NULL,
  "status" "public"."workspace_status" NOT NULL DEFAULT 'active',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_owner_persona_unique" ON "workspaces" ("owner_user_id", "type");
CREATE INDEX IF NOT EXISTS "workspaces_owner_idx" ON "workspaces" ("owner_user_id");

-- ── Plan: extend existing table with catalog-identity-only columns ──
DO $$ BEGIN
  CREATE TYPE "public"."plan_lifecycle_state" AS ENUM ('draft', 'published', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."plan_billing_interval" AS ENUM ('monthly', 'annual');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "internal_code" varchar(64);
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "badge" varchar(64);
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "lifecycle_state" "public"."plan_lifecycle_state" NOT NULL DEFAULT 'draft';
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "is_public" boolean NOT NULL DEFAULT false;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "is_recommended" boolean NOT NULL DEFAULT false;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "current_published_version_id" uuid;

CREATE UNIQUE INDEX IF NOT EXISTS "plans_internal_code_unique" ON "plans" ("internal_code") WHERE "internal_code" IS NOT NULL;

-- ── Plan Version: immutable-once-published commercial terms ──
CREATE TABLE IF NOT EXISTS "plan_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "plan_id" varchar(64) NOT NULL REFERENCES "public"."plans"("id") ON DELETE RESTRICT,
  "version" integer NOT NULL,
  "name_snapshot" varchar(160) NOT NULL,
  "description_snapshot" text,
  "trial_days" integer,
  "snapshot" jsonb,
  "published_at" timestamp,
  "published_by_user_id" uuid REFERENCES "public"."users"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "plan_versions_unique" ON "plan_versions" ("plan_id", "version");
-- Enables the composite FK below (a FK target must be covered by a unique index/constraint).
CREATE UNIQUE INDEX IF NOT EXISTS "plan_versions_plan_id_unique" ON "plan_versions" ("plan_id", "id");
CREATE INDEX IF NOT EXISTS "plan_versions_plan_idx" ON "plan_versions" ("plan_id");

-- Guarantees plans.current_published_version_id can never point at a version
-- belonging to a DIFFERENT plan — enforced by Postgres itself, no trigger.
DO $$ BEGIN
  ALTER TABLE "plans" ADD CONSTRAINT "plans_current_version_belongs_to_self"
    FOREIGN KEY ("id", "current_published_version_id") REFERENCES "plan_versions"("plan_id", "id");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── Plan Version Offer: one row per billing interval actually offered ──
CREATE TABLE IF NOT EXISTS "plan_version_offers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "plan_version_id" uuid NOT NULL REFERENCES "public"."plan_versions"("id") ON DELETE RESTRICT,
  "billing_interval" "public"."plan_billing_interval" NOT NULL,
  "price" integer NOT NULL,
  "currency" varchar(8) NOT NULL DEFAULT 'BDT'
);

CREATE UNIQUE INDEX IF NOT EXISTS "plan_version_offers_unique" ON "plan_version_offers" ("plan_version_id", "billing_interval");
CREATE INDEX IF NOT EXISTS "plan_version_offers_version_idx" ON "plan_version_offers" ("plan_version_id");

-- ── Plan Entitlements (boolean) / Plan Limits (quantitative) — versioned, kept separate ──
CREATE TABLE IF NOT EXISTS "plan_entitlements" (
  "plan_version_id" uuid NOT NULL REFERENCES "public"."plan_versions"("id") ON DELETE CASCADE,
  "feature_key" varchar(64) NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  PRIMARY KEY ("plan_version_id", "feature_key")
);

CREATE TABLE IF NOT EXISTS "plan_limits" (
  "plan_version_id" uuid NOT NULL REFERENCES "public"."plan_versions"("id") ON DELETE CASCADE,
  "limit_key" varchar(64) NOT NULL,
  "limit_value" integer,
  PRIMARY KEY ("plan_version_id", "limit_key")
);

-- ── Subscription: current continuing record, at most one OPEN row per Workspace ──
DO $$ BEGIN
  CREATE TYPE "public"."subscription_status" AS ENUM
    ('trial', 'active', 'past_due', 'grace_period', 'cancelled', 'expired', 'suspended');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "public"."workspaces"("id") ON DELETE RESTRICT,
  "plan_version_offer_id" uuid NOT NULL REFERENCES "public"."plan_version_offers"("id") ON DELETE RESTRICT,
  "status" "public"."subscription_status" NOT NULL DEFAULT 'trial',
  "start_date" timestamp NOT NULL DEFAULT now(),
  "current_period_start" timestamp NOT NULL,
  "current_period_end" timestamp,
  "cancel_at_period_end" boolean NOT NULL DEFAULT false,
  "cancelled_at" timestamp,
  "trial_ends_at" timestamp,
  "granted_manually" boolean NOT NULL DEFAULT false,
  "granted_by_user_id" uuid REFERENCES "public"."users"("id") ON DELETE SET NULL,
  "granted_reason" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "subscriptions_workspace_idx" ON "subscriptions" ("workspace_id");
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_workspace_open_unique" ON "subscriptions" ("workspace_id")
  WHERE "status" IN ('trial','active','past_due','grace_period');

-- ── Subscription Events: append-only lifecycle history ──
DO $$ BEGIN
  CREATE TYPE "public"."subscription_event_type" AS ENUM (
    'subscribed', 'renewed', 'upgraded', 'downgraded',
    'cancellation_requested', 'cancelled', 'expired',
    'manually_granted', 'suspended', 'restored'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "subscription_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "subscription_id" uuid NOT NULL REFERENCES "public"."subscriptions"("id") ON DELETE RESTRICT,
  "event_type" "public"."subscription_event_type" NOT NULL,
  "from_plan_version_offer_id" uuid REFERENCES "public"."plan_version_offers"("id"),
  "to_plan_version_offer_id" uuid REFERENCES "public"."plan_version_offers"("id"),
  "actor_user_id" uuid REFERENCES "public"."users"("id") ON DELETE SET NULL,
  "reason" text,
  "metadata" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "subscription_events_subscription_idx" ON "subscription_events" ("subscription_id");

-- ── Subscription Payments: subscription_id nullable (initial-purchase attempts precede the subscription itself) ──
DO $$ BEGIN
  CREATE TYPE "public"."subscription_payment_purpose" AS ENUM
    ('initial', 'renewal', 'upgrade', 'downgrade', 'manual_adjustment');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."subscription_payment_result" AS ENUM ('pending', 'succeeded', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "subscription_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "subscription_id" uuid REFERENCES "public"."subscriptions"("id") ON DELETE RESTRICT,
  "workspace_id" uuid NOT NULL REFERENCES "public"."workspaces"("id") ON DELETE RESTRICT,
  "plan_version_offer_id" uuid NOT NULL REFERENCES "public"."plan_version_offers"("id") ON DELETE RESTRICT,
  "purpose" "public"."subscription_payment_purpose" NOT NULL,
  "amount" integer NOT NULL,
  "currency" varchar(8) NOT NULL,
  "provider" varchar(32) NOT NULL DEFAULT 'sslcommerz',
  "provider_tran_id" varchar(120),
  "provider_val_id" varchar(120),
  "result" "public"."subscription_payment_result" NOT NULL DEFAULT 'pending',
  "idempotency_key" varchar(120) NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "subscription_payments_idempotency_unique" ON "subscription_payments" ("idempotency_key");
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_payments_tran_unique" ON "subscription_payments" ("provider", "provider_tran_id");
CREATE INDEX IF NOT EXISTS "subscription_payments_subscription_idx" ON "subscription_payments" ("subscription_id");
CREATE INDEX IF NOT EXISTS "subscription_payments_workspace_idx" ON "subscription_payments" ("workspace_id");

-- ── Subscription Billing Documents: issued 1:1 from a SUCCEEDED payment only ──
DO $$ BEGIN
  CREATE TYPE "public"."subscription_billing_document_status" AS ENUM ('issued', 'void');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "subscription_billing_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "subscription_payment_id" uuid NOT NULL REFERENCES "public"."subscription_payments"("id") ON DELETE RESTRICT,
  "workspace_id" uuid NOT NULL REFERENCES "public"."workspaces"("id") ON DELETE RESTRICT,
  "reference_id" varchar(32) NOT NULL,
  "amount" integer NOT NULL,
  "currency" varchar(8) NOT NULL,
  "period_start" timestamp NOT NULL,
  "period_end" timestamp,
  "status" "public"."subscription_billing_document_status" NOT NULL DEFAULT 'issued',
  "issued_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "subscription_billing_documents_reference_unique" ON "subscription_billing_documents" ("reference_id");
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_billing_documents_payment_unique" ON "subscription_billing_documents" ("subscription_payment_id");
CREATE INDEX IF NOT EXISTS "subscription_billing_documents_workspace_idx" ON "subscription_billing_documents" ("workspace_id");

-- NOTE: no persona-match trigger included (workspace.type == plan.role).
-- Decision: server-layer validation only for V1 -- the subscription-creation
-- service is the sole write path to this table, validates persona match as a
-- mandatory precondition inside the same transaction as the INSERT (no
-- TOCTOU window), and there is no direct/external SQL write surface this
-- needs to defend against. A trigger would add real cost (untestable via
-- Drizzle's own tooling, invisible to `drizzle-kit generate`, one more thing
-- every future migration must remember exists) for a threat model that does
-- not apply here. Revisit only if a second write path to `subscriptions`
-- is ever introduced.
