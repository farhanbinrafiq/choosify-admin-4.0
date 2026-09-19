/**
 * Choosify Platform Reference ID — canonical prefix registry + formatting.
 * Display/search/support identifiers only. Internal UUIDs remain authoritative.
 */

export type ReferenceEntityType =
  | 'user'
  | 'brand'
  | 'product'
  | 'content'
  | 'order'
  | 'invoice'
  | 'return'
  | 'refund'
  | 'advertisement'
  | 'deal'
  | 'payment'
  | 'escrow'
  | 'conversation'
  | 'cashbook'
  /** Sprint 12 — Subscription billing documents. Deliberately a SEPARATE series from 'invoice' (commerce sub-order invoices) — different business document, not to be conflated. */
  | 'subscriptionInvoice'
  /** Warranty & Claims — the WC-##### canonical claim id. Deliberately separate from 'return' (RT), a different case type. */
  | 'warrantyClaim';

export const REFERENCE_PREFIX: Record<ReferenceEntityType, string> = {
  user: 'CF',
  brand: 'BR',
  product: 'PR',
  content: 'CT',
  order: 'OR',
  invoice: 'INV',
  return: 'RT',
  refund: 'RF',
  advertisement: 'AD',
  deal: 'DL',
  payment: 'PAY',
  escrow: 'ESC',
  conversation: 'CV',
  cashbook: 'CB',
  subscriptionInvoice: 'SINV',
  warrantyClaim: 'WC',
};

export const REFERENCE_FIELD: Record<ReferenceEntityType, string> = {
  user: 'choosifyUserId',
  brand: 'brandReferenceId',
  product: 'productReferenceId',
  content: 'contentReferenceId',
  order: 'orderReferenceId',
  invoice: 'invoiceReferenceId',
  return: 'returnReferenceId',
  refund: 'refundReferenceId',
  advertisement: 'advertisementReferenceId',
  deal: 'dealReferenceId',
  payment: 'paymentReferenceId',
  escrow: 'escrowReferenceId',
  conversation: 'conversationReferenceId',
  cashbook: 'cashbookReferenceId',
  /** Field name only for consistency with the map's shape — subscription_billing_documents.reference_id is written directly at creation, never backfilled onto an existing row. */
  subscriptionInvoice: 'referenceId',
  /** Field name only — warranty claims live in the operations JSON store (OpsWarrantyClaim.referenceId), not a Postgres column. */
  warrantyClaim: 'referenceId',
};

export const REFERENCE_ENTITY_TYPES = Object.keys(REFERENCE_PREFIX) as ReferenceEntityType[];

const MIN_PAD = 5;

const PREFIX_TO_TYPE: Record<string, ReferenceEntityType> = Object.fromEntries(
  (Object.entries(REFERENCE_PREFIX) as Array<[ReferenceEntityType, string]>).map(([t, p]) => [
    p.toUpperCase(),
    t,
  ]),
);

export function formatReferenceId(entityType: ReferenceEntityType, sequence: number): string {
  const n = Math.floor(Number(sequence));
  if (!Number.isFinite(n) || n < 1) {
    throw new Error(`Invalid reference sequence for ${entityType}: ${sequence}`);
  }
  const prefix = REFERENCE_PREFIX[entityType];
  const body = n < 10 ** MIN_PAD ? String(n).padStart(MIN_PAD, '0') : String(n);
  return `${prefix}-${body}`;
}

export function sequenceFromReferenceId(refId: string): number {
  const parsed = parseReferenceId(refId);
  if (!parsed) return 0;
  return parsed.sequence;
}

export type ParsedReferenceId = {
  entityType: ReferenceEntityType;
  prefix: string;
  sequence: number;
  canonical: string;
};

/** Parse CF-00127 / br-27 / PR-100000 → canonical. */
export function parseReferenceId(raw: string): ParsedReferenceId | null {
  const trimmed = String(raw || '').trim().toUpperCase();
  if (!trimmed) return null;
  const m = trimmed.match(/^([A-Z]+)-(\d+)$/);
  if (!m) return null;
  const prefix = m[1];
  const entityType = PREFIX_TO_TYPE[prefix];
  if (!entityType) return null;
  const sequence = Number(m[2].replace(/^0+/, '') || '0');
  if (!Number.isFinite(sequence) || sequence < 1) return null;
  return {
    entityType,
    prefix: REFERENCE_PREFIX[entityType],
    sequence,
    canonical: formatReferenceId(entityType, sequence),
  };
}

export function normalizeReferenceIdQuery(
  raw: string,
  hintType?: ReferenceEntityType,
): string | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  const parsed = parseReferenceId(trimmed);
  if (parsed) {
    if (hintType && parsed.entityType !== hintType) return null;
    return parsed.canonical;
  }
  // Domain-scoped bare digits only when hint provided (never for global search).
  if (hintType && /^\d+$/.test(trimmed)) {
    const n = Number(trimmed.replace(/^0+/, '') || '0');
    if (!Number.isFinite(n) || n < 1) return null;
    return formatReferenceId(hintType, n);
  }
  return null;
}

export function isCanonicalReferenceId(value: string, entityType?: ReferenceEntityType): boolean {
  const parsed = parseReferenceId(value);
  if (!parsed) return false;
  if (entityType && parsed.entityType !== entityType) return false;
  return parsed.canonical === String(value).trim().toUpperCase();
}
