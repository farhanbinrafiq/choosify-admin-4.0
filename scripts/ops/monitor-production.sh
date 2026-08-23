#!/usr/bin/env bash
set -Eeuo pipefail

# ============================================================
# monitor-production.sh -- lightweight, read-only production
# monitoring for Choosify.
#
# Observes and reports only. Never restarts/repairs services,
# never mutates the database, never deploys applications, never
# modifies the booking-expiry or backup cron jobs.
#
# Exit codes: 0 = all checks healthy, 1 = warning, 2 = critical.
# ============================================================

RUN_DIR="/var/www/choosify/monitor"
LOCK_FILE="$RUN_DIR/monitor.lock"
LOG_FILE="$RUN_DIR/monitor.log"
NOTIFY_ENV="$RUN_DIR/monitor.env"   # optional, not committed, may not exist
LOG_MAX_BYTES=$((5 * 1024 * 1024))
LOG_KEEP_LINES=5000

BACKUP_DIR="/var/www/choosify/backups/postgres"
BOOKING_LOG="/data/choosify/runtime/booking-expire-cron.log"

DISK_WARN_PCT=80
DISK_CRIT_PCT=90
BACKUP_WARN_HOURS=30
BACKUP_CRIT_HOURS=48
BOOKING_WARN_HOURS=26
BOOKING_CRIT_HOURS=50
TLS_WARN_DAYS=21
TLS_CRIT_DAYS=7

SEVERITY=0
bump() { [ "$1" -gt "$SEVERITY" ] && SEVERITY="$1"; }

ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
log() {
  local line
  line=$(printf '[%s] [%s] %s' "$(ts)" "$1" "$2")
  echo "$line"
  echo "$line" >> "$LOG_FILE" 2>/dev/null || true
}

rotate_log_if_needed() {
  [ -f "$LOG_FILE" ] || return 0
  local size
  size=$(stat -c '%s' "$LOG_FILE" 2>/dev/null || echo 0)
  if [ "$size" -gt "$LOG_MAX_BYTES" ]; then
    tail -n "$LOG_KEEP_LINES" "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
    chmod 600 "$LOG_FILE"
    log INFO "monitor.log truncated to last ${LOG_KEEP_LINES} lines (exceeded ${LOG_MAX_BYTES} bytes)"
  fi
}

mkdir -p "$RUN_DIR"
chmod 700 "$RUN_DIR"
touch "$LOG_FILE"
chmod 600 "$LOG_FILE"
rotate_log_if_needed

exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  echo "[$(ts)] [WARN] Another monitor-production.sh run is already in progress. Exiting."
  exit 1
fi

log INFO "=== monitor-production.sh started ==="

http_check() {
  local name="$1" url="$2" want_ready="$3"
  local body code ok=0 attempt
  for attempt in 1 2 3; do
    body=$(curl -s -m 5 "$url" 2>/dev/null) || true
    code=$(curl -s -o /dev/null -m 5 -w '%{http_code}' "$url" 2>/dev/null) || true
    code="${code:-000}"
    if [ "$code" = "200" ]; then
      if [ "$want_ready" = "yes" ]; then
        if printf '%s' "$body" | grep -q '"readiness":"ready"'; then
          ok=1
          break
        fi
      else
        ok=1
        break
      fi
    fi
    sleep 2
  done
  if [ "$ok" = "1" ]; then
    log CHECK "$name: OK (http=$code)"
  else
    log ALERT "$name: FAILED after 3 attempts (last http=$code)"
    bump 2
  fi
}

http_check "Web local" "http://127.0.0.1:3000/" no
http_check "Web apex" "https://choosify.bd/" no
http_check "Web www" "https://www.choosify.bd/" no
http_check "Admin local /health" "http://127.0.0.1:3001/health" yes
http_check "Dashboard" "https://dashboard.choosify.bd/" no
http_check "Dashboard /health" "https://dashboard.choosify.bd/health" yes

svc_check() {
  local name="$1" unit="$2"
  if systemctl is-active --quiet "$unit"; then
    log CHECK "$name: active"
  else
    log ALERT "$name: NOT active"
    bump 2
  fi
}
svc_check "PostgreSQL" postgresql
svc_check "Nginx" nginx
svc_check "pm2-choosify.service" pm2-choosify

pm2_check() {
  local out app status
  out=$(pm2 jlist 2>/dev/null | node -e "
let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
  try {
    const j=JSON.parse(d);
    j.forEach(p=>console.log(p.name+'='+p.pm2_env.status));
  } catch(e) { console.log('PARSE_ERROR'); }
});" 2>/dev/null) || true
  for app in choosify-web choosify-admin; do
    status=$(printf '%s\n' "$out" | grep "^${app}=" | cut -d'=' -f2) || true
    if [ "$status" = "online" ]; then
      log CHECK "PM2 $app: online"
    else
      log ALERT "PM2 $app: status=${status:-unknown}"
      bump 2
    fi
  done
}
pm2_check

disk_check() {
  local line fs pct avail
  line=$(df -P /var/www/choosify | tail -n1) || true
  fs=$(echo "$line" | awk '{print $1}')
  pct=$(echo "$line" | awk '{print $5}' | tr -d '%')
  avail=$(echo "$line" | awk '{print $4}')
  if [ "$pct" -ge "$DISK_CRIT_PCT" ]; then
    log ALERT "Disk $fs: ${pct}% used (CRITICAL, avail=${avail}KB)"
    bump 2
  elif [ "$pct" -ge "$DISK_WARN_PCT" ]; then
    log WARN "Disk $fs: ${pct}% used (avail=${avail}KB)"
    bump 1
  else
    log CHECK "Disk $fs: ${pct}% used (avail=${avail}KB)"
  fi
}
disk_check

backup_check() {
  local newest mtime now age_h sumfile
  newest=$(ls -1t "$BACKUP_DIR"/choosify_daily_*.dump 2>/dev/null | head -n1) || true
  if [ -z "$newest" ]; then
    log ALERT "Backup: no choosify_daily_*.dump found in $BACKUP_DIR"
    bump 2
    return
  fi
  mtime=$(stat -c '%Y' "$newest")
  now=$(date +%s)
  age_h=$(( (now - mtime) / 3600 ))
  sumfile="${newest}.sha256"
  if [ ! -f "$sumfile" ]; then
    log ALERT "Backup: $(basename "$newest") missing .sha256"
    bump 2
    return
  fi
  if ! sha256sum -c "$sumfile" >/dev/null 2>&1; then
    log ALERT "Backup: checksum verification FAILED for $(basename "$newest")"
    bump 2
    return
  fi
  if ! pg_restore --list "$newest" >/dev/null 2>&1; then
    log ALERT "Backup: pg_restore --list FAILED to validate $(basename "$newest")"
    bump 2
    return
  fi
  if [ "$age_h" -ge "$BACKUP_CRIT_HOURS" ]; then
    log ALERT "Backup: newest valid backup is ${age_h}h old (CRITICAL, $(basename "$newest"))"
    bump 2
  elif [ "$age_h" -ge "$BACKUP_WARN_HOURS" ]; then
    log WARN "Backup: newest valid backup is ${age_h}h old ($(basename "$newest"))"
    bump 1
  else
    log CHECK "Backup: valid, ${age_h}h old ($(basename "$newest"))"
  fi
}
backup_check

booking_check() {
  local mtime now age_h last_line
  if [ ! -f "$BOOKING_LOG" ]; then
    log WARN "Booking cron: log file not found at $BOOKING_LOG (cannot assess)"
    bump 1
    return
  fi
  mtime=$(stat -c '%Y' "$BOOKING_LOG")
  now=$(date +%s)
  age_h=$(( (now - mtime) / 3600 ))
  last_line=$(tail -n1 "$BOOKING_LOG" 2>/dev/null)
  if [ "$age_h" -ge "$BOOKING_CRIT_HOURS" ]; then
    log ALERT "Booking cron: log not updated in ${age_h}h (CRITICAL -- cron may not be firing)"
    bump 2
  elif [ "$age_h" -ge "$BOOKING_WARN_HOURS" ]; then
    log WARN "Booking cron: log not updated in ${age_h}h"
    bump 1
  else
    if printf '%s' "$last_line" | grep -q '"success":true'; then
      log CHECK "Booking cron: last run fresh (${age_h}h ago) and reports success"
    else
      log WARN "Booking cron: log fresh (${age_h}h ago) but last line does not confirm success (best-effort check; see README known gap)"
      bump 1
    fi
  fi
}
booking_check

tls_check() {
  local host="$1" enddate epoch now days
  enddate=$(echo | timeout 8 openssl s_client -connect "${host}:443" -servername "$host" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d'=' -f2-) || true
  if [ -z "$enddate" ]; then
    log ALERT "TLS $host: unable to read certificate"
    bump 2
    return
  fi
  epoch=$(date -d "$enddate" +%s 2>/dev/null || echo 0)
  now=$(date +%s)
  days=$(( (epoch - now) / 86400 ))
  if [ "$days" -le "$TLS_CRIT_DAYS" ]; then
    log ALERT "TLS $host: expires in ${days}d (CRITICAL)"
    bump 2
  elif [ "$days" -le "$TLS_WARN_DAYS" ]; then
    log WARN "TLS $host: expires in ${days}d"
    bump 1
  else
    log CHECK "TLS $host: expires in ${days}d"
  fi
}
tls_check choosify.bd
tls_check www.choosify.bd
tls_check dashboard.choosify.bd

certbot_timer_check() {
  if systemctl is-active --quiet certbot.timer && systemctl is-enabled --quiet certbot.timer; then
    log CHECK "certbot.timer: active + enabled"
  else
    log ALERT "certbot.timer: not active/enabled"
    bump 2
  fi
}
certbot_timer_check

notify() {
  local sev="$1"
  if [ ! -f "$NOTIFY_ENV" ]; then
    log INFO "External alert delivery not configured (no $NOTIFY_ENV present) -- local log only"
    return
  fi
  ALERT_WEBHOOK_URL=""
  # shellcheck disable=SC1090
  source "$NOTIFY_ENV"
  if [ -z "${ALERT_WEBHOOK_URL:-}" ]; then
    log INFO "External alert delivery not configured (ALERT_WEBHOOK_URL empty) -- local log only"
    return
  fi
  local label="WARNING" payload
  [ "$sev" = "2" ] && label="CRITICAL"
  payload=$(printf '{"text":"[Choosify][%s] production monitor detected a %s condition at %s -- see monitor.log on the VPS"}' "$label" "$label" "$(ts)")
  if curl -s -m 5 -X POST -H 'Content-Type: application/json' -d "$payload" "$ALERT_WEBHOOK_URL" >/dev/null 2>&1; then
    log INFO "Notification sent ($label)"
  else
    log WARN "Notification attempt failed (webhook unreachable)"
  fi
  unset ALERT_WEBHOOK_URL
}

if [ "$SEVERITY" -ge 2 ]; then
  notify 2
fi

log INFO "=== monitor-production.sh finished (severity=$SEVERITY) ==="
exit "$SEVERITY"
