/**
 * Universal profile-status resolver.
 *
 * Derives one PRIMARY account phase + optional SECONDARY flags from existing
 * partner / catalog fields. Does not invent DEACTIVATED (not in the account model).
 * Feature entitlements are intentionally ignored.
 */

export type ProfileKind = 'seller' | 'creator' | 'consumer' | 'admin' | 'brand';

export type ProfilePrimaryStatus =
  | 'BANNED'
  | 'SUSPENDED'
  | 'REJECTED'
  | 'UNDER_REVIEW'
  | 'INACTIVE'
  | 'ACTIVE';

export type ProfileSecondaryStatus =
  | 'VERIFIED'
  | 'VERIFIED_OWNER'
  | 'OWNERSHIP_CLAIM_PENDING'
  | 'MARKETPLACE_ACCESS_OFF';

export type PartnerApplicationStatusValue = 'pending' | 'approved' | 'rejected' | null;

export type CatalogMarketplaceStatusValue =
  | 'not_granted'
  | 'granted'
  | 'restricted'
  | 'suspended'
  | 'restored'
  | 'revoked'
  | null;

export type ProfileStatusFacts = {
  kind: ProfileKind;
  partnerApplicationStatus?: PartnerApplicationStatusValue;
  identityVerified?: boolean;
  marketplaceAccess?: boolean;
  resubmissionRequested?: boolean;
  marketplaceStatus?: CatalogMarketplaceStatusValue;
  creatorCatalogStatus?: 'draft' | 'live' | 'archived' | null;
  verifiedStatus?: boolean;
  claimStatus?: 'community' | 'pending' | 'verified' | null;
  /** Live pending ownership-claim dossier (not the partner application). */
  ownershipClaimPending?: boolean;
  /** Optimistic overlay from Marketplace Access panel before catalog refresh. */
  localSuspended?: boolean;
};

export type ProfileStatusPill = {
  key: string;
  label: string;
  tone: ProfileStatusTone;
};

export type ProfileStatusTone =
  | 'success'
  | 'verified'
  | 'warning'
  | 'neutral'
  | 'danger'
  | 'banned';

export type ResolvedProfileStatus = {
  primary: ProfilePrimaryStatus;
  secondary: ProfileSecondaryStatus[];
  primaryLabel: string;
  pills: ProfileStatusPill[];
  hint?: string;
};

export const PRIMARY_STATUS_LABEL: Record<ProfilePrimaryStatus, string> = {
  BANNED: 'Banned',
  SUSPENDED: 'Suspended',
  REJECTED: 'Rejected',
  UNDER_REVIEW: 'Under Review',
  INACTIVE: 'Inactive',
  ACTIVE: 'Active',
};

export const SECONDARY_STATUS_LABEL: Record<ProfileSecondaryStatus, string> = {
  VERIFIED: 'Verified',
  VERIFIED_OWNER: 'Verified Owner',
  OWNERSHIP_CLAIM_PENDING: 'Ownership Claim Pending',
  MARKETPLACE_ACCESS_OFF: 'Marketplace Access Off',
};

export function kindFromRole(role: string | undefined | null): ProfileKind {
  const r = String(role || '').toLowerCase();
  if (r === 'seller' || r === 'verified_seller') return 'seller';
  if (r === 'creator') return 'creator';
  if (r === 'admin' || r === 'super_admin' || r === 'moderator' || r === 'support_agent' || r === 'finance_manager' || r === 'marketing_manager') {
    return 'admin';
  }
  return 'consumer';
}

export function profileRoleCardLabel(kind: ProfileKind, role?: string | null): string {
  if (kind === 'creator') return 'Content Creator';
  if (kind === 'seller' || kind === 'brand') return 'Seller';
  if (kind === 'consumer') return 'Consumer';
  const r = String(role || 'admin').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return r;
}

function isPartnerKind(kind: ProfileKind): boolean {
  return kind === 'seller' || kind === 'creator' || kind === 'brand';
}

function marketplaceOff(facts: ProfileStatusFacts): boolean {
  if (facts.marketplaceAccess === false) return true;
  const ms = facts.marketplaceStatus;
  if (ms === 'not_granted' || ms === 'restricted' || ms === 'suspended' || ms === 'revoked') return true;
  if (facts.kind === 'creator' && facts.creatorCatalogStatus && facts.creatorCatalogStatus !== 'live') return true;
  return false;
}

function identityIsVerified(facts: ProfileStatusFacts): boolean {
  if (facts.identityVerified === true) return true;
  if (facts.verifiedStatus === true) return true;
  if (facts.partnerApplicationStatus === 'approved') return true;
  return false;
}

function ownershipClaimIsPending(facts: ProfileStatusFacts): boolean {
  if (facts.ownershipClaimPending === true) return true;
  return facts.claimStatus === 'pending';
}

function ownershipIsVerified(facts: ProfileStatusFacts): boolean {
  if (ownershipClaimIsPending(facts)) return false;
  return facts.claimStatus === 'verified';
}

export function resolveProfileStatus(facts: ProfileStatusFacts): ResolvedProfileStatus {
  const kind = facts.kind;
  let primary: ProfilePrimaryStatus = 'ACTIVE';

  if (isPartnerKind(kind)) {
      if (facts.marketplaceStatus === 'revoked') {
      primary = 'BANNED';
    } else if (facts.localSuspended || facts.marketplaceStatus === 'suspended') {
      primary = 'SUSPENDED';
    } else if (
      facts.partnerApplicationStatus === 'pending' ||
      facts.resubmissionRequested === true ||
      ownershipClaimIsPending(facts)
    ) {
      primary = 'UNDER_REVIEW';
    } else if (facts.partnerApplicationStatus === 'rejected') {
      primary = 'REJECTED';
    } else if (kind === 'creator' && facts.creatorCatalogStatus === 'archived') {
      primary = 'INACTIVE';
    } else {
      primary = 'ACTIVE';
    }
  } else if (facts.localSuspended) {
    primary = 'SUSPENDED';
  }

  const secondary: ProfileSecondaryStatus[] = [];
  if (isPartnerKind(kind) && ownershipClaimIsPending(facts) && primary !== 'BANNED' && primary !== 'SUSPENDED') {
    secondary.push('OWNERSHIP_CLAIM_PENDING');
  }
  if (isPartnerKind(kind) && identityIsVerified(facts) && primary !== 'REJECTED' && primary !== 'UNDER_REVIEW') {
    secondary.push('VERIFIED');
  }
  if (isPartnerKind(kind) && ownershipIsVerified(facts) && primary !== 'REJECTED' && primary !== 'UNDER_REVIEW') {
    secondary.push('VERIFIED_OWNER');
  }
  if (
    isPartnerKind(kind) &&
    primary === 'ACTIVE' &&
    marketplaceOff(facts)
  ) {
    secondary.push('MARKETPLACE_ACCESS_OFF');
  }

  const pills: ProfileStatusPill[] = [
    { key: primary, label: PRIMARY_STATUS_LABEL[primary], tone: toneForPrimary(primary) },
    ...secondary.map((s) => ({
      key: s,
      label: SECONDARY_STATUS_LABEL[s],
      tone:
        s === 'VERIFIED' || s === 'VERIFIED_OWNER'
          ? ('verified' as const)
          : s === 'OWNERSHIP_CLAIM_PENDING'
            ? ('warning' as const)
            : ('neutral' as const),
    })),
  ];

  return {
    primary,
    secondary,
    primaryLabel: PRIMARY_STATUS_LABEL[primary],
    pills,
    hint: hintFor(primary, secondary, kind),
  };
}

export function toneForPrimary(primary: ProfilePrimaryStatus): ProfileStatusTone {
  switch (primary) {
    case 'ACTIVE':
      return 'success';
    case 'UNDER_REVIEW':
      return 'warning';
    case 'INACTIVE':
      return 'neutral';
    case 'SUSPENDED':
    case 'REJECTED':
      return 'danger';
    case 'BANNED':
      return 'banned';
    default:
      return 'neutral';
  }
}

function hintFor(
  primary: ProfilePrimaryStatus,
  secondary: ProfileSecondaryStatus[],
  kind: ProfileKind,
): string | undefined {
  if (!isPartnerKind(kind)) return undefined;
  if (primary === 'UNDER_REVIEW' && secondary.includes('OWNERSHIP_CLAIM_PENDING')) {
    return 'Your ownership claim is currently being reviewed.';
  }
  if (primary === 'UNDER_REVIEW') return 'Your partner application is currently being reviewed.';
  if (primary === 'REJECTED') return 'Your partner application was not approved.';
  if (primary === 'SUSPENDED') return 'Marketplace access is currently suspended.';
  if (primary === 'BANNED') return 'Marketplace access has been revoked.';
  if (primary === 'ACTIVE' && secondary.includes('MARKETPLACE_ACCESS_OFF')) {
    return 'Identity is verified. Marketplace access is not enabled yet.';
  }
  return undefined;
}

/** Light-card (cms-mirror / Unified Profile) pill classes. */
export const PROFILE_STATUS_TONE_CLASS: Record<ProfileStatusTone, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  verified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
  banned: 'bg-rose-700 text-white border-rose-800',
};

export const PROFILE_STATUS_TONE_STYLE: Record<ProfileStatusTone, string> = {
  success: 'background:rgba(22,163,74,0.12);color:#15803D;border:1px solid rgba(21,128,61,0.22)',
  verified: 'background:rgba(22,163,74,0.12);color:#15803D;border:1px solid rgba(21,128,61,0.22)',
  warning: 'background:#FFF7ED;color:#C2410C;border:1px solid #FDBA74',
  neutral: 'background:#F3F4F6;color:#4B5563;border:1px solid #E5E7EB',
  danger: 'background:rgba(220,38,38,0.10);color:#DC2626;border:1px solid rgba(220,38,38,0.22)',
  banned: 'background:#991B1B;color:#fff;border:1px solid #7F1D1D',
};

export function listStatusClass(label: string): { dot: string; text: string } {
  const key = String(label || '').toLowerCase();
  if (key === 'active' || key === 'verified') {
    return { dot: 'bg-green-500', text: 'text-green-600' };
  }
  if (key === 'under review') {
    return { dot: 'bg-amber-500', text: 'text-amber-700' };
  }
  if (key === 'inactive') {
    return { dot: 'bg-slate-400', text: 'text-slate-500' };
  }
  return { dot: 'bg-red-500', text: 'text-red-600' };
}
