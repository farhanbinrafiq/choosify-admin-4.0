import React, { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { operationsApi, type OpsVerification } from '../../../services/operationsApi';
import { catalogApi } from '../../../services/catalogApi';
import { getPublishedStorefrontUrl } from '../../../lib/storefrontUrls';
import { VerificationRequestCard } from '../profile/VerificationCenterPanel';

const SOURCE_LABEL: Record<string, string> = {
  storefront: 'Claimed from the storefront',
  onboarding: 'Claimed during sign-up',
  invitation: 'Claimed from an invitation',
};

/**
 * Ownership claim review on the CLAIMANT's full 360° profile
 * (/admin/seller-profile or /admin/creator-review with `claimId`). Staff see who
 * is claiming (the profile below) next to what is being claimed, then
 * Approve / Mark pending / Request information / Reject the claim. Approval is
 * server-side and atomic; the page reloads so the newly owned profile shows up.
 */
export function ClaimReviewSection({ claimId, onDecided }: { claimId: string; onDecided: () => void }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const canReview = ['super_admin', 'admin', 'moderator'].includes(String(profile?.role || ''));
  const [claim, setClaim] = useState<OpsVerification | null>(null);
  const [target, setTarget] = useState<{ name: string; slug: string; image: string; category: string; owner: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const row = (await operationsApi.getVerification(claimId)) as OpsVerification;
      setClaim(row);
      const type = row.entityType === 'creator' ? 'creator' : 'brand';
      const list = type === 'brand' ? await catalogApi.listBrands() : await catalogApi.listCreators();
      const e = (list as unknown as Array<Record<string, unknown>>).find((x) => x.id === row.entityId);
      setTarget(
        e
          ? {
              name: String(e.name || row.entityName),
              slug: String(e.slug || ''),
              image: String((type === 'brand' ? e.logo : e.avatar) || ''),
              category: String(e.category || ''),
              owner: (type === 'brand' ? (e.sellerId as string) : (e.userId as string)) || null,
            }
          : null,
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the ownership claim.');
    }
  }, [claimId]);

  useEffect(() => {
    void load();
  }, [load]);

  const box: React.CSSProperties = { background: '#fff', border: '2px solid var(--cms-accent)', borderRadius: 10, padding: 16, marginBottom: 16 };
  if (error) return <div style={{ ...box, color: '#DC2626', fontSize: 12, fontWeight: 700 }}>{error}</div>;
  if (!claim) {
    return (
      <div style={{ ...box, textAlign: 'center' }}>
        <Loader2 size={16} className="animate-spin" />
      </div>
    );
  }
  const type = claim.entityType === 'creator' ? 'creator' : 'brand';
  const publicHref = target?.slug ? `${getPublishedStorefrontUrl()}/${type === 'brand' ? 'brands' : 'creators'}/${target.slug}` : '';
  const queueHref = `/admin/${type === 'brand' ? 'seller' : 'creator'}-management?filter=claims`;

  return (
    <div style={box} data-testid="claim-review-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
          {target?.image ? (
            <img src={target.image} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', border: '1px solid #E8EDF2' }} />
          ) : (
            <div style={{ width: 48, height: 48, borderRadius: 10, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#64748B' }}>
              {(target?.name || claim.entityName).slice(0, 2).toUpperCase()}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.08em' }}>
              OWNERSHIP CLAIM · {type === 'brand' ? 'COMMUNITY BRAND' : 'COMMUNITY CREATOR PROFILE'}
            </div>
            <div style={{ fontSize: 16, fontWeight: 800 }} data-testid="claim-review-target">
              {target?.name || claim.entityName}
            </div>
            <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>
              {[target?.category, SOURCE_LABEL[claim.claimSource || ''], `opened ${new Date(claim.created_at).toLocaleDateString()}`].filter(Boolean).join(' · ')}
            </div>
            <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, marginTop: 2 }}>
              The account shown below is the <b>claimant</b>. Check their identity, history and documents before deciding.
            </div>
            {target?.owner && claim.status !== 'Approved' ? (
              <div style={{ fontSize: 11, color: '#B91C1C', fontWeight: 800, marginTop: 4 }}>
                This profile already has an owner — the claim cannot be approved. Ownership disputes use the separate assignment workflow.
              </div>
            ) : null}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {publicHref ? (
            <a href={publicHref} target="_blank" rel="noreferrer" style={linkBtn}>
              Claimed profile <ExternalLink size={12} />
            </a>
          ) : null}
          <button type="button" style={linkBtn} onClick={() => navigate(queueHref)}>
            ← Claims queue
          </button>
        </div>
      </div>
      <VerificationRequestCard
        v={claim}
        kind="ownership_claim"
        entityType={type}
        entityId={claim.entityId}
        entityName={target?.name || claim.entityName}
        canReview={canReview && claim.submitted_by !== profile?.id}
        asks={[]}
        onChanged={() => {
          void load();
          onDecided();
        }}
      />
    </div>
  );
}

const linkBtn: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #E8EDF2',
  borderRadius: 7,
  padding: '6px 10px',
  fontSize: 11,
  fontWeight: 800,
  cursor: 'pointer',
  color: '#374151',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  textDecoration: 'none',
};
