/**
 * How advertisers pay Choosify for an ad (bKash / Nagad / bank details), set by Choosify staff.
 * Stored next to the ads snapshot (same data folder), so each environment keeps its own.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { adsMemorySnapshotPath } from './adsPersistence';

export type AdPaymentSettings = { instructions: string; updatedAt?: string; updatedBy?: string };

const settingsPath = () => join(dirname(adsMemorySnapshotPath()), 'ads-payment-settings.json');

export function readAdPaymentSettings(): AdPaymentSettings {
  try {
    const p = settingsPath();
    if (!existsSync(p)) return { instructions: '' };
    const parsed = JSON.parse(readFileSync(p, 'utf8')) as AdPaymentSettings;
    return { instructions: typeof parsed.instructions === 'string' ? parsed.instructions : '', updatedAt: parsed.updatedAt, updatedBy: parsed.updatedBy };
  } catch {
    return { instructions: '' };
  }
}

export function writeAdPaymentSettings(next: AdPaymentSettings): AdPaymentSettings {
  const p = settingsPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(next, null, 2), 'utf8');
  return next;
}
