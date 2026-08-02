/**
 * Production env checklist for Choosify Admin / API on Vercel.
 *
 * Loads `.env` / `.env.local` when present (e.g. after `vercel env pull`), then
 * warns on prototype defaults and fails hard on critical misconfiguration.
 *
 * Run: npm run check:prod-env
 *
 * Exit codes:
 *   0 — no hard failures (warnings may still be printed)
 *   1 — ALLOWED_ORIGINS missing/empty, and/or ALLOW_DEV_LOGIN=true
 */
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';

loadDotenv({ path: resolve(process.cwd(), '.env.local') });
loadDotenv({ path: resolve(process.cwd(), '.env') });

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

type Finding = { level: 'warn' | 'fail'; key: string; message: string };

const findings: Finding[] = [];

function env(key: string): string | undefined {
  const raw = process.env[key];
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function warn(key: string, message: string): void {
  findings.push({ level: 'warn', key, message });
}

function fail(key: string, message: string): void {
  findings.push({ level: 'fail', key, message });
}

function looksLikeLocalOnlyOrigins(value: string): boolean {
  const parts = value
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return true;
  return parts.every(
    (origin) =>
      /localhost/i.test(origin) ||
      /127\.0\.0\.1/.test(origin) ||
      /0\.0\.0\.0/.test(origin),
  );
}

// ── Prototype-safe defaults that are production-unsafe ─────────────

const catalogFs = env('CATALOG_USE_FIRESTORE');
if (catalogFs !== 'true') {
  warn(
    'CATALOG_USE_FIRESTORE',
    `effective="${catalogFs ?? '(unset → false)'}" — catalog stays in-memory and resets on cold start. Set CATALOG_USE_FIRESTORE=true for production.`,
  );
}

const opsFs = env('OPERATIONS_USE_FIRESTORE');
if (opsFs !== 'true') {
  warn(
    'OPERATIONS_USE_FIRESTORE',
    `effective="${opsFs ?? '(unset → false)'}" — orders/reviews/coupons etc. stay in-memory. Set OPERATIONS_USE_FIRESTORE=true for production.`,
  );
}

const allowDevLogin = env('ALLOW_DEV_LOGIN');
if (allowDevLogin === 'true') {
  fail(
    'ALLOW_DEV_LOGIN',
    'ALLOW_DEV_LOGIN=true enables /auth/dev-login in production — refuse this for a real deployment. Set ALLOW_DEV_LOGIN=false or unset it.',
  );
} else if (allowDevLogin === undefined) {
  // Unset is safe at runtime (dev-login stays disabled when NODE_ENV=production),
  // but .env.example ships true — call out that production should set it explicitly.
  warn(
    'ALLOW_DEV_LOGIN',
    'unset — runtime treats this as disabled (OK), but set ALLOW_DEV_LOGIN=false explicitly in Vercel so it cannot drift.',
  );
}

const messagingMode = (env('MESSAGING_MODE') || 'mock').toLowerCase();
if (messagingMode === 'mock') {
  warn(
    'MESSAGING_MODE',
    `effective="${env('MESSAGING_MODE') ?? '(unset → mock)'}" — Meta/WhatsApp/IG delivery stays local-only. Set MESSAGING_MODE=live (+ Meta credentials) for production omnichannel.`,
  );
}

const aiEnabledRaw = env('AI_ENABLED');
const aiEnabled =
  aiEnabledRaw === undefined
    ? true // server/ai/config.ts readBoolEnv('AI_ENABLED', true)
    : aiEnabledRaw !== 'false' && aiEnabledRaw !== '0';
if (aiEnabledRaw === undefined) {
  warn(
    'AI_ENABLED',
    'unset — code defaults to AI_ENABLED=true. Set AI_ENABLED=true or false explicitly for production (and ensure GEMINI_API_KEY if enabled).',
  );
} else if (aiEnabled) {
  const provider = (env('AI_PROVIDER') || 'gemini').toLowerCase();
  if (provider === 'gemini' && !env('GEMINI_API_KEY')) {
    warn(
      'AI_ENABLED',
      'AI_ENABLED is on with AI_PROVIDER=gemini but GEMINI_API_KEY is missing — AI features will fail or degrade. Set GEMINI_API_KEY or AI_ENABLED=false.',
    );
  }
}

const allowedOrigins = env('ALLOWED_ORIGINS');
if (!allowedOrigins) {
  fail(
    'ALLOWED_ORIGINS',
    'ALLOWED_ORIGINS is missing — CORS falls back to localhost origins only. Set comma-separated production storefront + admin origins.',
  );
} else if (looksLikeLocalOnlyOrigins(allowedOrigins)) {
  warn(
    'ALLOWED_ORIGINS',
    `value looks like local-only defaults ("${allowedOrigins}"). Production must list real https origins (storefront + admin dashboard).`,
  );
}

// Supporting context (warn only) — needed for Firestore flags to actually work
if (
  (catalogFs === 'true' || opsFs === 'true') &&
  !env('FIREBASE_SERVICE_ACCOUNT_JSON') &&
  !env('GOOGLE_APPLICATION_CREDENTIALS')
) {
  warn(
    'FIREBASE_SERVICE_ACCOUNT_JSON',
    'Firestore flags are true but no Firebase Admin credentials were found (FIREBASE_SERVICE_ACCOUNT_JSON / GOOGLE_APPLICATION_CREDENTIALS). Persistence will not engage.',
  );
}

// ── Report ─────────────────────────────────────────────────────────

const warnings = findings.filter((f) => f.level === 'warn');
const failures = findings.filter((f) => f.level === 'fail');

console.log(`${BOLD}Choosify production env check${RESET}`);
console.log(`NODE_ENV=${env('NODE_ENV') ?? '(unset)'}`);
console.log('');

if (warnings.length === 0 && failures.length === 0) {
  console.log(`${GREEN}OK${RESET} — no prototype-default warnings and no hard failures.`);
  process.exit(0);
}

for (const f of warnings) {
  console.log(`${YELLOW}WARN${RESET}  [${f.key}] ${f.message}`);
}
for (const f of failures) {
  console.log(`${RED}FAIL${RESET}  [${f.key}] ${f.message}`);
}

console.log('');
console.log(
  `${BOLD}Summary:${RESET} ${warnings.length} warning(s), ${failures.length} failure(s).`,
);
if (failures.length > 0) {
  console.log(
    `${RED}${BOLD}Exiting non-zero:${RESET} fix ALLOWED_ORIGINS and/or ALLOW_DEV_LOGIN before treating this as production-ready.`,
  );
  process.exit(1);
}

console.log(
  `${YELLOW}Exiting zero with warnings:${RESET} review the items above in the Vercel Production environment.`,
);
process.exit(0);
