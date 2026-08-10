import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, History, RotateCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { catalogApi } from '../../services/catalogApi';
import { useEntityDraft } from '../../hooks/useEntityDraft';
import { ProductDetailPresentation } from '../../components/product-detail';
import {
  createBlankProductModel,
  editorModelToDetailPayload,
  editorModelToProductPatch,
  mapCatalogProductToEditor,
  type ProductEditSection,
  type ProductEditorModel,
} from './productEditorModel';

function linesFromTextarea(value: string): string[] {
  return value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function specsFromTextarea(value: string): Array<{ key: string; value: string }> {
  return linesFromTextarea(value).map((line) => {
    const idx = line.indexOf(':');
    if (idx === -1) return { key: line, value: '' };
    return { key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
  });
}

function specsToTextarea(specs: Array<{ key: string; value: string }>): string {
  return specs.map((s) => (s.value ? `${s.key}: ${s.value}` : s.key)).join('\n');
}

export default function ProductEditStudio() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';
  const activeId = isNew ? 'new' : id;

  const draftKey = `choosify_product_draft_${activeId}`;
  const pubKey = `choosify_product_published_${activeId}`;
  const versionsKey = `choosify_product_versions_${activeId}`;

  const [model, setModel] = useState<ProductEditorModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState<ProductEditSection | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const [headerForm, setHeaderForm] = useState({
    title: '',
    brandName: '',
    brandId: '',
    categoryName: '',
    description: '',
    price: '',
    originalPrice: '',
    stock: '',
    image: '',
    galleryText: '',
    status: 'DRAFT' as ProductEditorModel['status'],
  });
  const [specsText, setSpecsText] = useState('');
  const [overviewForm, setOverviewForm] = useState({
    quality: '',
    features: '',
    audience: '',
    support: '',
    tags: '',
  });
  const [boxForm, setBoxForm] = useState({ contents: '', additionalSpecs: '' });
  const [addonsText, setAddonsText] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');

  const {
    versions,
    saveDraft: persistDraft,
    saveVersion,
    isSaving: isDraftSaving,
    error: draftError,
  } = useEntityDraft<ProductEditorModel>(
    'product',
    isNew ? '' : activeId,
    { draftKey, versionsKey },
    (backendDraft) => {
      if (backendDraft) setModel(backendDraft);
    },
  );

  useEffect(() => {
    if (isDraftSaving) setSyncStatus('saving');
    else if (draftError) setSyncStatus('error');
    else if (syncStatus === 'saving') setSyncStatus('saved');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDraftSaving, draftError]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      if (isNew) {
        if (!cancelled) {
          setModel(createBlankProductModel('new'));
          setLoading(false);
        }
        return;
      }

      let loaded: ProductEditorModel | null = null;
      try {
        const cacheDraft = localStorage.getItem(draftKey);
        if (cacheDraft) loaded = JSON.parse(cacheDraft);
      } catch (_) {}
      if (!loaded) {
        try {
          const cachePub = localStorage.getItem(pubKey);
          if (cachePub) loaded = JSON.parse(cachePub);
        } catch (_) {}
      }

      try {
        const products = await catalogApi.listProducts();
        const product = products.find((p) => p.id === activeId);
        let detail = null;
        try {
          detail = await catalogApi.getProductDetail(activeId);
        } catch (_) {}
        if (product) {
          const fromCatalog = mapCatalogProductToEditor(product, detail);
          loaded = loaded
            ? {
                ...fromCatalog,
                ...loaded,
                id: activeId,
                title: loaded.title || fromCatalog.title,
                brandName: loaded.brandName || fromCatalog.brandName,
                image: loaded.image || fromCatalog.image,
                gallery: loaded.gallery?.length ? loaded.gallery : fromCatalog.gallery,
                specs: loaded.specs?.length ? loaded.specs : fromCatalog.specs,
                publicReviews: fromCatalog.publicReviews,
                creatorVideos: fromCatalog.creatorVideos,
              }
            : fromCatalog;
        }
      } catch (_) {}

      if (!loaded) loaded = createBlankProductModel(activeId);
      if (!cancelled) {
        setModel(loaded);
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, isNew]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => setToastMessage(null), 3500);
  };

  const openDrawer = (section: ProductEditSection) => {
    if (!model) return;
    setActiveDrawer(section);
    if (section === 'header' || section === 'pricing' || section === 'media') {
      setHeaderForm({
        title: model.title,
        brandName: model.brandName,
        brandId: model.brandId,
        categoryName: model.categoryName,
        description: model.description,
        price: String(model.price || ''),
        originalPrice: String(model.originalPrice || ''),
        stock: String(model.stock || ''),
        image: model.image,
        galleryText: (model.gallery || []).join('\n'),
        status: model.status,
      });
    } else if (section === 'specs') {
      setSpecsText(specsToTextarea(model.specs));
    } else if (section === 'overview') {
      setOverviewForm({
        quality: model.overviewQuality.join('\n'),
        features: model.overviewFeatures.join('\n'),
        audience: model.overviewAudience.join('\n'),
        support: model.overviewSupport.join('\n'),
        tags: model.bestForTags.join(', '),
      });
    } else if (section === 'box') {
      setBoxForm({
        contents: model.boxContents.join('\n'),
        additionalSpecs: specsToTextarea(model.additionalSpecs),
      });
    } else if (section === 'addons') {
      setAddonsText(model.addons.map((a) => (a.price ? `${a.name} | ${a.price}` : a.name)).join('\n'));
    } else if (section === 'delivery') {
      setDeliveryNote(model.deliveryNote);
    }
  };

  const saveDrawer = () => {
    if (!model || !activeDrawer) return;
    let next = { ...model };

    if (activeDrawer === 'header' || activeDrawer === 'pricing' || activeDrawer === 'media') {
      const gallery = linesFromTextarea(headerForm.galleryText);
      next = {
        ...next,
        title: headerForm.title,
        brandName: headerForm.brandName,
        brandId: headerForm.brandId,
        categoryName: headerForm.categoryName,
        description: headerForm.description,
        price: Number(headerForm.price) || 0,
        originalPrice: Number(headerForm.originalPrice) || 0,
        stock: Number(headerForm.stock) || 0,
        image: headerForm.image || gallery[0] || '',
        gallery: gallery.length ? gallery : headerForm.image ? [headerForm.image] : [],
        status: headerForm.status,
      };
    } else if (activeDrawer === 'specs') {
      next = { ...next, specs: specsFromTextarea(specsText) };
    } else if (activeDrawer === 'overview') {
      next = {
        ...next,
        overviewQuality: linesFromTextarea(overviewForm.quality),
        overviewFeatures: linesFromTextarea(overviewForm.features),
        overviewAudience: linesFromTextarea(overviewForm.audience),
        overviewSupport: linesFromTextarea(overviewForm.support),
        bestForTags: overviewForm.tags
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      };
    } else if (activeDrawer === 'box') {
      next = {
        ...next,
        boxContents: linesFromTextarea(boxForm.contents),
        additionalSpecs: specsFromTextarea(boxForm.additionalSpecs),
      };
    } else if (activeDrawer === 'addons') {
      next = {
        ...next,
        addons: linesFromTextarea(addonsText).map((line) => {
          const [name, price] = line.split('|').map((s) => (s || '').trim());
          return { name, price: price || '' };
        }),
      };
    } else if (activeDrawer === 'delivery') {
      next = { ...next, deliveryNote };
    }

    setModel(next);
    setHasUnsavedChanges(true);
    setActiveDrawer(null);
    triggerToast('Section saved to draft canvas');
  };

  const handleSaveDraft = async () => {
    if (!model) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify(model));
      if (!isNew) {
        persistDraft(model);
        await saveVersion(`Draft ${new Date().toLocaleString()}`, model);
      }
      setHasUnsavedChanges(false);
      setSyncStatus('saved');
      triggerToast('Draft saved');
    } catch (err) {
      setSyncStatus('error');
      triggerToast(err instanceof Error ? err.message : 'Draft save failed');
    }
  };

  const handlePublish = async () => {
    if (!model) return;
    setIsPublishing(true);
    try {
      let productId = model.id;
      const patch = editorModelToProductPatch({ ...model, status: 'LIVE' });
      if (isNew || productId === 'new') {
        const created = await catalogApi.createProduct(patch);
        productId = created.id;
      } else {
        await catalogApi.updateProduct(productId, patch);
      }
      try {
        await catalogApi.upsertProductDetail(productId, editorModelToDetailPayload({ ...model, id: productId }));
      } catch (_) {
        // Detail upsert may be optional depending on backend completeness
      }
      const published = { ...model, id: productId, status: 'LIVE' as const };
      localStorage.setItem(`choosify_product_published_${productId}`, JSON.stringify(published));
      localStorage.setItem(`choosify_product_draft_${productId}`, JSON.stringify(published));
      setModel(published);
      setHasUnsavedChanges(false);
      setShowPublishModal(false);
      triggerToast('Product published');
      if (isNew) navigate(`/admin/products/${productId}/edit`, { replace: true });
    } catch (err) {
      triggerToast(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setIsPublishing(false);
    }
  };

  if (loading || !model) {
    return (
      <div className="flex flex-col items-center justify-center h-[420px] gap-3 text-app-text-muted">
        <RotateCw className="w-10 h-10 animate-spin text-[#EF3C23]" />
        <span className="text-xs font-mono">Loading Product Visual Builder…</span>
      </div>
    );
  }

  const drawerTitle =
    activeDrawer === 'header'
      ? 'Edit Product Header'
      : activeDrawer === 'media'
        ? 'Edit Media Gallery'
        : activeDrawer === 'pricing'
          ? 'Edit Pricing & Stock'
          : activeDrawer === 'specs'
            ? 'Edit Specifications'
            : activeDrawer === 'overview'
              ? 'Edit Product Overview'
              : activeDrawer === 'box'
                ? 'Edit Box & Physical Specs'
                : activeDrawer === 'addons'
                  ? 'Edit Add-ons'
                  : activeDrawer === 'delivery'
                    ? 'Edit Delivery'
                    : '';

  return (
    <div className="aws-page flex flex-col text-slate-900 relative overflow-x-hidden">
      <header className="h-14 shrink-0 bg-white border border-app-border rounded-[18px] px-5 flex items-center justify-between z-30 shadow-sm mb-5">
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/admin/products')}
            className="p-2 bg-[#F1F3F5] text-slate-700 hover:bg-[#E8EDF2] rounded-[8px] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm font-black text-[#111827] truncate max-w-[420px]">
                {model.title || 'New Product'}
              </h1>
              <span
                className={`p-0.5 rounded-full text-[9px] font-bold px-1.5 ${
                  model.status === 'LIVE'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {model.status === 'LIVE' ? '● LIVE' : '○ DRAFT'}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-mono tracking-wider">
              Choosify Product Visual Builder
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hasUnsavedChanges ? (
            <span className="text-[#EF3C23] text-[10px] font-mono font-bold animate-pulse">
              ● UNSAVED
            </span>
          ) : null}
          {syncStatus === 'saving' ? (
            <span className="text-blue-600 text-[10px] font-mono font-bold">● Saving…</span>
          ) : null}
          {syncStatus === 'saved' ? (
            <span className="text-emerald-600 text-[10px] font-mono font-bold flex items-center gap-1">
              <Check className="w-3 h-3" /> Synced
            </span>
          ) : null}

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowVersions((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E8EDF2] text-[11px] font-bold bg-white"
            >
              <History className="w-4 h-4 text-[#EF3C23]" />
              Snapshots ({versions?.length || 0})
            </button>
            {showVersions ? (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-[#E8EDF2] rounded-xl shadow-xl p-3 z-40">
                <p className="text-xs font-black uppercase text-[#EF3C23] border-b border-slate-100 pb-2 m-0 mb-2">
                  History
                </p>
                {(versions || []).length === 0 ? (
                  <p className="text-[11px] text-slate-500 m-0">No snapshots yet.</p>
                ) : (
                  <ul className="m-0 p-0 list-none space-y-1 max-h-48 overflow-y-auto">
                    {(versions || []).slice(0, 8).map((v) => (
                      <li key={v.id} className="text-[11px] text-slate-700 py-1 border-b border-slate-50">
                        {v.label || v.createdAt}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => void handleSaveDraft()}
            className="px-3.5 py-2 rounded-lg border border-[#E8EDF2] text-[11px] font-extrabold bg-white"
          >
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => setShowPublishModal(true)}
            className="px-3.5 py-2 rounded-lg text-[11px] font-extrabold text-white bg-[#EF3C23]"
          >
            Publish
          </button>
        </div>
      </header>

      <ProductDetailPresentation
        model={model}
        mode="editor"
        onEditSection={(section) => openDrawer(section)}
      />

      <AnimatePresence>
        {activeDrawer ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveDrawer(null)}
              className="fixed inset-0 bg-app-card z-40"
            />
            <motion.div
              initial={{ x: 480 }}
              animate={{ x: 0 }}
              exit={{ x: 480 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed top-0 right-0 h-full w-full max-w-[480px] bg-white z-50 shadow-2xl border-l border-[#E8EDF2] p-5 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-black m-0">{drawerTitle}</h2>
                <button
                  type="button"
                  onClick={() => setActiveDrawer(null)}
                  className="text-[11px] font-bold text-slate-500 bg-transparent border-0 cursor-pointer"
                >
                  Close
                </button>
              </div>

              {(activeDrawer === 'header' || activeDrawer === 'pricing' || activeDrawer === 'media') && (
                <div className="space-y-3">
                  <label className="block text-[9px] font-black uppercase text-slate-500">Title</label>
                  <input
                    value={headerForm.title}
                    onChange={(e) => setHeaderForm({ ...headerForm, title: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-xs"
                  />
                  <label className="block text-[9px] font-black uppercase text-slate-500">Brand</label>
                  <input
                    value={headerForm.brandName}
                    onChange={(e) => setHeaderForm({ ...headerForm, brandName: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-xs"
                  />
                  <label className="block text-[9px] font-black uppercase text-slate-500">Category</label>
                  <input
                    value={headerForm.categoryName}
                    onChange={(e) => setHeaderForm({ ...headerForm, categoryName: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-xs"
                  />
                  <label className="block text-[9px] font-black uppercase text-slate-500">Description</label>
                  <textarea
                    rows={3}
                    value={headerForm.description}
                    onChange={(e) => setHeaderForm({ ...headerForm, description: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-xs"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[9px] font-black uppercase text-slate-500">Price</label>
                      <input
                        value={headerForm.price}
                        onChange={(e) => setHeaderForm({ ...headerForm, price: e.target.value })}
                        className="w-full p-2.5 border rounded-xl text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black uppercase text-slate-500">MRP</label>
                      <input
                        value={headerForm.originalPrice}
                        onChange={(e) => setHeaderForm({ ...headerForm, originalPrice: e.target.value })}
                        className="w-full p-2.5 border rounded-xl text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black uppercase text-slate-500">Stock</label>
                      <input
                        value={headerForm.stock}
                        onChange={(e) => setHeaderForm({ ...headerForm, stock: e.target.value })}
                        className="w-full p-2.5 border rounded-xl text-xs"
                      />
                    </div>
                  </div>
                  <label className="block text-[9px] font-black uppercase text-slate-500">Main image URL</label>
                  <input
                    value={headerForm.image}
                    onChange={(e) => setHeaderForm({ ...headerForm, image: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-xs"
                  />
                  <label className="block text-[9px] font-black uppercase text-slate-500">
                    Gallery URLs (one per line)
                  </label>
                  <textarea
                    rows={4}
                    value={headerForm.galleryText}
                    onChange={(e) => setHeaderForm({ ...headerForm, galleryText: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-xs font-mono"
                  />
                  <label className="block text-[9px] font-black uppercase text-slate-500">Status</label>
                  <select
                    value={headerForm.status}
                    onChange={(e) =>
                      setHeaderForm({
                        ...headerForm,
                        status: e.target.value as ProductEditorModel['status'],
                      })
                    }
                    className="w-full p-2.5 border rounded-xl text-xs"
                  >
                    <option value="DRAFT">DRAFT</option>
                    <option value="LIVE">LIVE</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>
              )}

              {activeDrawer === 'specs' && (
                <div>
                  <p className="text-[11px] text-slate-500 mb-2">One spec per line as `Key: Value`</p>
                  <textarea
                    rows={12}
                    value={specsText}
                    onChange={(e) => setSpecsText(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-xs font-mono"
                  />
                </div>
              )}

              {activeDrawer === 'overview' && (
                <div className="space-y-3">
                  {(
                    [
                      ['quality', 'Quality & Materials'],
                      ['features', 'Features & Benefits'],
                      ['audience', 'Audience & Use Cases'],
                      ['support', 'Customer Support & Assurance'],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key}>
                      <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">
                        {label}
                      </label>
                      <textarea
                        rows={3}
                        value={overviewForm[key]}
                        onChange={(e) => setOverviewForm({ ...overviewForm, [key]: e.target.value })}
                        className="w-full p-2.5 border rounded-xl text-xs"
                        placeholder="One bullet per line"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">
                      Best-for tags (comma separated)
                    </label>
                    <input
                      value={overviewForm.tags}
                      onChange={(e) => setOverviewForm({ ...overviewForm, tags: e.target.value })}
                      className="w-full p-2.5 border rounded-xl text-xs"
                    />
                  </div>
                </div>
              )}

              {activeDrawer === 'box' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">
                      Box contents (one per line)
                    </label>
                    <textarea
                      rows={5}
                      value={boxForm.contents}
                      onChange={(e) => setBoxForm({ ...boxForm, contents: e.target.value })}
                      className="w-full p-2.5 border rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">
                      Physical specs (`Key: Value` per line)
                    </label>
                    <textarea
                      rows={5}
                      value={boxForm.additionalSpecs}
                      onChange={(e) => setBoxForm({ ...boxForm, additionalSpecs: e.target.value })}
                      className="w-full p-2.5 border rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>
              )}

              {activeDrawer === 'addons' && (
                <div>
                  <p className="text-[11px] text-slate-500 mb-2">
                    One add-on per line as `Name | +৳price`
                  </p>
                  <textarea
                    rows={8}
                    value={addonsText}
                    onChange={(e) => setAddonsText(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-xs font-mono"
                  />
                </div>
              )}

              {activeDrawer === 'delivery' && (
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">
                    Delivery information
                  </label>
                  <textarea
                    rows={5}
                    value={deliveryNote}
                    onChange={(e) => setDeliveryNote(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-xs"
                    placeholder="Delivery coverage, ETA, COD notes…"
                  />
                </div>
              )}

              <div className="border-t border-slate-100 pt-4 mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => setActiveDrawer(null)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-800 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveDrawer}
                  className="flex-1 py-2.5 bg-[#EF3C23] text-white text-xs font-black uppercase tracking-wider rounded-xl"
                >
                  Save Section
                </button>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      {showPublishModal ? (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-black m-0 mb-2">Publish Live Product?</h3>
            <p className="text-[12px] text-slate-600 m-0 mb-5">
              This writes the Product to the catalog API and marks it LIVE where supported.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPublishing}
                onClick={() => void handlePublish()}
                className="flex-1 py-2.5 rounded-xl bg-[#EF3C23] text-white text-xs font-black disabled:opacity-50"
              >
                {isPublishing ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-[70] bg-[#0A0A1F] text-white text-xs font-bold px-5 py-3 rounded-xl shadow-2xl">
          {toastMessage}
        </div>
      ) : null}
    </div>
  );
}
