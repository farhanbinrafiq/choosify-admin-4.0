#!/usr/bin/env bash
set -Eeuo pipefail

# ============================================================
# backup-catalog.sh -- standalone backup for the production catalog
# memory-adapter snapshot (Choosify).
#
# Deliberately independent of backup-postgres.sh: catalog and
# PostgreSQL backups have different source/validation/restore
# semantics and should be runnable/debuggable independently. See
# the Catalog Persistence Safety Audit for background -- the live
# catalog (products, brands, creators, marketplaceStatus, deals,
# guides, placements, product details, brand posts, inventory,
# services, homepage/site config) runs on a memory-disk adapter
# (CATALOG_USE_FIRESTORE=false) whose sole durability copy is a
# single JSON file with no prior backup coverage.
#
# Never restarts services, never mutates or deletes the live
# snapshot, never changes CATALOG_USE_FIRESTORE, never interacts
# with PostgreSQL, never restores automatically.
# ============================================================

SOURCE_FILE="/var/www/choosify/admin/.data/catalog-memory-snapshot.json"
BACKUP_DIR="/var/www/choosify/backups/catalog"
LOCK_FILE="/var/www/choosify/backup/catalog-backup.lock"
LOG_FILE="$BACKUP_DIR/backup.log"
RETENTION_COUNT=7
NAMING_PREFIX="catalog_daily_"

ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
log() {
  local line
  line=$(printf '[%s] [%s] %s' "$(ts)" "$1" "$2")
  echo "$line"
  echo "$line" >> "$LOG_FILE" 2>/dev/null || true
}

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
mkdir -p "$(dirname "$LOCK_FILE")"
chmod 700 "$(dirname "$LOCK_FILE")"
touch "$LOG_FILE"
chmod 600 "$LOG_FILE"

exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  echo "[ERROR] Another backup-catalog.sh run is already in progress. Aborting."
  exit 1
fi

log INFO "=== backup-catalog.sh started ==="
log INFO "Source: $SOURCE_FILE"

# --- 1/2: source exists and is non-empty ---
[ -f "$SOURCE_FILE" ] || { log ERROR "[CHECK] Source snapshot not found: $SOURCE_FILE"; exit 1; }
log CHECK "Source snapshot exists."

SRC_SIZE=$(stat -c '%s' "$SOURCE_FILE")
if [ "$SRC_SIZE" -le 0 ]; then
  log ERROR "[CHECK] Source snapshot is empty (size=$SRC_SIZE). Refusing to back up."
  exit 1
fi
log CHECK "Source snapshot size: ${SRC_SIZE} bytes."

# --- JSON parse + shape + expected-key validation. Keys are the exact
# CatalogMemorySnapshot fields (lib/vercel-catalog/catalogMemoryPersistence.ts),
# not guessed. Only key PRESENCE is checked -- legitimate empty arrays
# (e.g. inventory: [], services: []) are valid and must not be rejected. ---
validate_json() {
  local file="$1"
  node -e '
    const fs = require("fs");
    let raw;
    try { raw = fs.readFileSync(process.argv[1], "utf8"); }
    catch (e) { console.error("READ_FAILED: " + e.message); process.exit(1); }
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch (e) { console.error("PARSE_FAILED: " + e.message); process.exit(1); }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      console.error("SHAPE_FAILED: top level is not an object");
      process.exit(1);
    }
    const required = [
      "version", "products", "categories", "categoryAttributes", "brands",
      "deals", "creators", "guides", "placements", "productDetails",
      "brandPosts", "inventory", "services", "homepage", "site",
    ];
    const missing = required.filter((k) => !(k in parsed));
    if (missing.length > 0) {
      console.error("KEYS_FAILED: missing " + missing.join(", "));
      process.exit(1);
    }
    process.exit(0);
  ' "$file"
}

# --- 3: validate SOURCE JSON before copying (fail closed) ---
if ! VALIDATION_ERR=$(validate_json "$SOURCE_FILE" 2>&1); then
  log ERROR "[CHECK] Source snapshot failed JSON/shape validation: $VALIDATION_ERR"
  exit 1
fi
log CHECK "Source snapshot JSON valid; expected top-level keys present."

TS=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/${NAMING_PREFIX}${TS}.json"
TMP_FILE="${BACKUP_FILE}.tmp"

# --- 5/6: copy to a temp file first, with a bounded retry in case the
# running app writes the source mid-copy. The file is small (~30KB) so
# a torn read is already astronomically unlikely; the real safety net
# is validating the TEMP COPY's JSON below, not this hash comparison --
# but comparing source hashes before/after catches the case where a
# completed write lands between them even if the copy itself parses. ---
COPY_OK=0
for attempt in 1 2 3; do
  SRC_HASH_BEFORE=$(sha256sum "$SOURCE_FILE" | cut -d' ' -f1)
  cp "$SOURCE_FILE" "$TMP_FILE"
  SRC_HASH_AFTER=$(sha256sum "$SOURCE_FILE" | cut -d' ' -f1)
  if [ "$SRC_HASH_BEFORE" = "$SRC_HASH_AFTER" ]; then
    COPY_OK=1
    log BACKUP "Copied source to temp file (attempt $attempt); source unchanged during copy."
    break
  fi
  log INFO "Source snapshot changed during copy attempt $attempt -- retrying."
  rm -f "$TMP_FILE"
  sleep 1
done
if [ "$COPY_OK" -ne 1 ]; then
  log ERROR "[COPY] Source snapshot kept changing across 3 attempts. Aborting without a backup this run."
  rm -f "$TMP_FILE"
  exit 1
fi

# --- validate the COPIED temp file (fail closed) ---
if ! VALIDATION_ERR=$(validate_json "$TMP_FILE" 2>&1); then
  log ERROR "[VERIFY] Copied backup failed JSON/shape validation: $VALIDATION_ERR"
  rm -f "$TMP_FILE"
  exit 1
fi
log VERIFY "Copied backup JSON valid."

# --- 7: atomic rename temp -> final ---
mv "$TMP_FILE" "$BACKUP_FILE"
log BACKUP "Backup finalized: $BACKUP_FILE"

if [ ! -f "$BACKUP_FILE" ]; then
  log ERROR "[VERIFY] Backup file missing after rename."
  exit 1
fi

BACKUP_SIZE=$(stat -c '%s' "$BACKUP_FILE")
if [ "$BACKUP_SIZE" -le 0 ]; then
  log ERROR "[VERIFY] Backup file size is not > 0 (size=$BACKUP_SIZE)."
  exit 1
fi
log VERIFY "Backup file size: ${BACKUP_SIZE} bytes."

# --- 10: restrictive permissions ---
chmod 600 "$BACKUP_FILE"

# --- 8/9: SHA256 + sibling checksum file ---
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
sha256sum "$BACKUP_FILE" > "$CHECKSUM_FILE"
chmod 600 "$CHECKSUM_FILE"
CHECKSUM=$(cut -d' ' -f1 "$CHECKSUM_FILE")
log VERIFY "SHA256: $CHECKSUM"

# --- 12: the live source snapshot was only ever read via cp, never
# written to or deleted, at any point above. ---
log INFO "Live source snapshot was only read; not modified or deleted."

# --- 11: retention -- keep latest 7 automated catalog backup sets only ---
log RETENTION "Applying retention: keep latest ${RETENTION_COUNT} set(s) matching ${NAMING_PREFIX}*.json (manually-named reference backups are never touched)"
mapfile -t OLD_BACKUPS < <(ls -1t "$BACKUP_DIR"/${NAMING_PREFIX}*.json 2>/dev/null | tail -n +$((RETENTION_COUNT + 1)))
if [ "${#OLD_BACKUPS[@]}" -gt 0 ]; then
  for f in "${OLD_BACKUPS[@]}"; do
    log RETENTION "Removing old automated backup: $f"
    rm -f "$f" "${f}.sha256"
  done
else
  log RETENTION "No automated backups exceed retention count; nothing removed."
fi

log SUCCESS "Backup complete: $BACKUP_FILE (size=${BACKUP_SIZE} bytes, sha256=${CHECKSUM})"
exit 0
