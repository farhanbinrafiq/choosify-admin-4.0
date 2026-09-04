-- Optional "Consumer sets up a local password via email OTP" flow.
-- Additive only — no changes to existing tables/columns/types. `users.password_hash`
-- is already nullable; this flow only ever sets it when it is currently NULL and
-- the account role is 'user'.
--
-- Why a dedicated table and not `auth_tokens`:
--   * `auth_tokens` stores 256-bit bearer tokens that are unguessable, so it has
--     no attempt counter. This flow's stage-1 secret is a 6-digit email OTP
--     (10^6 space) and is only safe with a server-side `attempts` lock plus send
--     throttling (`resend_count` / `last_sent_at`) — columns `auth_tokens` lacks.
--   * The spec's two-stage requirement needs a post-verification, purpose-bound
--     authorization (`grant_hash`) with its own expiry/one-time-use, distinct
--     from the OTP row lifecycle.
--   * Overloading the password_reset token type would blur reset semantics and
--     risk this becoming an alternative way to change an existing password.
--
-- Written idempotently (IF NOT EXISTS guards), matching 0001–0005.
--
-- IMPORTANT: generated for review. NOT run automatically by the app. Apply with
-- `npm run db:migrate` (drizzle-kit) after approval — locally first, and only
-- against production when explicitly authorized.

CREATE TABLE IF NOT EXISTS "local_password_setups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
  "purpose" varchar(40) NOT NULL DEFAULT 'SET_LOCAL_PASSWORD',
  -- Stage 1: emailed 6-digit code
  "code_hash" varchar(255) NOT NULL,
  "code_expires_at" timestamp NOT NULL,
  "attempts" integer NOT NULL DEFAULT 0,
  "resend_count" integer NOT NULL DEFAULT 0,
  "last_sent_at" timestamp NOT NULL DEFAULT now(),
  "verified_at" timestamp,
  -- Stage 2: short-lived purpose-bound authorization minted on successful verify
  "grant_hash" varchar(255),
  "grant_expires_at" timestamp,
  "consumed_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "local_password_setups_user_id_idx" ON "local_password_setups" ("user_id");
CREATE INDEX IF NOT EXISTS "local_password_setups_code_hash_idx" ON "local_password_setups" ("code_hash");
CREATE INDEX IF NOT EXISTS "local_password_setups_grant_hash_idx" ON "local_password_setups" ("grant_hash");
