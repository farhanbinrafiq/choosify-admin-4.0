import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image as ImageIcon, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { catalogApi } from '../../services/catalogApi';
import { uploadProductImage } from '../../services/mediaUpload';
import type { CatalogBrand, CatalogDealsBanner, CatalogProduct, DealsBannerDestinationType } from '../../types/catalog';

type DraftBanner = CatalogDealsBanner & { href?: string };

const emptyDraft = (order: number): DraftBanner => ({
  id: `deals-banner-${Date.now()}`,
  image: '',
  destinationType: 'custom-url',
  destinationRef: '/deals',
  order,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export default function DealsBannersStudio() {
  const [banners, setBanners] = useState<DraftBanner[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [brands, setBrands] = useState<CatalogBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [productQuery, setProductQuery] = useState('');
  const [brandQuery, setBrandQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bannerList, productList, brandList] = await Promise.all([
        catalogApi.listDealsBanners({ active: false }),
        catalogApi.listProducts().catch(() => [] as CatalogProduct[]),
        catalogApi.listBrands().catch(() => [] as CatalogBrand[]),
      ]);
      setBanners(bannerList.slice().sort((a, b) => a.order - b.order));
      setProducts(productList);
      setBrands(brandList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deals banners');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products.slice(0, 40);
    return products
      .filter((p) => `${p.title} ${p.brandName} ${p.id}`.toLowerCase().includes(q))
      .slice(0, 40);
  }, [products, productQuery]);

  const filteredBrands = useMemo(() => {
    const q = brandQuery.trim().toLowerCase();
    if (!q) return brands.slice(0, 40);
    return brands
      .filter((b) => `${b.name} ${b.id}`.toLowerCase().includes(q))
      .slice(0, 40);
  }, [brands, brandQuery]);

  const updateLocal = (id: string, patch: Partial<DraftBanner>) => {
    setBanners((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const handleUpload = async (id: string, file: File | null) => {
    if (!file) return;
    setUploadingId(id);
    setError(null);
    try {
      const url = await uploadProductImage(file);
      updateLocal(id, { image: url });
      setMessage('Image uploaded — save the banner to publish.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed');
    } finally {
      setUploadingId(null);
    }
  };

  const handleSave = async (banner: DraftBanner) => {
    if (!banner.image.trim()) {
      setError('Each banner needs an uploaded image.');
      return;
    }
    setSavingId(banner.id);
    setError(null);
    setMessage(null);
    try {
      const exists = await catalogApi
        .listDealsBanners({ active: false })
        .then((list) => list.some((b) => b.id === banner.id))
        .catch(() => false);

      const payload = {
        image: banner.image,
        destinationType: banner.destinationType,
        destinationRef: banner.destinationRef,
        order: Number(banner.order) || 0,
        isActive: banner.isActive,
      };

      const saved = exists
        ? await catalogApi.updateDealsBanner(banner.id, payload)
        : await catalogApi.createDealsBanner({ ...payload, id: banner.id });

      setBanners((prev) =>
        prev
          .map((b) => (b.id === banner.id ? { ...saved } : b))
          .sort((a, b) => a.order - b.order),
      );
      setMessage('Banner saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save banner');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this deals banner?')) return;
    setSavingId(id);
    setError(null);
    try {
      const known = banners.find((b) => b.id === id);
      // New unsaved drafts only exist locally
      const onServer = known?.createdAt && known.updatedAt && known.image;
      try {
        await catalogApi.deleteDealsBanner(id);
      } catch {
        if (onServer) throw new Error('Failed to delete banner on server');
      }
      setBanners((prev) => prev.filter((b) => b.id !== id));
      setMessage('Banner removed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete banner');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-2 text-sm text-app-text-secondary">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading Today&apos;s Deals banners…
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-app-text-primary tracking-tight">
            Today&apos;s Deals Banners
          </h1>
          <p className="text-[12px] text-app-text-secondary mt-1 max-w-xl">
            Upload image-only carousel cards for the homepage. Each card links to a product, brand,
            or custom URL. Images use the same Cloudinary upload path as Product Studio.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setBanners((prev) => [...prev, emptyDraft(prev.length)])}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-app-accent text-white text-[11px] font-black uppercase tracking-wider cursor-pointer border-0"
        >
          <Plus className="w-3.5 h-3.5" /> Add banner
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-[12px] px-3 py-2">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-[12px] px-3 py-2">
          {message}
        </div>
      )}

      <div className="space-y-4">
        {banners.length === 0 && (
          <div className="rounded-xl border border-dashed border-app-border p-10 text-center text-[12px] text-app-text-secondary">
            No banners yet. Add one to start the homepage carousel.
          </div>
        )}

        {banners.map((banner) => (
          <div
            key={banner.id}
            className="rounded-xl border border-app-border bg-white p-4 shadow-sm space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-app-accent bg-orange-50 px-2 py-0.5 rounded">
                  Order {banner.order}
                </span>
                <span
                  className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                    banner.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {banner.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleSave(banner)}
                  disabled={savingId === banner.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-app-border text-[10px] font-bold uppercase cursor-pointer bg-white disabled:opacity-50"
                >
                  {savingId === banner.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Save className="w-3 h-3" />
                  )}
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(banner.id)}
                  className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 cursor-pointer border-0 bg-transparent"
                  title="Delete banner"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
              <div className="space-y-2">
                <div className="aspect-[5/2] rounded-lg overflow-hidden border border-app-border bg-gray-50 flex items-center justify-center">
                  {banner.image ? (
                    <img src={banner.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-gray-300" />
                  )}
                </div>
                <label className="block">
                  <span className="sr-only">Upload image</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="block w-full text-[11px]"
                    disabled={uploadingId === banner.id}
                    onChange={(e) => void handleUpload(banner.id, e.target.files?.[0] ?? null)}
                  />
                </label>
                {uploadingId === banner.id && (
                  <p className="text-[10px] text-app-text-secondary flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Uploading…
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-[10px] font-bold uppercase text-app-text-secondary">
                    Display order
                  </span>
                  <input
                    type="number"
                    value={banner.order}
                    onChange={(e) => updateLocal(banner.id, { order: Number(e.target.value) || 0 })}
                    className="w-full h-9 px-2.5 rounded-lg border border-app-border text-[12px]"
                  />
                </label>

                <label className="flex items-center gap-2 mt-5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={banner.isActive}
                    onChange={(e) => updateLocal(banner.id, { isActive: e.target.checked })}
                    className="rounded border-app-border"
                  />
                  <span className="text-[12px] font-semibold text-app-text-primary">Active</span>
                </label>

                <label className="block space-y-1 sm:col-span-2">
                  <span className="text-[10px] font-bold uppercase text-app-text-secondary">
                    Destination type
                  </span>
                  <select
                    value={banner.destinationType}
                    onChange={(e) =>
                      updateLocal(banner.id, {
                        destinationType: e.target.value as DealsBannerDestinationType,
                        destinationRef:
                          e.target.value === 'custom-url' ? banner.destinationRef || '/deals' : '',
                      })
                    }
                    className="w-full h-9 px-2.5 rounded-lg border border-app-border text-[12px] bg-white"
                  >
                    <option value="product">Product</option>
                    <option value="brand">Brand</option>
                    <option value="custom-url">Custom URL</option>
                  </select>
                </label>

                {banner.destinationType === 'product' && (
                  <div className="sm:col-span-2 space-y-2">
                    <input
                      type="search"
                      value={productQuery}
                      onChange={(e) => setProductQuery(e.target.value)}
                      placeholder="Search products…"
                      className="w-full h-9 px-2.5 rounded-lg border border-app-border text-[12px]"
                    />
                    <select
                      value={banner.destinationRef}
                      onChange={(e) => updateLocal(banner.id, { destinationRef: e.target.value })}
                      className="w-full h-9 px-2.5 rounded-lg border border-app-border text-[12px] bg-white"
                    >
                      <option value="">Select product…</option>
                      {filteredProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} ({p.id})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {banner.destinationType === 'brand' && (
                  <div className="sm:col-span-2 space-y-2">
                    <input
                      type="search"
                      value={brandQuery}
                      onChange={(e) => setBrandQuery(e.target.value)}
                      placeholder="Search brands…"
                      className="w-full h-9 px-2.5 rounded-lg border border-app-border text-[12px]"
                    />
                    <select
                      value={banner.destinationRef}
                      onChange={(e) => updateLocal(banner.id, { destinationRef: e.target.value })}
                      className="w-full h-9 px-2.5 rounded-lg border border-app-border text-[12px] bg-white"
                    >
                      <option value="">Select brand…</option>
                      {filteredBrands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.id})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {banner.destinationType === 'custom-url' && (
                  <label className="block space-y-1 sm:col-span-2">
                    <span className="text-[10px] font-bold uppercase text-app-text-secondary">
                      URL
                    </span>
                    <input
                      type="text"
                      value={banner.destinationRef}
                      onChange={(e) => updateLocal(banner.id, { destinationRef: e.target.value })}
                      placeholder="/deals or https://…"
                      className="w-full h-9 px-2.5 rounded-lg border border-app-border text-[12px]"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
