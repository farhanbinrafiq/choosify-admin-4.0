// BrandEditStudio.tsx
//
// Storefront-parity Brand Studio — section-level INLINE editing (no drawer, no
// modal, no page-wide form). Mirrors ProductEditStudio: the seller sees the real
// Brand storefront; each canonically-backed region carries an "Edit" pill that
// swaps that region in place to an inline editor with Save / Cancel. One active
// section at a time; unsaved-change switching is blocked.
//
// Every section save goes through the ONE canonical write path
// `brandModelToCanonicalPatch` → `catalogApi.updateBrand` (PATCH /catalog/brands)
// which persists coverImage / tagline / website / socialLinks / story /
// storyVideoUrl / overview / credentials — the fields the old drawer studio
// dropped. Platform-owned fields (verification / claim / marketplace access /
// followers / ratings / featured / sponsored) are never written from here.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, GripVertical, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { catalogApi } from '../../services/catalogApi';
import type { CatalogBrand, CatalogGuide } from '../../types/catalog';
import type { BrandCMSModel, BrandServiceCenterEntry, BrandStoreEntry } from './brandSeeds';
import {
  brandModelToCanonicalPatch,
  createBlankBrandModel,
  detectStoryMediaKind,
  mapCatalogBrandToModel,
  mapCatalogProductToItem,
  type BrandEditSection,
  type StoryMediaKind,
} from './brandEditorModel';

const MEDIA_KIND_LABEL: Record<StoryMediaKind, string> = {
  youtube: 'YouTube (16:9)',
  youtube_shorts: 'YouTube Shorts (9:16)',
  instagram_reel: 'Instagram Reel (9:16)',
  instagram_post: 'Instagram post (1:1)',
  tiktok: 'TikTok (9:16)',
  facebook: 'Facebook (16:9)',
  other: 'Other / link (16:9)',
};
import { BrandImageUploadField } from './BrandImageUploadField';
import { BrandProfilePresentation } from '../../components/brand-profile';
import type { BrandStudioBridge } from '../../components/brand-profile/BrandProfileHero';

interface BrandEditStudioProps {
  overrideId?: string;
  isNested?: boolean;
}

const label = 'block text-[10px] font-extrabold uppercase tracking-wider text-[#6B7280] mb-1';
const input =
  'w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12.5px] text-[#1A1A2E] outline-none focus:border-[#EF3C23]/50 bg-white';
const textarea = `${input} resize-y`;
const ghostBtn =
  'inline-flex items-center gap-1 rounded-md border border-[#E8EDF2] bg-white px-2 py-1 text-[11px] font-bold text-[#374151]';
const accentBtn =
  'inline-flex items-center gap-1 rounded-md bg-[#EF3C23] px-3 py-1.5 text-[11px] font-extrabold text-white';
const hint = 'mt-1 text-[10.5px] leading-snug text-[#9CA3AF]';

const linesToArr = (v: string) => v.split('\n').map((s) => s.trim()).filter(Boolean);

export default function BrandEditStudio({ overrideId, isNested }: BrandEditStudioProps = {}) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeBrandId, allBrands, setActiveBrandId } = useAuth();
  const activeId = overrideId || id || activeBrandId || '';

  useEffect(() => {
    if (activeId) setActiveBrandId(activeId);
  }, [activeId, setActiveBrandId]);

  const [model, setModel] = useState<BrandCMSModel | null>(null);
  const [guides, setGuides] = useState<CatalogGuide[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<BrandEditSection | null>(null);
  const [draft, setDraft] = useState<BrandCMSModel | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const triggerToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    setModel(null);
    async function load() {
      if (!activeId) {
        setModel(createBlankBrandModel('new', '', ''));
        return;
      }
      let loaded: BrandCMSModel;
      try {
        const brands = await catalogApi.listBrands();
        const found = brands.find((b) => b.id === activeId);
        if (!found) {
          if (!cancelled) setLoadError('This brand could not be found or you do not have access to it.');
          return;
        }
        loaded = mapCatalogBrandToModel(found);
      } catch (e) {
        if (!cancelled) {
          setLoadError(
            e instanceof Error ? `Couldn't load this brand — ${e.message}` : "Couldn't load this brand.",
          );
        }
        return;
      }
      // Attach real catalog products + deals for the preview-only sections.
      try {
        const products = await catalogApi.listProducts();
        const brandProducts = products
          .filter(
            (p) =>
              p.brandId === activeId ||
              (loaded.brandName && p.brandName?.toLowerCase() === loaded.brandName.toLowerCase()),
          )
          .map(mapCatalogProductToItem);
        if (brandProducts.length) loaded = { ...loaded, products: brandProducts };
      } catch {
        /* preview only */
      }
      try {
        const deals = await catalogApi.listDeals();
        const brandDeals = deals
          .filter((d) => d.brandId === activeId)
          .map((d) => ({
            id: d.id,
            title: d.name,
            discountType: (d.discountType === 'flat' ? 'Flat' : 'Percentage') as 'Percentage' | 'Flat',
            discountValue: d.discountValue,
            status: (d.status === 'live' ? 'Active' : d.status === 'expired' ? 'Expired' : 'Scheduled') as
              | 'Active'
              | 'Scheduled'
              | 'Expired',
            startDate: d.validFrom || '',
            endDate: d.validUntil || '',
          }));
        if (brandDeals.length) loaded = { ...loaded, deals: brandDeals };
      } catch {
        /* preview only */
      }
      // Seller's own published content (Guides / Reviews / Live / blogs) for the
      // Brand Story pin picker.
      try {
        const g = await catalogApi.listGuides({ status: 'live' });
        if (!cancelled) setGuides(Array.isArray(g) ? g : []);
      } catch {
        if (!cancelled) setGuides([]);
      }
      if (!cancelled) setModel(loaded);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [activeId, reloadNonce]);

  const dirty = useMemo(
    () => !!draft && !!model && JSON.stringify(draft) !== JSON.stringify(model),
    [draft, model],
  );

  const requestEdit = (section: BrandEditSection) => {
    if (!model) return;
    if (editingId && editingId !== section && dirty) {
      triggerToast(`Finish editing “${editingId}” first — Save or Cancel.`);
      return;
    }
    setDraft(JSON.parse(JSON.stringify(model)) as BrandCMSModel);
    setEditingId(section);
  };

  const cancelSection = () => {
    setEditingId(null);
    setDraft(null);
  };

  const patch = (p: Partial<BrandCMSModel>) => setDraft((d) => (d ? { ...d, ...p } : d));

  const saveSection = async () => {
    if (!draft || !model || saving) return;
    setSaving(true);
    try {
      const saved = await catalogApi.updateBrand(activeId, brandModelToCanonicalPatch(draft));
      const next = mapCatalogBrandToModel(saved);
      // keep the preview-only lists we already attached
      setModel({ ...next, products: model.products, deals: model.deals, promoCodes: model.promoCodes });
      setEditingId(null);
      setDraft(null);
      triggerToast('Section saved.');
    } catch (e) {
      triggerToast(e instanceof Error ? `Save failed — ${e.message}` : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  // ── inline section editors ────────────────────────────────────────────────
  const renderEditor = (section: BrandEditSection): React.ReactNode => {
    const d = draft;
    if (!d) return null;

    switch (section) {
      case 'cover':
        return (
          <div>
            <div className={label}>Cover image</div>
            <BrandImageUploadField
              variant="banner"
              value={d.coverImage}
              onChange={(url) => patch({ coverImage: url })}
            />
          </div>
        );
      case 'logo':
        return (
          <div className="max-w-[240px]">
            <div className={label}>Brand logo</div>
            <BrandImageUploadField
              variant="logo"
              value={d.logo || d.logoUrl || ''}
              onChange={(url) => patch({ logo: url, logoUrl: url })}
            />
          </div>
        );
      case 'identity':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className={label}>Brand name</div>
                <input className={input} value={d.brandName} onChange={(e) => patch({ brandName: e.target.value })} placeholder="e.g. Walton" />
              </div>
              <div>
                <div className={label}>Category</div>
                <input className={input} value={d.category} onChange={(e) => patch({ category: e.target.value })} placeholder="e.g. Electronics & Appliances" />
              </div>
            </div>
            <div>
              <div className={label}>Tagline</div>
              <input
                className={input}
                value={d.tagline}
                onChange={(e) => patch({ tagline: e.target.value })}
                placeholder="e.g. Made in Bangladesh, Trusted Nationwide"
              />
              <div className={hint}>One short line shown under the brand name on the storefront.</div>
            </div>
            <div>
              <div className={label}>Official website</div>
              <input
                className={input}
                value={d.website}
                onChange={(e) => patch({ website: e.target.value })}
                placeholder="https://waltonbd.com"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className={label}>Facebook</div>
                <input className={input} value={d.socialFbUrl} onChange={(e) => patch({ socialFbUrl: e.target.value })} placeholder="https://facebook.com/yourbrand" />
              </div>
              <div>
                <div className={label}>Instagram</div>
                <input
                  className={input}
                  value={d.socialInstaUrl}
                  onChange={(e) => patch({ socialInstaUrl: e.target.value })}
                  placeholder="https://instagram.com/yourbrand"
                />
              </div>
              <div>
                <div className={label}>YouTube</div>
                <input className={input} value={d.socialYtUrl} onChange={(e) => patch({ socialYtUrl: e.target.value })} placeholder="https://youtube.com/@yourbrand" />
              </div>
              <div>
                <div className={label}>TikTok</div>
                <input
                  className={input}
                  value={d.socialTiktokUrl}
                  onChange={(e) => patch({ socialTiktokUrl: e.target.value })}
                  placeholder="https://tiktok.com/@yourbrand"
                />
              </div>
            </div>
            <div>
              <div className={label}>Other links (Discord, Threads, blog…)</div>
              <div className="space-y-2">
                {(d.customSocials || []).map((c, i) => (
                  <div key={c.id} className="flex gap-2">
                    <input
                      className={`${input} sm:max-w-[180px]`}
                      placeholder="Label"
                      value={c.label}
                      onChange={(e) =>
                        patch({
                          customSocials: (d.customSocials || []).map((x, idx) =>
                            idx === i ? { ...x, label: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <input
                      className={input}
                      placeholder="https://…"
                      value={c.url}
                      onChange={(e) =>
                        patch({
                          customSocials: (d.customSocials || []).map((x, idx) =>
                            idx === i ? { ...x, url: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <button
                      type="button"
                      className={`${ghostBtn} text-[#DC2626] shrink-0`}
                      onClick={() =>
                        patch({ customSocials: (d.customSocials || []).filter((_, idx) => idx !== i) })
                      }
                      aria-label="Remove link"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className={ghostBtn}
                  onClick={() =>
                    patch({
                      customSocials: [
                        ...(d.customSocials || []),
                        { id: `soc-${Date.now()}`, label: '', url: '' },
                      ],
                    })
                  }
                >
                  <Plus className="h-3 w-3" /> Add link
                </button>
              </div>
            </div>
          </div>
        );
      case 'brandAbout':
        return (
          <div>
            <div className={label}>About this brand</div>
            <textarea
              className={textarea}
              rows={5}
              value={d.description}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder={
                'e.g. Walton is a leading Bangladeshi electronics & appliances brand. ' +
                'We make refrigerators, ACs, TVs and smartphones with official warranty and a ' +
                'nationwide service network — trusted by millions of households since 2008.'
              }
            />
            <div className={hint}>2–4 sentences: who the brand is, what it sells, what makes it trusted.</div>
          </div>
        );
      case 'brandAddress':
        return (
          <div className="space-y-2.5">
            <div>
              <div className={label}>Physical shop address</div>
              <textarea
                className={textarea}
                rows={2}
                value={d.address}
                onChange={(e) => patch({ address: e.target.value })}
                placeholder="e.g. Choosify HQ, Suite 5A, Metropolitan Towers, Gulshan-2, Dhaka 1212"
              />
            </div>
            <div>
              <div className={label}>Official website</div>
              <input className={input} value={d.website} placeholder="https://waltonbd.com" onChange={(e) => patch({ website: e.target.value })} />
            </div>
            <div>
              <div className={label}>Google Maps link (“Open on Maps”)</div>
              <input
                className={input}
                value={d.mapLink}
                placeholder="e.g. https://maps.app.goo.gl/xxxxxx"
                onChange={(e) => patch({ mapLink: e.target.value })}
              />
              <div className={hint}>Open Google Maps, find your shop, Share → Copy link.</div>
            </div>
          </div>
        );
      case 'brandContact':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className={label}>Support email</div>
              <input className={input} value={d.contactEmail} onChange={(e) => patch({ contactEmail: e.target.value })} placeholder="e.g. support@waltonbd.com" />
            </div>
            <div>
              <div className={label}>Support phone</div>
              <input className={input} value={d.phone} onChange={(e) => patch({ phone: e.target.value })} placeholder="e.g. 09612-246673" />
            </div>
          </div>
        );
      case 'brandAudience':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className={label}>Price range</div>
              <input className={input} value={d.priceRange} onChange={(e) => patch({ priceRange: e.target.value })} placeholder="e.g. ৳1,000 – ৳1,80,000" />
            </div>
            <div>
              <div className={label}>Age focus</div>
              <input className={input} value={d.ageRange} onChange={(e) => patch({ ageRange: e.target.value })} placeholder="e.g. 18 – 60 years" />
            </div>
            <div>
              <div className={label}>Audience</div>
              <input className={input} value={d.audienceType} onChange={(e) => patch({ audienceType: e.target.value })} placeholder="e.g. Households, offices, smart buyers" />
            </div>
          </div>
        );
      case 'brandServices':
        return (
          <div>
            <div className={label}>Services / specialties — one per line</div>
            <textarea
              className={textarea}
              rows={6}
              value={(d.services || []).join('\n')}
              onChange={(e) => patch({ services: linesToArr(e.target.value) })}
              placeholder={
                'Free home delivery across Bangladesh\n' +
                'Up to 2-year official warranty\n' +
                'EMI up to 12 months\n' +
                'Nationwide authorised service centres\n' +
                '7-day easy replacement'
              }
            />
            <div className={hint}>Short benefit phrases — one per line. Each becomes a bullet in the storefront card.</div>
          </div>
        );
      case 'brandTags':
        return (
          <div>
            <div className={label}>Best-for tags — one per line (# optional)</div>
            <textarea
              className={textarea}
              rows={6}
              value={(d.bestForTags || []).join('\n')}
              onChange={(e) =>
                patch({ bestForTags: linesToArr(e.target.value).map((t) => t.replace(/^#+/, '')) })
              }
              placeholder={'MadeInBD\nAppliances\nTrusted\nBudgetFriendly\nWarrantyBacked'}
            />
            <div className={hint}>Single words / short phrases. Shown as “#tag” pills — no spaces work best.</div>
          </div>
        );
      case 'credentials':
        return (
          <div>
            <div className={label}>Guarantees & credentials</div>
            <textarea
              className={textarea}
              rows={5}
              value={d.credentials || ''}
              onChange={(e) => patch({ credentials: e.target.value })}
              placeholder={
                'e.g. BSTI approved · ISO 9001:2015 certified · 100% authentic products · ' +
                '2-year official warranty · Nationwide 80+ service centres · Cash-on-delivery available'
              }
            />
            <div className={hint}>Certifications, warranty promises and authenticity guarantees buyers should trust.</div>
          </div>
        );
      case 'story':
        return (
          <div className="space-y-4">
            <PinnedStoryEditor
              guides={guides}
              pinned={d.pinnedStoryContentIds || []}
              blockContentIds={(d.storyBlocks || [])
                .filter((b) => b.kind === 'content' && b.contentId)
                .map((b) => String(b.contentId))}
              onChange={(pinnedStoryContentIds) => patch({ pinnedStoryContentIds })}
            />
            <StoryBlocksEditor
              blocks={d.storyBlocks || []}
              guides={guides}
              onChange={(storyBlocks) => patch({ storyBlocks })}
            />
          </div>
        );
      case 'deals':
        return (
          <PinnedProductsEditor
            catalog={model?.products || []}
            pinned={d.pinnedProductIds || []}
            onChange={(pinnedProductIds) => patch({ pinnedProductIds })}
            blurb="Pin products to spotlight them — in order — at the top of the storefront “Top Deals & Coupons” section. Drag to reorder. Coupons and deals still follow below."
          />
        );
      case 'products':
        return (
          <PinnedProductsEditor
            catalog={model?.products || []}
            pinned={d.pinnedShowcaseProductIds || []}
            onChange={(pinnedShowcaseProductIds) => patch({ pinnedShowcaseProductIds })}
            blurb="Pin products to the front of the brand Products grid — in order. Drag to reorder. Unpinned products keep their normal order after these."
          />
        );
      case 'faq':
        return <FaqEditor rows={d.faq} onChange={(faq) => patch({ faq })} />;
      case 'stores':
        return <StoresEditor stores={d.stores} onChange={(stores) => patch({ stores })} />;
      default:
        return null;
    }
  };

  const studio: BrandStudioBridge = {
    editingSection: editingId,
    dirty,
    saving,
    onEdit: requestEdit,
    onCancel: cancelSection,
    onSave: () => void saveSection(),
    renderEditor,
  };

  // ── shell ────────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-[13px] font-bold text-[#1A1A2E]">{loadError}</p>
        <div className="flex gap-2">
          <button className={ghostBtn} onClick={() => setReloadNonce((n) => n + 1)}>
            Retry
          </button>
          {!isNested ? (
            <button className={accentBtn} onClick={() => navigate('/admin/brand-studio')}>
              Back to Brand Studio
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (!model) {
    return <div className="p-10 text-center text-[12px] text-[#9AA0AC]">Loading Brand Studio…</div>;
  }

  const compareBrands = allBrands
    .filter((b) => b.id !== model.id)
    .slice(0, 4)
    .map((b) => ({ id: b.id, name: b.name, category: b.category }));

  const storyContentById: Record<
    string,
    {
      title: string;
      image?: string;
      kind: string;
      href?: string;
      aspect?: 'landscape' | 'portrait' | 'square';
    }
  > = {};
  for (const g of guides) {
    storyContentById[g.id] = {
      title: g.title,
      image: g.image,
      href: `/guides/${g.slug}`,
      kind: guideKind(g),
      // Vertical formats (reels / shorts) render portrait on the storefront.
      aspect: g.type === 'reels' || g.type === 'shorts' ? 'portrait' : 'landscape',
    };
  }

  return (
    <div className="w-full bg-[#F0F8FF] min-h-screen">
      {!isNested ? (
        <header className="sticky top-[var(--cms-topbar-height,64px)] z-[8] flex items-center justify-between gap-3 border-b border-[#E8EDF2] bg-white/95 px-4 py-2.5 backdrop-blur">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate('/admin/brand-studio')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E8EDF2] text-[#374151]"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <div className="text-[9px] font-extrabold uppercase tracking-widest text-[#EF3C23]">Brand Studio</div>
              <div className="truncate text-[13px] font-extrabold text-[#1A1A2E]">
                {model.brandName || 'Untitled Brand'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {model.slug ? (
              <a
                href={`/brands/${model.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-[#E8EDF2] px-3 py-1.5 text-[11px] font-bold text-[#374151]"
              >
                View public page <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
            <span className="text-[10px] text-[#9AA0AC]">Each section saves on its own</span>
          </div>
        </header>
      ) : null}

      <BrandProfilePresentation
        model={model}
        mode="studio"
        studio={studio}
        compareBrands={compareBrands}
        storyContentById={storyContentById}
        manageLinks={{
          products: '/admin/products',
          deals: '/admin/ads-deals',
          creators: '/admin/recommendations',
          verification: `/admin/brands/${activeId}`,
        }}
      />

      {toast ? (
        <div className="fixed bottom-5 right-5 z-[60] rounded-xl bg-[#1A1A2E] px-4 py-3 text-[12px] font-semibold text-white shadow-2xl">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

// ── Pinned spotlight products editor ───────────────────────────────────────
function PinnedProductsEditor({
  catalog,
  pinned,
  onChange,
  blurb,
}: {
  catalog: BrandCMSModel['products'];
  pinned: string[];
  onChange: (ids: string[]) => void;
  blurb: string;
}) {
  const [q, setQ] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= pinned.length) return;
    const next = [...pinned];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const reorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= pinned.length || to >= pinned.length) return;
    const next = [...pinned];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };
  const query = q.trim().toLowerCase();
  const results = query
    ? catalog
        .filter((p) => !pinned.includes(p.id))
        .filter((p) => p.name.toLowerCase().includes(query) || (p.sku || '').toLowerCase().includes(query))
        .slice(0, 8)
    : [];

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-[#6B7280]">{blurb}</p>

      {pinned.length ? (
        <ol className="space-y-1.5">
          {pinned.map((pid, i) => {
            const p = byId.get(pid);
            return (
              <li
                key={pid}
                draggable
                onDragStart={(e) => {
                  setDragIdx(i);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (overIdx !== i) setOverIdx(i);
                }}
                onDrop={() => {
                  if (dragIdx !== null) reorder(dragIdx, i);
                  setDragIdx(null);
                  setOverIdx(null);
                }}
                onDragEnd={() => {
                  setDragIdx(null);
                  setOverIdx(null);
                }}
                className={`flex items-center gap-2 rounded-lg border bg-white px-2.5 py-1.5 ${
                  dragIdx === i
                    ? 'opacity-40 border-[#E8EDF2]'
                    : overIdx === i && dragIdx !== null
                      ? 'border-[#EF3C23] ring-1 ring-[#EF3C23]/30'
                      : 'border-[#E8EDF2]'
                }`}
              >
                <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-[#9AA0AC] active:cursor-grabbing" />
                <span className="text-[10px] font-extrabold text-[#EF3C23] w-6 shrink-0">#{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[#1A1A2E]">
                  {p ? p.name : <span className="text-[#9AA0AC] italic">Removed product ({pid})</span>}
                </span>
                {p ? (
                  <span className="shrink-0 text-[11px] font-bold text-[#EF3C23]">
                    ৳{Number(p.price || 0).toLocaleString()}
                  </span>
                ) : null}
                <button type="button" className={ghostBtn} onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  className={ghostBtn}
                  onClick={() => move(i, 1)}
                  disabled={i === pinned.length - 1}
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  className={`${ghostBtn} text-[#DC2626]`}
                  onClick={() => onChange(pinned.filter((x) => x !== pid))}
                >
                  <Trash2 className="h-3 w-3" /> Unpin
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-[11px] italic text-[#9AA0AC]">No pinned products yet.</p>
      )}

      <div className="relative">
        <input
          className={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={
            catalog.length ? 'Search this brand’s products to pin…' : 'No products listed for this brand yet'
          }
          disabled={!catalog.length}
        />
        {results.length ? (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-[#E8EDF2] bg-white shadow-lg">
            {results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange([...pinned, p.id].slice(0, 12));
                  setQ('');
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12px] hover:bg-[#F8FAFC]"
              >
                <span className="min-w-0 truncate font-semibold text-[#1A1A2E]">{p.name}</span>
                <span className="shrink-0 text-[11px] font-bold text-[#EF3C23]">Pin</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Pinned Brand Story content (seller's own published Guides / Reviews / …) ─
function PinnedStoryEditor({
  guides,
  pinned,
  blockContentIds,
  onChange,
}: {
  guides: CatalogGuide[];
  pinned: string[];
  /** contentIds already authored as a `content` story section — offered as blocks, not here. */
  blockContentIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [q, setQ] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const byId = new Map(guides.map((g) => [g.id, g]));
  const taken = new Set([...pinned, ...blockContentIds]);
  const reorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= pinned.length || to >= pinned.length) return;
    const next = [...pinned];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= pinned.length) return;
    const next = [...pinned];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const query = q.trim().toLowerCase();
  const results = query
    ? guides.filter((g) => !taken.has(g.id) && g.title.toLowerCase().includes(query)).slice(0, 8)
    : [];

  return (
    <div className="space-y-3 rounded-xl border border-[#EF3C23]/25 bg-[#FFF6F4] p-3.5">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-md bg-[#EF3C23] px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white">
          <Plus className="h-3 w-3" /> Pin published stories
        </span>
        <span className="text-[11px] font-bold text-[#B23A28]">
          {pinned.length ? `${pinned.length} pinned` : 'None pinned yet'}
        </span>
      </div>
      <p className="text-[11px] text-[#6B7280]">
        Feature a few of your own published Guides / Reviews / Live / blogs at the top of the
        storefront Brand Story section. Drag to reorder.
      </p>

      {pinned.length ? (
        <ol className="space-y-1.5">
          {pinned.map((gid, i) => {
            const g = byId.get(gid);
            return (
              <li
                key={gid}
                draggable
                onDragStart={(e) => {
                  setDragIdx(i);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (overIdx !== i) setOverIdx(i);
                }}
                onDrop={() => {
                  if (dragIdx !== null) reorder(dragIdx, i);
                  setDragIdx(null);
                  setOverIdx(null);
                }}
                onDragEnd={() => {
                  setDragIdx(null);
                  setOverIdx(null);
                }}
                className={`flex items-center gap-2 rounded-lg border bg-white px-2.5 py-1.5 ${
                  dragIdx === i
                    ? 'opacity-40 border-[#E8EDF2]'
                    : overIdx === i && dragIdx !== null
                      ? 'border-[#EF3C23] ring-1 ring-[#EF3C23]/30'
                      : 'border-[#E8EDF2]'
                }`}
              >
                <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-[#9AA0AC] active:cursor-grabbing" />
                <span className="text-[10px] font-extrabold text-[#EF3C23] w-6 shrink-0">#{i + 1}</span>
                {g ? (
                  <span className="shrink-0 rounded bg-[#F3E8FF] px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-[#8A00C4]">
                    {guideKind(g)}
                  </span>
                ) : null}
                <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[#1A1A2E]">
                  {g ? g.title : <span className="text-[#9AA0AC] italic">Unavailable content ({gid})</span>}
                </span>
                <button type="button" className={ghostBtn} onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  className={ghostBtn}
                  onClick={() => move(i, 1)}
                  disabled={i === pinned.length - 1}
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  className={`${ghostBtn} text-[#DC2626]`}
                  onClick={() => onChange(pinned.filter((x) => x !== gid))}
                >
                  <Trash2 className="h-3 w-3" /> Unpin
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-lg border border-dashed border-[#EF3C23]/40 bg-white px-3 py-2 text-[11px] font-semibold text-[#B23A28]">
          No pinned stories yet — search below to pin your published content.
        </p>
      )}

      <div className="relative">
        <input
          className={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={
            guides.length
              ? 'Search your published Guides / Reviews / Live / blogs to pin…'
              : 'No published content found'
          }
          disabled={!guides.length}
        />
        {results.length ? (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-[#E8EDF2] bg-white shadow-lg">
            {results.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  onChange([...pinned, g.id].slice(0, 12));
                  setQ('');
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-[#F8FAFC]"
              >
                <span className="shrink-0 rounded bg-[#F3E8FF] px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-[#8A00C4]">
                  {guideKind(g)}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold text-[#1A1A2E]">{g.title}</span>
                <span className="shrink-0 text-[11px] font-bold text-[#EF3C23]">Pin</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Brand Story — hybrid multi-entry sections (text / link / content) ──────
type StoryBlock = NonNullable<BrandCMSModel['storyBlocks']>[number];

function guideKind(g: CatalogGuide): string {
  return g.format === 'live'
    ? 'Live'
    : g.format === 'product_review'
      ? 'Review'
      : g.format === 'comparison'
        ? 'Comparison'
        : g.type === 'article'
          ? 'Blog'
          : g.format === 'buying_guide'
            ? 'Guide'
            : 'Content';
}

function StoryBlocksEditor({
  blocks,
  guides,
  onChange,
}: {
  blocks: StoryBlock[];
  guides: CatalogGuide[];
  onChange: (b: StoryBlock[]) => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [contentQ, setContentQ] = useState<Record<string, string>>({});
  const guideById = new Map(guides.map((g) => [g.id, g]));

  const patch = (i: number, p: Partial<StoryBlock>) =>
    onChange(blocks.map((b, idx) => (idx === i ? { ...b, ...p } : b)));
  const reorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= blocks.length || to >= blocks.length) return;
    const next = [...blocks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };
  const addBlock = (kind: 'link' | 'content') =>
    onChange([...blocks, { id: `sb-${Date.now()}`, heading: '', body: '', kind }]);

  return (
    <div className="space-y-2.5">
      <div className={label}>Brand story — featured links & your published content</div>
      <div className={hint}>
        Each section is an external link with your own thumbnail, or a Guide / Review / Live / blog
        you&rsquo;ve published on Choosify. Drag to reorder.
      </div>

      {blocks.map((b, i) => {
        const kind: 'link' | 'content' = b.kind === 'content' ? 'content' : 'link';
        return (
          <div
            key={b.id}
            draggable
            onDragStart={() => setDragIdx(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIdx !== null) reorder(dragIdx, i);
              setDragIdx(null);
            }}
            onDragEnd={() => setDragIdx(null)}
            className={`rounded-lg border p-3 space-y-2 bg-white ${
              dragIdx === i ? 'opacity-40 border-[#E8EDF2]' : 'border-[#E8EDF2]'
            }`}
          >
            <div className="flex items-center gap-2">
              <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-[#9AA0AC]" />
              <select
                className={`${input} !w-[140px] shrink-0`}
                value={kind}
                onChange={(e) => patch(i, { kind: e.target.value as 'link' | 'content' })}
              >
                <option value="link">External link</option>
                <option value="content">My content</option>
              </select>
              <input
                className={`${input} font-semibold`}
                value={b.heading}
                placeholder={
                  kind === 'link'
                    ? 'Card title — e.g. Featured on The Daily Star'
                    : 'Card title (optional — defaults to the content title)'
                }
                onChange={(e) => patch(i, { heading: e.target.value })}
              />
              <button
                type="button"
                className={`${ghostBtn} text-[#DC2626] shrink-0`}
                onClick={() => onChange(blocks.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className={`${label} !mb-0`}>Media type</span>
              <select
                className={`${input} !w-auto min-w-[180px]`}
                value={b.mediaKind || 'auto'}
                onChange={(e) =>
                  patch(i, {
                    mediaKind: e.target.value === 'auto' ? undefined : (e.target.value as StoryMediaKind),
                  })
                }
              >
                <option value="auto">Auto-detect from link</option>
                {(Object.keys(MEDIA_KIND_LABEL) as StoryMediaKind[]).map((k) => (
                  <option key={k} value={k}>
                    {MEDIA_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
              {!b.mediaKind && (b.url || '').trim() ? (
                <span className={hint}>
                  Detected: <b>{MEDIA_KIND_LABEL[detectStoryMediaKind(b.url || '')]}</b>
                </span>
              ) : null}
            </div>

            {kind === 'link' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <div className={label}>Link URL</div>
                  <input
                    className={input}
                    value={b.url || ''}
                    placeholder="https://…"
                    onChange={(e) => patch(i, { url: e.target.value })}
                  />
                  <input
                    className={`${input} mt-1.5`}
                    value={b.body}
                    placeholder="Short caption (optional)"
                    onChange={(e) => patch(i, { body: e.target.value })}
                  />
                </div>
                <div>
                  <div className={label}>Custom thumbnail</div>
                  <BrandImageUploadField
                    variant="banner"
                    value={b.thumbnail || ''}
                    onChange={(url) => patch(i, { thumbnail: url })}
                  />
                </div>
              </div>
            ) : null}

            {kind === 'content' ? (
              <div className="relative">
                {b.contentId ? (
                  <div className="flex items-center gap-2 rounded-lg border border-[#E8EDF2] bg-[#F8FAFC] px-2.5 py-1.5">
                    {guideById.get(b.contentId) ? (
                      <span className="shrink-0 rounded bg-[#F3E8FF] px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-[#8A00C4]">
                        {guideKind(guideById.get(b.contentId)!)}
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[#1A1A2E]">
                      {guideById.get(b.contentId)?.title || (
                        <span className="italic text-[#9AA0AC]">Unavailable content ({b.contentId})</span>
                      )}
                    </span>
                    <button
                      type="button"
                      className={`${ghostBtn} text-[#DC2626]`}
                      onClick={() => patch(i, { contentId: undefined })}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      className={input}
                      value={contentQ[b.id] || ''}
                      onChange={(e) => setContentQ((s) => ({ ...s, [b.id]: e.target.value }))}
                      placeholder={
                        guides.length ? 'Search your published Guides / Reviews / Live / blogs…' : 'No published content found'
                      }
                      disabled={!guides.length}
                    />
                    {(() => {
                      const q = (contentQ[b.id] || '').trim().toLowerCase();
                      const results = q
                        ? guides.filter((g) => g.title.toLowerCase().includes(q)).slice(0, 8)
                        : [];
                      return results.length ? (
                        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-[#E8EDF2] bg-white shadow-lg">
                          {results.map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => {
                                patch(i, { contentId: g.id });
                                setContentQ((s) => ({ ...s, [b.id]: '' }));
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-[#F8FAFC]"
                            >
                              <span className="shrink-0 rounded bg-[#F3E8FF] px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-[#8A00C4]">
                                {guideKind(g)}
                              </span>
                              <span className="min-w-0 flex-1 truncate font-semibold text-[#1A1A2E]">{g.title}</span>
                              <span className="shrink-0 text-[11px] font-bold text-[#EF3C23]">Add</span>
                            </button>
                          ))}
                        </div>
                      ) : null;
                    })()}
                  </>
                )}
              </div>
            ) : null}
          </div>
        );
      })}

      <div className="flex flex-wrap gap-2">
        <button type="button" className={accentBtn} onClick={() => addBlock('link')}>
          <Plus className="h-3 w-3" /> External link
        </button>
        <button type="button" className={ghostBtn} onClick={() => addBlock('content')}>
          <Plus className="h-3 w-3" /> My content
        </button>
      </div>
    </div>
  );
}

// ── FAQ editor ─────────────────────────────────────────────────────────────
function FaqEditor({
  rows,
  onChange,
}: {
  rows: BrandCMSModel['faq'];
  onChange: (rows: BrandCMSModel['faq']) => void;
}) {
  const patch = (i: number, p: Partial<BrandCMSModel['faq'][number]>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={r.id} className="rounded-lg border border-[#E8EDF2] p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              className={input}
              value={r.q}
              placeholder="Question — e.g. Are Walton products sold on Choosify 100% genuine?"
              onChange={(e) => patch(i, { q: e.target.value })}
            />
            <button type="button" className={ghostBtn} onClick={() => move(i, -1)} disabled={i === 0}>
              <ArrowUp className="h-3 w-3" />
            </button>
            <button type="button" className={ghostBtn} onClick={() => move(i, 1)} disabled={i === rows.length - 1}>
              <ArrowDown className="h-3 w-3" />
            </button>
            <button
              type="button"
              className={`${ghostBtn} text-[#DC2626]`}
              onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
          <textarea
            className={textarea}
            rows={2}
            value={r.a}
            placeholder="Answer — e.g. Yes. Every unit ships sealed with an official warranty card and is covered by Walton's nationwide service network."
            onChange={(e) => patch(i, { a: e.target.value })}
          />
        </div>
      ))}
      <button
        type="button"
        className={accentBtn}
        onClick={() => onChange([...rows, { id: `faq-${Date.now()}`, q: '', a: '' }])}
      >
        <Plus className="h-3 w-3" /> Add FAQ
      </button>
    </div>
  );
}

// ── Where-to-Buy editor (authorized / distributors / service centres) ───────
function StoresEditor({
  stores,
  onChange,
}: {
  stores: BrandCMSModel['stores'];
  onChange: (s: BrandCMSModel['stores']) => void;
}) {
  const cols: Array<{ key: keyof BrandCMSModel['stores']; label: string; hours?: boolean }> = [
    { key: 'authorized', label: 'Authorized stores' },
    { key: 'distributors', label: 'Distributors & resellers' },
    { key: 'serviceCenters', label: 'Service centres', hours: true },
  ];
  const set = (key: keyof BrandCMSModel['stores'], list: BrandStoreEntry[]) =>
    onChange({ ...stores, [key]: list });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cols.map((col) => {
        const list = (stores[col.key] || []) as BrandStoreEntry[];
        return (
          <div key={col.key} className="rounded-lg border border-[#E8EDF2] p-3 space-y-2">
            <div className={label}>{col.label}</div>
            <div className={hint}>
              {col.key === 'authorized'
                ? 'Your own outlets / official partner shops. e.g. “Walton Plaza — Bashundhara City, Level 4”.'
                : col.key === 'distributors'
                  ? 'Wholesalers / resellers who carry your products. e.g. “Rahim Electronics — Chattogram”.'
                  : 'Repair & warranty-claim centres. e.g. “Walton Service Center — Banani · 10AM – 7PM”.'}
            </div>
            {list.map((entry, i) => (
              <div key={entry.id} className="rounded-lg bg-[#F8FAFC] border border-[#E8EDF2] p-2 space-y-1.5">
                <input
                  className={input}
                  placeholder={col.key === 'serviceCenters' ? 'Centre name — e.g. Walton Service Center Dhaka' : 'Store name — e.g. Walton Plaza Gulshan'}
                  value={entry.name}
                  onChange={(e) => set(col.key, list.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)))}
                />
                <input
                  className={input}
                  placeholder="Area / city — e.g. Gulshan-1, Dhaka"
                  value={entry.sub}
                  onChange={(e) => set(col.key, list.map((x, idx) => (idx === i ? { ...x, sub: e.target.value } : x)))}
                />
                {col.hours ? (
                  <input
                    className={input}
                    placeholder="Hours (e.g. 10AM – 7PM)"
                    value={(entry as BrandServiceCenterEntry).hours || ''}
                    onChange={(e) =>
                      set(
                        col.key,
                        list.map((x, idx) => (idx === i ? { ...x, hours: e.target.value } : x)),
                      )
                    }
                  />
                ) : null}
                <button
                  type="button"
                  className={`${ghostBtn} text-[#DC2626]`}
                  onClick={() => set(col.key, list.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className={ghostBtn}
              onClick={() =>
                set(col.key, [
                  ...list,
                  col.hours
                    ? ({ id: `svc-${Date.now()}`, name: '', sub: '', hours: '' } as BrandServiceCenterEntry)
                    : ({ id: `st-${Date.now()}`, name: '', sub: '' } as BrandStoreEntry),
                ])
              }
            >
              <Plus className="h-3 w-3" /> Add entry
            </button>
          </div>
        );
      })}
    </div>
  );
}
