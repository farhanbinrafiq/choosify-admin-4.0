import type { Request } from 'express';
import { communicationStore } from './communicationStore';
import { logPreferenceChangeAudit } from './eventHooks';
import type { CommunicationPreferences } from './communicationTypes';

export function getPreferences(userId: string): CommunicationPreferences {
  return communicationStore.getPreferences(userId);
}

export function updatePreferences(
  userId: string,
  patch: Partial<Omit<CommunicationPreferences, 'userId' | 'updatedAt'>>,
  req?: Request,
): CommunicationPreferences {
  const updated = communicationStore.upsertPreferences(userId, {
    ...patch,
    systemRequired: true,
  });
  logPreferenceChangeAudit(userId, req);
  return updated;
}
