/**
 * Minimal settlement commission foundation — Sprint 8.
 * No full Commission Engine. Do not invent business percentages.
 *
 * Platform policy:
 * - PLATFORM_SETTLEMENT_COMMISSION_PERCENT (0–100) when set
 * - otherwise 0 (gap: configurable commission policy not yet administered)
 */

import { percentOfMajor, subMajor } from './money';

export type CommissionBreakdown = {
  grossAmount: number;
  commissionPercent: number;
  commissionAmount: number;
  sellerNetAmount: number;
  policySource: 'env' | 'default_zero';
};

export function resolveSettlementCommission(grossAmount: number): CommissionBreakdown {
  const raw = process.env.PLATFORM_SETTLEMENT_COMMISSION_PERCENT?.trim();
  let percent = 0;
  let policySource: 'env' | 'default_zero' = 'default_zero';
  if (raw !== undefined && raw !== '') {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 100) {
      percent = n;
      policySource = 'env';
    }
  }
  const commissionAmount = percentOfMajor(grossAmount, percent);
  const sellerNetAmount = subMajor(grossAmount, commissionAmount);
  return {
    grossAmount,
    commissionPercent: percent,
    commissionAmount,
    sellerNetAmount,
    policySource,
  };
}
