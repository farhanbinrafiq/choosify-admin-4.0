-- Shared profile-image adjustment feature — User Profile / Brand Studio /
-- Creator Studio all use the same crop/zoom/pan editor (ProfileImageAdjustModal).
-- Persisting the ORIGINAL upload alongside the rendered avatar means "Edit"
-- can resume against the real source instead of re-cropping an already-
-- cropped image. Brand and Creator profile images live in the JSON catalog
-- store (lib/vercel-catalog), not Postgres, so only `users` needs a schema
-- change here. Additive and idempotent, matching the convention of 0001-0008.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_original_url" varchar(700);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_crop" jsonb;
