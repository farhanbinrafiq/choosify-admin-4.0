import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import { brandIsMarketplaceVisible } from '../catalog/sellerWorkspace';
import { partnerApplicationStore, type PartnerApplication } from './partnerApplicationStore';

export type PartnerLifecycle = {
  application: PartnerApplication | null;
  applicationStatus: PartnerApplication['status'] | null;
  identityVerified: boolean;
  marketplaceAccess: boolean;
  /** True when this actor never went through the new apply-time provision path. */
  grandfathered: boolean;
};

function isPartnerRole(role: string | undefined | null): boolean {
  const r = String(role || '').toLowerCase();
  return r === 'seller' || r === 'verified_seller' || r === 'creator';
}

/**
 * Sprint 12 pre-beta audit — P1 fix: grandfathered accounts (no partner-application
 * record, or a legacy-approved application never stamped with catalogEntityId) used
 * to get marketplaceAccess:true unconditionally, so an admin hiding/unpublishing
 * their brand or creator profile had no effect. If the actor already has a real
 * catalog entity, gate on its actual visibility like every other account; only
 * default open when there is no entity yet to revoke.
 */
async function resolveGrandfatheredMarketplaceAccess(
  role: string | undefined | null,
  userId: string | undefined,
): Promise<boolean> {
  if (!userId) return true;
  const r = String(role || '').toLowerCase();
  if (r === 'creator') {
    const creators = await catalogStore.listCreators();
    const mine = creators.find((c) => c.userId === userId);
    return mine ? mine.status === 'live' : true;
  }
  const brands = await catalogStore.listBrands();
  const mine = brands.find((b) => b.sellerId === userId);
  return mine ? brandIsMarketplaceVisible(mine) : true;
}

export async function resolvePartnerLifecycle(params: {
  userId?: string;
  email?: string;
  role?: string;
}): Promise<PartnerLifecycle> {
  if (!isPartnerRole(params.role)) {
    return {
      application: null,
      applicationStatus: null,
      identityVerified: true,
      marketplaceAccess: true,
      grandfathered: true,
    };
  }

  const application = await partnerApplicationStore.findForActor({
    userId: params.userId,
    email: params.email,
  });

  if (!application) {
    return {
      application: null,
      applicationStatus: null,
      identityVerified: true,
      marketplaceAccess: await resolveGrandfatheredMarketplaceAccess(params.role, params.userId),
      grandfathered: true,
    };
  }

  if (application.status === 'pending' || application.status === 'rejected') {
    return {
      application,
      applicationStatus: application.status,
      identityVerified: false,
      marketplaceAccess: false,
      grandfathered: false,
    };
  }

  // Legacy approve did not stamp catalogEntityId — identity stays unlocked, but
  // marketplace visibility still reflects the real catalog entity if one exists.
  if (!application.catalogEntityId) {
    return {
      application,
      applicationStatus: application.status,
      identityVerified: true,
      marketplaceAccess: await resolveGrandfatheredMarketplaceAccess(params.role, params.userId),
      grandfathered: true,
    };
  }

  let marketplaceAccess = false;
  if (application.applicantType === 'seller' && params.userId) {
    const brands = await catalogStore.listBrands();
    marketplaceAccess = brands.some(
      (b) => b.sellerId === params.userId && brandIsMarketplaceVisible(b),
    );
  } else if (application.applicantType === 'creator' && params.userId) {
    const creators = await catalogStore.listCreators();
    marketplaceAccess = creators.some((c) => c.userId === params.userId && c.status === 'live');
  }

  return {
    application,
    applicationStatus: application.status,
    identityVerified: true,
    marketplaceAccess,
    grandfathered: false,
  };
}

export function publicLifecycleFields(life: PartnerLifecycle) {
  return {
    partnerApplicationStatus: life.applicationStatus,
    identityVerified: life.identityVerified,
    marketplaceAccess: life.marketplaceAccess,
    partnerApplicationId: life.application?.id || null,
    resubmissionRequested: Boolean(life.application?.resubmissionRequested),
  };
}
