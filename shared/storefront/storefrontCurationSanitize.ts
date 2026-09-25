/**
 * Structural sanitizers for the Storefront Curation placements. Pure — used by
 * the dedicated (Super Admin only) curation endpoints, the only write path.
 * Client-sent metadata (updatedAt/updatedBy) is never kept; the server writes
 * it. Entity existence/eligibility checks live server-side
 * (storefrontCurationService).
 */
import {
  ASSURANCE_ICONS,
  ASSURANCE_LIMITS,
  ASSURANCE_PLACEMENT_KEYS,
  ASSURANCE_TONES,
  CURATION_PLACEMENTS,
  CURATION_PLACEMENT_KEYS,
  type AssuranceIconKey,
  type AssuranceItem,
  type AssurancePlacementConfig,
  type AssurancePlacementKey,
  type AssuranceTone,
  type CurationPlacementConfig,
  type CurationPlacementKey,
} from './storefrontCuration';

const CONTROL_RE = /[\u0000-\u001F\u007F]/g;
const plain = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(CONTROL_RE, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export function isCurationPlacementKey(k: string): k is CurationPlacementKey {
  return (CURATION_PLACEMENT_KEYS as string[]).includes(k);
}
export function isAssurancePlacementKey(k: string): k is AssurancePlacementKey {
  return (ASSURANCE_PLACEMENT_KEYS as string[]).includes(k);
}

export function sanitizeCurationPlacement(key: CurationPlacementKey, raw: unknown): CurationPlacementConfig {
  const obj = isObj(raw) ? raw : {};
  const seen = new Set<string>();
  const items = (Array.isArray(obj.items) ? obj.items : [])
    .map((it) => (isObj(it) ? { entityId: plain(it.entityId, 120), enabled: it.enabled !== false } : null))
    .filter((it): it is { entityId: string; enabled: boolean } => !!it && !!it.entityId && !seen.has(it.entityId) && !!seen.add(it.entityId))
    .slice(0, CURATION_PLACEMENTS[key].max);
  return { enabled: obj.enabled !== false, items };
}

const ICON_KEYS = new Set<string>(ASSURANCE_ICONS.map((i) => i.key));
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

export function sanitizeAssurancePlacement(raw: unknown): AssurancePlacementConfig {
  const obj = isObj(raw) ? raw : {};
  const seen = new Set<string>();
  const items: AssuranceItem[] = [];
  for (const [idx, it] of (Array.isArray(obj.items) ? obj.items : []).entries()) {
    if (!isObj(it)) continue;
    const title = plain(it.title, ASSURANCE_LIMITS.title);
    if (!title) continue;
    let id = slug(plain(it.id, 40)) || slug(title) || `item-${idx + 1}`;
    while (seen.has(id)) id = `${id}-${idx + 1}`;
    seen.add(id);
    const icon = typeof it.icon === 'string' && ICON_KEYS.has(it.icon) ? (it.icon as AssuranceIconKey) : 'shield-check';
    const tone = typeof it.tone === 'string' && it.tone in ASSURANCE_TONES ? (it.tone as AssuranceTone) : 'slate';
    items.push({ id, title, description: plain(it.description, ASSURANCE_LIMITS.description), icon, tone, enabled: it.enabled !== false });
    if (items.length >= ASSURANCE_LIMITS.items) break;
  }
  return { enabled: obj.enabled !== false, items };
}
