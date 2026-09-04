-- Social login provider identities (Google + Facebook). Additive only — no
-- changes to existing tables/columns. `users.password_hash` is already nullable,
-- so an OAuth-only Consumer account needs nothing on `users`.
--
-- Written idempotently (IF NOT EXISTS / DO-block guards), matching the
-- convention already used by 0001–0004.
--
-- IMPORTANT: this file is generated for review. It is NOT run automatically by
-- the app. Apply with `npm run db:migrate` (drizzle-kit) after approval —
-- locally first, and only against production when explicitly authorized.

DO $$ BEGIN
  CREATE TYPE "public"."auth_provider" AS ENUM ('google', 'facebook');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "user_identities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
  "provider" "public"."auth_provider" NOT NULL,
  "provider_subject" varchar(255) NOT NULL,
  "provider_email" varchar(320),
  "provider_email_verified" boolean NOT NULL DEFAULT false,
  "linked_at" timestamp NOT NULL DEFAULT now(),
  "last_login_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- One provider identity maps to exactly one Choosify user, and a Choosify user
-- has at most one identity per provider.
CREATE UNIQUE INDEX IF NOT EXISTS "user_identities_provider_subject_unique" ON "user_identities" ("provider", "provider_subject");
CREATE UNIQUE INDEX IF NOT EXISTS "user_identities_user_provider_unique" ON "user_identities" ("user_id", "provider");
CREATE INDEX IF NOT EXISTS "user_identities_user_id_idx" ON "user_identities" ("user_id");
