-- Choosify User ID (CF-#####) — permanent human-readable account identifier.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "choosify_user_id" varchar(32);
CREATE UNIQUE INDEX IF NOT EXISTS "users_choosify_user_id_uidx" ON "users" ("choosify_user_id") WHERE "choosify_user_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "choosify_user_id_counters" (
  "id" integer PRIMARY KEY,
  "next_value" bigint NOT NULL DEFAULT 1,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "choosify_user_id_counters_singleton" CHECK ("id" = 1)
);

INSERT INTO "choosify_user_id_counters" ("id", "next_value")
VALUES (1, 1)
ON CONFLICT ("id") DO NOTHING;
