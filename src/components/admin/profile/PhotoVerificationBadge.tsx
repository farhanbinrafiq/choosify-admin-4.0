import React, { useEffect, useState } from 'react';
import { operationsApi, type OpsVerification } from '../../../services/operationsApi';
import { PROFILE_PHOTO_DOCUMENT } from '../../../../shared/verification/verificationDocuments';

/**
 * Photo-verification state of the account's profile picture, shown under the
 * avatar on the Seller / Creator profile (owner and Super Admin). Reads the
 * latest verification request's 'Profile Photo' document; flags when the
 * picture changed after it was submitted.
 */
export function PhotoVerificationBadge({
  entityType,
  entityIds,
  currentAvatarUrl,
}: {
  entityType: 'brand' | 'creator';
  entityIds: string[];
  currentAvatarUrl?: string | null;
}) {
  const [doc, setDoc] = useState<OpsVerification['documents'][number] | null | undefined>(undefined);
  const key = entityIds.join('|');

  useEffect(() => {
    let alive = true;
    const ids = new Set(entityIds);
    operationsApi
      .listVerifications({ entityType })
      .then((rows) => {
        if (!alive) return;
        const latest = rows
          .filter((r) => ids.has(r.entityId))
          .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
          .find((r) => r.documents.some((d) => d.type === PROFILE_PHOTO_DOCUMENT));
        setDoc(latest?.documents.find((d) => d.type === PROFILE_PHOTO_DOCUMENT) || null);
      })
      .catch(() => alive && setDoc(null));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, key]);

  if (doc === undefined || !entityIds.length) return null;
  const changed = Boolean(doc && currentAvatarUrl && doc.doc_url !== currentAvatarUrl);
  const [text, bg, fg] = !doc
    ? ['Photo not verified', '#F1F5F9', '#64748B']
    : changed
      ? ['Photo changed — not yet re-verified', '#FEF3C7', '#92400E']
      : doc.status === 'approved'
        ? ['Photo verified', '#DCFCE7', '#166534']
        : doc.status === 'rejected'
          ? ['Photo rejected', '#FEE2E2', '#991B1B']
          : ['Photo verification pending', '#FEF3C7', '#92400E'];
  return (
    <span
      style={{ display: 'inline-block', marginTop: 6, padding: '2px 8px', borderRadius: 6, fontSize: 9, fontWeight: 800, textTransform: 'uppercase', background: bg, color: fg }}
      title={doc?.notes || undefined}
      data-testid="photo-verification-badge"
    >
      {text}
    </span>
  );
}

const MARKETPLACE_REMOVED: Record<string, string> = { suspended: 'Suspended', restricted: 'Restricted', revoked: 'Revoked', archived: 'Suspended' };

/**
 * Marketplace state badge shown beside the photo badge. `status` is the brand
 * marketplaceStatus or the creator publish status; `active` the resolved access.
 */
export function MarketplaceStatusBadge({ active, status }: { active: boolean; status?: string | null }) {
  const removed = !active && status ? MARKETPLACE_REMOVED[String(status)] : undefined;
  const [text, bg, fg] = active
    ? ['Marketplace Active', '#DCFCE7', '#166534']
    : removed
      ? [`Marketplace ${removed}`, '#FEE2E2', '#991B1B']
      : ['Marketplace Not Active', '#F1F5F9', '#64748B'];
  return (
    <span
      style={{ display: 'inline-block', marginTop: 6, padding: '2px 8px', borderRadius: 6, fontSize: 9, fontWeight: 800, textTransform: 'uppercase', background: bg, color: fg }}
      data-testid="marketplace-status-badge"
    >
      {text}
    </span>
  );
}
