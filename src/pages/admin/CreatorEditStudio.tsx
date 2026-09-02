import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, History, Plus, RotateCw, Trash2, Upload } from 'lucide-react';
import { catalogApi } from '../../services/catalogApi';
import { useAuth } from '../../contexts/AuthContext';
import { useEntityDraft } from '../../hooks/useEntityDraft';
import { uploadCreatorImage } from '../../services/mediaUpload';
import { CreatorProfilePresentation, type CreatorStudioBridge } from '../../components/creator-profile';
import type { CatalogBrand } from '../../types/catalog';
import {
  createBlankCreatorModel,
  editorModelToCreatorPayload,
  editorModelToCreatorSectionPatch,
  mapCatalogCreatorToEditor,
  type CreatorBrandPartner,
  type CreatorEditSection,
  type CreatorEditorModel,
  type CreatorFeaturedItem,
} from './creatorEditorModel';

const WEB_ORIGIN = 'http://localhost:5173';

const label = 'block text-[10px] font-extrabold uppercase tracking-wider text-[#6B7280] mb-1';
const input =
  'w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12.5px] text-[#1A1A2E] outline-none focus:border-[#EF3C23]';
const textarea = `${input} min-h-[110px] leading-relaxed`;
const ghostBtn =
  'inline-flex items-center gap-1 rounded-md border border-[#E8EDF2] bg-white px-2 py-1 text-[10px] font-bold text-[#374151] hover:bg-[#F8FAFC]';
const hint = 'mt-1 text-[10.5px] leading-snug text-[#9CA3AF]';

const SECTION_LABEL: Record<CreatorEditSection, string> = {
  cover: 'Cover & Avatar',
  identity: 'Profile Identity',
  social: 'Social Links',
  overview: 'Creator Overview',
  contact: 'Contact & Reach',
  partnerships: 'Partnerships',
  featured: 'Featured Content',
};

/* ── Repeatable single-line list editor ──────────────────────────────────── */
function ListEditor({
  items,
  onChange,
  placeholder,
  addLabel = 'Add',
}: {
  items: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  addLabel?: string;
}) {
  return (
    <div className="space-y-1.5">
      {items.map((v, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            className={input}
            value={v}
            placeholder={placeholder}
            onChange={(e) => onChange(items.map((x, idx) => (idx === i ? e.target.value : x)))}
          />
          <button
            type="button"
            className={`${ghostBtn} text-[#DC2626]`}
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#EF3C23]"
        onClick={() => onChange([...items, ''])}
      >
        <Plus className="h-3.5 w-3.5" /> {addLabel}
      </button>
    </div>
  );
}

/* ── One image (cover or avatar) — canonical uploadCreatorImage, inline preview ── */
function ImageField({
  value,
  onChange,
  onToast,
  aspect,
  roundedFull,
  emptyLabel,
}: {
  value: string;
  onChange: (u: string) => void;
  onToast: (m: string) => void;
  aspect: string;
  roundedFull?: boolean;
  emptyLabel: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const doUpload = async (files: FileList | File[] | null) => {
    const f = Array.from(files ?? []).find((x) => x.type.startsWith('image/'));
    if (!f) {
      onToast('Choose a JPG or PNG image.');
      return;
    }
    setBusy(true);
    try {
      onChange(await uploadCreatorImage(f));
    } catch (e) {
      const blob = URL.createObjectURL(f);
      onChange(blob);
      onToast(e instanceof Error ? `${e.message} — UNSAVED local preview.` : 'Upload failed — UNSAVED local preview.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void doUpload(e.target.files)}
      />
      <div
        role="button"
        tabIndex={0}
        onClick={() => !busy && fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void doUpload(e.dataTransfer.files);
        }}
        className={`relative ${aspect} ${roundedFull ? 'rounded-full' : 'rounded-lg'} overflow-hidden border border-[#E8EDF2] bg-[#F4F7F9] cursor-pointer flex items-center justify-center`}
      >
        {value ? (
          <img src={value} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="text-[11px] font-bold text-[#9CA3AF] flex items-center gap-1.5">
            {busy ? <RotateCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {busy ? 'Uploading…' : emptyLabel}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex gap-2">
        <button type="button" className={ghostBtn} disabled={busy} onClick={() => fileRef.current?.click()}>
          {value ? 'Replace' : 'Upload'}
        </button>
        {value ? (
          <button type="button" className={`${ghostBtn} text-[#DC2626]`} onClick={() => onChange('')}>
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ── Small square thumbnail upload (featured card / brand logo) ─────────── */
function ThumbField({
  value,
  onChange,
  onToast,
  rounded,
}: {
  value: string;
  onChange: (u: string) => void;
  onToast: (m: string) => void;
  rounded?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const doUpload = async (files: FileList | File[] | null) => {
    const f = Array.from(files ?? []).find((x) => x.type.startsWith('image/'));
    if (!f) {
      onToast('Choose a JPG or PNG image.');
      return;
    }
    setBusy(true);
    try {
      onChange(await uploadCreatorImage(f));
    } catch (e) {
      onChange(URL.createObjectURL(f));
      onToast(e instanceof Error ? `${e.message} — UNSAVED local preview.` : 'Upload failed — UNSAVED preview.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  return (
    <div className="flex items-center gap-2">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void doUpload(e.target.files)} />
      <div
        role="button"
        tabIndex={0}
        onClick={() => !busy && fileRef.current?.click()}
        className={`w-14 h-14 ${rounded ? 'rounded-full' : 'rounded-lg'} overflow-hidden border border-[#E8EDF2] bg-[#F4F7F9] shrink-0 flex items-center justify-center cursor-pointer`}
      >
        {value ? (
          <img src={value} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : busy ? (
          <RotateCw className="h-4 w-4 animate-spin text-[#9CA3AF]" />
        ) : (
          <Upload className="h-4 w-4 text-[#9CA3AF]" />
        )}
      </div>
      <button type="button" className={ghostBtn} disabled={busy} onClick={() => fileRef.current?.click()}>
        {value ? 'Replace' : 'Upload'}
      </button>
      {value ? (
        <button type="button" className={`${ghostBtn} text-[#DC2626]`} onClick={() => onChange('')}>
          Remove
        </button>
      ) : null}
    </div>
  );
}

/* ── Extra social links (label + url) ─────────────────────────────────── */
function SocialCustomEditor({
  items,
  onChange,
}: {
  items: Array<{ label: string; url: string }>;
  onChange: (v: Array<{ label: string; url: string }>) => void;
}) {
  const upd = (i: number, p: Partial<{ label: string; url: string }>) =>
    onChange(items.map((x, idx) => (idx === i ? { ...x, ...p } : x)));
  return (
    <div className="space-y-1.5">
      <div className={label}>More links</div>
      {items.map((c, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            className={`${input} max-w-[150px]`}
            value={c.label}
            placeholder="Label (e.g. Twitch)"
            maxLength={40}
            onChange={(e) => upd(i, { label: e.target.value })}
          />
          <input
            className={input}
            value={c.url}
            placeholder="https://…"
            onChange={(e) => upd(i, { url: e.target.value })}
          />
          <button type="button" className={`${ghostBtn} text-[#DC2626]`} onClick={() => onChange(items.filter((_, idx) => idx !== i))}>
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
      {items.length < 8 ? (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#EF3C23]"
          onClick={() => onChange([...items, { label: '', url: '' }])}
        >
          <Plus className="h-3.5 w-3.5" /> Add a link
        </button>
      ) : (
        <div className={hint}>Up to 8 extra links.</div>
      )}
    </div>
  );
}

/* ── Brand partners — tag a Choosify brand OR add a custom one with a logo ── */
function BrandPartnersEditor({
  items,
  onChange,
  brands,
  onToast,
}: {
  items: CreatorBrandPartner[];
  onChange: (v: CreatorBrandPartner[]) => void;
  brands: CatalogBrand[];
  onToast: (m: string) => void;
}) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const taggedIds = new Set(items.map((b) => b.brandId).filter(Boolean));
  const results = query
    ? brands
        .filter((b) => !taggedIds.has(b.id) && (b.name || '').toLowerCase().includes(query))
        .slice(0, 8)
    : [];
  const upd = (i: number, p: Partial<CreatorBrandPartner>) =>
    onChange(items.map((x, idx) => (idx === i ? { ...x, ...p } : x)));
  return (
    <div className="space-y-2">
      {items.length ? (
        <ol className="space-y-1.5">
          {items.map((b, i) => (
            <li key={b.brandId || `${b.name}-${i}`} className="rounded-lg border border-[#E8EDF2] bg-white p-2.5">
              <div className="flex items-center gap-2">
                {(b.logo || (b.brandId && brands.find((x) => x.id === b.brandId)?.logo)) ? (
                  <img
                    src={b.logo || brands.find((x) => x.id === b.brandId)?.logo}
                    alt=""
                    className="w-7 h-7 rounded object-cover border border-[#E8EDF2] shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : null}
                <input
                  className={`${input} flex-1`}
                  value={b.name}
                  placeholder="Brand name"
                  onChange={(e) => upd(i, { name: e.target.value })}
                  disabled={!!b.brandId}
                />
                {b.brandId ? (
                  <span className="text-[9px] font-bold text-[#059669] uppercase shrink-0">Choosify brand</span>
                ) : null}
                <button
                  type="button"
                  className={`${ghostBtn} text-[#DC2626]`}
                  onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              {!b.brandId ? (
                <div className="mt-1.5">
                  <div className={hint}>Logo (optional)</div>
                  <ThumbField value={b.logo || ''} onChange={(logo) => upd(i, { logo })} onToast={onToast} />
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-[11px] italic text-[#9AA0AC]">No brand partners yet.</p>
      )}
      <div className="relative">
        <input
          className={input}
          value={q}
          placeholder={brands.length ? 'Search Choosify brands to tag…' : 'No brands available'}
          disabled={!brands.length}
          onChange={(e) => setQ(e.target.value)}
        />
        {results.length ? (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-[#E8EDF2] bg-white shadow-lg">
            {results.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  onChange([...items, { name: b.name, brandId: b.id, logo: b.logo || undefined }]);
                  setQ('');
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-[#F8FAFC]"
              >
                {b.logo ? <img src={b.logo} alt="" className="w-5 h-5 rounded object-cover" referrerPolicy="no-referrer" /> : null}
                <span className="min-w-0 truncate font-semibold text-[#1A1A2E]">{b.name}</span>
                <span className="ml-auto shrink-0 text-[10px] font-bold text-[#EF3C23]">Tag</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#EF3C23]"
        onClick={() => onChange([...items, { name: '' }])}
      >
        <Plus className="h-3.5 w-3.5" /> Add a custom brand
      </button>
    </div>
  );
}

/* ── Featured Content — tag own Guides + add external links w/ thumbnail ── */
function FeaturedContentEditor({
  items,
  onChange,
  ownGuides,
  onToast,
}: {
  items: CreatorFeaturedItem[];
  onChange: (v: CreatorFeaturedItem[]) => void;
  ownGuides: Array<{ id: string; slug?: string; title: string; image?: string }>;
  onToast: (m: string) => void;
}) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const usedIds = new Set(items.map((f) => f.contentId).filter(Boolean));
  const results = query
    ? ownGuides.filter((g) => !usedIds.has(g.id) && (g.title || '').toLowerCase().includes(query)).slice(0, 8)
    : [];
  const upd = (i: number, p: Partial<CreatorFeaturedItem>) =>
    onChange(items.map((x, idx) => (idx === i ? { ...x, ...p } : x)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const n = [...items];
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };
  return (
    <div className="space-y-2">
      {items.length ? (
        <ol className="space-y-2">
          {items.map((f, i) => (
            <li key={f.id} className="rounded-lg border border-[#E8EDF2] bg-white p-2.5 flex gap-2.5">
              <div className="w-16 h-12 rounded-md overflow-hidden bg-[#F4F7F9] border border-[#E8EDF2] shrink-0">
                {f.thumbnail ? <img src={f.thumbnail} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : null}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[8px] font-extrabold uppercase rounded px-1 py-0.5 ${
                      f.source === 'platform' ? 'bg-[#E0F2FE] text-[#0369A1]' : 'bg-[#F3F4F6] text-[#6B7280]'
                    }`}
                  >
                    {f.source === 'platform' ? 'Choosify guide' : 'External'}
                  </span>
                  <button type="button" className={ghostBtn} onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                  <button type="button" className={ghostBtn} onClick={() => move(i, 1)} disabled={i === items.length - 1}>↓</button>
                  <button type="button" className={`${ghostBtn} text-[#DC2626] ml-auto`} onClick={() => onChange(items.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <input
                  className={`${input} !h-8`}
                  value={f.title}
                  placeholder="Title"
                  onChange={(e) => upd(i, { title: e.target.value })}
                />
                {f.source === 'external' ? (
                  <>
                    <input
                      className={`${input} !h-8`}
                      value={f.url}
                      placeholder="https:// link"
                      onChange={(e) => upd(i, { url: e.target.value })}
                    />
                    <div>
                      <div className={hint}>Custom thumbnail</div>
                      <ThumbField value={f.thumbnail} onChange={(thumbnail) => upd(i, { thumbnail })} onToast={onToast} />
                    </div>
                  </>
                ) : (
                  <div className={hint}>Links to {f.url}</div>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-[11px] italic text-[#9AA0AC]">
          Nothing featured yet — the profile falls back to your newest videos, reels and guides.
        </p>
      )}

      <div className="relative">
        <input
          className={input}
          value={q}
          placeholder={ownGuides.length ? 'Search your Choosify guides to feature…' : 'You have no guides to feature yet'}
          disabled={!ownGuides.length}
          onChange={(e) => setQ(e.target.value)}
        />
        {results.length ? (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-[#E8EDF2] bg-white shadow-lg">
            {results.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  onChange([
                    ...items,
                    {
                      id: `cfc-${Date.now()}`,
                      source: 'platform',
                      kind: 'guide',
                      contentId: g.id,
                      title: g.title,
                      thumbnail: g.image || '',
                      url: `/spotlight/${g.slug || g.id}`,
                    },
                  ]);
                  setQ('');
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-[#F8FAFC]"
              >
                {g.image ? <img src={g.image} alt="" className="w-8 h-6 rounded object-cover" referrerPolicy="no-referrer" /> : null}
                <span className="min-w-0 truncate font-semibold text-[#1A1A2E]">{g.title}</span>
                <span className="ml-auto shrink-0 text-[10px] font-bold text-[#EF3C23]">Feature</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#EF3C23]"
        onClick={() =>
          onChange([
            ...items,
            { id: `cfc-${Date.now()}`, source: 'external', kind: 'link', title: '', thumbnail: '', url: '' },
          ])
        }
      >
        <Plus className="h-3.5 w-3.5" /> Add an external item
      </button>
    </div>
  );
}

export default function CreatorEditStudio() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isCreatorRole = profile?.role === 'creator';
  const isStaff =
    profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.role === 'moderator';
  const isNew = !id || id === 'new';

  const [model, setModel] = useState<CreatorEditorModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [brands, setBrands] = useState<CatalogBrand[]>([]);
  const [ownGuides, setOwnGuides] = useState<Array<{ id: string; slug?: string; title: string; image?: string }>>([]);

  const [editMode, setEditMode] = useState(isNew);
  const [editingId, setEditingId] = useState<CreatorEditSection | null>(null);
  const [draft, setDraft] = useState<CreatorEditorModel | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [pendingLifecycle, setPendingLifecycle] = useState<'publish' | 'unpublish' | 'archive' | null>(null);

  const flash = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 3400);
  }, []);

  const activeId = model?.id && model.id !== 'new' ? model.id : '';
  // Snapshot / version history only. We deliberately ignore the hook's backend
  // draft-hydration path — the canonical Creator API is the sole source of truth.
  const { versions, saveVersion } = useEntityDraft<CreatorEditorModel>(
    'creator',
    activeId,
    {
      draftKey: `creator_studio_cache_${activeId || 'new'}`,
      versionsKey: `creator_studio_versions_${activeId || 'new'}`,
    },
    () => {},
  );
  // Snapshot dedupe — never record an identical consecutive version.
  const lastSnapshotJson = useRef<string>('');

  // ── load — canonical API only (no operational localStorage) ─────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      if (isNew) {
        // Creators own exactly one profile — resolve (or auto-create the draft)
        // via ensureCreatorWorkspace and edit that instead of a throwaway canvas.
        if (isCreatorRole) {
          try {
            const { creators } = await catalogApi.ensureCreatorWorkspace({
              displayName: profile?.displayName || undefined,
              email: profile?.email || undefined,
            });
            const own = creators[0];
            if (own && !cancelled) {
              setModel(mapCatalogCreatorToEditor(own));
              navigate(`/admin/creator-studio/${own.id}/edit`, { replace: true });
              setLoading(false);
              return;
            }
          } catch {
            /* fall through to blank */
          }
        }
        if (!cancelled) {
          setModel(createBlankCreatorModel('new'));
          setLoading(false);
        }
        return;
      }

      try {
        let creator = null as Awaited<ReturnType<typeof catalogApi.listCreators>>[number] | null;
        if (isCreatorRole) {
          const { creators } = await catalogApi.ensureCreatorWorkspace();
          creator = creators.find((c) => c.id === id || c.slug === id) || creators[0] || null;
        } else {
          const creators = await catalogApi.listCreators();
          creator = creators.find((c) => c.id === id || c.slug === id) || null;
        }
        if (cancelled) return;
        if (!creator) {
          setLoadError(`Creator "${id}" was not found or you don’t have access.`);
          setModel(createBlankCreatorModel(id as string));
        } else {
          setModel(mapCatalogCreatorToEditor(creator));
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Failed to load creator profile');
          setModel(createBlankCreatorModel(id as string));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew, isCreatorRole]);

  // Reference data for the Partnerships brand-tag picker + Featured guide picker.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [brs, guides] = await Promise.all([
        catalogApi.listBrands().catch(() => [] as CatalogBrand[]),
        catalogApi
          .manageGuides({ status: 'all' })
          .then((r) => r.data || [])
          .catch(() => []),
      ]);
      if (cancelled) return;
      setBrands(brs);
      setOwnGuides(
        guides.map((g) => ({ id: g.id, slug: g.slug, title: g.title || 'Untitled guide', image: g.image })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = useMemo(
    () => !!draft && !!model && JSON.stringify(draft) !== JSON.stringify(model),
    [draft, model],
  );

  const requestEdit = (k: CreatorEditSection) => {
    if (!model) return;
    if (dirty && editingId && editingId !== k) {
      flash('Save or cancel the current section first.');
      return;
    }
    setEditingId(k);
    setDraft({ ...model });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };
  const patchDraft = (p: Partial<CreatorEditorModel>) => setDraft((d) => (d ? { ...d, ...p } : d));

  const snapshotAfterSave = async (saved: CreatorEditorModel, section: string) => {
    const json = JSON.stringify(editorModelToCreatorPayload(saved));
    if (json === lastSnapshotJson.current) return;
    lastSnapshotJson.current = json;
    try {
      await saveVersion(`${section} · ${new Date().toLocaleString()}`, saved);
    } catch {
      /* snapshot history is best-effort; the canonical save already succeeded */
    }
  };

  const saveSection = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      if (isNew || draft.id === 'new') {
        // Staff creating a fresh creator row.
        const newId = `creator-${Date.now()}`;
        const created = await catalogApi.upsertCreator(newId, {
          ...editorModelToCreatorPayload(draft),
          id: newId,
          slug: draft.slug || newId,
        });
        const m = mapCatalogCreatorToEditor(created);
        setModel(m);
        setEditingId(null);
        setDraft(null);
        void snapshotAfterSave(m, SECTION_LABEL[editingId ?? 'identity']);
        navigate(`/admin/creator-studio/${created.id}/edit`, { replace: true });
        flash('Creator profile created (draft)');
        return;
      }
      const saved = await catalogApi.patchCreator(model!.id, editorModelToCreatorSectionPatch(draft));
      const m = mapCatalogCreatorToEditor(saved);
      setModel(m);
      setEditingId(null);
      setDraft(null);
      void snapshotAfterSave(m, SECTION_LABEL[editingId ?? 'identity']);
      flash('Section saved');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const runLifecycle = async (action: 'publish' | 'unpublish' | 'archive') => {
    if (!model || isNew || model.id === 'new') {
      flash('Save the profile first.');
      return;
    }
    setBusy(true);
    try {
      const status = action === 'publish' ? 'live' : action === 'archive' ? 'archived' : 'draft';
      const saved = await catalogApi.setCreatorPublishStatus(model.id, status);
      setModel(mapCatalogCreatorToEditor(saved));
      flash(
        action === 'publish'
          ? 'Creator profile published'
          : action === 'archive'
            ? 'Creator profile archived'
            : 'Creator profile moved to draft',
      );
    } catch (e) {
      flash(e instanceof Error ? e.message : `${action} failed`);
    } finally {
      setBusy(false);
      setShowPublishModal(false);
      setPendingLifecycle(null);
    }
  };

  const showModel = editingId && draft ? draft : model;

  const d = draft;
  function renderEditor(section: CreatorEditSection): React.ReactNode {
    if (!d) return null;
    switch (section) {
      case 'cover':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-4">
            <div>
              <div className={label}>Cover image</div>
              <ImageField
                value={d.coverImage}
                onChange={(coverImage) => patchDraft({ coverImage })}
                onToast={flash}
                aspect="aspect-[16/6]"
                emptyLabel="Upload cover"
              />
              <div className={hint}>Wide banner shown at the top of your public profile.</div>
            </div>
            <div>
              <div className={label}>Avatar</div>
              <ImageField
                value={d.avatar}
                onChange={(avatar) => patchDraft({ avatar })}
                onToast={flash}
                aspect="aspect-square max-w-[140px]"
                roundedFull
                emptyLabel="Upload avatar"
              />
            </div>
          </div>
        );
      case 'identity':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <div className={label}>Name</div>
                <input className={input} value={d.name} placeholder="e.g. Rifat Hasan" onChange={(e) => patchDraft({ name: e.target.value })} />
              </div>
              <div>
                <div className={label}>Handle</div>
                <input className={input} value={d.handle} placeholder="@rifathasan" onChange={(e) => patchDraft({ handle: e.target.value })} />
              </div>
              <div>
                <div className={label}>Title / role</div>
                <input className={input} value={d.title} placeholder="e.g. Senior Tech Reviewer" onChange={(e) => patchDraft({ title: e.target.value })} />
              </div>
              <div>
                <div className={label}>Location</div>
                <input className={input} value={d.location} placeholder="e.g. Dhaka, Bangladesh" onChange={(e) => patchDraft({ location: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <div className={label}>Best for (headline)</div>
                <input className={input} value={d.bestFor} placeholder="e.g. Phones &amp; Laptops" onChange={(e) => patchDraft({ bestFor: e.target.value })} />
              </div>
            </div>
            <p className="text-[10.5px] text-[#9AA0AC] m-0">
              Bio is edited in the Creator Overview section. Verification, Trust Score and going LIVE are managed by
              Choosify — use the Publish button for lifecycle.
            </p>
          </div>
        );
      case 'overview':
        return (
          <div className="space-y-4">
            <div>
              <div className={label}>Background &amp; Bio</div>
              <textarea
                className={textarea}
                rows={5}
                value={d.bio}
                placeholder="A short, first-person intro shown on your public profile — who you are, what you cover, why buyers should trust your picks."
                onChange={(e) => patchDraft({ bio: e.target.value })}
              />
              <div className={hint}>The one canonical bio. It also appears in the profile header.</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className={label}>Areas of expertise</div>
                <ListEditor
                  items={d.bestForTags}
                  onChange={(bestForTags) =>
                    patchDraft({ bestForTags, bestFor: d.bestFor || bestForTags[0] || '' })
                  }
                  placeholder="e.g. Flagship phones"
                  addLabel="Add topic"
                />
              </div>
              <div>
                <div className={label}>Content platforms</div>
                <ListEditor
                  items={d.platforms}
                  onChange={(platforms) => patchDraft({ platforms })}
                  placeholder="e.g. YouTube"
                  addLabel="Add platform"
                />
              </div>
            </div>
            <div className={hint}>
              Bio, expertise and platforms are the Creator Overview shown on your public profile. Expertise also feeds
              the “Why Follow” highlights.
            </div>
          </div>
        );
      case 'social':
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              {(['facebook', 'instagram', 'youtube', 'linkedin', 'tiktok'] as const).map((k) => (
                <div key={k}>
                  <div className={label}>{k}</div>
                  <input
                    className={input}
                    value={d.socialLinks[k] || ''}
                    placeholder={`https://${k}.com/…`}
                    onChange={(e) => patchDraft({ socialLinks: { ...d.socialLinks, [k]: e.target.value } })}
                  />
                </div>
              ))}
            </div>
            <SocialCustomEditor
              items={d.socialLinks.custom ?? []}
              onChange={(custom) => patchDraft({ socialLinks: { ...d.socialLinks, custom } })}
            />
          </div>
        );
      case 'contact':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <div className={label}>Business email</div>
              <input className={input} value={d.email} placeholder="you@example.com" onChange={(e) => patchDraft({ email: e.target.value })} />
            </div>
            <div>
              <div className={label}>Phone</div>
              <input className={input} value={d.phone} placeholder="+8801…" onChange={(e) => patchDraft({ phone: e.target.value })} />
            </div>
            <div>
              <div className={label}>Response time</div>
              <input className={input} value={d.responseTime} placeholder="e.g. Within 24 hours" onChange={(e) => patchDraft({ responseTime: e.target.value })} />
            </div>
            <div>
              <div className={label}>Preferred contact</div>
              <input className={input} value={d.preferredContact} placeholder="e.g. Email" onChange={(e) => patchDraft({ preferredContact: e.target.value })} />
            </div>
          </div>
        );
      case 'partnerships':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className={label}>Brand partners</div>
              <BrandPartnersEditor
                items={d.brandPartners}
                onChange={(brandPartners) => patchDraft({ brandPartners })}
                brands={brands}
                onToast={flash}
              />
            </div>
            <div>
              <div className={label}>Collaboration types</div>
              <ListEditor items={d.collabTypes} onChange={(collabTypes) => patchDraft({ collabTypes })} placeholder="e.g. Sponsored review" addLabel="Add type" />
            </div>
          </div>
        );
      case 'featured':
        return (
          <FeaturedContentEditor
            items={d.featuredContent}
            onChange={(featuredContent) => patchDraft({ featuredContent })}
            ownGuides={ownGuides}
            onToast={flash}
          />
        );
      default:
        return null;
    }
  }

  const bridge: CreatorStudioBridge = {
    editingSection: editingId,
    dirty,
    saving,
    onEdit: requestEdit,
    onCancel: cancelEdit,
    onSave: saveSection,
    renderEditor: (s) => renderEditor(s),
    manageGuidesHref: '/admin/guides',
  };

  if (loading || !model) {
    return (
      <div className="flex flex-col items-center justify-center h-[420px] gap-3 text-[#9AA0AC]">
        <RotateCw className="w-8 h-8 animate-spin text-[#EF3C23]" />
        <span className="text-xs font-mono">Loading Creator Studio…</span>
        {loadError ? <span className="text-[12px] text-[#DC2626] max-w-md text-center">{loadError}</span> : null}
      </div>
    );
  }

  const canPublish = !isNew && model.id !== 'new';
  const publicHref = model.slug || model.id ? `${WEB_ORIGIN}/creators/${model.slug || model.id}` : '';

  return (
    <div className="aws-page w-full bg-[#F0F8FF] min-h-screen overflow-x-clip">
      <header className="sticky top-[var(--cms-topbar-height,64px)] z-[8] flex flex-wrap items-center justify-between gap-3 border-b border-[#E8EDF2] bg-white/95 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate(isCreatorRole ? '/admin/creator-profile' : '/admin/creator-studio')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E8EDF2] text-[#374151]"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="text-[9px] font-extrabold uppercase tracking-widest text-[#EF3C23]">Creator Studio</div>
            <div className="truncate text-[13px] font-extrabold text-[#1A1A2E]">{model.name || 'New Creator'}</div>
          </div>
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase ${
              model.status === 'LIVE'
                ? 'bg-emerald-100 text-emerald-700'
                : model.status === 'ARCHIVED'
                  ? 'bg-[#F3F4F6] text-[#6B7280]'
                  : 'bg-amber-100 text-amber-700'
            }`}
          >
            {model.status}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-[#E8EDF2] overflow-hidden">
            <button
              type="button"
              onClick={() => {
                if (editingId) cancelEdit();
                setEditMode(false);
              }}
              className={`px-3 py-1.5 text-[11px] font-bold ${!editMode ? 'bg-[#1A1A2E] text-white' : 'bg-white text-[#374151]'}`}
            >
              View
            </button>
            <button
              type="button"
              onClick={() => setEditMode(true)}
              className={`px-3 py-1.5 text-[11px] font-bold ${editMode ? 'bg-[#EF3C23] text-white' : 'bg-white text-[#374151]'}`}
            >
              Edit
            </button>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowVersions((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8EDF2] px-3 py-1.5 text-[11px] font-bold bg-white"
            >
              <History className="h-4 w-4 text-[#EF3C23]" /> Snapshots ({versions?.length || 0})
            </button>
            {showVersions ? (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-[#E8EDF2] rounded-xl shadow-xl p-3 z-40">
                <div className="text-[10px] font-extrabold uppercase text-[#EF3C23] border-b border-slate-100 pb-2 mb-2">History</div>
                {(versions || []).length === 0 ? (
                  <p className="text-[11px] text-slate-500 m-0">No snapshots yet.</p>
                ) : (
                  <ul className="m-0 p-0 list-none space-y-1 max-h-48 overflow-y-auto">
                    {(versions || []).slice(0, 10).map((v) => (
                      <li key={v.id} className="text-[11px] text-slate-700 py-1 border-b border-slate-50">
                        {v.label || v.createdAt}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>

          {publicHref && model.status === 'LIVE' ? (
            <a
              href={publicHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-[#E8EDF2] px-3 py-1.5 text-[11px] font-bold text-[#374151]"
            >
              View public profile <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}

          {canPublish && model.status !== 'LIVE' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setPendingLifecycle('publish');
                setShowPublishModal(true);
              }}
              className="rounded-lg bg-[#EF3C23] px-3.5 py-2 text-[11px] font-extrabold text-white disabled:opacity-60"
            >
              Publish
            </button>
          ) : null}
          {canPublish && model.status === 'LIVE' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void runLifecycle('unpublish')}
              className="rounded-lg border border-[#E8EDF2] px-3.5 py-2 text-[11px] font-extrabold bg-white disabled:opacity-60"
            >
              Unpublish
            </button>
          ) : null}
          {canPublish && model.status !== 'ARCHIVED' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void runLifecycle('archive')}
              className="rounded-lg border border-[#E8EDF2] px-3.5 py-2 text-[11px] font-extrabold bg-white disabled:opacity-60"
            >
              Archive
            </button>
          ) : null}
          <span className="hidden lg:inline text-[10px] text-[#9AA0AC]">
            {editMode ? 'Each section saves on its own' : 'Read-only preview — click Edit to make changes'}
          </span>
        </div>
      </header>

      {loadError ? (
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8 pt-4">
          <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-[12px] text-[#B45309]">
            {loadError}
          </div>
        </div>
      ) : null}

      <CreatorProfilePresentation model={showModel} mode={editMode ? 'studio' : 'view'} studio={bridge} />

      {showPublishModal ? (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-[420px] w-full shadow-2xl">
            <h3 className="text-[16px] font-extrabold m-0 mb-2">Publish this creator profile?</h3>
            <p className="text-[12px] text-[#4B5563] m-0 mb-5">
              This makes your profile publicly visible on Choosify. Save any in-progress section first.
              {isCreatorRole ? ' If Marketplace Access is still pending, going live may be held until Choosify enables it.' : ''}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowPublishModal(false);
                  setPendingLifecycle(null);
                }}
                className="flex-1 py-2.5 rounded-xl border border-[#E8EDF2] text-[12px] font-bold bg-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runLifecycle(pendingLifecycle ?? 'publish')}
                className="flex-1 py-2.5 rounded-xl bg-[#EF3C23] text-white text-[12px] font-extrabold disabled:opacity-60"
              >
                {busy ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-5 right-5 z-[70] rounded-xl bg-[#1A1A2E] px-4 py-3 text-[12px] font-semibold text-white shadow-2xl">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
