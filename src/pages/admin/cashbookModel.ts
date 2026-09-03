/**
 * Cashbook — pure helpers (no React, no fetch). Shared by CashBookHub + probes.
 * Visual language: reuses the Order Hub radius/token system (orderHubChrome.S)
 * so Hub → Ledger feels like one product.
 */
import type { CashbookEntry, CashbookListItem } from '../../services/cashbookApi';

/** Classification categories — from the approved standalone Cashbook reference. */
export const CASHBOOK_CATEGORIES = [
  'Sales',
  'Inventory',
  'Salary',
  'Transport',
  'Utilities',
  'Marketing',
  'Rent',
  'Commission',
  'Sponsorship',
  'Affiliate',
  'Refund',
  'Tax',
  'Miscellaneous',
  'Loan',
  'Investment',
] as const;

/** Payment channels — from the approved standalone Cashbook reference. */
export const CASHBOOK_PAYMENT_MODES = ['Bank Transfer', 'bKash', 'Nagad', 'Cash (Manual)'] as const;

export const CASHBOOK_ICON_CHOICES = ['📒', '🛒', '🛍️', '💼', '🧵', '🎥', '✨', '📦', '🏦', '🎨'];
export const CASHBOOK_COLOR_CHOICES = [
  '#FF5B00',
  '#EF3C23',
  '#18154C',
  '#16A34A',
  '#2563EB',
  '#7C3AED',
  '#0891B2',
  '#64748B',
];

/** A Commerce order can be imported once it represents a real accounting event. */
export function isImportEligibleStatus(status: string | undefined | null): boolean {
  const s = String(status || '').toLowerCase();
  return s === 'delivered' || s === 'completed';
}

export function entryDirection(entry: Pick<CashbookEntry, 'amount'>): 'in' | 'out' {
  return entry.amount < 0 ? 'out' : 'in';
}

export type LedgerRow = { entry: CashbookEntry; running: number };

/**
 * Attach a running balance to each entry. Balance accrues in chronological
 * order (oldest → newest); the returned rows are newest-first for display but
 * each carries the running balance AT that entry.
 */
export function withRunningBalance(entries: CashbookEntry[]): LedgerRow[] {
  const chrono = [...entries].sort((a, b) => {
    const ka = a.entryDate || a.createdAt;
    const kb = b.entryDate || b.createdAt;
    if (ka === kb) return a.createdAt.localeCompare(b.createdAt);
    return ka.localeCompare(kb);
  });
  let running = 0;
  const withRun = chrono.map((entry) => {
    running += entry.amount;
    return { entry, running };
  });
  return withRun.reverse();
}

/** Human label for a read-time order-state flag on an imported entry. */
export function orderFlagLabel(flag: string): string {
  switch (flag) {
    case 'cancelled':
      return 'Order cancelled';
    case 'returned':
      return 'Return filed';
    case 'status_changed':
      return 'Order status changed';
    default:
      return flag;
  }
}

/** Sum helpers for the Hub KPI strip (books already carry per-book summaries). */
export function aggregateBooks(books: CashbookListItem[]) {
  return books.reduce(
    (acc, b) => {
      acc.moneyIn += b.summary.moneyIn || 0;
      acc.moneyOut += b.summary.moneyOut || 0;
      acc.net += b.summary.net || 0;
      acc.entryCount += b.summary.entryCount || 0;
      return acc;
    },
    { moneyIn: 0, moneyOut: 0, net: 0, entryCount: 0 },
  );
}

export function cashbookLedgerPath(bookId: string): string {
  return `/admin/cashbook/${encodeURIComponent(bookId)}`;
}
