/**
 * Escrow lifecycle helpers — ES-005 §37–§38.
 */

import type { EscrowStatus } from './types';

export function canSettleFromStatus(status: EscrowStatus): boolean {
  return status === 'held' || status === 'partial_refund_remaining';
}

export function canRefundFromStatus(status: EscrowStatus): boolean {
  return status === 'held' || status === 'partial_refund_remaining';
}

export function blocksSettlement(status: EscrowStatus): boolean {
  return (
    status === 'dispute_hold' ||
    status === 'full_refund' ||
    status === 'settled' ||
    status === 'administrative_adjustment'
  );
}
