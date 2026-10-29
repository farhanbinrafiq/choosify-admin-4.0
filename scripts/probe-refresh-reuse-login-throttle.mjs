// Refresh-token reuse detection + per-account login throttle. Run against an ISOLATED server on :3001 (never production); takes ~70 s (real 61 s wait).
const API = 'http://localhost:3001/api/v1';
let pass = 0, fail = 0;
const check = (l, c, d) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', l, c ? '' : String(d ?? '').slice(0, 220)); };
const PW = 'ChoosifyDev!2026';
const cookieOf = (r) => ((r.headers.get('set-cookie') || '').match(/choosify_refresh=([^;]*)/) || [])[1] || null;
async function login(email, password = PW) {
  const r = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  return { status: r.status, body: await r.json().catch(() => ({})), cookie: cookieOf(r), retryAfter: r.headers.get('retry-after') };
}
async function refresh(cookie) {
  const r = await fetch(API + '/auth/refresh', { method: 'POST', headers: { Cookie: `choosify_refresh=${cookie}` } });
  return { status: r.status, body: await r.json().catch(() => ({})), cookie: cookieOf(r) };
}
async function logout(cookie) {
  await fetch(API + '/auth/logout', { method: 'POST', headers: { Cookie: `choosify_refresh=${cookie}` } });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Refresh-token reuse ───────────────────────────────────────────────────
const SELLER = 'seller@choosify.com.bd';
const a = await login(SELLER); // device A
const b = await login(SELLER); // device B
check('two devices signed in', a.status === 200 && b.status === 200 && a.cookie && b.cookie);
const r1 = await refresh(a.cookie); // A: R0 -> R1
check('device A refreshes (R0 -> R1)', r1.status === 200 && r1.cookie);
const raceReplay = await refresh(a.cookie); // R0 again within the race window
check('R0 replayed at once (race window): refused', raceReplay.status === 401);
const r2 = await refresh(r1.cookie); // A's live token still works -> no mass revocation
check('race-window replay does NOT end sessions (R1 -> R2 works)', r2.status === 200 && r2.cookie, JSON.stringify(r2.body));
const l = await login(SELLER); // device L, then logs out
await logout(l.cookie);
console.log('… waiting 61 s to leave the race window');
await sleep(61_000);
const logoutReplay = await refresh(l.cookie);
check('logged-out token replayed later: refused', logoutReplay.status === 401);
const bAfterLogoutReplay = await refresh(b.cookie);
check('logged-out token replay does NOT end other sessions (device B still refreshes)', bAfterLogoutReplay.status === 200 && bAfterLogoutReplay.cookie, JSON.stringify(bAfterLogoutReplay.body));
const theft = await refresh(a.cookie); // R0, rotated > 60 s ago = copied cookie
check('rotated token replayed after 60 s: refused', theft.status === 401 && theft.body.code === 'AUTH_INVALID_TOKEN', JSON.stringify(theft.body));
const aAfter = await refresh(r2.cookie);
check('…and device A (current token R2) is signed out', aAfter.status === 401, aAfter.status);
const bAfter = await refresh(bAfterLogoutReplay.cookie);
check('…and device B is signed out too (all sessions ended)', bAfter.status === 401, bAfter.status);
const again = await login(SELLER);
check('the owner can sign in again normally', again.status === 200 && again.cookie);
const act = await fetch(API + `/operations/account-activity/${again.body.uid}`, { headers: { Authorization: 'Bearer ' + again.body.accessToken } }).then((r) => r.json()).catch(() => ({}));
const items = act.data?.items || act.data || act.items || [];
check('activity log tells the owner why', JSON.stringify(items).includes('old sign-in token was used again'), JSON.stringify(items).slice(0, 200));

// ── Per-account login throttle ────────────────────────────────────────────
const MOD = 'moderator@choosify.com.bd';
let lastWrong;
for (let i = 0; i < 9; i++) lastWrong = await login(MOD, 'wrong-password-' + i);
check('9 wrong passwords: still plain 401', lastWrong.status === 401, lastWrong.status);
const okAfter9 = await login(MOD);
check('correct password after 9 failures signs in (and clears the counter)', okAfter9.status === 200);
for (let i = 0; i < 10; i++) lastWrong = await login(MOD, 'wrong-password-b' + i);
check('10th wrong password still 401', lastWrong.status === 401, lastWrong.status);
const locked = await login(MOD);
check('after 10 failures even the correct password is paused (429)', locked.status === 429 && locked.body.code === 'ACCOUNT_LOGIN_THROTTLED' && Number(locked.retryAfter) > 0, JSON.stringify(locked.body) + ' retry-after=' + locked.retryAfter);
const other = await login('creator@choosify.com.bd');
check('a different account is not affected', other.status === 200);
const GHOST = `nobody-${Date.now()}@example.invalid`;
for (let i = 0; i < 10; i++) await login(GHOST, 'wrong-password-' + i);
const ghostLocked = await login(GHOST, 'wrong-password-z');
check('unknown email gets the same 429 (no account enumeration)', ghostLocked.status === 429 && ghostLocked.body.code === 'ACCOUNT_LOGIN_THROTTLED' && ghostLocked.body.error === locked.body.error.replace(/\d+ minute/, ghostLocked.body.error.match(/\d+ minute/)?.[0] || ''), JSON.stringify(ghostLocked.body));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
