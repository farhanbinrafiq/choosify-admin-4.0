import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { catalogApi } from '../../../services/catalogApi';
import type { CatalogBrand, CatalogProduct } from '../../../types/catalog';
import { mapCatalogBrandToModel, mapCatalogProductToItem } from '../../../pages/admin/brandEditorModel';
import { BrandProfilePresentation } from '../../brand-profile/BrandProfilePresentation';
import { publicProfileUrl } from '../PublicHandlePanels';

/**
 * Brand Portfolio on the Super Admin Seller Profile = the seller's REAL brand
 * profile, rendered by the same BrandProfilePresentation component Brand
 * Studio uses, from the same catalog record and the same canonical mappers
 * (brandEditorModel). Read-only here; in Edit mode it hands off to the
 * canonical Brand Studio editor — there is no second brand editor.
 */
export function BrandPortfolioView({ brands, products, editing }: { brands: CatalogBrand[]; products: CatalogProduct[]; editing: boolean }) {
  const [brandId, setBrandId] = useState(brands[0]?.id || '');
  const [legacyDeals, setLegacyDeals] = useState<Awaited<ReturnType<typeof catalogApi.listDeals>>>([]);
  const [loadingDeals, setLoadingDeals] = useState(true);

  useEffect(() => {
    if (!brands.some((b) => b.id === brandId)) setBrandId(brands[0]?.id || '');
  }, [brands, brandId]);

  useEffect(() => {
    let alive = true;
    catalogApi
      .listDeals()
      .then((d) => alive && setLegacyDeals(d))
      .catch(() => alive && setLegacyDeals([]))
      .finally(() => alive && setLoadingDeals(false));
    return () => {
      alive = false;
    };
  }, []);

  const brand = brands.find((b) => b.id === brandId);
  // Same enrichment Brand Studio applies: the brand's real catalog products + deals.
  const model = useMemo(() => {
    if (!brand) return null;
    let m = mapCatalogBrandToModel(brand);
    const brandProducts = products.filter((p) => p.brandId === brand.id).map(mapCatalogProductToItem);
    if (brandProducts.length) m = { ...m, products: brandProducts };
    const deals = legacyDeals
      .filter((d) => d.brandId === brand.id)
      .map((d) => ({
        id: d.id,
        title: d.name,
        discountType: (d.discountType === 'flat' ? 'Flat' : 'Percentage') as 'Percentage' | 'Flat',
        discountValue: d.discountValue,
        status: (d.status === 'live' ? 'Active' : d.status === 'expired' ? 'Expired' : 'Scheduled') as 'Active' | 'Scheduled' | 'Expired',
        startDate: d.validFrom || '',
        endDate: d.validUntil || '',
      }));
    if (deals.length) m = { ...m, deals };
    return m;
  }, [brand, products, legacyDeals]);

  if (brands.length === 0) {
    return (
      <div style={{ background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: 24, textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#9CA3AF', fontStyle: 'italic' }}>
        This seller owns no brands yet, so there is no brand profile to show.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-testid="brand-portfolio">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: '10px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF' }}>BRAND PROFILE (LIVE BRAND STUDIO DATA)</span>
          {brands.length > 1 ? (
            <select value={brandId} onChange={(e) => setBrandId(e.target.value)} aria-label="Choose brand" style={{ border: '1px solid #E8EDF2', borderRadius: 7, padding: '5px 8px', fontSize: 12, fontWeight: 700 }}>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          ) : (
            <span style={{ fontSize: 12, fontWeight: 800 }}>{brand?.name}</span>
          )}
          <span style={{ fontSize: 10.5, color: '#6B7280', fontWeight: 600 }}>Last updated {brand?.updatedAt ? new Date(brand.updatedAt).toLocaleString() : '—'}</span>
        </div>
        {editing && brand ? (
          <Link to={`/admin/brand-studio/${encodeURIComponent(brand.id)}/edit`} style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--cms-accent)', textDecoration: 'none' }} data-testid="brand-portfolio-edit">
            Edit in Brand Studio →
          </Link>
        ) : (
          <span style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 700 }}>View only</span>
        )}
      </div>
      {loadingDeals || !model || !brand ? (
        <div style={{ padding: 30, textAlign: 'center' }}><Loader2 size={18} className="animate-spin" /></div>
      ) : (
        <div style={{ border: '1px solid #E8EDF2', borderRadius: 8, overflow: 'hidden', background: '#F0F8FF' }}>
          <BrandProfilePresentation
            model={model}
            mode="editor"
            publicUrl={publicProfileUrl('brand', { handle: (brand as { publicHandle?: string | null }).publicHandle, slug: brand.slug, id: brand.id })}
            visibility={{ marketplaceStatus: brand.marketplaceStatus, marketplaceAccess: brand.marketplaceAccess, sellerId: brand.sellerId }}
          />
        </div>
      )}
    </div>
  );
}
