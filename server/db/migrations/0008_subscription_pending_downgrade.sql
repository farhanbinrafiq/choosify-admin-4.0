-- Sprint 12 (Phase 3C) — pending downgrade support.
-- Manual-renewal V1 policy: a downgrade is scheduled for period end, never
-- applied immediately. Recording "what the user wants to move to" needs a
-- real, queryable column (not something re-derived from an append-only
-- event log) because the expiry sweep and the later "pay for the pending
-- target" flow both have to read it reliably. Written idempotently,
-- matching the convention of 0001-0007.

ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "pending_plan_version_offer_id" uuid;

DO $$ BEGIN
  ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_pending_plan_version_offer_id_fkey"
    FOREIGN KEY ("pending_plan_version_offer_id") REFERENCES "public"."plan_version_offers"("id") ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 'downgraded' already means "took effect" (past tense, matching 'cancelled').
-- These two represent the pending request itself, before fulfilled/withdrawn.
DO $$ BEGIN
  ALTER TYPE "public"."subscription_event_type" ADD VALUE IF NOT EXISTS 'downgrade_requested';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "public"."subscription_event_type" ADD VALUE IF NOT EXISTS 'downgrade_cancelled';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
