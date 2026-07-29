import { useState } from 'react';

export type MarketplaceEntityType = 'brand' | 'seller' | 'creator' | 'consumer';

export interface MarketplaceAccessState {
  suspended: boolean;
  suspendedAt?: string;
  suspensionReason?: string;
  suspensionDurationDays?: number;
  autoReinstateAt?: string;
  notifyOnSuspend?: boolean;
}

export interface SuspendInput {
  reason: string;
  durationDays: number | null; // null = indefinite, no auto-reinstate
  notify: boolean;
}

interface UseMarketplaceAccessOptions {
  entityType: MarketplaceEntityType;
  entityId: string;
  entityName: string;
  /** Called with the access-state patch to persist (e.g. context updateProfile / local setState). */
  onPersist: (patch: MarketplaceAccessState) => void;
  /** Called for both suspend and reinstate actions, mirroring the existing brand audit log pattern. */
  onAudit: (action: string, description: string) => void;
  /** Optional: notify the account holder (email/in-app) — no-op if omitted. */
  onNotify?: (message: string) => void;
}

/**
 * Shared suspend/reinstate logic for marketplace-access control, usable from any entity's
 * profile "Account Info" tab (Brand, Creator, Consumer, Seller). Generalizes the
 * handleSuspend/handleRestore pattern already used in Sellers.tsx, adding duration,
 * auto-reinstate scheduling, and an admin-notify-user toggle per the design spec.
 */
export function useMarketplaceAccess({ entityType, entityId, entityName, onPersist, onAudit, onNotify }: UseMarketplaceAccessOptions) {
  const [isProcessing, setIsProcessing] = useState(false);

  const suspend = ({ reason, durationDays, notify }: SuspendInput) => {
    setIsProcessing(true);
    const suspendedAt = new Date().toISOString();
    const autoReinstateAt =
      durationDays && durationDays > 0 ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString() : undefined;

    onPersist({
      suspended: true,
      suspendedAt,
      suspensionReason: reason,
      suspensionDurationDays: durationDays ?? undefined,
      autoReinstateAt,
      notifyOnSuspend: notify,
    });

    onAudit(
      'Marketplace Access Suspended',
      `${entityType} "${entityName}" suspended${durationDays ? ` for ${durationDays} day(s) (auto-reinstate ${new Date(autoReinstateAt!).toLocaleDateString()})` : ' indefinitely'}. Reason: ${reason}`
    );

    if (notify && onNotify) {
      onNotify(
        `Your ${entityType} account has been suspended${durationDays ? ` for ${durationDays} day(s)` : ''}. Reason: ${reason}`
      );
    }

    setIsProcessing(false);
  };

  const reinstate = (note?: string) => {
    setIsProcessing(true);

    onPersist({
      suspended: false,
      suspendedAt: undefined,
      suspensionReason: undefined,
      suspensionDurationDays: undefined,
      autoReinstateAt: undefined,
      notifyOnSuspend: undefined,
    });

    onAudit('Marketplace Access Reinstated', note || `${entityType} "${entityName}" reinstated; suspension lifted.`);

    if (onNotify) {
      onNotify(`Your ${entityType} account access has been reinstated.`);
    }

    setIsProcessing(false);
  };

  /** Auto-reinstate check — call on profile load to lazily clear an expired suspension. */
  const checkAutoReinstate = (state: MarketplaceAccessState): boolean => {
    if (!state.suspended || !state.autoReinstateAt) return false;
    if (new Date(state.autoReinstateAt).getTime() > Date.now()) return false;
    reinstate(`Auto-reinstated: scheduled suspension window for "${entityName}" elapsed.`);
    return true;
  };

  return { suspend, reinstate, checkAutoReinstate, isProcessing, entityId };
}
