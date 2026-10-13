/**
 * Phase E (E2/E3) — pure Marketplace-Access-pending helpers shared by the full-page
 * gate, the lock panel and the Studio notice (no React, so probes can import them).
 */

/**
 * Phase E (E2/E3): editing one's OWN Brand (seller) or Creator profile (creator)
 * is an identity action the server allows while Marketplace Access is pending —
 * `isPartnerIdentityApiPath` exempts GET + PUT/PATCH of /catalog/brands/:id and
 * /catalog/creators/:id, and the routes still enforce ownership. The full-page
 * gate used to block these Studio pages anyway, so a seller who had just created
 * their first Brand (which is private until Choosify grants access, and so locks
 * the account) — or a creator with a draft profile — could no longer open it.
 * Creating ANOTHER brand / profile (`/new`), products and every other commercial
 * page stay locked; nothing here grants access or publishes anything.
 */
export function identityStudioEditPath(role: string | undefined, pathname: string): boolean {
  if (role === 'seller') return /^\/admin\/brand-studio\/(?!new\/?$)[^/]+\/edit\/?$/.test(pathname);
  if (role === 'creator') return /^\/admin\/creator-studio\/(?!new\/?$)[^/]+\/edit\/?$/.test(pathname);
  return false;
}

export type PendingState = 'resubmit' | 'rejected' | 'awaiting_activation' | 'under_review';

export function pendingStateOf(profile: { partnerApplicationStatus?: string | null; resubmissionRequested?: boolean } | null | undefined): PendingState {
  if (profile?.resubmissionRequested === true) return 'resubmit';
  if (profile?.partnerApplicationStatus === 'rejected') return 'rejected';
  /** Identity approval (status) and Marketplace Access (marketplaceAccess) are two independent
   * gates — an approved partner reaching this gate has cleared identity review and is only
   * waiting on the separate activation step, which reads as a different state. */
  if (profile?.partnerApplicationStatus === 'approved') return 'awaiting_activation';
  return 'under_review';
}

const STATE_LABEL: Record<PendingState, string> = {
  resubmit: 'Verification Required',
  rejected: 'Application Declined',
  awaiting_activation: 'Awaiting Activation',
  under_review: 'Under Review',
};

/** The one concrete next step for each pending state (shared by the lock panel and the Studio notice). */
export function nextStepOf(state: PendingState): string {
  switch (state) {
    case 'resubmit':
      return 'Next step: open Profile & Verification and resubmit the information Choosify asked for.';
    case 'rejected':
      return 'Next step: open Profile & Verification to see why, then update and resubmit your application, or contact Choosify support.';
    case 'awaiting_activation':
      return 'Next step: nothing more is needed from you — Choosify enables Marketplace Access. Contact Choosify support if you have been waiting a while.';
    default:
      return 'Next step: make sure your Profile & Verification details are complete — Choosify reviews them and then enables Marketplace Access.';
  }
}

export const PENDING_STATE_LABEL: Record<PendingState, string> = STATE_LABEL;
