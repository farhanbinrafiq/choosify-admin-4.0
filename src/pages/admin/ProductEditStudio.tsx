import React, { useEffect, useMemo, useRef, useState, CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, History, Image as ImageIcon, RotateCw, Trash2, Upload } from 'lucide-react';
import { catalogApi } from '../../services/catalogApi';
import { uploadProductImages, uploadProductVideoFile } from '../../services/mediaUpload';
import { classifyProductVideo } from '../../lib/productVideo';
import { useAuth } from '../../contexts/AuthContext';
import { useEntityDraft } from '../../hooks/useEntityDraft';
import { ProductDetailPresentation, type StudioBridge } from '../../components/product-detail';
import type { CatalogCategoryAttribute } from '../../types/catalog';
import {
  checkCategorySchemaCompatibility,
  createBlankProductModel,
  editorModelToDetailPayload,
  editorModelToProductPatch,
  isSafeToPersist,
  resolveExistingProductLoad,
  type CategorySchemaCompatibility,
  type ProductEditorModel,
  type SchemaVariantDimension,
} from './productEditorModel';
import {
  AddonItemsEditor,
  CategoryChangeDecision,
  CreatorReviewsEditor,
  HashtagsEditor,
  OverviewBlocksEditor,
  ProductGuideEditor,
  RelatedInfoEditor,
  SpecRowsEditor,
  VariantMatrixEditor,
  VariantRemapPanel,
  WarrantyEditor,
} from './productStudioSections';
import { defaultRelatedInfoType } from './productEditorModel';

const mapSchemaDim = (a: CatalogCategoryAttribute): SchemaVariantDimension => ({
  key: a.key,
  name: a.name,
  type: a.type,
  options: Array.isArray(a.options) ? a.options : [],
});

/**
 * Product Studio — single-product create/edit workspace.
 *
 * PRESENTATION is the storefront-parity Product Detail
 * (<ProductDetailPresentation mode="studio">) — the seller edits the product
 * while seeing (near-real-time) how it appears on the public Product Detail page.
 *
 * INTERACTION is SECTION-LEVEL inline editing
 * (docs/design/dashboard-ui-regression-lock.md §7): each editable storefront
 * region carries a small "Edit"; clicking it swaps THAT region in place to the
 * inline editor supplied by `renderEditor`, with Save Changes / Cancel. One
 * section at a time; switching while dirty is blocked. Preview-only sections
 * (ratings/analytics, Public/Creator Reviews, Brand, comparison, trust) stay
 * read-only. Buyer actions (Add to Cart / Wishlist / Compare / Message / qty)
 * render for parity but are disabled and non-interactive. No drawer / slide-over
 * / ordinary modal. The only dialog is the deliberate Publish confirmation.
 *
 * This component is a thin functional shell — model load, section draft/dirty
 * state, `saveSection`, canonical `updateProduct` + `upsertProductDetail`,
 * ownership/RBAC/inventory/Marketplace-Access rules and unsaved-change
 * protection are all preserved unchanged.
 *
 * FUNCTIONAL CONTRACT — unchanged:
 *  - Each section's Save persists through the canonical catalog API
 *    (`updateProduct` + `upsertProductDetail`), reusing `editorModelToProductPatch`
 *    / `editorModelToDetailPayload` verbatim, on the section-merged model. It
 *    keeps the product's current lifecycle status — it never force-publishes.
 *  - Cancel restores that section's persisted values only.
 *  - Media uses the real `uploadProductImages` service. Canonical image model:
 *    `product.image` = primary, `product.gallery` = ordered list; the app's rule
 *    is "first photo is the primary". The Primary Photo section manipulates
 *    `image` (kept as gallery index 0); the Product Photos section manages the
 *    remaining gallery entries. No second backend image field is invented.
 *  - Seller ownership / Marketplace Access / brand ownership / validation /
 *    archived rules / RBAC / creation semantics are server-enforced, untouched.
 *    Option groups & variants are round-tripped. No client-only business state,
 *    no localStorage mock data, no data fabricated from the standalone.
 */

function linesFromTextarea(value: string): string[] {
  return value.split('\n').map((s) => s.trim()).filter(Boolean);
}
/** `Label: Value` lines <-> {key,value}[] — used by the Physical Specifications box. */
function specsFromTextarea(value: string): Array<{ key: string; value: string }> {
  return linesFromTextarea(value).map((line) => {
    const idx = line.indexOf(':');
    if (idx === -1) return { key: line, value: '' };
    return { key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
  });
}
function specsToTextarea(specs: Array<{ key: string; value: string }>): string {
  return (specs || []).map((s) => (s.value ? `${s.key}: ${s.value}` : s.key)).join('\n');
}
/** A blob:/data: URL is an unsaved local preview — it will NOT persist. */
const isUnsaved = (u: string) => /^(blob:|data:)/i.test(u || '');
/** Canonical ordered photo list: primary (image) first, then the rest of gallery. */
const photosOf = (m: Pick<ProductEditorModel, 'image' | 'gallery'>): string[] =>
  m.image ? [m.image, ...(m.gallery || []).filter((u) => u && u !== m.image)] : (m.gallery || []).filter(Boolean);

const ACCENT = 'var(--cms-accent)';
const ACCENT_WASH = 'color-mix(in srgb, var(--cms-accent) 12%, transparent)';

const S: Record<string, CSSProperties> = {
  page: { color: '#111827' },
  headerCard: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 10, padding: '14px 20px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  backBtn: { width: 32, height: 32, borderRadius: 8, border: '1px solid #E8EDF2', background: '#fff', cursor: 'pointer', color: '#374151', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  kicker: { fontSize: 10, fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.05em' },
  badgeDraft: { background: ACCENT_WASH, color: '#C2410C', fontSize: 9, fontWeight: 800, padding: '3px 9px', borderRadius: 20 },
  badgeLive: { background: 'rgba(34,197,94,0.14)', color: '#15803D', fontSize: 9, fontWeight: 800, padding: '3px 9px', borderRadius: 20 },
  h1: { fontSize: 15, fontWeight: 800, marginTop: 2 },
  ghostBtn: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: '9px 14px', fontSize: '11.5px', fontWeight: 700, color: '#374151', cursor: 'pointer' },
  accentBtn: { background: ACCENT, border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: '11.5px', fontWeight: 800, color: '#fff', cursor: 'pointer' },
  editLink: { background: 'none', border: '1px solid #E8EDF2', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 800, color: ACCENT, cursor: 'pointer', letterSpacing: '0.02em' },
  card: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 10, padding: 22, marginBottom: 16 },
  cardEditing: { borderColor: ACCENT, boxShadow: `0 0 0 3px ${ACCENT_WASH}` },
  secHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12 },
  secKicker: { fontSize: 10, fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.05em' },
  secTitle: { fontSize: '14.5px', fontWeight: 800, marginTop: 2 },
  label: { fontSize: '10.5px', fontWeight: 800, color: '#6B7280', marginBottom: 6, letterSpacing: '0.04em' },
  hint: { fontSize: '10.5px', color: '#9CA3AF', marginTop: 5, lineHeight: 1.5 },
  input: { width: '100%', boxSizing: 'border-box', height: 40, borderRadius: 8, border: '1px solid #E8EDF2', padding: '0 12px', fontSize: 13, background: '#fff', outline: 'none' },
  textarea: { width: '100%', boxSizing: 'border-box', borderRadius: 8, border: '1px solid #E8EDF2', padding: '10px 12px', fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'inherit' },
  readValue: { fontSize: 13, fontWeight: 600, color: '#111827' },
  readEmpty: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },
  previewCell: { background: '#F9FAFB', borderRadius: 8, padding: '10px 12px' },
  previewLabel: { fontSize: '9.5px', fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.04em' },
  previewValue: { fontSize: 12, fontWeight: 700, marginTop: 2 },
  chip: { background: ACCENT_WASH, color: '#C2410C', fontSize: 11, fontWeight: 800, padding: '6px 12px', borderRadius: 20 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 },
  saveRow: { display: 'flex', gap: 8, marginTop: 16, paddingTop: 14, borderTop: '1px solid #F1F3F5' },
  mediaBox: { border: '1px solid #E8EDF2', borderRadius: 10, background: '#F9FAFB', padding: 14 },
  dropInner: { minHeight: 150, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 18, textAlign: 'center', cursor: 'pointer', border: '2px dashed #E5E7EB', borderRadius: 10, background: '#fff' },
  tile: { position: 'relative', width: 92, height: 92, borderRadius: 8, overflow: 'hidden', border: '1px solid #E8EDF2', background: '#fff', flexShrink: 0 },
  tileImg: { width: '100%', height: '100%', objectFit: 'cover' },
  tileX: { position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: 6, border: 'none', background: 'rgba(220,38,38,0.92)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  ribbonPrimary: { position: 'absolute', bottom: 0, left: 0, right: 0, background: ACCENT, color: '#fff', fontSize: 8, fontWeight: 800, textAlign: 'center', padding: '2px 0', letterSpacing: '0.04em' },
  ribbonUnsaved: { position: 'absolute', top: 3, left: 3, background: '#B45309', color: '#fff', fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 4, letterSpacing: '0.03em' },
  makePrimaryBtn: { position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', background: 'rgba(17,24,39,0.85)', color: '#fff', border: 'none', borderRadius: 5, fontSize: 8.5, fontWeight: 800, padding: '3px 6px', cursor: 'pointer', whiteSpace: 'nowrap' },
};

const dz = (active: boolean): CSSProperties =>
  active ? { ...S.dropInner, borderColor: ACCENT, background: ACCENT_WASH } : S.dropInner;

// ── Product Video (Optional) — one canonical CatalogProduct.videoUrl ──
// Upload an MP4/WebM (app media disk, /media/…) OR paste a YouTube / direct
// HTTPS video URL. Single source: applying either overwrites the other.
function VideoField({
  editing, value, onChange, onToast,
}: { editing: boolean; value: string; onChange: (url: string) => void; onToast: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [linkErr, setLinkErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const info = classifyProductVideo(value);

  const box: CSSProperties = { position: 'relative', height: 168, borderRadius: 10, overflow: 'hidden', border: '1px solid #E8EDF2', background: '#000', marginBottom: 8 };

  const doUpload = async (files: File[]) => {
    const f = Array.from(files).find((x) => x.type.startsWith('video/'));
    if (!f) { onToast('Please choose an MP4 or WebM video file.'); return; }
    setBusy(true);
    try {
      const url = await uploadProductVideoFile(f);
      onChange(url);
      setLinkErr('');
      onToast('Video uploaded.');
    } catch (err) {
      // No fake persistence — a failed upload does not set a video.
      onToast(err instanceof Error ? err.message : 'Video upload failed.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const applyLink = () => {
    const s = linkInput.trim();
    const c = classifyProductVideo(s);
    if (c.kind === 'invalid') { setLinkErr(c.reason); return; }
    onChange(s);
    setLinkInput('');
    setLinkErr('');
    onToast('Video link applied.');
  };

  const preview = info.kind === 'youtube' ? (
    <iframe title="Product video" src={info.embedUrl} allow="accelerator; encrypted-media; picture-in-picture" allowFullScreen
      style={{ width: '100%', height: '100%', border: 0 }} />
  ) : info.kind === 'file' ? (
    <video src={info.src} controls preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />
  ) : null;

  if (!editing) {
    return (
      <div>
        <div style={S.label}>PRODUCT VIDEO (OPTIONAL)</div>
        {preview ? (
          <>
            <div style={box}>{preview}</div>
            <div style={{ ...S.readEmpty, wordBreak: 'break-all' }}>{value}</div>
          </>
        ) : (
          <div style={{ height: 168, borderRadius: 10, border: '1px solid #E8EDF2', background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 12, fontStyle: 'italic' }}>
            No product video
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={S.label}>PRODUCT VIDEO (OPTIONAL)</div>
      <input ref={fileRef} type="file" accept="video/mp4,video/webm" style={{ display: 'none' }}
        onChange={(e) => e.target.files?.length && void doUpload([...e.target.files])} />

      {preview ? (
        <>
          <div style={box}>{preview}</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} style={S.ghostBtn}>{busy ? 'Uploading…' : 'Replace video'}</button>
            <button type="button" onClick={() => { onChange(''); setLinkErr(''); }} style={{ ...S.ghostBtn, color: '#DC2626' }}>Remove video</button>
          </div>
          <div style={{ ...S.readEmpty, wordBreak: 'break-all' }}>{value}</div>
        </>
      ) : (
        <>
          <div
            role="button" tabIndex={0}
            onClick={() => !busy && fileRef.current?.click()}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDrag(false); }}
            onDrop={(e) => { e.preventDefault(); setDrag(false); e.dataTransfer.files?.length && void doUpload([...e.dataTransfer.files]); }}
            style={{ ...dz(drag), height: 168, borderRadius: 10, marginBottom: 8 }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 12, background: ACCENT_WASH, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {busy ? <RotateCw className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
            </div>
            <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{busy ? 'Uploading…' : 'Upload video — click or drag here'}</div>
            <span style={{ marginTop: 6, background: ACCENT, color: '#fff', fontSize: 9, fontWeight: 800, padding: '5px 12px', borderRadius: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Browse File</span>
            <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: 4 }}>MP4 or WebM</div>
          </div>
          <div style={{ ...S.label, marginBottom: 6 }}>OR USE VIDEO LINK</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={linkInput} onChange={(e) => { setLinkInput(e.target.value); setLinkErr(''); }} placeholder="Paste video HTTPS URL (YouTube / MP4)…"
              style={{ ...S.input, height: 36, flex: 1, minWidth: 180 }} />
            <button type="button" onClick={applyLink} style={{ ...S.ghostBtn, padding: '7px 12px' }}>Apply</button>
          </div>
          {linkErr ? <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 700, marginTop: 6 }}>{linkErr}</div> : null}
          <div style={{ ...S.readEmpty, marginTop: 6 }}>One video only. YouTube link, a direct .mp4/.webm URL, or an uploaded MP4/WebM (≤ 50 MB; use a link for larger files).</div>
        </>
      )}
    </div>
  );
}

// ── Core Product Profile media composition — ONE section, reference layout ──
// Left "PRODUCT PHOTOS": a large main slot (canonical `image` = gallery[0]) with
// smaller gallery slots below. Right "PRODUCT VIDEO (OPTIONAL)": one canonical
// CatalogProduct.videoUrl (see VideoField).
function MediaComposition({
  editing, photos, onChange, onToast, videoUrl, onVideoChange,
}: { editing: boolean; photos: string[]; onChange: (next: string[]) => void; onToast: (m: string) => void; videoUrl: string; onVideoChange: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const mainRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const primary = photos[0] || '';
  const extras = photos.slice(1);

  const uploadMain = async (files: File[]) => {
    const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!imgs.length) { onToast('Please choose a JPG or PNG image.'); return; }
    setBusy(true);
    try {
      const [url] = await uploadProductImages([imgs[0]]);
      onChange([url, ...photos.filter((p) => p !== url)]);
      onToast('Main photo uploaded.');
    } catch (err) {
      const blob = URL.createObjectURL(imgs[0]);
      onChange([blob, ...photos]);
      onToast(err instanceof Error ? `${err.message} — shown as an UNSAVED local preview; it will not persist.` : 'Upload failed — shown as an UNSAVED local preview.');
    } finally { setBusy(false); if (mainRef.current) mainRef.current.value = ''; }
  };
  const uploadAdd = async (files: File[]) => {
    const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!imgs.length) { onToast('Please choose JPG or PNG image files.'); return; }
    setBusy(true);
    try {
      const urls = await uploadProductImages(imgs);
      onChange([...photos, ...urls]);
      onToast(`Uploaded ${urls.length} image${urls.length === 1 ? '' : 's'}.`);
    } catch (err) {
      const blobs = imgs.map((f) => URL.createObjectURL(f));
      onChange([...photos, ...blobs]);
      onToast(err instanceof Error ? `${err.message} — shown as UNSAVED local previews; they will not persist.` : 'Upload failed — shown as UNSAVED local previews.');
    } finally { setBusy(false); if (addRef.current) addRef.current.value = ''; }
  };

  const removeAt = (absoluteIndex: number) => onChange(photos.filter((_, idx) => idx !== absoluteIndex));
  const setPrimary = (u: string) => onChange([u, ...photos.filter((p) => p !== u)]);

  const mainSlot: CSSProperties = { position: 'relative', height: 168, borderRadius: 10, overflow: 'hidden', border: '1px solid #E8EDF2', background: '#F9FAFB', marginBottom: 8 };
  const smallSlot: CSSProperties = { position: 'relative', minHeight: 62, borderRadius: 8, overflow: 'hidden', border: '1px solid #E8EDF2', background: '#F9FAFB' };
  const smallGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 };
  const dashed: CSSProperties = { ...smallSlot, border: '2px dashed #E5E7EB', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: editing ? 'pointer' : 'default', color: '#9CA3AF' };

  // Number of small slots to show: at least 4 (reference), grows with content.
  const slotCount = Math.max(4, extras.length + (editing ? 1 : 0));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
      {/* LEFT — PRODUCT PHOTOS */}
      <div
        onDragOver={(e) => { if (!editing) return; e.preventDefault(); setDrag(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDrag(false); }}
        onDrop={(e) => { if (!editing) return; e.preventDefault(); setDrag(false); e.dataTransfer.files?.length && void uploadAdd([...e.dataTransfer.files]); }}
        style={drag ? { outline: `2px dashed ${ACCENT}`, outlineOffset: 4, borderRadius: 12 } : undefined}
      >
        <input ref={mainRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files?.length && void uploadMain([...e.target.files])} />
        <input ref={addRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => e.target.files?.length && void uploadAdd([...e.target.files])} />

        <div style={S.label}>PRODUCT PHOTOS</div>

        {/* main / primary slot */}
        <div style={mainSlot}>
          {primary ? (
            <>
              <img src={primary} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
              <span style={{ position: 'absolute', top: 6, left: 6, background: ACCENT, color: '#fff', fontSize: 8, fontWeight: 800, padding: '2px 7px', borderRadius: 4, letterSpacing: '0.04em' }}>PRIMARY</span>
              {isUnsaved(primary) ? <span style={{ ...S.ribbonUnsaved, top: 'auto', bottom: 6 }}>UNSAVED · local preview</span> : null}
              {editing ? (
                <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 6 }}>
                  <button type="button" disabled={busy} onClick={() => mainRef.current?.click()} style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid #E8EDF2', borderRadius: 6, fontSize: 10, fontWeight: 800, padding: '4px 8px', cursor: 'pointer' }}>{busy ? '…' : 'Replace'}</button>
                  <button type="button" onClick={() => removeAt(0)} style={{ background: 'rgba(220,38,38,0.95)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 10, fontWeight: 800, padding: '4px 8px', cursor: 'pointer' }}>Remove</button>
                </div>
              ) : null}
            </>
          ) : editing ? (
            <div role="button" tabIndex={0} onClick={() => !busy && mainRef.current?.click()} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && mainRef.current?.click()}
              style={{ ...dz(false), height: '100%', borderRadius: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: ACCENT_WASH, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {busy ? <RotateCw className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
              </div>
              <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Drop main product photo</div>
              <div style={{ fontSize: '10px', color: '#9CA3AF' }}>JPG or PNG</div>
            </div>
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 12, fontStyle: 'italic' }}>No main photo</div>
          )}
        </div>

        {/* smaller gallery slots */}
        <div style={smallGrid}>
          {Array.from({ length: slotCount }).map((_, i) => {
            const u = extras[i];
            const absoluteIndex = i + 1;
            if (u) {
              return (
                <div key={`${u}-${i}`} style={smallSlot}>
                  <img src={u} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                  {isUnsaved(u) ? <span style={{ ...S.ribbonUnsaved, fontSize: 7, padding: '1px 4px' }}>UNSAVED</span> : null}
                  {editing ? (
                    <>
                      <button type="button" title="Remove" onClick={() => removeAt(absoluteIndex)} style={{ ...S.tileX, width: 16, height: 16 }}><Trash2 className="w-2.5 h-2.5" /></button>
                      <button type="button" onClick={() => setPrimary(u)} style={{ ...S.makePrimaryBtn, fontSize: 7.5, padding: '2px 5px' }}>★ Primary</button>
                    </>
                  ) : null}
                </div>
              );
            }
            return (
              <div key={`empty-${i}`} style={dashed} onClick={() => editing && addRef.current?.click()}>
                {editing ? <span style={{ fontSize: 16, fontWeight: 700, color: ACCENT }}>+</span> : null}
              </div>
            );
          })}
        </div>

        {editing ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ ...S.readEmpty, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ImageIcon className="w-3.5 h-3.5" /> drag files here, or
            </span>
            <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="paste an image HTTPS URL…" style={{ ...S.input, height: 32, flex: 1, minWidth: 160 }} />
            <button type="button" onClick={() => { const u = urlInput.trim(); if (u) { onChange([...photos, u]); setUrlInput(''); } }} style={{ ...S.ghostBtn, padding: '6px 10px' }}>Add</button>
          </div>
        ) : null}
      </div>

      {/* RIGHT — PRODUCT VIDEO (OPTIONAL) — functional, one canonical source */}
      <VideoField editing={editing} value={videoUrl} onChange={onVideoChange} onToast={onToast} />
    </div>
  );
}

export default function ProductEditStudio() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';
  const activeId = isNew ? 'new' : id;

  const draftKey = `choosify_product_draft_${activeId}`;
  const pubKey = `choosify_product_published_${activeId}`;
  const versionsKey = `choosify_product_versions_${activeId}`;

  // `model` = last persisted state (all sections read from it).
  // `sectionDraft` = a full working clone the active section mutates.
  // `editingId` = the section currently in edit mode; '*' = whole-form create.
  const [model, setModel] = useState<ProductEditorModel | null>(null);
  const [sectionDraft, setSectionDraft] = useState<ProductEditorModel | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Existing product that could not be authoritatively loaded. While set, the
  // Studio shows a load-error state and every Save/Publish path is disabled —
  // it must NEVER PATCH a blank model over a real listing.
  const [loadError, setLoadError] = useState<{ kind: 'notfound' | 'error'; message: string } | null>(null);
  const loadErrorRef = useRef(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Category variant schema for the category currently in the draft.
  const [categorySchema, setCategorySchema] = useState<{ forId: string; dims: SchemaVariantDimension[] } | null>(null);
  // A category the seller picked whose schema is incompatible with current
  // variant data — held until they choose Remap / Clear / Cancel.
  const [pendingCategory, setPendingCategory] = useState<
    { id: string; name: string; dims: SchemaVariantDimension[]; compat: CategorySchemaCompatibility } | null
  >(null);
  const [remapOpen, setRemapOpen] = useState(false);

  const { allBrands, activeBrandId } = useAuth();
  const [categoryOptions, setCategoryOptions] = useState<Array<{ id: string; name: string }>>([]);

  const { versions, saveDraft: persistDraft, saveVersion } = useEntityDraft<ProductEditorModel>(
    'product',
    isNew ? '' : activeId,
    { draftKey, versionsKey },
    (backendDraft) => {
      // Never resurrect an editable model while the authoritative load failed —
      // a backend draft is a partial editor snapshot, not the server product.
      if (backendDraft && !loadErrorRef.current) setModel(backendDraft);
    },
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      loadErrorRef.current = false;

      if (isNew) {
        if (!cancelled) {
          const blank = createBlankProductModel('new');
          setModel(blank);
          setSectionDraft(blank);
          setEditingId('*'); // brand-new product: one create form
          setLoading(false);
        }
        return;
      }

      const readCache = (): ProductEditorModel | null => {
        try {
          const raw = localStorage.getItem(draftKey) || localStorage.getItem(pubKey);
          return raw ? (JSON.parse(raw) as ProductEditorModel) : null;
        } catch {
          return null;
        }
      };

      const result = await resolveExistingProductLoad(activeId, {
        getProduct: (pid) => catalogApi.getProduct(pid),
        getProductDetail: (pid) => catalogApi.getProductDetail(pid),
        readCache,
      });
      if (cancelled) return;

      if (result.status === 'ok') {
        setModel(result.model);
        setSectionDraft(result.model);
        setLoading(false);
        return;
      }

      // EXISTING product id that could not be authoritatively loaded (list call
      // failed, or the id is not in this account's catalog). Do NOT fall back to
      // a blank model — a later Save/Publish would PATCH empty data over the
      // real listing. Enter the explicit load-error state instead.
      loadErrorRef.current = true;
      setModel(null);
      setSectionDraft(null);
      setEditingId(null);
      setDirty(false);
      setLoadError(
        result.status === 'notfound'
          ? {
              kind: 'notfound',
              message: `Product “${activeId}” is not in your catalog. It may have been removed, or your account may not have access to it.`,
            }
          : { kind: 'error', message: result.message },
      );
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, isNew, reloadNonce]);

  useEffect(() => {
    let cancelled = false;
    catalogApi.listCategories()
      .then((c) => { if (!cancelled) setCategoryOptions(c.map((x) => ({ id: x.id, name: x.name }))); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Keep the variant schema in sync with the draft's category.
  const draftCategoryId = sectionDraft?.categoryId || '';
  useEffect(() => {
    if (!draftCategoryId) { setCategorySchema(null); return; }
    if (categorySchema?.forId === draftCategoryId) return;
    let cancelled = false;
    catalogApi.getCategorySchema(draftCategoryId)
      .then((s) => {
        if (!cancelled) {
          setCategorySchema({ forId: draftCategoryId, dims: (s.variantDimensions || []).map(mapSchemaDim) });
        }
      })
      .catch(() => { if (!cancelled) setCategorySchema({ forId: draftCategoryId, dims: [] }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftCategoryId]);

  // New product with no brand yet → default to the seller's (or first) brand.
  useEffect(() => {
    if (!isNew || !sectionDraft || sectionDraft.brandId || !allBrands.length) return;
    const brand = allBrands.find((b) => b.id === activeBrandId) || allBrands[0];
    if (!brand) return;
    setSectionDraft((prev) => (prev && !prev.brandId ? { ...prev, brandId: brand.id, brandName: brand.name } : prev));
  }, [isNew, sectionDraft, allBrands, activeBrandId]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => setToastMessage(null), 4000);
  };

  const brandFieldOptions = useMemo(() => allBrands.map((b) => ({ id: b.id, name: b.name })), [allBrands]);

  const SECTION_LABELS: Record<string, string> = {
    core: 'Core Product Profile', basic: 'Basic Information',
    description: 'Description', pricing: 'Pricing', inventory: 'Inventory & Status',
    options: 'Options & Variants', addons: 'Add-on Items', specs: 'Specifications',
    addlspecs: 'Physical Specifications', box: 'Complimentary Features', overview: 'Product Overview',
    tags: 'Best For Tags', delivery: 'Delivery Information',
    influencer: 'Creator Reviews', warranty: 'Warranty & After-Sales Services',
    relatedinfo: 'Related Information',
  };

  const requestEdit = (sectionId: string) => {
    if (!model) return;
    if (editingId && editingId !== sectionId) {
      if (dirty) {
        triggerToast(`Finish editing “${SECTION_LABELS[editingId] || editingId}” first — Save or Cancel.`);
        return;
      }
    }
    setSectionDraft(JSON.parse(JSON.stringify(model)));
    setEditingId(sectionId);
    setDirty(false);
  };

  const cancelSection = () => {
    setSectionDraft(model);
    setEditingId(null);
    setDirty(false);
    setPendingCategory(null);
    setRemapOpen(false);
    if (isNew) navigate('/admin/products');
  };

  const patch = (p: Partial<ProductEditorModel>) => {
    setSectionDraft((d) => (d ? { ...d, ...p } : d));
    setDirty(true);
  };

  const persistCache = (saved: ProductEditorModel) => {
    try {
      localStorage.setItem(`choosify_product_published_${saved.id}`, JSON.stringify(saved));
      localStorage.setItem(`choosify_product_draft_${saved.id}`, JSON.stringify(saved));
    } catch (_) {}
  };

  // Persist the active section — canonical API, section-merged model, status kept.
  const saveSection = async () => {
    if (!sectionDraft || !editingId) return;
    // Fail closed: never write back when the authoritative product is not loaded.
    if (!isSafeToPersist(model, { isNew, activeId, hasLoadError: !!loadError })) {
      triggerToast('This product hasn’t loaded — reload before saving.');
      return;
    }
    if (pendingCategory) {
      triggerToast('Resolve the category change first — Remap, Clear, or Cancel it.');
      return;
    }
    setSaving(true);
    try {
      const merged: ProductEditorModel = { ...model, ...sectionDraft } as ProductEditorModel;
      let productId = merged.id;
      const productPatch = editorModelToProductPatch(merged); // status from merged.status, never forced LIVE
      if (isNew || productId === 'new') {
        const created = await catalogApi.createProduct(productPatch);
        productId = created.id;
      } else {
        await catalogApi.updateProduct(productId, productPatch);
      }
      try {
        await catalogApi.upsertProductDetail(productId, editorModelToDetailPayload({ ...merged, id: productId }));
      } catch (_) {}
      const saved: ProductEditorModel = { ...merged, id: productId };
      persistCache(saved);
      if (!isNew) {
        persistDraft(saved);
        try { await saveVersion(`Saved ${SECTION_LABELS[editingId] || editingId} · ${new Date().toLocaleString()}`, saved); } catch (_) {}
      }
      setModel(saved);
      setSectionDraft(saved);
      setEditingId(null);
      setDirty(false);
      triggerToast(isNew ? 'Product created' : `${SECTION_LABELS[editingId] || 'Section'} saved`);
      if (isNew) navigate(`/admin/products/${productId}/edit`, { replace: true });
    } catch (err) {
      triggerToast(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    const base = model;
    if (!base) return;
    if (!isSafeToPersist(base, { isNew, activeId, hasLoadError: !!loadError })) {
      triggerToast('This product hasn’t loaded — reload before publishing.');
      return;
    }
    setIsPublishing(true);
    try {
      let productId = base.id;
      const productPatch = editorModelToProductPatch({ ...base, status: 'LIVE' });
      if (isNew || productId === 'new') {
        const created = await catalogApi.createProduct(productPatch);
        productId = created.id;
      } else {
        await catalogApi.updateProduct(productId, productPatch);
      }
      try {
        await catalogApi.upsertProductDetail(productId, editorModelToDetailPayload({ ...base, id: productId }));
      } catch (_) {}
      const published: ProductEditorModel = { ...base, id: productId, status: 'LIVE' };
      persistCache(published);
      setModel(published);
      setSectionDraft(published);
      setShowPublishModal(false);
      triggerToast('Product published');
      if (isNew) navigate(`/admin/products/${productId}/edit`, { replace: true });
    } catch (err) {
      triggerToast(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setIsPublishing(false);
    }
  };

  if (loadError) {
    return (
      <div className="aws-page" style={S.page}>
        <div style={S.headerCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <button type="button" onClick={() => navigate('/admin/products')} style={S.backBtn} aria-label="Back to products">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div style={{ minWidth: 0 }}>
              <div style={S.kicker}>PRODUCT STUDIO</div>
              <div style={S.h1}>Couldn’t load this product</div>
            </div>
          </div>
        </div>
        <div style={{ ...S.card, borderColor: '#FCA5A5', background: '#FEF2F2' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#B91C1C', marginBottom: 6 }}>
            {loadError.kind === 'notfound' ? 'Product not found' : 'Load failed'}
          </div>
          <div style={{ fontSize: 12, color: '#7F1D1D', lineHeight: 1.6, marginBottom: 16, maxWidth: 560 }}>
            {loadError.message}
            <br />
            Saving and publishing are disabled until it loads — this protects the existing listing from being
            overwritten with incomplete data.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => setReloadNonce((n) => n + 1)} style={S.accentBtn} disabled={loading}>
              {loading ? 'Retrying…' : 'Retry'}
            </button>
            <button type="button" onClick={() => navigate('/admin/products')} style={S.ghostBtn}>
              Back to products
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !model || !sectionDraft) {
    return (
      <div className="flex flex-col items-center justify-center h-[420px] gap-3 text-app-text-muted">
        <RotateCw className="w-10 h-10 animate-spin" style={{ color: ACCENT }} />
        <span className="text-xs font-mono">Loading Product Studio…</span>
      </div>
    );
  }

  const creating = editingId === '*';
  const isLive = model.status === 'LIVE';
  const kindLabel = isNew ? 'NEW PRODUCT' : 'PRODUCT STUDIO';
  const heading = (creating ? sectionDraft.title : model.title) || (isNew ? 'New Product' : 'Untitled Product');

  const applyPhotos = (next: string[]) => patch({ image: next[0] || '', gallery: next });

  const draftIsService = sectionDraft.productType === 'service';

  // Category picker — a category whose schema is incompatible with the current
  // variant data is NOT applied silently. It parks in `pendingCategory` until the
  // seller chooses Remap / Clear / Cancel (see CategoryChangeDecision).
  const onPickCategory = async (newId: string) => {
    setRemapOpen(false);
    const name = categoryOptions.find((c) => c.id === newId)?.name || '';
    const d = sectionDraft;
    const hasVariantData = (d.optionGroups?.length ?? 0) > 0 || (d.productVariants?.length ?? 0) > 0;
    if (!newId || newId === d.categoryId || !hasVariantData) {
      setPendingCategory(null);
      patch({ categoryId: newId, categoryName: name });
      return;
    }
    let dims: SchemaVariantDimension[] = [];
    try {
      const s = await catalogApi.getCategorySchema(newId);
      dims = (s.variantDimensions || []).map(mapSchemaDim);
    } catch {
      // Schema unreachable — apply the change; the server re-validates on Save.
      setPendingCategory(null);
      patch({ categoryId: newId, categoryName: name });
      triggerToast('Could not load the new category schema — it will be validated on Save.');
      return;
    }
    const compat = checkCategorySchemaCompatibility(d.optionGroups, d.productVariants, dims);
    if (compat.compatible) {
      setPendingCategory(null);
      patch({ categoryId: newId, categoryName: name });
    } else {
      setPendingCategory({ id: newId, name, dims, compat });
    }
  };

  const applyCategoryClear = () => {
    if (!pendingCategory) return;
    const { compat } = pendingCategory;
    const badValueGroups = new Set(compat.invalidValues.map((iv) => iv.split(' → ')[0]));
    const keepGroups = (sectionDraft.optionGroups || []).filter(
      (g) => !compat.invalidGroups.includes(g.name) && !badValueGroups.has(g.name),
    );
    const badVarIds = new Set(compat.invalidVariantIds);
    const keepVariants = (sectionDraft.productVariants || []).filter((v) => !badVarIds.has(v.id));
    patch({
      categoryId: pendingCategory.id,
      categoryName: pendingCategory.name,
      optionGroups: keepGroups,
      productVariants: keepVariants,
    });
    setPendingCategory(null);
    setRemapOpen(false);
    triggerToast('Incompatible variant data cleared.');
  };

  const applyCategoryRemap = (next: {
    optionGroups: ProductEditorModel['optionGroups'];
    productVariants: ProductEditorModel['productVariants'];
  }) => {
    if (!pendingCategory) return;
    patch({
      categoryId: pendingCategory.id,
      categoryName: pendingCategory.name,
      optionGroups: next.optionGroups,
      productVariants: next.productVariants,
    });
    setPendingCategory(null);
    setRemapOpen(false);
    triggerToast('Variant data remapped to the new category schema.');
  };

  // Inline field editors for one storefront section. Rendered in place by
  // <ProductDetailPresentation mode="studio"> when that section is being edited
  // (or, in create mode, for every section at once). Reads/writes `sectionDraft`
  // only; Save/Cancel chrome is supplied by the presentation's SectionShell.
  const renderEditor = (key: string): React.ReactNode => {
    const d = sectionDraft;
    switch (key) {
      case 'core':
        return (
          <MediaComposition
            editing
            photos={photosOf(d)}
            onChange={applyPhotos}
            onToast={triggerToast}
            videoUrl={d.videoUrl || ''}
            onVideoChange={(url) => patch({ videoUrl: url })}
          />
        );
      case 'basic':
        return (
          <>
            <div style={S.grid3}>
              <div>
                <div style={S.label}>PRODUCT CATALOG SKU NAME</div>
                <input value={d.title} onChange={(e) => patch({ title: e.target.value })} placeholder="e.g. Sony WH-1000XM5 Headphones" style={S.input} />
              </div>
              <div>
                <div style={S.label}>BRAND</div>
                <select value={d.brandId} onChange={(e) => { const b = brandFieldOptions.find((x) => x.id === e.target.value); patch({ brandId: e.target.value, brandName: b?.name || '' }); }} style={S.input}>
                  <option value="">Select a brand…</option>
                  {brandFieldOptions.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <div style={S.label}>CATEGORY</div>
                <select value={d.categoryId} onChange={(e) => void onPickCategory(e.target.value)} style={S.input}>
                  <option value="">Select a category…</option>
                  {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <div style={S.label}>PRODUCT CODE (OPTIONAL)</div>
                <input value={d.sku} onChange={(e) => patch({ sku: e.target.value })} placeholder="Your own SKU / article no." style={S.input} />
                <div style={S.hint}>Seller reference only — not shown to buyers.</div>
              </div>
            </div>
            {pendingCategory ? (
              <div style={{ marginTop: 12 }}>
                <CategoryChangeDecision
                  compat={pendingCategory.compat}
                  fromName={d.categoryName}
                  toName={pendingCategory.name}
                  onRemap={() => setRemapOpen(true)}
                  onClear={applyCategoryClear}
                  onCancel={() => { setPendingCategory(null); setRemapOpen(false); }}
                />
                {remapOpen ? (
                  <VariantRemapPanel
                    optionGroups={d.optionGroups}
                    productVariants={d.productVariants}
                    targetDims={pendingCategory.dims}
                    onApply={applyCategoryRemap}
                    onCancel={() => setRemapOpen(false)}
                  />
                ) : null}
              </div>
            ) : null}
          </>
        );
      case 'description':
        return (
          <textarea rows={4} value={d.description} onChange={(e) => patch({ description: e.target.value })} style={S.textarea} placeholder="What is this product, who is it for, what makes it worth buying?" />
        );
      case 'pricing': {
        const mrpBelowPrice = d.originalPrice > 0 && d.price > 0 && d.originalPrice < d.price;
        return (
          <div style={S.grid2}>
            <div>
              <div style={S.label}>ACTUAL PRICE (৳)</div>
              <input type="number" min={0} value={d.price || ''} onChange={(e) => patch({ price: Number(e.target.value) || 0 })} style={S.input} />
              <div style={S.hint}>Current sell price after discount — what the buyer pays.</div>
            </div>
            <div>
              <div style={S.label}>MRP / STRIKE PRICE (৳)</div>
              <input type="number" min={0} value={d.originalPrice || ''} onChange={(e) => patch({ originalPrice: Number(e.target.value) || 0 })} style={mrpBelowPrice ? { ...S.input, borderColor: '#DC2626' } : S.input} />
              <div style={S.hint}>
                The original / reference price. Shows struck-through above the sell price; the gap is
                the buyer's saving. Leave blank for no discount.
              </div>
              {mrpBelowPrice ? (
                <div style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', marginTop: 4 }}>
                  MRP can't be lower than the actual price — the storefront would show no discount and Save will be rejected.
                </div>
              ) : null}
            </div>
          </div>
        );
      }
      case 'inventory':
        return (
          <div style={S.grid2}>
            <div>
              <div style={S.label}>STOCK (UNITS)</div>
              <input type="number" min={0} value={d.stock || ''} onChange={(e) => patch({ stock: Number(e.target.value) || 0 })} placeholder="Units in stock" style={S.input} />
            </div>
            <div>
              <div style={S.label}>LISTING STATUS</div>
              <select value={d.status} onChange={(e) => patch({ status: e.target.value as ProductEditorModel['status'] })} style={S.input}>
                <option value="DRAFT">DRAFT</option>
                <option value="LIVE">LIVE</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            </div>
          </div>
        );
      case 'options':
        return (
          <>
            <VariantMatrixEditor
              optionGroups={d.optionGroups}
              productVariants={d.productVariants}
              variantDimensions={
                !d.categoryId
                  ? []
                  : categorySchema && categorySchema.forId === d.categoryId
                    ? categorySchema.dims
                    : null
              }
              isService={draftIsService}
              onChange={(next) => patch({ optionGroups: next.optionGroups, productVariants: next.productVariants })}
            />
            <ProductGuideEditor
              guide={d.sizeGuide}
              onChange={(next) => patch({ sizeGuide: next })}
              onToast={triggerToast}
            />
          </>
        );
      case 'addons':
        return (
          <AddonItemsEditor items={d.addonItems} onChange={(next) => patch({ addonItems: next })} />
        );
      case 'delivery':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={S.label}>DELIVERY REGION</div>
              <input
                value={d.deliveryRegion}
                onChange={(e) => patch({ deliveryRegion: e.target.value })}
                placeholder="e.g. Dhaka, Bangladesh"
                style={S.input}
              />
              <div style={S.hint}>Shown at the top of the Delivery Information card.</div>
            </div>
            <div>
              <div style={{ ...S.label, marginBottom: 6 }}>DELIVERY FACTS — one per line</div>
              <textarea
                rows={5}
                value={(d.deliveryBullets || []).join('\n')}
                onChange={(e) => patch({ deliveryBullets: linesFromTextarea(e.target.value) })}
                placeholder={'Cash on Delivery available\nSame-day delivery inside Dhaka\nInstant order confirmation\nNationwide courier 2–4 days'}
                style={S.textarea}
              />
              <div style={S.hint}>
                Quick-service delivery info buyers see on the Product Detail page. Leave everything
                blank to fall back to the platform default.
              </div>
            </div>
          </div>
        );
      case 'specs':
        return (
          <SpecRowsEditor
            rows={d.specs}
            onChange={(next) => patch({ specs: next })}
            labelPlaceholder="e.g. Display"
            valuePlaceholder={'e.g. 6.7" AMOLED 120Hz'}
          />
        );
      case 'addlspecs':
        return (
          <>
            <div style={{ ...S.label, marginBottom: 6 }}>Physical specifications — one per line: <code>Label: Value</code></div>
            <textarea rows={4} value={specsToTextarea(d.additionalSpecs)} onChange={(e) => patch({ additionalSpecs: specsFromTextarea(e.target.value) })} placeholder={'Dimensions: 160 × 74 × 8 mm\nBox weight: 420 g\nMaterial: Aluminium frame\nColour: Midnight Black'} style={{ ...S.textarea, fontFamily: 'ui-monospace, monospace', fontSize: 12 }} />
            <div style={S.hint}>Dimensions, weight and material — shown beside Complimentary Features on the storefront.</div>
          </>
        );
      case 'box':
        return (
          <>
            <div style={{ ...S.label, marginBottom: 6 }}>Complimentary features — one item per line</div>
            <textarea rows={4} value={d.boxContents.join('\n')} onChange={(e) => patch({ boxContents: linesFromTextarea(e.target.value) })} placeholder={'1 × Handset\n1 × 33W charger\n1 × USB-C cable\nFree screen protector\nWarranty card'} style={S.textarea} />
            <div style={S.hint}>Free extras and everything included with this product.</div>
          </>
        );
      case 'overview':
        return (
          <OverviewBlocksEditor
            blocks={d.overviewBlocks}
            onChange={(next) => patch({ overviewBlocks: next })}
          />
        );
      case 'influencer':
        return (
          <CreatorReviewsEditor
            videos={d.creatorVideos}
            onChange={(next) => patch({ creatorVideos: next })}
          />
        );
      case 'warranty':
        return (
          <WarrantyEditor
            months={d.warrantyMonths}
            type={d.warrantyType}
            provider={d.warrantyProvider}
            terms={d.warrantyTerms}
            afterSales={d.afterSalesBullets}
            onChange={(p) =>
              patch({
                ...(p.months !== undefined ? { warrantyMonths: p.months } : {}),
                ...(p.type !== undefined ? { warrantyType: p.type } : {}),
                ...(p.provider !== undefined ? { warrantyProvider: p.provider } : {}),
                ...(p.terms !== undefined ? { warrantyTerms: p.terms } : {}),
                ...(p.afterSales !== undefined ? { afterSalesBullets: p.afterSales } : {}),
              })
            }
          />
        );
      case 'tags':
        return (
          <HashtagsEditor tags={d.bestForTags} onChange={(next) => patch({ bestForTags: next })} />
        );
      case 'relatedinfo':
        return (
          <RelatedInfoEditor
            type={d.relatedInfoType}
            priceAcrossStoresEnabled={d.priceAcrossStoresEnabled}
            stores={d.relatedStores}
            adminPromoted={d.adminPromotedStores}
            locked={d.relatedInfoLockedByAdmin}
            whatsNearby={d.whatsNearby}
            beforeYourVisit={d.beforeYourVisit}
            customTitle={d.customRelatedInfoTitle}
            customBlocks={d.customRelatedBlocks}
            suggestedType={defaultRelatedInfoType(d.productType)}
            onChange={(p) => patch(p)}
          />
        );
      default:
        return null;
    }
  };

  const studio: StudioBridge = {
    editingSection: editingId,
    dirty,
    saving,
    onEdit: requestEdit,
    onCancel: cancelSection,
    onSave: () => { void saveSection(); },
    renderEditor,
  };

  return (
    <div className="aws-page" style={S.page}>
      {/* ── Header ── */}
      <div style={S.headerCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <button type="button" onClick={() => navigate('/admin/products')} style={S.backBtn} aria-label="Back to products">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={S.kicker}>{kindLabel}</span>
              <span style={isLive ? S.badgeLive : S.badgeDraft}>{isLive ? '● LIVE' : '● DRAFT'}</span>
              {editingId && !creating ? <span style={{ ...S.kicker, color: ACCENT }}>● EDITING: {SECTION_LABELS[editingId]}</span> : null}
            </div>
            <div style={{ ...S.h1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 460 }}>{heading}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {!isNew ? (
            <button type="button" onClick={() => navigate(`/admin/products/${model.id}/preview`)} style={S.ghostBtn}>
              View storefront preview
            </button>
          ) : null}
          <div style={{ position: 'relative' }}>
            <button type="button" onClick={() => setShowVersions((v) => !v)} style={{ ...S.ghostBtn, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <History className="w-4 h-4" style={{ color: ACCENT }} />
              Snapshots ({versions?.length || 0})
            </button>
            {showVersions ? (
              <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 8, width: 300, background: '#fff', border: '1px solid #E8EDF2', borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.12)', padding: 12, zIndex: 40 }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: ACCENT, borderBottom: '1px solid #F1F3F5', paddingBottom: 8, marginBottom: 8 }}>History</div>
                {(versions || []).length === 0 ? (
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>No snapshots yet.</div>
                ) : (
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', maxHeight: 190, overflowY: 'auto' }}>
                    {(versions || []).slice(0, 10).map((v) => (
                      <li key={v.id} style={{ fontSize: 11, color: '#374151', padding: '6px 0', borderBottom: '1px solid #F7F8FA' }}>{v.label || v.createdAt}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
          {creating ? (
            <>
              <button type="button" onClick={cancelSection} style={S.ghostBtn} disabled={saving}>Cancel</button>
              <button type="button" onClick={() => void saveSection()} style={S.accentBtn} disabled={saving}>
                {saving ? 'Creating…' : 'Create Product'}
              </button>
            </>
          ) : !isLive ? (
            <button type="button" onClick={() => setShowPublishModal(true)} style={S.accentBtn}>Publish Product</button>
          ) : null}
        </div>
      </div>

      {creating ? (
        <div style={{ ...S.card, borderColor: ACCENT, background: ACCENT_WASH }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#C2410C' }}>
            New product — fill in the sections below, then <b>Create Product</b>. After it exists you can edit each section on its own.
          </div>
        </div>
      ) : null}

      {/* -- Storefront-parity Product Detail with section-level inline editing.
          Each EDITABLE region carries an "Edit" pill; clicking it swaps that
          region in place to renderEditor(key) with Save Changes / Cancel (one
          section at a time; switching while dirty is blocked upstream). The
          engagement metrics, Creator/Public Reviews, Brand card and the trust
          panel are preview-only. Buyer actions (Add to Cart / Wishlist / Compare
          / Message / qty) render for parity but are disabled. -- */}
      <div style={{ border: '1px solid #E8EDF2', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
        <ProductDetailPresentation model={model} mode="studio" studio={studio} />
      </div>

      {/* ── Publish confirmation (allowed dialog: deliberate go-live gate) ── */}
      {showPublishModal ? (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 420, width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 8px' }}>Publish live product?</h3>
            <p style={{ fontSize: 12, color: '#4B5563', margin: '0 0 20px' }}>
              This writes the product to the catalog API and marks it LIVE where supported. Save any in-progress section first.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" onClick={() => setShowPublishModal(false)} style={{ ...S.ghostBtn, flex: 1 }}>Cancel</button>
              <button type="button" disabled={isPublishing} onClick={() => void handlePublish()} style={{ ...S.accentBtn, flex: 1, opacity: isPublishing ? 0.6 : 1 }}>
                {isPublishing ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toastMessage ? (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 70, background: '#0A0A1F', color: '#fff', fontSize: 12, fontWeight: 700, padding: '11px 18px', borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.25)', maxWidth: 420 }}>
          {toastMessage}
        </div>
      ) : null}
    </div>
  );
}
