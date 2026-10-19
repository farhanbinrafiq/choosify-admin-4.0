import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { operationsStore } from '../operations/operationsStore';
import { scheduleOperationsPersist } from '../operations/operationsPersistence';
import type { OpsAccountActivity, OpsAccountActivityCategory } from '../operations/types';

/**
 * Account Activity Log — the per-account trail shown on the Seller / Creator
 * profile (to the owner and to Choosify staff): sign-ins (with IP, device and
 * location when the edge proxy provides it), security changes, account
 * changes and every staff action taken on the account. Stored in the
 * operations snapshot (additive collection, capped per account).
 *
 * Staff-performed entries keep the staff member's identity, IP and device in
 * staff-only fields; owners see them as "Choosify staff".
 */

const PER_ACCOUNT_CAP = 300;

export type ActivityActor = 'self' | 'staff' | 'system';

export type RecordActivityInput = {
  /** The account the entry belongs to (whose log it appears in). */
  userId: string;
  type: string;
  category: OpsAccountActivityCategory;
  summary: string;
  /** Who did it — defaults to the account owner. */
  actor?: ActivityActor;
  success?: boolean;
  /** Detail only Choosify staff can read (e.g. an internal reason). */
  staffNote?: string;
  /** Staff identity when it is not the request's own user (e.g. Login As exit). */
  staffActorId?: string;
  staffActorName?: string;
};

function clientIp(req?: Request): string | undefined {
  if (!req) return undefined;
  const raw = String(req.ip || req.socket?.remoteAddress || '').trim();
  return raw ? raw.replace(/^::ffff:/, '') : undefined;
}

/** Country / city from edge-proxy headers (Cloudflare, Vercel) when present. No GeoIP lookup is done. */
function edgeLocation(req?: Request): string | undefined {
  if (!req) return undefined;
  const h = (name: string) => {
    const v = req.get(name);
    return v ? decodeURIComponent(v).trim() : '';
  };
  const city = h('cf-ipcity') || h('x-vercel-ip-city');
  const country = h('cf-ipcountry') || h('x-vercel-ip-country');
  const parts = [city, country && country !== 'XX' ? country : ''].filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

/** Small, dependency-free user-agent summary: "Chrome 141 · Windows · Desktop". */
export function describeDevice(userAgent?: string): string | undefined {
  const ua = String(userAgent || '');
  if (!ua) return undefined;
  const pick = (re: RegExp) => ua.match(re)?.[1];
  let browser = 'Unknown browser';
  if (/Edg\//.test(ua)) browser = `Edge ${pick(/Edg\/(\d+)/) || ''}`;
  else if (/OPR\//.test(ua)) browser = `Opera ${pick(/OPR\/(\d+)/) || ''}`;
  else if (/SamsungBrowser\//.test(ua)) browser = `Samsung Internet ${pick(/SamsungBrowser\/(\d+)/) || ''}`;
  else if (/Firefox\//.test(ua)) browser = `Firefox ${pick(/Firefox\/(\d+)/) || ''}`;
  else if (/Chrome\//.test(ua)) browser = `${/HeadlessChrome/.test(ua) ? 'Headless Chrome' : 'Chrome'} ${pick(/Chrome\/(\d+)/) || ''}`;
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = `Safari ${pick(/Version\/(\d+)/) || ''}`;
  else if (/curl\//i.test(ua)) browser = 'curl';
  else if (/node|undici/i.test(ua)) browser = 'Script / API client';
  let os = '';
  if (/Windows NT/.test(ua)) os = 'Windows';
  else if (/Android/.test(ua)) os = `Android ${pick(/Android (\d+)/) || ''}`.trim();
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  const kind = /Mobi|iPhone|Android.+Mobile/.test(ua) ? 'Mobile' : /iPad|Tablet/.test(ua) ? 'Tablet' : os ? 'Desktop' : '';
  return [browser.trim(), os, kind].filter(Boolean).join(' · ');
}

export function recordAccountActivity(req: Request | undefined, input: RecordActivityInput): OpsAccountActivity | null {
  const userId = String(input.userId || '').trim();
  if (!userId || userId.startsWith('dev_')) return null;
  // Anything done while a staff member is signed in AS this account (Login As)
  // is a staff action, not the owner's.
  const impersonating = Boolean(req?.realActorUserId);
  const actor: ActivityActor = input.actor === 'self' || !input.actor ? (impersonating ? 'staff' : 'self') : input.actor;
  const userAgent = req?.get('user-agent') || undefined;
  const where = {
    ip: clientIp(req),
    device: describeDevice(userAgent),
    location: edgeLocation(req),
  };
  const entry: OpsAccountActivity = {
    id: `act_${randomUUID()}`,
    userId,
    at: new Date().toISOString(),
    type: input.type,
    category: input.category,
    summary: input.summary,
    actor,
    success: input.success !== false,
    // The owner's own IP / device / location; staff ones are kept staff-only.
    ...(actor === 'self' ? where : {}),
    ...(actor === 'staff'
      ? {
          staffActorId: input.staffActorId || req?.realActorUserId || req?.userId,
          // During Login As, req.user is the account itself — never label staff with it.
          staffActorName: input.staffActorName || (impersonating ? undefined : req?.user?.displayName || undefined),
          staffActorRole: (req?.realActorRole || req?.userRole) as string | undefined,
          staffIp: where.ip,
          staffDevice: where.device,
        }
      : {}),
    ...(input.staffNote || (impersonating && (input.actor || 'self') === 'self')
      ? { staffNote: [impersonating && (input.actor || 'self') === 'self' ? 'Done while signed in as this account (Login As).' : '', input.staffNote || ''].filter(Boolean).join(' ').slice(0, 500) }
      : {}),
  };
  try {
    operationsStore.addAccountActivity(entry, PER_ACCOUNT_CAP);
    scheduleOperationsPersist();
  } catch {
    // Activity logging must never break the action being logged.
  }
  return entry;
}

/** What the account owner may see — staff identities, IPs and notes removed. */
export function ownerView(entry: OpsAccountActivity): OpsAccountActivity {
  const { staffActorId: _a, staffActorName: _n, staffActorRole: _r, staffIp: _i, staffDevice: _d, staffNote: _s, ...rest } = entry;
  return rest;
}
