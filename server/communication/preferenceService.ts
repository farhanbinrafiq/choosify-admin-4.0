/**
 * Notification preferences — Postgres (`notification_preferences`) is the
 * source of truth. One row per (user, persona); `in_app` stores only the events
 * the person has switched OFF (`{ "<eventKey>": false }`), so a missing key or a
 * missing row means "deliver" (today's default for every existing user).
 *
 * The legacy JSON communication snapshot is no longer read or written for
 * preferences: its channel/quiet-hours/digest fields never affected delivery,
 * and no production preference rows ever existed, so nothing is imported.
 */
import type { Request } from 'express';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client';
import { notificationPreferences } from '../db/schema';
import { logPreferenceChangeAudit } from './eventHooks';
import {
  NOTIFICATION_PERSONAS,
  controllableEventsForPersona,
  eventAppliesToRole,
  getNotificationEvent,
  isNotificationPersona,
  mandatoryEventsForPersona,
  personaForRole,
  type NotificationPersona,
} from '../../shared/notifications/notificationEvents';

export class PreferenceValidationError extends Error {
  readonly status = 400;
  constructor(message: string, readonly details?: string[]) {
    super(message);
    this.name = 'PreferenceValidationError';
  }
}

export type NotificationPreferenceView = {
  persona: NotificationPersona;
  availablePersonas: NotificationPersona[];
  /** Only meaningful on the `account` persona. */
  marketingOptIn: boolean;
  /** Whether a row exists (false = pure defaults). */
  saved: boolean;
  updatedAt: string | null;
  events: Array<{ key: string; label: string; description: string; group: string; enabled: boolean }>;
  mandatoryEvents: Array<{ key: string; label: string; description: string; group: string }>;
};

/** A person may manage their account-level row and the persona their role operates as. */
export function allowedPersonasForRole(role: string | null | undefined): NotificationPersona[] {
  return ['account', personaForRole(role)];
}

async function loadRow(userId: string, persona: NotificationPersona) {
  const rows = await db
    .select()
    .from(notificationPreferences)
    .where(and(eq(notificationPreferences.userId, userId), eq(notificationPreferences.persona, persona)))
    .limit(1);
  return rows[0] ?? null;
}

function disabledMap(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, boolean>;
}

function toView(
  persona: NotificationPersona,
  role: string | null | undefined,
  row: Awaited<ReturnType<typeof loadRow>>,
): NotificationPreferenceView {
  const inApp = disabledMap(row?.inApp);
  return {
    persona,
    availablePersonas: allowedPersonasForRole(role),
    marketingOptIn: row?.marketingOptIn ?? false,
    saved: Boolean(row),
    updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    events: controllableEventsForPersona(persona, role).map((e) => ({
      key: e.key,
      label: e.label,
      description: e.description,
      group: e.group,
      enabled: inApp[e.key] !== false,
    })),
    mandatoryEvents: mandatoryEventsForPersona(persona).map((e) => ({
      key: e.key,
      label: e.label,
      description: e.description,
      group: e.group,
    })),
  };
}

function resolvePersona(requested: unknown, role: string | null | undefined): NotificationPersona {
  const allowed = allowedPersonasForRole(role);
  if (requested === undefined || requested === null || requested === '') return personaForRole(role);
  if (!isNotificationPersona(requested)) {
    throw new PreferenceValidationError(`Unknown persona. Allowed: ${allowed.join(', ')}`);
  }
  if (!allowed.includes(requested)) {
    throw new PreferenceValidationError(`You cannot manage the "${requested}" persona. Allowed: ${allowed.join(', ')}`);
  }
  return requested;
}

export async function getPreferences(
  userId: string,
  role: string | null | undefined,
  requestedPersona?: unknown,
): Promise<NotificationPreferenceView> {
  const persona = resolvePersona(requestedPersona, role);
  return toView(persona, role, await loadRow(userId, persona));
}

/** Strict: unknown top-level fields (including any `userId`) are rejected. */
const UpdateBodySchema = z.strictObject({
  persona: z.enum(NOTIFICATION_PERSONAS),
  inApp: z.record(z.string(), z.boolean()).optional(),
  marketingOptIn: z.boolean().optional(),
});

export async function updatePreferences(
  userId: string,
  role: string | null | undefined,
  body: unknown,
  req?: Request,
): Promise<NotificationPreferenceView> {
  const parsed = UpdateBodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new PreferenceValidationError(
      'Invalid preference update',
      parsed.error.issues.map((i) => `${i.path.join('.') || '(body)'}: ${i.message}`),
    );
  }
  const persona = resolvePersona(parsed.data.persona, role);
  const patch = parsed.data.inApp ?? {};
  const patchKeys = Object.keys(patch);

  if (persona === 'account') {
    if (patchKeys.length) {
      throw new PreferenceValidationError('The account persona has no switchable notifications; use your role persona.');
    }
  } else if (parsed.data.marketingOptIn !== undefined) {
    throw new PreferenceValidationError('marketingOptIn is an account-level setting (persona "account").');
  }

  const problems: string[] = [];
  for (const key of patchKeys) {
    const event = getNotificationEvent(key);
    if (!event) problems.push(`${key}: unknown notification event`);
    else if (!(event.personas as readonly string[]).includes(persona)) {
      problems.push(`${key}: not a ${persona} notification`);
    } else if (event.mandatory) problems.push(`${key}: mandatory notifications cannot be changed`);
    else if (!eventAppliesToRole(event, role)) problems.push(`${key}: not sent to your role`);
  }
  if (problems.length) throw new PreferenceValidationError('Invalid notification keys', problems);

  const existing = await loadRow(userId, persona);
  const merged = { ...disabledMap(existing?.inApp), ...patch };
  // Persist only what is switched off — "missing" always means delivered.
  const inApp = Object.fromEntries(Object.entries(merged).filter(([, enabled]) => enabled === false));
  const marketingOptIn =
    persona === 'account' ? parsed.data.marketingOptIn ?? existing?.marketingOptIn ?? false : false;
  const now = new Date();

  const [row] = await db
    .insert(notificationPreferences)
    .values({ userId, persona, inApp, marketingOptIn, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [notificationPreferences.userId, notificationPreferences.persona],
      set: { inApp, marketingOptIn, updatedAt: now },
    })
    .returning();

  logPreferenceChangeAudit(userId, req);
  return toView(persona, role, row);
}

/**
 * Delivery gate used by createNotification. Mandatory (or unknown/un-keyed)
 * events are always delivered; otherwise only an explicit `false` for this
 * exact (user, persona, event) suppresses it — one persona's choices can
 * never affect another persona.
 */
export async function isInAppNotificationEnabled(
  userId: string,
  persona: NotificationPersona,
  eventKey: string,
): Promise<boolean> {
  const event = getNotificationEvent(eventKey);
  if (!event || event.mandatory) return true;
  const row = await loadRow(userId, persona);
  return disabledMap(row?.inApp)[eventKey] !== false;
}

export async function countUsersWithPreferences(): Promise<number> {
  const rows = await db.selectDistinct({ userId: notificationPreferences.userId }).from(notificationPreferences);
  return rows.length;
}
