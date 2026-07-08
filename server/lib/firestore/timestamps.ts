import { FieldValue, Timestamp } from 'firebase-admin/firestore';

export function serverTimestamp() {
  return FieldValue.serverTimestamp();
}

export function isoNow(): string {
  return new Date().toISOString();
}

export function timestampToIso(value: Timestamp | string | undefined): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  return value.toDate().toISOString();
}
