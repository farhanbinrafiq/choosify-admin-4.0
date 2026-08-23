#!/usr/bin/env bash
set -Eeuo pipefail

# ============================================================
# backup-postgres.sh -- production PostgreSQL backup for Choosify.
#
# Runs as the choosify OS user, no root required. Uses the same
# proven authentication mechanism as admin/.env's DATABASE_URL
# (the value is read into a variable and used, but never echoed
# or logged). Creates a timestamped custom-format pg_dump,
# validates it with pg_restore --list, computes a SHA256
# checksum, enforces retention ONLY on files matching the
# automated daily naming prefix (never touches manually-created
# backups like the restore-tested choosify_YYYYMMDD_HHMMSS.dump),
# and logs every step except secrets.
#
# Never modifies the production database, never restarts
# PostgreSQL/PM2, never runs migrations.
# ============================================================

ADMIN_ENV="/var/www/choosify/admin/.env"
BACKUP_DIR="/var/www/choosify/backups/postgres"
LOCK_FILE="/var/www/choosify/backup/postgres-backup.lock"
LOG_FILE="$BACKUP_DIR/backup.log"
RETENTION_COUNT=7
NAMING_PREFIX="choosify_daily_"

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
  echo "[ERROR] Another backup-postgres.sh run is already in progress. Aborting."
  exit 1
fi

log INFO "=== backup-postgres.sh started ==="

[ -f "$ADMIN_ENV" ] || { log ERROR "[CHECK] $ADMIN_ENV not found."; exit 1; }
DBURL=$(grep '^DATABASE_URL=' "$ADMIN_ENV" | cut -d'=' -f2- | sed 's/^"//;s/"$//')
[ -n "$DBURL" ] || { log ERROR "[CHECK] DATABASE_URL not found in $ADMIN_ENV."; exit 1; }
log CHECK "DATABASE_URL located (value never logged)."

TS=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/${NAMING_PREFIX}${TS}.dump"

log BACKUP "Starting pg_dump -> $BACKUP_FILE"
if ! pg_dump -Fc "$DBURL" -f "$BACKUP_FILE" 2>>"$LOG_FILE"; then
  log ERROR "pg_dump failed (non-zero exit). No further steps taken; removing any partial file."
  unset DBURL
  rm -f "$BACKUP_FILE"
  exit 1
fi
unset DBURL
log BACKUP "pg_dump completed successfully."

if [ ! -f "$BACKUP_FILE" ]; then
  log ERROR "[VERIFY] Backup file missing after pg_dump reported success."
  exit 1
fi

SIZE=$(stat -c '%s' "$BACKUP_FILE")
if [ "$SIZE" -le 0 ]; then
  log ERROR "[VERIFY] Backup file size is not > 0 (size=$SIZE)."
  exit 1
fi
log VERIFY "Backup file size: ${SIZE} bytes."

if ! pg_restore --list "$BACKUP_FILE" > /dev/null 2>>"$LOG_FILE"; then
  log ERROR "[VERIFY] pg_restore --list failed to validate the archive."
  exit 1
fi
log VERIFY "Archive validated via pg_restore --list."

chmod 600 "$BACKUP_FILE"

CHECKSUM_FILE="${BACKUP_FILE}.sha256"
sha256sum "$BACKUP_FILE" > "$CHECKSUM_FILE"
chmod 600 "$CHECKSUM_FILE"
CHECKSUM=$(cut -d' ' -f1 "$CHECKSUM_FILE")
log VERIFY "SHA256: $CHECKSUM"

log RETENTION "Applying retention: keep latest ${RETENTION_COUNT} set(s) matching ${NAMING_PREFIX}*.dump (manually-named backups are never touched)"
mapfile -t OLD_DUMPS < <(ls -1t "$BACKUP_DIR"/${NAMING_PREFIX}*.dump 2>/dev/null | tail -n +$((RETENTION_COUNT + 1)))
if [ "${#OLD_DUMPS[@]}" -gt 0 ]; then
  for f in "${OLD_DUMPS[@]}"; do
    log RETENTION "Removing old automated backup: $f"
    rm -f "$f" "${f}.sha256"
  done
else
  log RETENTION "No automated backups exceed retention count; nothing removed."
fi

log SUCCESS "Backup complete: $BACKUP_FILE (size=${SIZE} bytes, sha256=${CHECKSUM})"
exit 0
