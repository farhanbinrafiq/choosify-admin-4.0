/**
 * Seller/Creator Finance summary — presentation over Escrow balance + commission policy.
 * Does not create a second finance ledger.
 */
import { CommerceError } from '../commerce/cartService';
import { resolveSettlementCommission } from '../escrow/commissionPolicy';
import { getSellerBalanceForActor } from '../escrow/escrowService';
import { escrowStore } from '../escrow/escrowStore';
import { subMajor, addMajor } from '../escrow/money';

function isStaff(role?: string): boolean {
  const r = (role || '').toLowerCase();
  return r === 'admin' || r === 'super_admin' || r === 'superadmin';
}

export type FinanceAdjustmentRow = {
  id: string;
  date: string;
  type: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  status: string;
};

export type FinanceSummary = {
  currency: string;
  lifetimeEarnings: number;
  availableBalance: number;
  pendingApproval: number;
  escrowHeld: number;
  /** Current commission expected against eligible available amount (policy-based). */
  choosifyCommission: number;
  choosifyCommissionPercent: number;
  commissionPolicySource: 'env' | 'default_zero';
  commissionNote: string;
  otherAdjustments: number;
  netWithdrawable: number;
  grossEligibleAmount: number;
  adjustments: FinanceAdjustmentRow[];
};

async function listAdjustmentsForSeller(sellerId: string): Promise<FinanceAdjustmentRow[]> {
  // Prefer balance ledger when available on memory backend.
  const anyStore = escrowStore as unknown as {
    listBalanceEntriesBySeller?: (sellerId: string) => Promise<
      Array<{
        entryId: string;
        amount: number;
        kind: string;
        orderId?: string;
        settlementId?: string;
        createdAt: string;
      }>
    >;
  };
  if (typeof anyStore.listBalanceEntriesBySeller !== 'function') {
    return [];
  }
  const rows = await anyStore.listBalanceEntriesBySeller(sellerId);
  return rows
    .filter((r) => r.kind === 'admin_adjustment' || r.kind === 'refund_clawback')
    .map((r) => ({
      id: r.entryId,
      date: r.createdAt,
      type: r.kind === 'refund_clawback' ? 'Refund Clawback' : 'Admin Adjustment',
      reference: r.orderId || r.settlementId || r.entryId,
      description:
        r.kind === 'refund_clawback'
          ? 'Refund-related balance adjustment'
          : 'Administrative balance adjustment',
      debit: r.amount < 0 ? Math.abs(r.amount) : 0,
      credit: r.amount > 0 ? r.amount : 0,
      status: 'Posted',
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Build current payout breakdown.
 * Available balance is post-settlement wallet (commission already applied at settlement).
 * For CURRENT withdrawal UI we still surface the active policy rate applied to the
 * eligible pool so Sellers see Choosify Commission / Net Withdrawable clearly.
 * When policy is 0% (default), commission is 0 and net equals available − other fees.
 */
export async function getFinanceSummaryForActor(
  sellerId: string,
  actor: { userId: string; role?: string },
  currency = 'BDT',
): Promise<FinanceSummary> {
  if (!actor.userId) throw new CommerceError('Authentication required', 401);
  if (!isStaff(actor.role) && actor.userId !== sellerId) {
    throw new CommerceError('Not authorized to view this finance summary', 403);
  }

  const balance = await getSellerBalanceForActor(sellerId, currency, actor);
  const available = balance.availableBalance || 0;
  const pending = balance.pendingSettlement || 0;
  const escrowHeld = balance.escrowBalance || 0;

  const commission = resolveSettlementCommission(available);
  const adjustments = await listAdjustmentsForSeller(sellerId);
  const otherDebits = adjustments.reduce((a, r) => a + (r.debit || 0), 0);
  const otherCredits = adjustments.reduce((a, r) => a + (r.credit || 0), 0);
  // Open adjustments already in wallet are informational; only show unsettled-style net effect
  // as explicit "other adjustments" line for current payout clarity (debits reduce withdrawable).
  const otherAdjustments = subMajor(otherDebits, otherCredits);
  const afterCommission = commission.sellerNetAmount;
  const netWithdrawable = Math.max(0, subMajor(afterCommission, Math.max(0, otherAdjustments)));

  // Lifetime ≈ available + pending + held + reconstructed settled path (best-effort from wallet)
  const lifetimeEarnings = addMajor(addMajor(available, pending), escrowHeld);

  return {
    currency,
    lifetimeEarnings,
    availableBalance: available,
    pendingApproval: pending,
    escrowHeld,
    choosifyCommission: commission.commissionAmount,
    choosifyCommissionPercent: commission.commissionPercent,
    commissionPolicySource: commission.policySource,
    commissionNote:
      'Estimated/current commission deducted from eligible earnings under platform settlement policy.',
    otherAdjustments: Math.max(0, otherAdjustments),
    netWithdrawable,
    grossEligibleAmount: available,
    adjustments,
  };
}
