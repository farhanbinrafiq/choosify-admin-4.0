-- Choosify Platform Reference ID counters (BR/PR/CT/OR/… — not CF; CF remains choosify_user_id_counters).
CREATE TABLE IF NOT EXISTS "choosify_reference_id_counters" (
  "entity_type" varchar(32) PRIMARY KEY,
  "next_value" bigint NOT NULL DEFAULT 1,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
