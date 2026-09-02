/**
 * Deterministic (no-AI) extraction of a Manual Order draft from a Meta
 * conversation's recent CUSTOMER messages.
 *
 * V1 is label-first: because the "Request Order Details" macro asks the
 * customer to reply `Name:`, `Email:`, `Phone:` … we parse that shape
 * exactly, with a few loose fallbacks (a bare email, a bare BD phone,
 * "2 pcs"). Anything not clearly present is left blank and flagged
 * `needs_review`. Option values (Size/Color/Storage…) are only accepted
 * when they match the product's real canonical option values — never
 * invented from free text. This NEVER creates an order; it only drafts the
 * form the Seller then reviews.
 */

import { normalizeBdPhone, isPlausibleBdPhone, isPlausibleEmail } from './identityNormalizeClient';

export type GuessSource = 'conversation';
export interface FieldGuess<T = string> {
  value: T;
  source: GuessSource;
  confidence: 'high' | 'low';
}

export interface ExtractedOrderDraft {
  name?: FieldGuess;
  email?: FieldGuess;
  phone?: FieldGuess;
  address?: FieldGuess;
  quantity?: FieldGuess<number>;
  /** keyed by canonical option-group name → matched canonical value */
  options: Record<string, FieldGuess>;
  /** customer-stated tokens that did NOT match any canonical option value */
  unmatchedOptionValues: string[];
}

export interface ExtractOptionGroup {
  name: string;
  values: string[];
}

const LABELS: Record<string, keyof ExtractedOrderDraft | 'fullname'> = {
  name: 'fullname',
  'full name': 'fullname',
  fullname: 'fullname',
  email: 'email',
  'e-mail': 'email',
  phone: 'phone',
  'phone number': 'phone',
  mobile: 'phone',
  contact: 'phone',
  address: 'address',
  'delivery address': 'address',
  quantity: 'quantity',
  qty: 'quantity',
};

function labelledLines(text: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const m = rawLine.match(/^\s*([A-Za-z][A-Za-z /-]{1,24})\s*[:\-–]\s*(.+?)\s*$/);
    if (m) out.push([m[1].trim().toLowerCase(), m[2].trim()]);
  }
  return out;
}

export function extractOrderDraftFromMessages(
  messages: Array<{ body: string; fromCustomer: boolean }>,
  optionGroups: ExtractOptionGroup[] = [],
): ExtractedOrderDraft {
  const draft: ExtractedOrderDraft = { options: {}, unmatchedOptionValues: [] };

  // Only the customer's own messages, newest first, capped — never other
  // conversations, never past orders.
  const customerText = messages
    .filter((m) => m.fromCustomer && m.body)
    .slice(-8)
    .map((m) => m.body)
    .join('\n');
  if (!customerText.trim()) return draft;

  // 1. Labelled fields (high confidence).
  for (const [label, value] of labelledLines(customerText)) {
    const key = LABELS[label];
    if (!key || !value) continue;
    if (key === 'fullname' && !draft.name) {
      draft.name = { value, source: 'conversation', confidence: 'high' };
    } else if (key === 'email' && !draft.email && isPlausibleEmail(value)) {
      draft.email = { value: value.toLowerCase(), source: 'conversation', confidence: 'high' };
    } else if (key === 'phone' && !draft.phone) {
      const n = normalizeBdPhone(value);
      if (isPlausibleBdPhone(value)) {
        draft.phone = { value: n, source: 'conversation', confidence: 'high' };
      }
    } else if (key === 'address' && !draft.address) {
      draft.address = { value, source: 'conversation', confidence: 'high' };
    } else if (key === 'quantity' && !draft.quantity) {
      const q = Number.parseInt(value.replace(/[^\d]/g, ''), 10);
      if (Number.isFinite(q) && q > 0) {
        draft.quantity = { value: q, source: 'conversation', confidence: 'high' };
      }
    } else {
      // Labelled with an option-group name (Size:/Color:/Storage:…)
      const g = optionGroups.find((og) => og.name.toLowerCase() === label);
      if (g && !draft.options[g.name]) {
        const match = g.values.find((v) => v.toLowerCase() === value.toLowerCase());
        if (match) {
          draft.options[g.name] = { value: match, source: 'conversation', confidence: 'high' };
        } else {
          draft.unmatchedOptionValues.push(`${g.name}: ${value}`);
        }
      }
    }
  }

  // 2. Loose fallbacks (low confidence) for anything still missing.
  if (!draft.email) {
    const m = customerText.match(/[^\s@]+@[^\s@]+\.[^\s@]{2,}/);
    if (m && isPlausibleEmail(m[0])) {
      draft.email = { value: m[0].toLowerCase(), source: 'conversation', confidence: 'low' };
    }
  }
  if (!draft.phone) {
    const m = customerText.match(/(\+?880|0)1[3-9]\d[\d\s-]{6,}\d/);
    if (m) {
      const n = normalizeBdPhone(m[0]);
      if (isPlausibleBdPhone(m[0])) {
        draft.phone = { value: n, source: 'conversation', confidence: 'low' };
      }
    }
  }
  if (!draft.quantity) {
    const m = customerText.match(/\b(\d{1,3})\s*(?:pcs?|pieces?|units?|qty|x)\b/i);
    if (m) {
      const q = Number.parseInt(m[1], 10);
      if (q > 0) draft.quantity = { value: q, source: 'conversation', confidence: 'low' };
    }
  }

  // 3. Bare option tokens anywhere in the text → match canonical values only.
  for (const g of optionGroups) {
    if (draft.options[g.name]) continue;
    for (const v of g.values) {
      const re = new RegExp(`\\b${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (re.test(customerText)) {
        draft.options[g.name] = { value: v, source: 'conversation', confidence: 'low' };
        break;
      }
    }
  }

  return draft;
}
