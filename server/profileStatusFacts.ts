import { catalogStore } from '../lib/vercel-catalog/catalogStore';
import {
  kindFromRole,
  resolveProfileStatus,
  type CatalogMarketplaceStatusValue,
  type ProfileKind,
  type ProfileStatusFacts,
} from '../src/lib/profileStatus';
import {
  publicLifecycleFields,
  resolvePartnerLifecycle,
} from './partnerApplications/partnerLifecycle';
import { partnerApplicationStore } from './partnerApplications/partnerApplicationStore';
import { brandIsMarketplaceVisible } from './catalog/sellerWorkspace';

type CatalogBrandRow = {
  sellerId?: string;
  marketplaceStatus?: CatalogMarketplaceStatusValue;
  marketplaceAccess?: boolean;
  verifiedStatus?: boolean;
  claimStatus?: 'community' | 'pending' | 'verified';
};

type CatalogCreatorRow = {
  userId?: string;
  status?: 'draft' | 'live' | 'archived';
  verifiedStatus?: boolean;
};

function factsFromCatalog(
  kind: ProfileKind,
  userId: string,
  brands: CatalogBrandRow[],
  creators: CatalogCreatorRow[],
): Pick<ProfileStatusFacts, 'marketplaceStatus' | 'creatorCatalogStatus' | 'verifiedStatus' | 'claimStatus'> {
  if (kind === 'seller' || kind === 'brand') {
    const mine = brands.find((b) => b.sellerId === userId);
    if (!mine) return {};
    return {
      marketplaceStatus:
        mine.marketplaceStatus ||
        (mine.marketplaceAccess ? 'granted' : mine.marketplaceAccess === false ? 'not_granted' : null),
      verifiedStatus: !!mine.verifiedStatus,
      claimStatus: mine.claimStatus || null,
    };
  }
  if (kind === 'creator') {
    const mine = creators.find((c) => c.userId === userId);
    if (!mine) return {};
    return {
      creatorCatalogStatus: mine.status || null,
      verifiedStatus: !!mine.verifiedStatus,
    };
  }
  return {};
}

export async function accountStatusPayload(user: { id: string; role?: string | null; email?: string | null }) {
  const kind = kindFromRole(user.role);
  const life = await resolvePartnerLifecycle({
    userId: user.id,
    email: user.email || undefined,
    role: user.role || undefined,
  });
  const publicLife = publicLifecycleFields(life);
  let brands: CatalogBrandRow[] = [];
  let creators: CatalogCreatorRow[] = [];
  try {
    if (kind === 'seller' || kind === 'brand') brands = (await catalogStore.listBrands()) as CatalogBrandRow[];
    if (kind === 'creator') creators = (await catalogStore.listCreators()) as CatalogCreatorRow[];
  } catch {
    /* catalog optional */
  }
  const catalog = factsFromCatalog(kind, user.id, brands, creators);
  const facts: ProfileStatusFacts = {
    kind,
    partnerApplicationStatus: publicLife.partnerApplicationStatus,
    identityVerified: publicLife.identityVerified,
    marketplaceAccess: publicLife.marketplaceAccess,
    resubmissionRequested: publicLife.resubmissionRequested,
    ...catalog,
  };
  const resolved = resolveProfileStatus(facts);
  return {
    ...publicLife,
    ...catalog,
    profileStatus: resolved.primaryLabel,
    profileStatusPrimary: resolved.primary,
    profileStatusSecondary: resolved.secondary,
  };
}

export async function batchAccountPrimaryLabels(
  users: Array<{ id: string; role?: string | null; email?: string | null }>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  let brands: CatalogBrandRow[] = [];
  let creators: CatalogCreatorRow[] = [];
  try {
    brands = (await catalogStore.listBrands()) as CatalogBrandRow[];
    creators = (await catalogStore.listCreators()) as CatalogCreatorRow[];
  } catch {
    /* optional */
  }
  const apps = await partnerApplicationStore.list();
  for (const user of users) {
    const kind = kindFromRole(user.role);
    const app =
      apps.find(
        (a) => a.provisionedUserId === user.id || a.existingUserId === user.id || (user.email && a.email === user.email),
      ) || null;
    let identityVerified = true;
    let marketplaceAccess = true;
    let applicationStatus = app?.status || null;
    if (kind === 'seller' || kind === 'creator') {
      if (app) {
        if (app.status === 'pending' || app.status === 'rejected') {
          identityVerified = false;
          marketplaceAccess = false;
        } else if (app.catalogEntityId) {
          identityVerified = true;
          if (kind === 'seller') {
            marketplaceAccess = brands.some((b) => b.sellerId === user.id && brandIsMarketplaceVisible(b as never));
          } else {
            marketplaceAccess = creators.some((c) => c.userId === user.id && c.status === 'live');
          }
        }
      }
    }
    const catalog = factsFromCatalog(kind, user.id, brands, creators);
    const resolved = resolveProfileStatus({
      kind,
      partnerApplicationStatus: applicationStatus,
      identityVerified,
      marketplaceAccess,
      resubmissionRequested: Boolean(app?.resubmissionRequested),
      ...catalog,
    });
    out.set(user.id, resolved.primaryLabel);
  }
  return out;
}
