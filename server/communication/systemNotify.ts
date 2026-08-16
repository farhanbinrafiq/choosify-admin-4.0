/**
 * Sprint 11 — thin helper for system-triggered notifications to a role (not a
 * human-authored admin broadcast, which stays on the existing
 * createBroadcast/sendBroadcast draft-then-send flow). Reuses the canonical
 * createNotification function — this does not duplicate nav-attention, it
 * complements it: nav-attention answers "how many things need attention right
 * now" from live queries; this answers "something specific just happened."
 */
import { inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { users, roleEnum } from '../db/schema';
import { createNotification } from './notificationService';
import type { NotificationCategory, NotificationInput } from './communicationTypes';

type SchemaUserRole = (typeof roleEnum.enumValues)[number];

export async function notifyRoles(
  roles: SchemaUserRole[],
  input: Omit<NotificationInput, 'userId'> & { category: NotificationCategory },
): Promise<void> {
  if (roles.length === 0) return;
  const rows = await db.select({ id: users.id }).from(users).where(inArray(users.role, roles));
  for (const row of rows) {
    await createNotification({ ...input, userId: row.id });
  }
}

export async function notifyUser(userId: string, input: Omit<NotificationInput, 'userId'>): Promise<void> {
  if (!userId) return;
  await createNotification({ ...input, userId });
}
