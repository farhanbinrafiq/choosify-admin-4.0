import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCw } from 'lucide-react';
import { catalogApi } from '../../services/catalogApi';
import { ProductDetailPresentation } from '../../components/product-detail';
import { createBlankProductModel, mapCatalogProductToEditor, type ProductEditorModel } from './productEditorModel';

/**
 * Read-only storefront-parity preview of a product's Product Detail page,
 * rendered from the REAL catalog API (not localStorage, not mock). It exists so
 * changes made in Product Studio — including the optional product video — can be
 * checked against the same carousel the public storefront uses. It renders the
 * shared <ProductDetailPresentation mode="public"> component; it does not
 * redesign or replace the public storefront.
 */
export default function ProductStorefrontPreview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [model, setModel] = useState<ProductEditorModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const products = await catalogApi.listProducts();
        const product = products.find((p) => p.id === id);
        if (!product) {
          if (!cancelled) { setError('Product not found or not visible to you.'); setLoading(false); }
          return;
        }
        let detail = null;
        try { detail = await catalogApi.getProductDetail(id!); } catch (_) {}
        if (!cancelled) {
          setModel(mapCatalogProductToEditor(product, detail));
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) { setError(err instanceof Error ? err.message : 'Failed to load product.'); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  return (
    <div style={{ background: '#F0F8FF', minHeight: '100vh' }}>
      <div style={{ background: '#0A0A1F', color: '#fff', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', fontSize: 11, letterSpacing: '0.05em' }}>
        <button type="button" onClick={() => navigate(id ? `/admin/products/${id}/edit` : '/admin/products')}
          style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6, color: '#fff', padding: '5px 8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={13} /> Back to Product Studio
        </button>
        <span style={{ opacity: 0.6, fontWeight: 700, textTransform: 'uppercase' }}>Storefront preview · read-only · live catalog data</span>
      </div>
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 360, gap: 10, color: '#6B7280' }}>
          <RotateCw className="w-8 h-8 animate-spin" />
          <span style={{ fontSize: 12 }}>Loading storefront preview…</span>
        </div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#DC2626', fontWeight: 600 }}>{error}</div>
      ) : (
        <ProductDetailPresentation model={model || createBlankProductModel(id || 'preview')} mode="public" />
      )}
    </div>
  );
}
