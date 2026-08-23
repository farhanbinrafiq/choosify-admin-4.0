# Choosify VPS Operations Tooling

Reference copies of the production deployment and backup scripts that run on
the Choosify Hostinger VPS (`choosify.bd`, `www.choosify.bd`,
`dashboard.choosify.bd`). This directory is the version-controlled
source-of-truth for these scripts; it is not automatically deployed or
executed from here.

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
