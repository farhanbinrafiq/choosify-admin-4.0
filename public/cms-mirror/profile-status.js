/**
 * Universal profile-status resolver (cms-mirror). Keep in sync with src/lib/profileStatus.ts.
 */
(function (global) {
  var PRIMARY_LABEL = {
    BANNED: 'Banned',
    SUSPENDED: 'Suspended',
    REJECTED: 'Rejected',
    UNDER_REVIEW: 'Under Review',
    INACTIVE: 'Inactive',
    ACTIVE: 'Active',
  };
  var SECONDARY_LABEL = {
    VERIFIED: 'Verified',
    VERIFIED_OWNER: 'Verified Owner',
    OWNERSHIP_CLAIM_PENDING: 'Ownership Claim Pending',
    MARKETPLACE_ACCESS_OFF: 'Marketplace Access Off',
  };
  var TONE_STYLE = {
    success: 'background:rgba(22,163,74,0.12);color:#15803D;border:1px solid rgba(21,128,61,0.22)',
    verified: 'background:rgba(22,163,74,0.12);color:#15803D;border:1px solid rgba(21,128,61,0.22)',
    warning: 'background:#FFF7ED;color:#C2410C;border:1px solid #FDBA74',
    neutral: 'background:#F3F4F6;color:#4B5563;border:1px solid #E5E7EB',
    danger: 'background:rgba(220,38,38,0.10);color:#DC2626;border:1px solid rgba(220,38,38,0.22)',
    banned: 'background:#991B1B;color:#fff;border:1px solid #7F1D1D',
  };

  function kindFromRole(role) {
    var r = String(role || '').toLowerCase();
    if (r === 'seller' || r === 'verified_seller') return 'seller';
    if (r === 'creator') return 'creator';
    if (r === 'admin' || r === 'super_admin' || r === 'moderator' || r === 'support_agent' || r === 'finance_manager' || r === 'marketing_manager') {
      return 'admin';
    }
    return 'consumer';
  }

  function isPartnerKind(kind) {
    return kind === 'seller' || kind === 'creator' || kind === 'brand';
  }

  function marketplaceOff(facts) {
    if (facts.marketplaceAccess === false) return true;
    var ms = facts.marketplaceStatus;
    if (ms === 'not_granted' || ms === 'restricted' || ms === 'suspended' || ms === 'revoked') return true;
    if (facts.kind === 'creator' && facts.creatorCatalogStatus && facts.creatorCatalogStatus !== 'live') return true;
    return false;
  }

  function identityIsVerified(facts) {
    if (facts.identityVerified === true) return true;
    if (facts.verifiedStatus === true) return true;
    if (facts.partnerApplicationStatus === 'approved') return true;
    return false;
  }

  function ownershipClaimIsPending(facts) {
    if (facts.ownershipClaimPending === true) return true;
    return facts.claimStatus === 'pending';
  }

  function ownershipIsVerified(facts) {
    if (ownershipClaimIsPending(facts)) return false;
    return facts.claimStatus === 'verified';
  }

  function toneForPrimary(primary) {
    if (primary === 'ACTIVE') return 'success';
    if (primary === 'UNDER_REVIEW') return 'warning';
    if (primary === 'INACTIVE') return 'neutral';
    if (primary === 'SUSPENDED' || primary === 'REJECTED') return 'danger';
    if (primary === 'BANNED') return 'banned';
    return 'neutral';
  }

  function hintFor(primary, secondary, kind) {
    if (!isPartnerKind(kind)) return '';
    if (primary === 'UNDER_REVIEW' && secondary.indexOf('OWNERSHIP_CLAIM_PENDING') >= 0) {
      return 'Your ownership claim is currently being reviewed.';
    }
    if (primary === 'UNDER_REVIEW') return 'Your partner application is currently being reviewed.';
    if (primary === 'REJECTED') return 'Your partner application was not approved.';
    if (primary === 'SUSPENDED') return 'Marketplace access is currently suspended.';
    if (primary === 'BANNED') return 'Marketplace access has been revoked.';
    if (primary === 'ACTIVE' && secondary.indexOf('MARKETPLACE_ACCESS_OFF') >= 0) {
      return 'Identity is verified. Marketplace access is not enabled yet.';
    }
    return '';
  }

  function resolveProfileStatus(facts) {
    facts = facts || {};
    var kind = facts.kind || 'consumer';
    var primary = 'ACTIVE';
    if (isPartnerKind(kind)) {
      if (facts.marketplaceStatus === 'revoked') primary = 'BANNED';
      else if (facts.localSuspended || facts.marketplaceStatus === 'suspended') primary = 'SUSPENDED';
      else if (facts.partnerApplicationStatus === 'pending' || facts.resubmissionRequested === true || ownershipClaimIsPending(facts)) primary = 'UNDER_REVIEW';
      else if (facts.partnerApplicationStatus === 'rejected') primary = 'REJECTED';
      else if (kind === 'creator' && facts.creatorCatalogStatus === 'archived') primary = 'INACTIVE';
      else primary = 'ACTIVE';
    } else if (facts.localSuspended) {
      primary = 'SUSPENDED';
    }
    var secondary = [];
    if (isPartnerKind(kind) && ownershipClaimIsPending(facts) && primary !== 'BANNED' && primary !== 'SUSPENDED') {
      secondary.push('OWNERSHIP_CLAIM_PENDING');
    }
    if (isPartnerKind(kind) && identityIsVerified(facts) && primary !== 'REJECTED' && primary !== 'UNDER_REVIEW') {
      secondary.push('VERIFIED');
    }
    if (isPartnerKind(kind) && ownershipIsVerified(facts) && primary !== 'REJECTED' && primary !== 'UNDER_REVIEW') {
      secondary.push('VERIFIED_OWNER');
    }
    if (isPartnerKind(kind) && primary === 'ACTIVE' && marketplaceOff(facts)) {
      secondary.push('MARKETPLACE_ACCESS_OFF');
    }
    var pills = [{ key: primary, label: PRIMARY_LABEL[primary], tone: toneForPrimary(primary) }];
    for (var i = 0; i < secondary.length; i++) {
      var s = secondary[i];
      var tone = 'neutral';
      if (s === 'VERIFIED' || s === 'VERIFIED_OWNER') tone = 'verified';
      else if (s === 'OWNERSHIP_CLAIM_PENDING') tone = 'warning';
      pills.push({
        key: s,
        label: SECONDARY_LABEL[s],
        tone: tone,
      });
    }
    var hint = hintFor(primary, secondary, kind);
    return {
      primary: primary,
      secondary: secondary,
      primaryLabel: PRIMARY_LABEL[primary],
      pills: pills,
      hint: hint,
    };
  }

  function pillStyle(tone) {
    return (
      TONE_STYLE[tone] || TONE_STYLE.neutral
    ) + ';font-size:9px;font-weight:800;padding:3px 8px;border-radius:999px;letter-spacing:0.04em;text-transform:uppercase;white-space:nowrap';
  }

  function buildProfileStatusView(facts, opts) {
    var resolved = resolveProfileStatus(facts);
    var showHint = !!(opts && opts.showHint && resolved.hint);
    return {
      primary: resolved.primary,
      primaryLabel: resolved.primaryLabel,
      hint: resolved.hint || '',
      showHint: showHint,
      showPills: resolved.pills.length > 0,
      pills: resolved.pills.map(function (p) {
        return { key: p.key, label: p.label, style: pillStyle(p.tone) };
      }),
    };
  }

  global.resolveProfileStatus = resolveProfileStatus;
  global.buildProfileStatusView = buildProfileStatusView;
  global.profileStatusKindFromRole = kindFromRole;
})(typeof window !== 'undefined' ? window : globalThis);
