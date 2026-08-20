#!/usr/bin/env bash
# VPS replacement for the Vercel Cron entry in vercel.json
# ("/api/v1/booking/expire", schedule "0 0 * * *"). Vercel's crons config
# has no effect off Vercel — this script + a system scheduler (cron or
# systemd timer, see docs/HOSTINGER_CRON.md) is the equivalent for a
# Hostinger VPS deployment.
#
# Required env: CHOOSIFY_API_URL (e.g. https://dashboard.choosify.bd),
# CRON_SECRET (must match the API server's CRON_SECRET; if the server has
# no CRON_SECRET set, the endpoint is unprotected and this var may be
# empty — not recommended for a real deployment).
set -euo pipefail

: "${CHOOSIFY_API_URL:?CHOOSIFY_API_URL must be set (e.g. https://dashboard.choosify.bd)}"

curl_args=(
  --fail
  --silent
  --show-error
  --max-time 30
  -X POST
  "${CHOOSIFY_API_URL%/}/api/v1/booking/expire"
)

if [[ -n "${CRON_SECRET:-}" ]]; then
  curl_args+=(-H "Authorization: Bearer ${CRON_SECRET}")
fi

curl "${curl_args[@]}"
echo
