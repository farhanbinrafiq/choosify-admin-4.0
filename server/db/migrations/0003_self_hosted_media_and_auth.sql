-- Pre-VPS self-hosting pass: local/persistent media storage metadata,
-- email-verification/password-reset tokens, and a user avatar URL.
-- Written idempotently (IF NOT EXISTS / DO-block guards), matching the
-- convention already used by 0001_choosify_user_id.sql and
-- 0002_choosify_reference_ids.sql, since this repo hand-authors additive
-- migrations rather than relying on drizzle-kit's snapshot diff for them.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" varchar(700);

DO $$ BEGIN
  CREATE TYPE "public"."media_provider" AS ENUM ('local', 'cloudinary');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."media_visibility" AS ENUM ('public', 'private');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."media_type" AS ENUM ('image', 'video', 'document');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "media" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "uploaded_by_user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
  "category" varchar(32) NOT NULL,
  "visibility" "public"."media_visibility" NOT NULL DEFAULT 'public',
  "media_type" "public"."media_type" NOT NULL DEFAULT 'image',
  "related_entity_type" varchar(32),
  "related_entity_id" varchar(128),
  "provider" "public"."media_provider" NOT NULL DEFAULT 'local',
  "relative_path" varchar(500),
  "public_url" varchar(700),
  "mime_type" varchar(100) NOT NULL,
  "size_bytes" bigint NOT NULL,
  "width" integer,
  "height" integer,
  "duration_seconds" integer,
  "original_filename" varchar(255),
  "status" varchar(16) NOT NULL DEFAULT 'active',
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "media_uploader_idx" ON "media" ("uploaded_by_user_id");
CREATE INDEX IF NOT EXISTS "media_category_idx" ON "media" ("category");
CREATE INDEX IF NOT EXISTS "media_entity_idx" ON "media" ("related_entity_type", "related_entity_id");

DO $$ BEGIN
  CREATE TYPE "public"."auth_token_type" AS ENUM ('email_verification', 'password_reset');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "auth_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
  "type" "public"."auth_token_type" NOT NULL,
  "token_hash" varchar(255) NOT NULL,
  "expires_at" timestamp NOT NULL,
  "consumed_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "auth_tokens_user_type_idx" ON "auth_tokens" ("user_id", "type");
CREATE INDEX IF NOT EXISTS "auth_tokens_token_hash_idx" ON "auth_tokens" ("token_hash");
