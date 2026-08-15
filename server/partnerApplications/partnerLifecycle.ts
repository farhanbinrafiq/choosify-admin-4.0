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
      marketplaceAccess: true,
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

  // Legacy approve did not stamp catalogEntityId — keep those accounts unlocked.
  if (!application.catalogEntityId) {
    return {
      application,
      applicationStatus: application.status,
      identityVerified: true,
      marketplaceAccess: true,
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
