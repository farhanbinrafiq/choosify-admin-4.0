# Choosify VPS Operations Tooling

Reference copies of the production deployment, backup, and monitoring
scripts that run on the Choosify Hostinger VPS (`choosify.bd`,
`www.choosify.bd`, `dashboard.choosify.bd`). This directory is the
version-controlled source-of-truth for these scripts; it is not
automatically deployed or executed from here.

## Production host model

- Hostinger VPS, operator user: `choosify` (non-root)
- Nginx terminates TLS and reverse-proxies to two PM2-managed Node apps:
  - `choosify-web` (port 3000, loopback-only)
  - `choosify-admin` (port 3001, loopback-only)
- PostgreSQL runs locally on the VPS, not exposed externally
- PM2 persists across reboots via `pm2-choosify.service` (`pm2 resurrect`)

## Runtime script locations

These scripts actually execute from fixed paths outside both git
repositories, owned by `choosify:choosify`, mode `750`:

- `/var/www/choosify/deploy/deploy-web.sh`
- `/var/www/choosify/deploy/deploy-admin.sh`
- `/var/www/choosify/backup/backup-postgres.sh`
- `/var/www/choosify/backup/backup-catalog.sh`
- `/var/www/choosify/backup/backup-operations.sh`
- `/var/www/choosify/monitor/monitor-production.sh`

The copies in this directory (`scripts/ops/`) are reference/source copies
only. They are not symlinked to the runtime paths and are not executed
directly from within this repository checkout.

## Deployment markers

Each app's deploy script tracks "what's actually running" independently of
git HEAD, via a persistent marker file:

- `/var/www/choosify/deploy/state/web.deployed-commit`
- `/var/www/choosify/deploy/state/admin.deployed-commit`

**These marker files are runtime state and must never be committed to
either repository.** They exist only on the VPS.

## Deployment behavior (summary)

- Operator-invoked only; nothing deploys automatically
- `git fetch` against the actual repo, requires a clean working tree
- Fast-forward only (no merge, no rebase, no reset/clean)
- `npm ci` runs only if the target commit changed dependencies
- Restart is scoped to the single affected PM2 app
- Bounded health-check retries after restart
- Previous build artifact is retained (`.previous`) before a new build
- On health-check failure, the script automatically rolls back to the
  retained `.previous` artifact and restarts, without touching Nginx,
  PostgreSQL, or the firewall
- Admin deploys additionally run a migration guard: if the target commit
  touches `server/db/migrations/`, the deploy aborts before any
  git/build/restart action. Migrations are never applied automatically.

## Backup behavior (summary)

- Daily PostgreSQL custom-format dump (`pg_dump -Fc`) of the production
  database
- Archive integrity validated via `pg_restore --list` before the run is
  considered successful
- A SHA256 checksum is generated alongside each dump
- Local retention: latest 7 daily dumps only (matched by a dedicated
  `choosify_daily_` filename prefix, so it never touches manually created
  reference backups)
- A separately named, manually created and restore-tested reference backup
  is retained outside this rotation
- Never runs migrations, never restarts services, never modifies the live
  database

## Catalog backup behavior (summary)

`backup-catalog.sh` is a standalone, independently-runnable backup for the
production catalog memory-adapter snapshot
(`/var/www/choosify/admin/.data/catalog-memory-snapshot.json`) -- the sole
durability copy of products, categories, brands, creators (including
`marketplaceStatus`/`marketplaceAccess`), deals, guides, placements,
product details, brand posts, inventory, services, and homepage/site
config while `CATALOG_USE_FIRESTORE=false`. Kept deliberately separate
from `backup-postgres.sh`: different source, different validation
(JSON shape/key checks rather than `pg_restore --list`), different
restore semantics.

- Source JSON is validated (parses, is an object, has all expected
  `CatalogMemorySnapshot` top-level keys) *before* it is copied
- Copied to a temp file first, with a bounded 3-attempt retry if the
  source changes mid-copy (source hash compared before/after `cp`);
  the temp copy's JSON is validated again before it becomes final
- Finalized via atomic rename (`mv`), never a direct overwrite of the
  destination
- A SHA256 checksum is generated alongside each backup
- Local retention: latest 7 daily backups only (matched by a dedicated
  `catalog_daily_` filename prefix, so it never touches manually created
  reference copies)
- Never mutates or deletes the live snapshot (read-only `cp` of the
  source), never restarts services, never changes
  `CATALOG_USE_FIRESTORE`, never interacts with PostgreSQL, never
  restores automatically

## Operations backup behavior (summary)

`backup-operations.sh` is a standalone, independently-runnable backup for
the production operations memory-adapter snapshot
(`/data/choosify/runtime/operations-memory-snapshot.json`, path set via
`OPERATIONS_MEMORY_SNAPSHOT_PATH`) -- the sole durability copy of orders,
shipments, coupons, coupon usage, reviews, leads, job postings/applications,
permissions, feature flags, seller offers, fee charges, payment options
config, seller booking settings, returns, verifications, and warranty
claims while `OPERATIONS_USE_FIRESTORE=false`. Same fragile write pattern
as the catalog snapshot (direct overwrite, no fsync, debounced writes,
silent fallback-to-defaults on a corrupt/missing file) -- see QA3-002.
Kept deliberately separate from `backup-postgres.sh` and
`backup-catalog.sh`: different source, different schema, independently
runnable/debuggable.

**This is temporary protection only.** It backs up the existing fragile
store; it does not fix the underlying persistence model. The durable fix
is moving operations data to PostgreSQL, which has not been done.

- Source JSON is validated (parses, is an object, has all expected
  `OperationsSnapshot` top-level keys) *before* it is copied
- Copied to a temp file first, with a bounded 3-attempt retry if the
  source changes mid-copy (source hash compared before/after `cp`);
  the temp copy's JSON is validated again before it becomes final
- Finalized via atomic rename (`mv`), never a direct overwrite of the
  destination
- A SHA256 checksum is generated alongside each backup
- Local retention: latest 7 daily backups only (matched by a dedicated
  `operations_daily_` filename prefix, so it never touches manually
  created reference copies, Postgres backups, or catalog backups)
- Never mutates or deletes the live snapshot (read-only `cp` of the
  source), never restarts services, never changes
  `OPERATIONS_MEMORY_SNAPSHOT_PATH`, never interacts with PostgreSQL,
  never restores automatically -- restoring from a backup is a manual,
  operator-performed action only
- Never logs order/buyer/coupon/shipment contents -- only paths, sizes,
  filenames, and checksums

## Monitoring behavior (summary)

`monitor-production.sh` is a lightweight, read-only monitor. It never
restarts/repairs services, never mutates the database, and never deploys
or modifies application code. It runs on a schedule (see below) via cron,
independent of the deploy/backup jobs.

Checks performed each run:

- Web local (`127.0.0.1:3000`), public apex, public www — expect HTTP 200
- Admin local `/health` and public Dashboard `/health` — expect HTTP 200
  and `"readiness":"ready"` in the body
- Public Dashboard root — expect HTTP 200
- PostgreSQL, Nginx, and `pm2-choosify.service` — expect `active`
- `choosify-web` / `choosify-admin` PM2 process status — expect `online`
- Disk usage on the filesystem backing `/var/www/choosify` — warn at
  >= 80%, critical at >= 90%
- Freshness/integrity of the newest `choosify_daily_*.dump` backup
  (checksum verified, archive validated via `pg_restore --list`) — warn
  if no valid backup within 30 hours, critical within 48 hours
- Freshness/integrity of the newest `catalog_daily_*.json` backup
  (checksum verified, JSON parse validated) — reported as its own,
  separate check from the PostgreSQL backup check above — warn if no
  valid backup within 30 hours, critical within 48 hours
- Freshness/integrity of the newest `operations_daily_*.json` backup
  (checksum verified, JSON parse validated) — reported as its own check,
  separate from both the PostgreSQL and catalog backup checks — warn if
  no valid backup within 30 hours, critical within 48 hours
- Booking-expiry cron observability, on a best-effort basis (see gap
  below) — warn if the log hasn't updated in 26 hours, critical at 50
- TLS certificate expiry for all three hostnames — warn at <= 21 days,
  critical at <= 7 days
- `certbot.timer` — expect active and enabled

HTTP checks retry up to 3 times (with a short delay) before being
reported as failed, so a single transient blip does not trigger an
alert.

**Known observability gap:** `booking-expire-cron.sh` and its crontab
invocation are intentionally left unmodified (they are already-validated
production behavior). Its log contains only the raw endpoint response
with no timestamp or explicit success/failure marker of its own, so the
monitor infers freshness from the log file's mtime and does a best-effort
scan of the last line for `"success":true`. This cannot distinguish every
possible silent failure. A minimal future enhancement (not applied) would
be to prepend a timestamped run marker to that log without touching the
underlying script's request logic.

### Exit codes

- `0` — all checks healthy
- `1` — one or more warning-level conditions
- `2` — one or more critical/failure conditions

### Notification

The monitor only pages out on a critical (exit 2) condition, to avoid
alert noise. Delivery is controlled by an optional, uncommitted config
file at `/var/www/choosify/monitor/monitor.env` (mode `600`), which may
set `ALERT_WEBHOOK_URL` to an outbound webhook (e.g. Slack/Discord
incoming webhook). If that file or variable is absent, the monitor logs
that external delivery isn't configured and continues normally — nothing
fails or blocks on its absence.

As of this writing, no such file exists in production and **external
alert delivery is not yet configured**; monitoring output is local-log-only
until an operator supplies a dedicated webhook URL.

## Installation / update rule

Changes to these scripts are never auto-deployed from this repository.
Any future change to the runtime scripts must follow this order:

1. Modify the git-controlled source in `scripts/ops/`
2. Review the diff
3. Syntax-test (`bash -n`)
4. Test the change safely (dry-run / isolated environment, as applicable)
5. Copy the updated script deliberately to its runtime path
6. Verify the copied file's SHA256 matches the git-controlled source
7. Re-test runtime behavior before considering the update complete

There is intentionally no automatic sync between this directory and the
runtime paths.

## Secrets

- These scripts must never contain secret literals (database URLs,
  passwords, tokens, private keys). They read credentials at runtime from
  protected production configuration (`.env` files, mode `600`, never
  committed).
- `.env`, `.env.bak.*`, deploy markers, backup archives, backup logs, and
  lock files are runtime/generated artifacts and are not tracked here.
- `monitor.env` (optional webhook config for the monitor) follows the same
  rule: it is runtime configuration, lives only at
  `/var/www/choosify/monitor/monitor.env`, mode `600`, and is never
  committed.
