import type { CurationEditor } from '../../shared/storefront/storefrontCuration';

/** "Last updated 25 Sept 2026, 14:05 by Super Admin" — from server-written placement metadata. */
export function lastUpdatedLabel(updatedAt?: string, updatedBy?: CurationEditor): string | null {
  if (!updatedAt) return null;
  const when = new Date(updatedAt).toLocaleString('en-GB', {
    timeZone: 'Asia/Dhaka',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const who = updatedBy?.name || (updatedBy?.id ? `user ${updatedBy.id.slice(0, 8)}` : '');
  return `Last updated ${when}${who ? ` by ${who}` : ''}`;
}
