-- Settings / notification preferences: per-person, per-persona in-app
-- notification choices. Purely additive — creates one new table; no existing
-- table, column or row is altered or removed. Idempotent, matching the
-- convention of 0001-0009.
--
-- in_app stores ONLY explicit choices as {"<eventKey>": true|false}. A missing
-- key, or no row at all, means "deliver" — so every existing user keeps
-- today's behaviour (all in-app notifications) until they change a setting.
-- Event keys and which events are mandatory are defined in
-- shared/notifications/notificationEvents.ts (mandatory events ignore this
-- table entirely).
--
-- Rollback (only if nothing depends on it yet): DROP TABLE IF EXISTS "notification_preferences";

CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "persona" varchar(16) NOT NULL,
  "in_app" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "marketing_opt_in" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "notification_preferences_persona_check" CHECK ("persona" IN ('account', 'seller', 'creator', 'consumer', 'staff')),
  CONSTRAINT "notification_preferences_in_app_object_check" CHECK (jsonb_typeof("in_app") = 'object')
);

DO $$ BEGIN
  ALTER TABLE "notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "notification_preferences_user_persona_unique"
  ON "notification_preferences" USING btree ("user_id", "persona");
