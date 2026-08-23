#!/usr/bin/env bash
set -Eeuo pipefail

# ============================================================
# deploy-admin.sh -- manual, operator-invoked deployment for
# choosify-admin (Hostinger VPS).
#
# This script is NEVER triggered automatically (no CI, no git
# hook). It never runs database migrations -- if incoming
# changes touch server/db/migrations/, it refuses to proceed
# at all. It never touches .env, Nginx, TLS, UFW, SSH,
# PostgreSQL, cron, or Vercel.
#
# DEPLOYMENT STATE MARKER
# ------------------------------------------------------------
# /var/www/choosify/deploy/state/admin.deployed-commit records
# the commit that is ACTUALLY currently being served, which can
# differ from `git rev-parse HEAD`: if a build ever fails after
# a fast-forward, Git HEAD advances but the artifact is
# deliberately rolled back to the old build (see BUILD FAILURE
# HANDLING below) -- Git is never force-reset to match. Using
# local HEAD alone to decide "is there anything to deploy" would
# then wrongly report "nothing to deploy" on the next run, even
# though the running artifact is stale. The marker is the
# authoritative answer to "what is actually running"; local HEAD
# is only used for repository-integrity checks (clean, not
# ahead, fast-forwardable) and as the source of the diffs.
#
# The marker only advances on a confirmed-successful deploy
# (health checks passed). A rollback never touches the marker,
# since it restores exactly the artifact the marker already
# describes.
#
# Usage:
#   ./deploy-admin.sh              real deployment
#   ./deploy-admin.sh --dry-run    inspection only, no changes
# ============================================================

REPO_DIR="/var/www/choosify/admin"
APP_NAME="choosify-admin"
APP_PORT="3001"
ARTIFACT_DIR="dist"
ARTIFACT_ENTRY="dist/server.cjs"
LOCAL_HEALTH_URL="http://127.0.0.1:3001/health"
PUBLIC_URL_1="https://dashboard.choosify.bd"
PUBLIC_URL_2="https://dashboard.choosify.bd/health"
DEPLOY_ROOT="/var/www/choosify/deploy"
LOCK_FILE="$DEPLOY_ROOT/locks/deploy-admin.lock"
MARKER_FILE="$DEPLOY_ROOT/state/admin.deployed-commit"
HEALTH_ATTEMPTS=12
HEALTH_INTERVAL=2

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=1
fi

ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
log() { printf '[%s] [%s] %s\n' "$(ts)" "$1" "$2"; }

get_pm2_status() {
  pm2 jlist | node -e '
const fs=require("fs");
const apps=JSON.parse(fs.readFileSync(0,"utf8"));
const a=apps.find(x=>x.name==="'"$APP_NAME"'");
console.log(a ? ((a.pm2_env && a.pm2_env.status) || "unknown") : "MISSING");
'
}

# PM2 must never carry frozen copies of secrets/app-config as process-level
# env vars -- .env (read directly by the app via dotenv) is the sole
# authority. If PM2's own environment for this process already contains any
# of these keys, a prior `pm2 start`/`--update-env` captured a full shell
# snapshot (including .env-sourced values already exported into that
# shell), and every subsequent plain `pm2 restart` -- including this
# script's own -- reuses that frozen copy forever, silently ignoring any
# later .env change (this is exactly how a rotated DATABASE_URL and a
# changed JSON_BODY_LIMIT both failed to take effect in production).
check_pm2_env_hygiene() {
  local offenders
  offenders=$(pm2 jlist | node -e '
const fs = require("fs");
const SENSITIVE = ["DATABASE_URL","JWT_ACCESS_SECRET","JWT_REFRESH_SECRET","CRON_SECRET"];
const apps = JSON.parse(fs.readFileSync(0, "utf8"));
const app = apps.find(a => a.name === "'"$APP_NAME"'");
if (!app) { process.exit(0); }
const env = (app.pm2_env && app.pm2_env.env) || {};
SENSITIVE.filter(k => Object.prototype.hasOwnProperty.call(env, k)).forEach(k => console.log(k));
')
  if [ -n "$offenders" ]; then
    log ERROR "[CHECK] PM2 is carrying frozen application secret(s) for '$APP_NAME': $offenders"
    log ERROR "[CHECK] .env changes (including any future secret rotation) will silently NOT take effect on restart while this persists."
    log ERROR "[CHECK] Fix: pm2 delete '$APP_NAME' && (cd $REPO_DIR && pm2 start $ARTIFACT_ENTRY --name $APP_NAME) && pm2 save"
    log ERROR "[CHECK] Refusing to deploy on top of a stale PM2 environment. Fix this first, then re-run."
    exit 1
  fi
  log CHECK "PM2 environment for '$APP_NAME' carries no frozen application secrets."
}

check_listener() {
  ss -lntp 2>/dev/null | grep -qE "127\.0\.0\.1:${APP_PORT}[[:space:]]"
}

http_code() {
  # curl's own -w already prints "000" when no HTTP status was received
  # (connection refused, timeout, etc). Falling back with `|| echo "000"`
  # double-appends in that exact case, producing "000000" -- the fallback
  # below only fires if curl produced no output at all.
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 --max-time 10 "$1" 2>/dev/null)
  echo "${code:-000}"
}

http_code_and_ready() {
  local url="$1" body_file code ready
  body_file=$(mktemp)
  code=$(curl -s -o "$body_file" -w '%{http_code}' --connect-timeout 5 --max-time 10 "$url" 2>/dev/null)
  code="${code:-000}"
  if [ "$code" = "200" ] && grep -q '"readiness":"ready"' "$body_file" 2>/dev/null; then
    ready=1
  else
    ready=0
  fi
  rm -f "$body_file"
  echo "${code}:${ready}"
}

# ---- state used by the exit trap ----------------------------
# See the header comment: this only ever acts when the artifact
# directory is actually missing, which is only possible in the
# narrow window between the pre-build move-aside and a
# completed build (success or the explicit failure-handler both
# leave the directory present again), so this check is
# self-limiting and cannot misfire after any normal completion.
ARTIFACT_BACKED_UP=0

cleanup_on_exit() {
  local ec=$?
  if [ "$ARTIFACT_BACKED_UP" -eq 1 ] && [ ! -d "$REPO_DIR/$ARTIFACT_DIR" ]; then
    log ERROR "Unexpected termination while the artifact was mid-swap. Restoring previous artifact so production is never left pointing at a missing directory."
    rm -rf "$REPO_DIR/$ARTIFACT_DIR" 2>/dev/null || true
    if [ -d "$REPO_DIR/${ARTIFACT_DIR}.previous" ]; then
      mv "$REPO_DIR/${ARTIFACT_DIR}.previous" "$REPO_DIR/$ARTIFACT_DIR"
      log INFO "Previous artifact restored to $ARTIFACT_DIR. PM2 was not restarted by this trap -- the already-running process was never interrupted."
    else
      log ERROR "No .previous artifact was available to restore. Manual intervention required: pm2 status ; ls -la $REPO_DIR"
    fi
  fi
  exit $ec
}
trap cleanup_on_exit EXIT

# ---- health check helper (retry loop, used for post-restart) ---
wait_for_http() {
  local url="$1" attempts="$2" interval="$3" require_ready="${4:-0}"
  local i=1 code body_file
  while [ "$i" -le "$attempts" ]; do
    body_file=$(mktemp)
    code=$(curl -s -o "$body_file" -w '%{http_code}' --connect-timeout 5 --max-time 10 "$url" 2>/dev/null)
    code="${code:-000}"
    if [ "$code" = "200" ]; then
      if [ "$require_ready" -eq 1 ]; then
        if grep -q '"readiness":"ready"' "$body_file" 2>/dev/null; then
          rm -f "$body_file"
          return 0
        fi
      else
        rm -f "$body_file"
        return 0
      fi
    fi
    rm -f "$body_file"
    log HEALTH "Attempt $i/$attempts for $url not ready (http=$code), waiting ${interval}s..."
    sleep "$interval"
    i=$((i + 1))
  done
  return 1
}

run_all_health_checks() {
  log HEALTH "Checking local: $LOCAL_HEALTH_URL"
  wait_for_http "$LOCAL_HEALTH_URL" "$HEALTH_ATTEMPTS" "$HEALTH_INTERVAL" 1 || return 1
  log HEALTH "Local health check passed."
  log HEALTH "Checking public: $PUBLIC_URL_1"
  wait_for_http "$PUBLIC_URL_1" "$HEALTH_ATTEMPTS" "$HEALTH_INTERVAL" 0 || return 1
  log HEALTH "Checking public: $PUBLIC_URL_2"
  wait_for_http "$PUBLIC_URL_2" "$HEALTH_ATTEMPTS" "$HEALTH_INTERVAL" 1 || return 1
  log HEALTH "All public health checks passed."
  return 0
}

do_rollback() {
  log ROLLBACK "Beginning automatic application rollback for $APP_NAME..."
  if [ ! -d "$REPO_DIR/${ARTIFACT_DIR}.previous" ]; then
    log CRITICAL "No .previous artifact available -- cannot automatically roll back."
    log CRITICAL "Diagnostics: pm2 status ; pm2 logs $APP_NAME --lines 100"
    return 1
  fi
  rm -rf "$REPO_DIR/$ARTIFACT_DIR"
  cp -r "$REPO_DIR/${ARTIFACT_DIR}.previous" "$REPO_DIR/$ARTIFACT_DIR"
  log ROLLBACK "Restored previous artifact into $ARTIFACT_DIR (.previous kept intact)."
  pm2 restart "$APP_NAME"
  log ROLLBACK "Restarted $APP_NAME with the rolled-back artifact."

  if run_all_health_checks; then
    log INFO "[ROLLBACK SUCCESS]"
    log INFO "Git HEAD:          $(git rev-parse HEAD) (remains at the newer commit)"
    log INFO "Deployed marker:   $(cat "$MARKER_FILE" 2>/dev/null || echo 'unset') (unchanged -- correctly still describes what is running)"
    log INFO "Deployment state requires operator attention: Git is ahead of what is actually running. This was deliberate -- Git was never force-reset."
    return 0
  else
    log CRITICAL "=============================================="
    log CRITICAL "[CRITICAL] Rollback restart did not restore health."
    log CRITICAL "=============================================="
    log CRITICAL "No further automated action will be taken."
    log CRITICAL "Diagnostics:"
    log CRITICAL "  pm2 status"
    log CRITICAL "  pm2 logs $APP_NAME --lines 100"
    return 1
  fi
}

# ============================================================
# LOCKING -- independent per app
# ============================================================
mkdir -p "$(dirname "$LOCK_FILE")" "$(dirname "$MARKER_FILE")" 2>/dev/null || true
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  log ERROR "Another deploy-admin.sh run is already in progress. Aborting."
  exit 1
fi

log INFO "=== deploy-admin.sh started$( [ "$DRY_RUN" -eq 1 ] && echo ' (DRY RUN)' ) ==="

# ============================================================
# PRE-FLIGHT CHECKS -- read-only, abort on first failure
# ============================================================
[ -d "$REPO_DIR" ] || { log ERROR "[CHECK] Repository directory $REPO_DIR does not exist."; exit 1; }
cd "$REPO_DIR"
log CHECK "Repository directory exists: $REPO_DIR"

[ -d .git ] || { log ERROR "[CHECK] $REPO_DIR is not a git repository."; exit 1; }
log CHECK "Git repository confirmed."

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
[ "$CURRENT_BRANCH" = "main" ] || { log ERROR "[CHECK] Current branch is '$CURRENT_BRANCH', expected 'main'."; exit 1; }
log CHECK "Branch is main."

if [ -n "$(git status --porcelain)" ]; then
  log ERROR "[CHECK] Working tree is not clean:"
  git status --short
  exit 1
fi
log CHECK "Working tree is clean."

git remote get-url origin >/dev/null 2>&1 || { log ERROR "[CHECK] No 'origin' remote configured."; exit 1; }
log CHECK "origin remote exists: $(git remote get-url origin)"

log CHECK "Fetching origin..."
git fetch origin
log CHECK "Fetch succeeded."

git rev-parse origin/main >/dev/null 2>&1 || { log ERROR "[CHECK] origin/main does not exist."; exit 1; }
log CHECK "origin/main exists."

LOCAL_HEAD=$(git rev-parse HEAD)
TARGET_COMMIT=$(git rev-parse origin/main)

AHEAD_COUNT=$(git rev-list --count origin/main..HEAD)
if [ "$AHEAD_COUNT" -ne 0 ]; then
  log ERROR "[CHECK] Local HEAD is $AHEAD_COUNT commit(s) ahead of origin/main. Refusing to proceed -- needs manual review."
  exit 1
fi
log CHECK "Local HEAD is not ahead of origin/main."

if [ "$LOCAL_HEAD" != "$TARGET_COMMIT" ]; then
  if ! git merge-base --is-ancestor HEAD origin/main; then
    log ERROR "[CHECK] origin/main is not a descendant of local HEAD -- history has diverged. Refusing to fast-forward."
    exit 1
  fi
  log CHECK "origin/main is a fast-forwardable descendant of HEAD."
fi

for cmd in git npm node pm2 curl ss flock; do
  command -v "$cmd" >/dev/null 2>&1 || { log ERROR "[CHECK] Required command '$cmd' not found."; exit 1; }
done
log CHECK "Required commands present: git, npm, node, pm2, curl, ss, flock."

[ -f "$REPO_DIR/.env" ] || { log ERROR "[CHECK] Expected $REPO_DIR/.env does not exist."; exit 1; }
log CHECK ".env present (not inspected, not modified)."

[ -f "$REPO_DIR/$ARTIFACT_ENTRY" ] || { log ERROR "[CHECK] Expected current production artifact $ARTIFACT_ENTRY does not exist."; exit 1; }
log CHECK "Current production artifact present: $ARTIFACT_ENTRY"

PM2_STATUS=$(get_pm2_status)
[ "$PM2_STATUS" = "online" ] || { log ERROR "[CHECK] PM2 process '$APP_NAME' is not online (status=$PM2_STATUS)."; exit 1; }
log CHECK "PM2 process '$APP_NAME' is online."

check_pm2_env_hygiene

log INFO "LOCAL_HEAD=$LOCAL_HEAD"
log INFO "TARGET_COMMIT=$TARGET_COMMIT"

# ============================================================
# STATE MARKER BOOTSTRAP (only when the marker does not exist)
# ------------------------------------------------------------
# On first-ever run there is no record of what commit the
# running artifact corresponds to. We only initialize the
# marker to local HEAD if a full set of independent conditions
# ALL prove the current, already-running production is healthy
# and precisely matches origin/main -- otherwise we refuse to
# guess and stop for operator review. This is a one-time
# "bootstrap current known-good production commit" action, not
# a substitute for the deploy decision that follows it.
# ============================================================
if [ ! -f "$MARKER_FILE" ]; then
  log INFO "[BOOTSTRAP] No deployment marker found at $MARKER_FILE -- running one-time bootstrap check."
  BOOTSTRAP_OK=1

  if [ -n "$(git status --porcelain)" ]; then
    log ERROR "[BOOTSTRAP] working tree is not clean."
    BOOTSTRAP_OK=0
  fi
  if [ "$LOCAL_HEAD" != "$TARGET_COMMIT" ]; then
    log ERROR "[BOOTSTRAP] HEAD ($LOCAL_HEAD) does not equal origin/main ($TARGET_COMMIT)."
    BOOTSTRAP_OK=0
  fi
  if [ "$(get_pm2_status)" != "online" ]; then
    log ERROR "[BOOTSTRAP] PM2 $APP_NAME is not online."
    BOOTSTRAP_OK=0
  fi
  if [ ! -f "$REPO_DIR/$ARTIFACT_ENTRY" ]; then
    log ERROR "[BOOTSTRAP] expected compiled artifact $ARTIFACT_ENTRY is missing."
    BOOTSTRAP_OK=0
  fi
  if ! check_listener; then
    log ERROR "[BOOTSTRAP] no listener found on 127.0.0.1:$APP_PORT."
    BOOTSTRAP_OK=0
  fi
  LOCAL_CHECK=$(http_code_and_ready "$LOCAL_HEALTH_URL")
  if [ "${LOCAL_CHECK%%:*}" != "200" ] || [ "${LOCAL_CHECK##*:}" != "1" ]; then
    log ERROR "[BOOTSTRAP] local /health did not return 200/ready (got $LOCAL_CHECK)."
    BOOTSTRAP_OK=0
  fi
  PUB1_CODE=$(http_code "$PUBLIC_URL_1")
  if [ "$PUB1_CODE" != "200" ]; then
    log ERROR "[BOOTSTRAP] public dashboard did not return 200 (got $PUB1_CODE)."
    BOOTSTRAP_OK=0
  fi
  PUB2_CHECK=$(http_code_and_ready "$PUBLIC_URL_2")
  if [ "${PUB2_CHECK%%:*}" != "200" ] || [ "${PUB2_CHECK##*:}" != "1" ]; then
    log ERROR "[BOOTSTRAP] public dashboard /health did not return 200/ready (got $PUB2_CHECK)."
    BOOTSTRAP_OK=0
  fi

  if [ "$BOOTSTRAP_OK" -ne 1 ]; then
    log ERROR "[BOOTSTRAP] One or more conditions failed. Refusing to initialize the deployment marker blindly."
    log ERROR "[BOOTSTRAP] No changes have been made. Resolve the discrepancy above and re-run."
    exit 1
  fi

  echo "$LOCAL_HEAD" > "$MARKER_FILE"
  log SUCCESS "[BOOTSTRAP] All conditions passed. Initialized $MARKER_FILE = $LOCAL_HEAD (bootstrap current known-good production commit)."
fi

MARKER_COMMIT=$(cat "$MARKER_FILE")
log INFO "MARKER_COMMIT=$MARKER_COMMIT (this, not local HEAD, is what decides whether a deploy is needed)"

# ============================================================
# NO-CHANGE SHORT CIRCUIT (based on the marker, not local HEAD)
# ============================================================
if [ "$MARKER_COMMIT" = "$TARGET_COMMIT" ]; then
  log INFO "Already at origin/main -- nothing to deploy."
  exit 0
fi

# ============================================================
# INCOMING CHANGE INSPECTION -- diffed from the marker (the
# true last-deployed state), not from local HEAD, so a retry
# after a previously failed build still picks up everything
# that changed since what is actually still running.
# ============================================================
DEP_FILES_CHANGED=$(git diff --name-only "$MARKER_COMMIT" "$TARGET_COMMIT" -- package.json package-lock.json)
if [ -n "$DEP_FILES_CHANGED" ]; then
  DEPS_CHANGED=1
  log INFO "Dependency files changed: $(echo "$DEP_FILES_CHANGED" | tr '\n' ' ') -- npm ci will run."
else
  DEPS_CHANGED=0
  log INFO "No dependency file changes detected -- npm ci will be skipped."
fi

MIGRATION_FILES_CHANGED=$(git diff --name-only "$MARKER_COMMIT" "$TARGET_COMMIT" -- server/db/migrations/)
if [ -n "$MIGRATION_FILES_CHANGED" ]; then
  log ERROR "=============================================="
  log ERROR "[MIGRATION REQUIRED]"
  log ERROR "=============================================="
  log ERROR "This deployment includes changes under server/db/migrations/:"
  while IFS= read -r f; do
    [ -n "$f" ] && log ERROR "  - $f"
  done <<< "$MIGRATION_FILES_CHANGED"
  log ERROR "This script deliberately never runs database migrations."
  log ERROR "A separate, migration-aware deployment procedure (with a"
  log ERROR "pre-migration backup and manual review) is required before"
  log ERROR "this code can be deployed."
  log ERROR "No changes have been made -- Git was not fast-forwarded, the marker was not touched."
  exit 1
fi
log CHECK "No migration file changes detected."

if [ "$DRY_RUN" -eq 1 ]; then
  if [ "$LOCAL_HEAD" != "$TARGET_COMMIT" ]; then
    log INFO "--dry-run: would fast-forward $LOCAL_HEAD -> $TARGET_COMMIT"
  else
    log INFO "--dry-run: local HEAD already at target; would skip fast-forward and retry build/restart (marker is stale, likely from a previously failed build)"
  fi
  [ "$DEPS_CHANGED" -eq 1 ] && log INFO "--dry-run: would run npm ci (dependency files changed)"
  log INFO "--dry-run: would build, restart $APP_NAME, health-check, then advance marker to $TARGET_COMMIT."
  log INFO "--dry-run: running CURRENT health checks only (no modification)..."
  if run_all_health_checks; then
    log SUCCESS "--dry-run: current production is healthy."
  else
    log ERROR "--dry-run: current production health check failed (unrelated to this dry run -- investigate separately)."
    exit 1
  fi
  log INFO "--dry-run complete. Nothing was modified."
  exit 0
fi

# ============================================================
# FAST-FORWARD (only if local HEAD is not already at target)
# ============================================================
if [ "$LOCAL_HEAD" != "$TARGET_COMMIT" ]; then
  log INFO "Fast-forwarding $LOCAL_HEAD -> $TARGET_COMMIT"
  git merge --ff-only origin/main
  log INFO "Fast-forward complete. HEAD is now $(git rev-parse HEAD)"
else
  log INFO "Local HEAD already at target commit; skipping fast-forward. Retrying build/restart for a stale marker."
fi
NEW_COMMIT=$(git rev-parse HEAD)

# ============================================================
# DEPENDENCIES
# ============================================================
if [ "$DEPS_CHANGED" -eq 1 ]; then
  log INFO "Running npm ci..."
  if ! npm ci; then
    log ERROR "npm ci failed. Git HEAD is at $NEW_COMMIT but the artifact/PM2 process and deployment marker are untouched."
    log ERROR "Git HEAD:          $NEW_COMMIT"
    log ERROR "Deployed marker:   $MARKER_COMMIT (unchanged)"
    log ERROR "Deployment state requires operator attention."
    exit 1
  fi
  log INFO "npm ci succeeded."
else
  log INFO "Skipping npm ci (no dependency file changes)."
fi

# ============================================================
# BUILD ARTIFACT BACKUP
# ============================================================
log INFO "Backing up current artifact before build..."
rm -rf "$REPO_DIR/${ARTIFACT_DIR}.previous"
mv "$REPO_DIR/$ARTIFACT_DIR" "$REPO_DIR/${ARTIFACT_DIR}.previous"
ARTIFACT_BACKED_UP=1
log INFO "Moved $ARTIFACT_DIR -> ${ARTIFACT_DIR}.previous (retained as rollback target)."

# ============================================================
# BUILD
# ============================================================
log BUILD "Running npm run build..."
BUILD_LOG=$(mktemp)
if npm run build > "$BUILD_LOG" 2>&1; then
  BUILD_OK=1
else
  BUILD_OK=0
fi

if [ "$BUILD_OK" -eq 0 ] || [ ! -f "$REPO_DIR/$ARTIFACT_ENTRY" ]; then
  log ERROR "Build failed or did not produce $ARTIFACT_ENTRY. Last 40 lines of build output:"
  tail -40 "$BUILD_LOG"
  rm -f "$BUILD_LOG"
  log ERROR "Restoring previous artifact because the build failed."
  rm -rf "$REPO_DIR/$ARTIFACT_DIR"
  mv "$REPO_DIR/${ARTIFACT_DIR}.previous" "$REPO_DIR/$ARTIFACT_DIR"
  ARTIFACT_BACKED_UP=0
  log ERROR "Previous artifact restored. PM2 was NOT restarted -- the already-running process is still serving the previously loaded build."
  log ERROR "Git HEAD:          $NEW_COMMIT"
  log ERROR "Deployed marker:   $MARKER_COMMIT (unchanged -- still correctly describes what is running)"
  log ERROR "Deployment state requires operator attention: Git is ahead of what is running. Re-running this script later will retry the build using the marker, without needing to re-fetch."
  exit 1
fi
rm -f "$BUILD_LOG"
log BUILD "Build succeeded. $ARTIFACT_ENTRY present."

# ============================================================
# api/index.js RESTORATION (admin only)
#
# admin's `npm run build` also regenerates the git-tracked
# api/index.js (a dormant Vercel serverless bundle -- never
# executed by PM2/VPS production, which runs dist/server.cjs).
# Every build re-minifies it slightly differently even with no
# meaningful source change, which would otherwise leave the
# repo permanently dirty after every deploy. This restores
# ONLY that one file to exactly what Git has tracked at the
# new HEAD -- a targeted `git checkout -- <path>` with an
# explicit single pathspec, NOT the banned bare
# `git checkout .` (which would discard the whole tree). This
# has zero effect on the running application, so failure here
# is logged loudly but is not treated as fatal to the deploy.
# ============================================================
log INFO "Restoring api/index.js to the version tracked at the new HEAD (dormant Vercel artifact, not used by VPS production)."
if ! git checkout -- api/index.js; then
  log ERROR "git checkout -- api/index.js failed. This does not affect the running application (api/index.js is never executed on this VPS), so the deploy continues -- but the repository is not fully clean. Investigate separately."
elif [ -n "$(git status --porcelain -- api/index.js)" ]; then
  log ERROR "api/index.js still shows as modified after restoration -- unexpected. This does not affect the running application, but the repository is not fully clean. Investigate separately."
else
  log INFO "api/index.js restored cleanly; repository will remain clean after this deploy."
fi

# ============================================================
# PM2 RESTART -- affected app only
# ============================================================
log RESTART "Restarting $APP_NAME..."
pm2 restart "$APP_NAME"
log RESTART "$APP_NAME restarted."

# ============================================================
# HEALTH CHECKS
# ============================================================
if run_all_health_checks; then
  echo "$NEW_COMMIT" > "$MARKER_FILE"
  log SUCCESS "=============================================="
  log SUCCESS "Deployment succeeded."
  log SUCCESS "Old marker:    $MARKER_COMMIT"
  log SUCCESS "New marker:    $NEW_COMMIT"
  log SUCCESS "Deps changed:  $( [ "$DEPS_CHANGED" -eq 1 ] && echo yes || echo no )"
  log SUCCESS "=============================================="
  exit 0
else
  log ERROR "Health checks failed after restart."
  do_rollback
  exit 1
fi
