-- Feature Access & Entitlements Phase 2A — entitlement architecture foundation.
-- Purely additive: creates three new tables. No existing table, column or row is
-- altered or removed (feature_entitlements is untouched and stays the role-default
-- baseline). No backfill. Idempotent, matching the convention of 0001-0010.
--
--  * account_entitlement_overrides — one active override per (account, feature):
--      grant    = allowed until removed (no expiry)
--      revoke   = permanently denied until removed (no expiry)
--      restrict = denied until expires_at, then ignored by the resolver
--    History lives in entitlement_audit_events, not in this table.
--  * platform_feature_states — platform-wide switch; a missing row means ENABLED.
--    Core / deprecated / reserved features are rejected at write time (app layer).
--  * entitlement_audit_events — append-only administrative history. Deliberately
--    NO foreign keys on the actor/target user columns so history survives user
--    deletion and is never rewritten by ON DELETE actions.
--
-- Rollback (only while the tables are empty / unused by deployed code):
--   DROP TABLE IF EXISTS "entitlement_audit_events";
--   DROP TABLE IF EXISTS "platform_feature_states";
--   DROP TABLE IF EXISTS "account_entitlement_overrides";

CREATE TABLE IF NOT EXISTS "account_entitlement_overrides" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "feature_key" varchar(80) NOT NULL,
  "effect" varchar(16) NOT NULL,
  "expires_at" timestamp with time zone,
  "reason" text NOT NULL,
  "created_by_user_id" uuid,
  "updated_by_user_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "account_entitlement_overrides_effect_check" CHECK ("effect" IN ('grant', 'revoke', 'restrict')),
  CONSTRAINT "account_entitlement_overrides_expiry_check" CHECK (("effect" = 'restrict') = ("expires_at" IS NOT NULL)),
  CONSTRAINT "account_entitlement_overrides_reason_check" CHECK (length(trim("reason")) > 0)
);

DO $$ BEGIN
  ALTER TABLE "account_entitlement_overrides"
    ADD CONSTRAINT "account_entitlement_overrides_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "account_entitlement_overrides"
    ADD CONSTRAINT "account_entitlement_overrides_created_by_user_id_users_id_fk"
    FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "account_entitlement_overrides"
    ADD CONSTRAINT "account_entitlement_overrides_updated_by_user_id_users_id_fk"
    FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "account_entitlement_overrides_user_feature_unique"
  ON "account_entitlement_overrides" USING btree ("user_id", "feature_key");

CREATE TABLE IF NOT EXISTS "platform_feature_states" (
  "feature_key" varchar(80) PRIMARY KEY NOT NULL,
  "enabled" boolean NOT NULL,
  "reason" text,
  "updated_by_user_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "platform_feature_states_reason_check" CHECK ("enabled" OR length(trim(coalesce("reason", ''))) > 0)
);

DO $$ BEGIN
  ALTER TABLE "platform_feature_states"
    ADD CONSTRAINT "platform_feature_states_updated_by_user_id_users_id_fk"
    FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "entitlement_audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "action" varchar(40) NOT NULL,
  "source" varchar(16) NOT NULL,
  "actor_user_id" uuid,
  "real_actor_user_id" uuid,
  "target_scope" varchar(16) NOT NULL,
  "target_user_id" uuid,
  "target_role" varchar(16),
  "feature_key" varchar(80) NOT NULL,
  "previous_state" jsonb,
  "new_state" jsonb,
  "reason" text,
  CONSTRAINT "entitlement_audit_events_action_check" CHECK ("action" IN ('role_default.set', 'account_override.set', 'account_override.removed', 'platform_state.set')),
  CONSTRAINT "entitlement_audit_events_source_check" CHECK ("source" IN ('admin_api', 'system')),
  CONSTRAINT "entitlement_audit_events_target_scope_check" CHECK ("target_scope" IN ('role', 'account', 'platform'))
);

CREATE INDEX IF NOT EXISTS "entitlement_audit_events_target_user_created_idx"
  ON "entitlement_audit_events" USING btree ("target_user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "entitlement_audit_events_feature_created_idx"
  ON "entitlement_audit_events" USING btree ("feature_key", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "entitlement_audit_events_created_idx"
  ON "entitlement_audit_events" USING btree ("created_at" DESC);
