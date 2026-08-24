import { useState } from 'react';
import { catalogApi } from '../services/catalogApi';
import type { CatalogBrand, CatalogCreator, CatalogMarketplaceStatus } from '../types/catalog';

export type MarketplaceEntityType = 'brand' | 'seller' | 'creator' | 'consumer';

/** Creator publish-status lifecycle (server/catalogRouter.ts PATCH /catalog/creators/:id). Creators
 * have no dedicated marketplace-access endpoint, reason/duration tracking, or active-order guard
 * like brands do — resolvePartnerLifecycle() treats status === 'live' as the sole grant condition. */
export type CreatorPublishStatus = NonNullable<CatalogCreator['status']>;

export type MarketplaceLifecycleStatus = CatalogMarketplaceStatus | CreatorPublishStatus;

export interface MarketplaceAccessState {
  /** Canonical backend status. Undefined for entity types with no backend marketplace concept (e.g. consumer). */
  status?: MarketplaceLifecycleStatus;
  /** Authoritative access boolean mirrored from the server (marketplaceAccess for brands, status==='live' for creators). */
  access: boolean;
  /** Operator-entered note from the current session only — the backend does not persist a suspend reason, so this clears on refresh/reload. */
  suspensionReason?: string;
  suspendedAt?: string;
  notifyOnSuspend?: boolean;
}

export interface SuspendInput {
  reason: string;
  /** Collected for operator context only — the backend endpoint does not accept or store duration. */
  durationDays: number | null;
  notify: boolean;
}

interface UseMarketplaceAccessOptions {
  entityType: MarketplaceEntityType;
  /** Catalog brand id (brand/seller) or catalog creator id (creator). Unused/no-op for 'consumer'. */
  entityId: string;
  entityName: string;
  /** Called with the freshly-saved server record after any successful transition, so the caller can refresh from authoritative state. */
  onSaved: (updated: CatalogBrand | CatalogCreator) => void;
  /** Called on a failed transition; state is left untouched (no optimistic mutation). */
  onError: (message: string) => void;
  onAudit: (action: string, description: string) => void;
  onNotify?: (message: string) => void;
}

/**
 * Marketplace Access control for Brand/Seller/Creator profile tabs. Talks to the real backend
 * (catalogApi.setBrandMarketplaceAccess / setCreatorPublishStatus) instead of local-only state —
 * grant/suspend/reinstate all round-trip through the server and refresh from its response.
 */
export function useMarketplaceAccess({
  entityType,
  entityId,
  entityName,
  onSaved,
  onError,
  onAudit,
  onNotify,
}: UseMarketplaceAccessOptions) {
  const [isProcessing, setIsProcessing] = useState(false);

  const isCreator = entityType === 'creator';
  const isBrandLike = entityType === 'brand' || entityType === 'seller';

  async function run(action: () => Promise<CatalogBrand | CatalogCreator>, auditAction: string, auditDescription: string, notifyMessage?: string) {
    if (isProcessing || !entityId || (!isCreator && !isBrandLike)) return;
    setIsProcessing(true);
    try {
      const saved = await action();
      onSaved(saved);
      onAudit(auditAction, auditDescription);
      if (notifyMessage && onNotify) onNotify(notifyMessage);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Marketplace Access update failed.');
    } finally {
      setIsProcessing(false);
    }
  }

  const grant = () => {
    if (isCreator) {
      return run(
        () => catalogApi.setCreatorPublishStatus(entityId, 'live'),
        'Marketplace Access Granted',
        `${entityType} "${entityName}" granted Marketplace Access (status set to live).`,
        'Your account has been activated. Marketplace Access is now on.',
      );
    }
    return run(
      () => catalogApi.setBrandMarketplaceAccess(entityId, 'granted').then((r) => r.data),
      'Marketplace Access Granted',
      `${entityType} "${entityName}" granted Marketplace Access.`,
      'Your account has been activated. Marketplace Access is now on.',
    );
  };

  const suspend = ({ reason, durationDays, notify }: SuspendInput) => {
    if (isCreator) {
      return run(
        () => catalogApi.setCreatorPublishStatus(entityId, 'archived'),
        'Marketplace Access Suspended',
        `${entityType} "${entityName}" archived (creators have no separate suspend-with-reason state). Operator note: ${reason}`,
        notify ? `Your ${entityType} account has been deactivated. Reason: ${reason}` : undefined,
      );
    }
    return run(
      () => catalogApi.setBrandMarketplaceAccess(entityId, 'suspended').then((r) => r.data),
      'Marketplace Access Suspended',
      `${entityType} "${entityName}" suspended${durationDays ? ` for ${durationDays} day(s)` : ' indefinitely'}. Reason: ${reason} (duration/reason are operator notes only — not persisted server-side).`,
      notify ? `Your ${entityType} account has been suspended${durationDays ? ` for ${durationDays} day(s)` : ''}. Reason: ${reason}` : undefined,
    );
  };

  const reinstate = () => {
    if (isCreator) {
      return run(
        () => catalogApi.setCreatorPublishStatus(entityId, 'live'),
        'Marketplace Access Reinstated',
        `${entityType} "${entityName}" reinstated (status set back to live).`,
        `Your ${entityType} account access has been reinstated.`,
      );
    }
    return run(
      () => catalogApi.setBrandMarketplaceAccess(entityId, 'restored').then((r) => r.data),
      'Marketplace Access Reinstated',
      `${entityType} "${entityName}" reinstated; suspension lifted.`,
      `Your ${entityType} account access has been reinstated.`,
    );
  };

  return { grant, suspend, reinstate, isProcessing, entityId };
}
