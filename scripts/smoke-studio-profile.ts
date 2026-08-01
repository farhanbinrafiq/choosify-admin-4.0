/**
 * Smoke: catalog profile fields persist via store + normalizers (no HTTP auth).
 * Run: npx tsx scripts/smoke-studio-profile.ts
 */
import { catalogStore, ensureCatalogSeedData } from '../lib/vercel-catalog/catalogStore';
import { normalizeBrandInput } from '../server/catalogContract';
import {
  normalizeCreatorInput,
  normalizeProductDetailInput,
  normalizeGuideInput,
} from '../lib/vercel-catalog/catalogEditorialContract';

async function main() {
  await ensureCatalogSeedData();

  // Brands may already be seeded; list and patch Walton
  const brands = await catalogStore.listBrands();
  let walton = brands.find((b) => b.slug === 'walton' || b.name === 'Walton');
  if (!walton) {
    walton = normalizeBrandInput({
      id: 'brand-walton',
      name: 'Walton',
      category: 'Electronics',
      description: 'Made in Bangladesh',
      logo: 'https://example.com/walton-logo.png',
      coverImage: 'https://example.com/walton-cover.png',
      tagline: 'Trusted Nationwide',
      website: 'https://waltonbd.com',
      socialLinks: { facebook: 'https://facebook.com/waltonbd' },
      story: 'Walton story smoke',
      overview: {
        address: 'Gazipur',
        email: 'support@walton.bd',
        phone: '09666',
        priceRange: '৳1k–৳100k',
        services: ['Warranty'],
        tags: ['#MadeInBD'],
      },
      verifiedStatus: true,
      claimStatus: 'verified',
      followers: 100,
      ratings: 4.5,
      featuredFlag: true,
      sponsoredFlag: false,
    });
    await catalogStore.upsertBrand(walton);
  } else {
    walton = normalizeBrandInput(
      {
        ...walton,
        coverImage: 'https://example.com/walton-cover-smoke.png',
        tagline: 'Smoke tagline ' + Date.now(),
        socialLinks: { ...(walton.socialLinks || {}), youtube: 'https://youtube.com/@walton-smoke' },
        story: 'Updated story via smoke',
        overview: {
          ...(walton.overview || {}),
          address: 'Smoke HQ, Gazipur',
          email: 'smoke@walton.bd',
        },
      },
      walton,
    );
    await catalogStore.upsertBrand(walton);
  }

  const waltonReload = await catalogStore.getBrand(walton.id);
  if (!waltonReload?.coverImage || !waltonReload.tagline || !waltonReload.overview?.email) {
    throw new Error('Walton profile fields did not persist: ' + JSON.stringify(waltonReload));
  }
  console.log('OK brand', waltonReload.id, waltonReload.tagline, waltonReload.overview?.email);

  // Creator Tech Talks BD
  const creators = await catalogStore.listCreators();
  let creator = creators.find((c) => c.slug === 'tech-talks-bd' || c.name === 'Tech Talks BD');
  const creatorPayload = normalizeCreatorInput(
    {
      ...(creator || {}),
      id: creator?.id || 'creator-techtalks',
      name: 'Tech Talks BD',
      handle: '@techtalksbd',
      avatar: 'https://example.com/ttbd.png',
      coverImage: 'https://example.com/ttbd-cover-smoke.png',
      role: 'Creator & Product Researcher',
      location: 'Dhaka, Bangladesh',
      bio: 'Smoke bio ' + Date.now(),
      socialLinks: { youtube: 'https://youtube.com/@techtalksbd-smoke' },
      brandPartners: [{ name: 'Samsung' }, { name: 'Xiaomi' }, { name: 'SmokeBrand' }],
      collabTypes: ['Product Reviews'],
      score: 4.9,
      bestFor: 'Tech',
      platforms: ['YouTube'],
      followers: { YouTube: '482K' },
      verifiedStatus: true,
      featuredFlag: true,
      videos: [],
      reels: [],
      blogs: [],
      status: 'live',
    },
    creator || undefined,
  );
  await catalogStore.upsertCreator(creatorPayload);
  const creatorReload = await catalogStore.getCreator(creatorPayload.id);
  if (!creatorReload?.coverImage || !creatorReload.socialLinks?.youtube || !creatorReload.brandPartners?.some((bp) => bp.name === 'SmokeBrand')) {
    throw new Error('Creator profile fields did not persist: ' + JSON.stringify(creatorReload));
  }
  console.log('OK creator', creatorReload.id, creatorReload.coverImage, creatorReload.brandPartners);

  // Product detail
  const products = await catalogStore.listProducts();
  const product = products[0];
  if (!product) throw new Error('No products in catalog for detail smoke');
  const existingDetail = await catalogStore.getProductDetail(product.id);
  const detail = normalizeProductDetailInput(
    {
      ...(existingDetail || {}),
      productId: product.id,
      about: 'Smoke about',
      specs: [{ key: 'Smoke', value: 'Yes' }],
      overviewBlocks: [
        {
          id: 'features',
          title: 'Features',
          content: 'Smoke features',
          bullets: ['A', 'B'],
          enabled: true,
          sortOrder: 0,
        },
      ],
      optionGroups: [{ id: 'opt-color', name: 'Color', displayType: 'pills', values: ['Black', 'Silver'] }],
      sizeGuide: {
        enabled: true,
        title: 'Smoke Size Guide',
        description: 'Measure carefully',
        unitLabel: 'cm',
        columnHeaders: ['Chest'],
        rows: [{ size: 'M', Chest: '98' }],
      },
      pros: [],
      cons: [],
      bestForTags: ['Smoke'],
      storeComparisonList: [],
      physicalStores: [],
      productVariants: [],
      creatorContent: [],
    },
    product.id,
    existingDetail || undefined,
  );
  await catalogStore.upsertProductDetail(detail);
  const detailReload = await catalogStore.getProductDetail(product.id);
  if (!detailReload?.sizeGuide?.enabled || !detailReload.overviewBlocks?.length) {
    throw new Error('Product detail fields did not persist: ' + JSON.stringify(detailReload));
  }
  console.log('OK product-detail', product.id, detailReload.sizeGuide?.title, detailReload.overviewBlocks.length);

  // Guide write
  const guide = normalizeGuideInput({
    id: 'guide-smoke-profile',
    title: 'Smoke Guide ' + Date.now(),
    author: 'Tech Talks BD',
    category: 'Tech',
    image: 'https://example.com/guide.png',
    type: 'article',
    readTime: '4 min',
    views: '10',
    tags: ['smoke'],
    creatorId: creatorPayload.id,
    productIds: [product.id],
    whatWeLike: [],
    whatToConsider: [],
    status: 'live',
  });
  await catalogStore.upsertGuide(guide);
  const guideReload = await catalogStore.getGuide(guide.id);
  if (!guideReload || guideReload.creatorId !== creatorPayload.id) {
    throw new Error('Guide did not persist');
  }
  console.log('OK guide', guideReload.id, guideReload.title);

  // GET-shape routes smoke via in-process if server up
  try {
    const res = await fetch('http://127.0.0.1:3001/api/v1/catalog/brands');
    if (res.ok) {
      const json = (await res.json()) as { data?: Array<{ slug?: string; coverImage?: string }> };
      const w = (json.data || []).find((b) => b.slug === 'walton');
      console.log('OK HTTP GET brands walton cover?', !!(w && w.coverImage));
    } else {
      console.log('SKIP HTTP GET brands status', res.status);
    }
  } catch {
    console.log('SKIP HTTP (server not running)');
  }

  console.log('ALL SMOKE CHECKS PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
