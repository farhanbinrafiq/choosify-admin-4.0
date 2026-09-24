/**
 * Canonical public business-inquiry registry (Suggest a Brand / Partnership /
 * Advertise / Contact). The server validates every submission against these
 * lists and serves them to the storefront, so form options can never drift
 * from what Choosify actually supports.
 */
import { AD_PLACEMENTS } from '../ads/placementRegistry';

export type InquiryType = 'suggest_brand' | 'partnership' | 'advertising' | 'general_contact';

export const INQUIRY_TYPES: Array<{ value: InquiryType; label: string; notificationTitle: string }> = [
  { value: 'suggest_brand', label: 'Brand Suggestion', notificationTitle: 'New Brand Suggestion' },
  { value: 'partnership', label: 'Partnership Request', notificationTitle: 'New Partnership Request' },
  { value: 'advertising', label: 'Advertising Inquiry', notificationTitle: 'New Advertising Inquiry' },
  { value: 'general_contact', label: 'General Contact', notificationTitle: 'New Contact Message' },
];

/**
 * Extends the pre-existing lead lifecycle (new/contacted/qualified/closed)
 * instead of renaming it, so leads captured before this change stay valid.
 * `closed` is presented as "Resolved".
 */
export type InquiryStatus = 'new' | 'reviewing' | 'contacted' | 'qualified' | 'closed' | 'rejected' | 'spam';

export const INQUIRY_STATUSES: Array<{ value: InquiryStatus; label: string }> = [
  { value: 'new', label: 'New' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'closed', label: 'Resolved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'spam', label: 'Spam' },
];

/** Only programs Choosify actually runs (seller/brand onboarding, creator onboarding). */
export const PARTNERSHIP_MODELS: Array<{ value: string; label: string }> = [
  { value: 'brand', label: 'Brand / Seller partnership' },
  { value: 'creator', label: 'Creator partnership' },
  { value: 'other', label: 'Other collaboration' },
];

/** Budget ranges only qualify a sales conversation; they create no pricing commitment. */
export const AD_BUDGET_RANGES: Array<{ value: string; label: string }> = [
  { value: 'under-50k', label: 'Under ৳50,000 / month' },
  { value: '50k-150k', label: '৳50,000 – ৳150,000 / month' },
  { value: '150k-500k', label: '৳150,000 – ৳500,000 / month' },
  { value: 'above-500k', label: 'Above ৳500,000 / month' },
  { value: 'not-sure', label: 'Not sure yet' },
];

export type AdPlacementInterest = { value: string; label: string; placementIds: string[] };

/**
 * One option per page that has at least one active slot in the canonical ads
 * placement registry, plus sponsored listings (Storefront Curation sponsor
 * types: sponsored product / brand / deal / recommendation) and "not sure".
 */
export function buildAdPlacementInterests(): AdPlacementInterest[] {
  const byPage = new Map<string, { label: string; slots: string[]; ids: string[] }>();
  for (const p of AD_PLACEMENTS) {
    if (!p.active) continue;
    const row = byPage.get(p.pageKey) ?? { label: p.pageLabel, slots: [], ids: [] };
    row.slots.push(p.slotLabel);
    row.ids.push(p.placementId);
    byPage.set(p.pageKey, row);
  }
  const pageOptions = [...byPage.entries()].map(([pageKey, row]) => ({
    value: `page:${pageKey}`,
    label: `${row.label} — ${[...new Set(row.slots)].join(', ')}`,
    placementIds: row.ids,
  }));
  return [
    ...pageOptions,
    { value: 'sponsored_listings', label: 'Sponsored products, brands, deals & recommendations', placementIds: [] },
    { value: 'not_sure', label: 'Not sure yet — recommend options', placementIds: [] },
  ];
}

export const INQUIRY_LIMITS = {
  name: 120,
  email: 254,
  url: 500,
  country: 80,
  subject: 160,
  message: 4000,
} as const;

export function inquiryTypeLabel(type: string | undefined): string {
  return INQUIRY_TYPES.find((t) => t.value === type)?.label ?? 'Inquiry';
}

export function inquiryStatusLabel(status: string | undefined): string {
  return INQUIRY_STATUSES.find((s) => s.value === status)?.label ?? String(status ?? '');
}
