import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, Eye, Globe, ImagePlus, Loader2, MapPin, Pencil, Plus, Trash2, X } from 'lucide-react';
import { catalogApi } from '../../../services/catalogApi';
import { useAuth } from '../../../contexts/AuthContext';
import {
  operationsApi,
  type CommunityDuplicate,
  type CommunityProfileCopy,
  type CommunityProfileInput,
  type OpsLead,
} from '../../../services/operationsApi';
import type { CatalogBrand, CatalogCategory, CatalogCreator } from '../../../types/catalog';
import { getPublishedStorefrontUrl } from '../../../lib/storefrontUrls';
import { uploadBrandImage, uploadCreatorImage } from '../../../services/mediaUpload';
import { TagPillInput } from '../ListInputs';

/**
 * Community profiles — public-information discovery profiles staff create for
 * real brands / creators that have not joined Choosify. They have no owner, no
 * account and no Marketplace Access; the real owner can claim them from the
 * storefront. Columns show only real state (owner / open claim / provenance).
 */

type Row = {
  id: string;
  name: string;
  slug: string;
  category: string;
  createdAt: string;
  state: string;
  stateTone: string;
  /** Staff manage the profile only while it has no owner; delete also needs no open claim. */
  owned: boolean;
  claimPending: boolean;
  profile: CommunityProfileFields;
};

/** The fields staff fill in — the same shape for create, edit and the View card. */
type CommunityProfileFields = {
  name: string;
  categoryId: string;
  category: string;
  description: string;
  logo: string;
  coverImage: string;
  website: string;
  location: string;
  socials: Record<string, string>;
  /** "Best for #tags" (brand overview.tags / creator bestForTags). */
  tags: string[];
  /** Brand price range text (overview.priceRange); empty for creators. */
  priceRange: string;
};

const STATE_LABEL: Record<string, [string, string]> = {
  community: ['Unclaimed', 'bg-slate-500/10 text-slate-600'],
  claim_pending: ['Claim pending', 'bg-amber-500/10 text-amber-600'],
  owned_verified: ['Claimed · verified owner', 'bg-emerald-500/10 text-emerald-600'],
  owned: ['Claimed', 'bg-emerald-500/10 text-emerald-600'],
  unavailable: ['Unavailable', 'bg-red-500/10 text-red-600'],
};
const SOCIALS = ['facebook', 'instagram', 'youtube', 'tiktok', 'linkedin'] as const;

function profileFieldsOf(entityType: 'brand' | 'creator', r: CatalogBrand | CatalogCreator): CommunityProfileFields {
  const links = (r.socialLinks || {}) as Record<string, unknown>;
  const socials = Object.fromEntries(SOCIALS.map((k) => [k, String(links[k] || '')]).filter(([, v]) => v));
  if (entityType === 'brand') {
    const b = r as CatalogBrand;
    return {
      name: b.name,
      categoryId: String(b.categoryId || ''),
      category: String(b.category || ''),
      description: String(b.description || ''),
      logo: String(b.logo || ''),
      coverImage: String(b.coverImage || ''),
      website: String(b.website || ''),
      location: String((b.overview as { address?: string } | undefined)?.address || ''),
      socials,
      tags: Array.isArray(b.overview?.tags) ? b.overview!.tags!.map(String) : [],
      priceRange: String(b.overview?.priceRange || ''),
    };
  }
  const c = r as CatalogCreator;
  return {
    name: c.name,
    categoryId: '',
    category: String((c as { category?: string }).category || ''),
    description: String(c.bio || ''),
    logo: String(c.avatar || ''),
    coverImage: String(c.coverImage || ''),
    website: '',
    location: String(c.location || ''),
    socials,
    tags: Array.isArray(c.bestForTags) ? c.bestForTags.map(String) : [],
    priceRange: '',
  };
}
const input = 'w-full bg-white border border-app-border rounded-lg px-3 py-2 text-xs outline-none focus:border-app-accent';
const label = 'block text-[9.5px] font-black uppercase tracking-wider text-app-text-secondary mb-1';

export function CommunityProfilesPanel({ entityType }: { entityType: 'brand' | 'creator' }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [viewing, setViewing] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const { profile } = useAuth();
  // Deleting is final — Admins and Super Admins only (the server enforces the same).
  const canDelete = ['super_admin', 'admin'].includes(String(profile?.role || ''));
  const [notice, setNotice] = useState<string | null>(null);
  const publicBase = `${getPublishedStorefrontUrl()}/${entityType === 'brand' ? 'brands' : 'creators'}`;

  const load = useCallback(async () => {
    setError(null);
    try {
      const [list, cats] = await Promise.all([
        entityType === 'brand' ? catalogApi.listBrands() : catalogApi.listCreators(),
        entityType === 'brand' ? catalogApi.listCategories() : Promise.resolve([] as CatalogCategory[]),
      ]);
      const community = (list as Array<CatalogBrand | CatalogCreator>).filter((r) => r.origin === 'community');
      setRows(
        community
          .map((r) => {
            const owner = entityType === 'brand' ? (r as CatalogBrand).sellerId : (r as CatalogCreator).userId;
            const state = r.ownership?.state || (owner ? 'owned' : 'community');
            const [stateLabel, tone] = STATE_LABEL[state] || STATE_LABEL.community;
            const profile = profileFieldsOf(entityType, r);
            return {
              id: r.id,
              name: r.name,
              slug: r.slug,
              category: String((r as { category?: string }).category || '—'),
              createdAt: String(r.createdAt || ''),
              state: stateLabel,
              stateTone: tone,
              owned: Boolean(owner),
              claimPending: state === 'claim_pending',
              profile,
            };
          })
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
      setCategories(cats.filter((c) => !c.parentId && c.enabled !== false));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load community profiles.');
    } finally {
      setLoading(false);
    }
  }, [entityType]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4" data-testid="community-profiles-panel">
      <div className="aws-page-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black">Community {entityType === 'brand' ? 'brand' : 'creator'} profiles</div>
          <div className="text-[11px] text-app-text-secondary">
            Discovery profiles built from public information. No owner, account or Marketplace Access until a verified claim.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 bg-app-accent text-white rounded-lg px-3.5 py-2 text-[11px] font-black shrink-0"
          data-testid="community-create-open"
        >
          <Plus className="w-3.5 h-3.5" /> Create community {entityType === 'brand' ? 'brand' : 'creator'}
        </button>
      </div>

      {notice && (
        <div className="aws-page-card p-3 text-[11.5px] font-bold text-emerald-600 flex items-center justify-between gap-2" role="status">
          <span className="break-all">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="aws-page-card overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-app-text-secondary" />
          </div>
        ) : error ? (
          <p className="p-6 text-xs font-bold text-red-500">{error}</p>
        ) : rows.length === 0 ? (
          <p className="p-10 text-center text-xs text-app-text-secondary">No community profiles yet.</p>
        ) : (
          <div className="divide-y divide-app-border">
            {rows.map((r) => (
              <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3" data-testid="community-profile-row">
                <div
                  className={`h-11 w-11 shrink-0 overflow-hidden border border-app-border bg-slate-100 ${entityType === 'creator' ? 'rounded-full' : 'rounded-lg'}`}
                  data-testid="community-row-photo"
                >
                  {r.profile.logo ? (
                    <img src={r.profile.logo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[11px] font-black text-slate-500">{r.name.slice(0, 2).toUpperCase()}</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold truncate">{r.name}</div>
                  <div className="text-[10.5px] text-app-text-secondary">
                    {entityType === 'brand' ? `${r.category} · ` : ''}/{r.slug} · created {r.createdAt.slice(0, 10) || '—'}
                  </div>
                </div>
                <span className={`text-[9px] font-black uppercase px-2 py-1 rounded shrink-0 w-max ${r.stateTone}`}>{r.state}</span>
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewing(r)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-app-border text-[10px] font-bold"
                    data-testid="community-view"
                  >
                    <Eye className="w-3 h-3" /> View
                  </button>
                  <button
                    type="button"
                    disabled={r.owned}
                    title={r.owned ? 'Claimed — the owner manages this profile now' : undefined}
                    onClick={() => setEditing(r)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-app-border text-[10px] font-bold disabled:opacity-40"
                    data-testid="community-edit"
                  >
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                  {canDelete && (
                  <button
                    type="button"
                    disabled={r.owned || r.claimPending}
                    title={r.owned ? 'Claimed — the owner manages this profile now' : r.claimPending ? 'Decide or close the open claim first' : undefined}
                    onClick={() => setDeleting(r)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 text-[10px] font-bold disabled:opacity-40"
                    data-testid="community-delete"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                  )}
                  <a
                    href={`${publicBase}/${r.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-app-border text-[10px] font-bold"
                  >
                    Public page <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CommunityCopyEditor entityType={entityType} />

      {(creating || editing) && (
        <CommunityProfileDialog
          entityType={entityType}
          categories={categories}
          editing={editing ? { id: editing.id, ...editing.profile } : null}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={(name, slug) => {
            setNotice(editing ? `Community profile “${name}” updated.` : `Community profile “${name}” created — ${publicBase}/${slug}`);
            setCreating(false);
            setEditing(null);
            void load();
          }}
        />
      )}
      {viewing && (
        <CommunityProfileViewCard
          entityType={entityType}
          row={viewing}
          publicUrl={`${publicBase}/${viewing.slug}`}
          onClose={() => setViewing(null)}
          onEdit={
            viewing.owned
              ? undefined
              : () => {
                  setEditing(viewing);
                  setViewing(null);
                }
          }
        />
      )}
      {deleting && (
        <DeleteCommunityProfileDialog
          entityType={entityType}
          row={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={(name, warning) => {
            setDeleting(null);
            setNotice(`Community profile “${name}” deleted.${warning ? ` ${warning}` : ''}`);
            void load();
          }}
        />
      )}
    </div>
  );
}

function CommunityProfileDialog({
  entityType,
  categories,
  editing,
  prefill,
  title,
  createProfile,
  onClose,
  onSaved,
}: {
  entityType: 'brand' | 'creator';
  categories: CatalogCategory[];
  /** Present when editing an existing community profile. */
  editing: (CommunityProfileFields & { id: string }) | null;
  /** Starting values for a new profile (e.g. from a brand suggestion). */
  prefill?: CommunityProfileFields | null;
  title?: string;
  /** Replaces the default create call (e.g. approving a brand suggestion). */
  createProfile?: (input: Omit<CommunityProfileInput, 'entityType'>) => Promise<{ name: string; slug: string }>;
  onClose: () => void;
  onSaved: (name: string, slug: string) => void;
}) {
  const start = editing ?? prefill ?? null;
  const [name, setName] = useState(start?.name || '');
  const [categoryId, setCategoryId] = useState(
    start ? start.categoryId || categories.find((c) => c.name === start.category)?.id || '' : '',
  );
  const [description, setDescription] = useState(start?.description || '');
  const [logo, setLogo] = useState(start?.logo || '');
  const [coverImage, setCoverImage] = useState(start?.coverImage || '');
  const [website, setWebsite] = useState(start?.website || '');
  const [location, setLocation] = useState(start?.location || '');
  const [socials, setSocials] = useState<Record<string, string>>(start?.socials || {});
  const [tags, setTags] = useState<string[]>(start?.tags || []);
  const [priceRange, setPriceRange] = useState(start?.priceRange || '');
  const [uploading, setUploading] = useState(0);
  const [duplicates, setDuplicates] = useState<CommunityDuplicate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isBrand = entityType === 'brand';
  const cleanSocials = useMemo(
    () => Object.fromEntries(Object.entries(socials).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()])),
    [socials],
  );
  // Any edit invalidates a previous duplicate check.
  useEffect(() => setDuplicates(null), [name, website, cleanSocials]);
  const trackUpload = (busyNow: boolean) => setUploading((n) => Math.max(0, n + (busyNow ? 1 : -1)));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        const saved = await operationsApi.updateCommunityProfile(editing.id, {
          entityType,
          name: name.trim(),
          categoryId: categoryId || undefined,
          description: description.trim(),
          logo: logo.trim(),
          coverImage: coverImage.trim(),
          website: website.trim(),
          location: location.trim(),
          socialLinks: cleanSocials,
          tags,
          ...(isBrand ? { priceRange: priceRange.trim() } : {}),
        });
        onSaved(saved.name, saved.slug);
        return;
      }
      if (duplicates === null) {
        const found = await operationsApi.findCommunityDuplicates({ entityType, name: name.trim(), website: website.trim(), socialLinks: cleanSocials });
        if (found.length) {
          setDuplicates(found);
          return;
        }
      }
      const input = {
        name: name.trim(),
        categoryId: categoryId || undefined,
        description: description.trim(),
        logo: logo.trim(),
        coverImage: coverImage.trim(),
        website: website.trim(),
        location: location.trim(),
        socialLinks: cleanSocials,
        tags,
        ...(isBrand ? { priceRange: priceRange.trim() } : {}),
        acknowledgeDuplicates: Boolean(duplicates?.length),
      };
      const created = createProfile ? await createProfile(input) : await operationsApi.createCommunityProfile({ entityType, ...input });
      onSaved(created.name, created.slug);
    } catch (e) {
      setError(e instanceof Error ? e.message : editing ? 'Could not save the profile.' : 'Could not create the profile.');
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = name.trim().length >= 2 && (!isBrand || categoryId) && !busy && uploading === 0;
  const uploadImage = isBrand ? uploadBrandImage : uploadCreatorImage;
  // A click outside never closes the form; × / Cancel ask first when something was entered.
  const snapshot = JSON.stringify([name, categoryId, description, logo, coverImage, website, location, cleanSocials, tags, priceRange]);
  const [initialSnapshot] = useState(snapshot);
  const requestClose = () => {
    if (snapshot !== initialSnapshot && !window.confirm('Discard the information you entered? It will not be saved.')) return;
    onClose();
  };
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${editing ? 'Edit' : 'Create'} community ${entityType}`}
      className="fixed inset-0 z-[1000] bg-slate-900/50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-xl w-full max-w-[560px] shadow-xl" onClick={(e) => e.stopPropagation()} data-testid="community-create-dialog">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-app-border">
          <div className="text-sm font-black">
            {title ?? (editing ? `Edit ${editing.name}` : `Create community ${isBrand ? 'brand' : 'creator'} profile`)}
          </div>
          <button type="button" onClick={requestClose} aria-label="Close" data-testid="community-create-close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          <p className="text-[11px] text-app-text-secondary">
            Use only publicly available information. The profile is created without an owner, account, CF-ID or Marketplace Access, and
            shows the community-profile disclaimer until a verified claim.
          </p>
          <div>
            <label className={label} htmlFor="cp-name">Name *</label>
            <input id="cp-name" className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </div>
          {isBrand && (
            <div>
              <label className={label} htmlFor="cp-cat">Category *</label>
              <select id="cp-cat" className={input} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Choose a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={label} htmlFor="cp-desc">Short description</label>
            <textarea id="cp-desc" className={input} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={600} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3">
            <ImageUploadField
              id="cp-logo"
              title={isBrand ? 'Logo' : 'Profile photo'}
              value={logo}
              wide={false}
              upload={uploadImage}
              onChange={setLogo}
              onBusy={trackUpload}
            />
            <ImageUploadField
              id="cp-cover"
              title="Cover image"
              value={coverImage}
              wide
              upload={uploadImage}
              onChange={setCoverImage}
              onBusy={trackUpload}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {isBrand && (
              <div>
                <label className={label} htmlFor="cp-web">Official website</label>
                <input id="cp-web" className={input} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
              </div>
            )}
            {isBrand && (
              <div>
                <label className={label} htmlFor="cp-price">Price range</label>
                <input
                  id="cp-price"
                  className={input}
                  value={priceRange}
                  onChange={(e) => setPriceRange(e.target.value)}
                  maxLength={60}
                  placeholder="e.g. ৳1,000 – ৳20,000"
                />
              </div>
            )}
            <div>
              <label className={label} htmlFor="cp-loc">Location</label>
              <input id="cp-loc" className={input} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Dhaka, Bangladesh" />
            </div>
          </div>
          <div data-testid="cp-tags">
            <div className={label}>Best for #tags</div>
            <div className="mb-1 text-[10.5px] text-app-text-secondary">
              What the brand is best known for — shown as “Best For” on its storefront card (e.g. Men’s Shirts, Sunglasses). Separate from the category.
            </div>
            <TagPillInput
              className="w-full bg-white border border-app-border rounded-lg text-xs"
              values={tags}
              onChange={(next) => setTags(next.slice(0, 15))}
              prefix="#"
              stripHash
              maxLength={40}
              placeholder="Type a tag and press Enter — e.g. Art, Painting"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SOCIALS.map((k) => (
              <div key={k}>
                <label className={label} htmlFor={`cp-${k}`}>{k}</label>
                <input
                  id={`cp-${k}`}
                  className={input}
                  value={socials[k] || ''}
                  onChange={(e) => setSocials((s) => ({ ...s, [k]: e.target.value }))}
                  placeholder={`https://${k === 'youtube' ? 'youtube.com/@' : `${k}.com/`}…`}
                />
              </div>
            ))}
          </div>
          {!editing && duplicates && duplicates.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-900" data-testid="community-duplicates">
              <div className="flex items-center gap-1.5 font-black mb-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Possible duplicates — check before creating
              </div>
              <ul className="space-y-1">
                {duplicates.map((d) => (
                  <li key={d.id}>
                    <b>{d.name}</b> (/{d.slug}) · matched on {d.matchedOn.join(', ')}
                    {d.owned ? ' · already owned' : ' · community'}
                  </li>
                ))}
              </ul>
              <div className="mt-1.5">Nothing is merged automatically. Create anyway only if this is a different {entityType}.</div>
            </div>
          )}
          {error && <div className="text-[11.5px] font-bold text-red-600" role="alert">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-app-border">
          <button type="button" onClick={requestClose} className="px-3.5 py-2 rounded-lg border border-app-border text-[11px] font-bold">
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void submit()}
            className="px-3.5 py-2 rounded-lg bg-app-accent text-white text-[11px] font-black disabled:opacity-50"
            data-testid="community-create-submit"
          >
            {busy ? 'Working…' : uploading ? 'Uploading…' : editing ? 'Save changes' : duplicates?.length ? 'Create anyway' : 'Create profile'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Logo / cover picker: uploads the chosen image file (no pasted links) and previews it. */
function ImageUploadField({
  id,
  title,
  value,
  wide,
  upload,
  onChange,
  onBusy,
}: {
  id: string;
  title: string;
  value: string;
  wide: boolean;
  upload: (file: File) => Promise<string>;
  onChange: (url: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = async (file: File) => {
    setBusy(true);
    onBusy(true);
    setError(null);
    try {
      onChange(await upload(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
      onBusy(false);
    }
  };
  return (
    <div data-testid={`${id}-field`}>
      <div className={label}>{title}</div>
      <label
        htmlFor={id}
        className={`relative flex items-center justify-center overflow-hidden rounded-lg border border-dashed border-app-border bg-slate-50 cursor-pointer hover:border-app-accent ${
          wide ? 'h-[110px] w-full' : 'h-[110px] w-[110px]'
        }`}
      >
        {value ? (
          <img src={value} alt="" className="h-full w-full object-cover" data-testid={`${id}-preview`} />
        ) : (
          <span className="flex flex-col items-center gap-1 text-[10px] font-bold text-app-text-secondary">
            <ImagePlus className="w-4 h-4" /> Upload image
          </span>
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 className="w-4 h-4 animate-spin" />
          </span>
        )}
      </label>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void pick(file);
        }}
      />
      <div className="mt-1 flex gap-2 text-[10px] font-bold">
        <label htmlFor={id} className="cursor-pointer text-app-accent">
          {value ? 'Replace' : 'Choose file'}
        </label>
        {value && !busy && (
          <button type="button" className="text-red-600" onClick={() => onChange('')}>
            Remove
          </button>
        )}
      </div>
      {error && <div className="mt-1 text-[10.5px] font-bold text-red-600">{error}</div>}
    </div>
  );
}

/**
 * Read-only preview laid out like the public profile, with an unmistakable
 * "Community profile" banner so staff never confuse it with an owner-managed one.
 */
function CommunityProfileViewCard({
  entityType,
  row,
  publicUrl,
  onClose,
  onEdit,
  banner,
  extra,
  actions,
}: {
  entityType: 'brand' | 'creator';
  row: Row;
  /** Omitted when the profile isn't public yet (a brand suggestion). */
  publicUrl?: string;
  onClose: () => void;
  onEdit?: () => void;
  banner?: { title: string; text: string };
  /** Extra section under the profile details (e.g. who suggested it). */
  extra?: React.ReactNode;
  /** Extra footer buttons. */
  actions?: React.ReactNode;
}) {
  const p = row.profile;
  const links = Object.entries(p.socials).filter(([, v]) => v);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Community profile ${row.name}`}
      className="fixed inset-0 z-[1000] bg-slate-900/50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div className="bg-white rounded-xl w-full max-w-[600px] shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()} data-testid="community-view-card">
        <div className="flex items-start gap-2 bg-amber-50 border-b border-amber-200 px-5 py-3 text-[11px] text-amber-900" data-testid="community-view-banner">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-black uppercase tracking-wider text-[10px]">{banner?.title ?? `Community profile · ${row.state}`}</div>
            <div>
              {banner?.text ??
                `Created by Choosify staff from public information. ${row.owned ? 'It has since been claimed by its owner.' : 'It has no owner, account, CF-ID or Marketplace Access.'}`}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="relative h-[150px] bg-gradient-to-r from-slate-200 to-slate-100">
          {p.coverImage && <img src={p.coverImage} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="px-5 pb-5">
          <div className="relative z-10 -mt-10 flex items-end gap-3">
            <div className={`h-20 w-20 shrink-0 overflow-hidden border-4 border-white bg-slate-100 shadow ${entityType === 'creator' ? 'rounded-full' : 'rounded-xl'}`}>
              {p.logo ? (
                <img src={p.logo} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-lg font-black text-slate-500">{row.name.slice(0, 2).toUpperCase()}</div>
              )}
            </div>
            <div className="min-w-0 pb-1">
              <div className="text-base font-black truncate">{row.name}</div>
              <div className="text-[11px] text-app-text-secondary">
                {[p.category, row.slug ? `/${row.slug}` : ''].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-3 text-[12px]">
            <div>
              <div className={label}>{entityType === 'brand' ? 'Description' : 'Bio'}</div>
              <p className="whitespace-pre-line">{p.description || <span className="text-app-text-secondary">Not added</span>}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {entityType === 'brand' && (
                <div>
                  <div className={label}>Official website</div>
                  {p.website ? (
                    <a href={p.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-app-accent break-all">
                      <Globe className="w-3 h-3 shrink-0" /> {p.website}
                    </a>
                  ) : (
                    <span className="text-app-text-secondary">Not added</span>
                  )}
                </div>
              )}
              {entityType === 'brand' && (
                <div>
                  <div className={label}>Price range</div>
                  {p.priceRange ? <span>{p.priceRange}</span> : <span className="text-app-text-secondary">Not added</span>}
                </div>
              )}
              <div>
                <div className={label}>Location</div>
                {p.location ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {p.location}
                  </span>
                ) : (
                  <span className="text-app-text-secondary">Not added</span>
                )}
              </div>
            </div>
            <div data-testid="community-view-tags">
              <div className={label}>Best for #tags</div>
              {p.tags.length ? (
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {p.tags.map((t) => (
                    <span key={t} className="text-[11px] font-black uppercase tracking-wide text-[#8A00C4]">
                      #{t}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-app-text-secondary">Not added</span>
              )}
            </div>
            <div>
              <div className={label}>Social links</div>
              {links.length ? (
                <ul className="space-y-1">
                  {links.map(([k, v]) => (
                    <li key={k} className="break-all">
                      <span className="font-bold capitalize">{k}:</span>{' '}
                      <a href={v} target="_blank" rel="noreferrer" className="text-app-accent">
                        {v}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-app-text-secondary">Not added</span>
              )}
            </div>
            {extra}
            <div className="text-[10.5px] text-app-text-secondary">{banner ? 'Submitted' : 'Created'} {row.createdAt.slice(0, 10) || '—'}</div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-app-border">
          {publicUrl && (
            <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg border border-app-border text-[11px] font-bold">
              Public page <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {actions}
          {onEdit && (
            <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg bg-app-accent text-white text-[11px] font-black">
              <Pencil className="w-3 h-3" /> Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DeleteCommunityProfileDialog({
  entityType,
  row,
  onClose,
  onDeleted,
}: {
  entityType: 'brand' | 'creator';
  row: Row;
  onClose: () => void;
  onDeleted: (name: string, warning?: string) => void;
}) {
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await operationsApi.deleteCommunityProfile(entityType, row.id);
      onDeleted(result.data?.name || row.name, result.warning);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the profile.');
      setBusy(false);
    }
  };
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Delete ${row.name}`}
      className="fixed inset-0 z-[1000] bg-slate-900/50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-xl w-full max-w-[440px] shadow-xl" onClick={(e) => e.stopPropagation()} data-testid="community-delete-dialog">
        <div className="px-5 py-4 space-y-3">
          <div className="text-sm font-black">Delete community profile?</div>
          <p className="text-[11.5px] text-app-text-secondary">
            “{row.name}” and its public page /{row.slug} will be removed. Its public handle is retired and will not be reused. This cannot be
            undone.
          </p>
          <div>
            <label className={label} htmlFor="cp-del-confirm">Type the profile name to confirm</label>
            <input id="cp-del-confirm" className={input} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          </div>
          {error && <div className="text-[11.5px] font-bold text-red-600" role="alert">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-app-border">
          <button type="button" onClick={onClose} className="px-3.5 py-2 rounded-lg border border-app-border text-[11px] font-bold">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || confirmText.trim() !== row.name.trim()}
            onClick={() => void run()}
            className="px-3.5 py-2 rounded-lg bg-red-600 text-white text-[11px] font-black disabled:opacity-50"
            data-testid="community-delete-confirm"
          >
            {busy ? 'Deleting…' : 'Delete profile'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Staff-editable public copy: the disclaimer on community profiles and the claim review notice. */
function CommunityCopyEditor({ entityType }: { entityType: 'brand' | 'creator' }) {
  const [copy, setCopy] = useState<CommunityProfileCopy | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    operationsApi.getCommunityProfileCopy().then(setCopy).catch(() => setCopy(null));
  }, []);
  if (!copy) return null;
  const field = entityType === 'brand' ? 'brandDisclaimer' : 'creatorDisclaimer';
  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      setCopy({ ...copy, ...(await operationsApi.updateCommunityProfileCopy(copy)), isDefault: false });
      setMsg({ ok: true, text: 'Saved. The storefront shows the new text.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save.' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="aws-page-card p-4 space-y-3" data-testid="community-copy-editor">
      <button type="button" className="text-xs font-black" onClick={() => setOpen((v) => !v)}>
        {open ? '▾' : '▸'} Public disclaimer & claim review notice {copy.isDefault ? '(default text)' : ''}
      </button>
      {open && (
        <>
          <div>
            <label className={label} htmlFor="cc-disc">{entityType === 'brand' ? 'Brand' : 'Creator'} community-profile disclaimer</label>
            <textarea
              id="cc-disc"
              className={input}
              rows={4}
              maxLength={1200}
              value={copy[field]}
              onChange={(e) => setCopy({ ...copy, [field]: e.target.value })}
            />
          </div>
          <div>
            <label className={label} htmlFor="cc-notice">Claim review notice (shown to claimants)</label>
            <textarea
              id="cc-notice"
              className={input}
              rows={3}
              maxLength={1200}
              value={copy.claimReviewNotice}
              onChange={(e) => setCopy({ ...copy, claimReviewNotice: e.target.value })}
            />
          </div>
          <p className="text-[10.5px] text-app-text-secondary">
            Neutral clarification, not legal advice — have the final wording reviewed before relying on it.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="px-3.5 py-2 rounded-lg bg-app-accent text-white text-[11px] font-black disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save text'}
            </button>
            {msg && <span className={`text-[11px] font-bold ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</span>}
          </div>
        </>
      )}
    </div>
  );
}

// ── Suggested Brands (storefront "Suggest a Brand") ─────────────────────────

type SuggestionView = 'pending' | 'approved' | 'rejected';

const suggestionOf = (l: OpsLead): SuggestionView =>
  l.suggestionDecision?.decision === 'approved' ? 'approved' : l.suggestionDecision?.decision === 'rejected' || l.status === 'rejected' || l.status === 'spam' ? 'rejected' : 'pending';

function suggestionFields(l: OpsLead): CommunityProfileFields {
  const s = l.suggestion || {};
  return {
    name: l.brandName,
    categoryId: l.categoryId || '',
    category: l.categoryName || '',
    description: s.description || '',
    logo: s.logo || '',
    coverImage: s.coverImage || '',
    website: l.website || '',
    location: s.location || l.country || '',
    socials: { ...(s.socialLinks || {}) },
    tags: s.tags || [],
    priceRange: s.priceRange || '',
  };
}

/** Open brand suggestions waiting for review (for the tab count). */
export function countPendingBrandSuggestions(leads: OpsLead[]): number {
  return leads.filter((l) => l.inquiryType === 'suggest_brand' && suggestionOf(l) === 'pending' && l.status !== 'closed').length;
}

/**
 * Brand suggestions from the storefront. Review shows the same profile card
 * staff use for community profiles; Approve opens the community profile form
 * pre-filled (staff can correct anything) and creates the community brand
 * profile; Reject needs a short reason.
 */
export function SuggestedBrandsPanel({ onCountChange }: { onCountChange?: (n: number) => void }) {
  const [leads, setLeads] = useState<OpsLead[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<SuggestionView>('pending');
  const [viewing, setViewing] = useState<OpsLead | null>(null);
  const [approving, setApproving] = useState<OpsLead | null>(null);
  const [rejecting, setRejecting] = useState<OpsLead | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const publicBase = `${getPublishedStorefrontUrl()}/brands`;

  const load = useCallback(async () => {
    setError(null);
    try {
      const [all, cats] = await Promise.all([operationsApi.listLeads(), catalogApi.listCategories()]);
      const rows = all.filter((l) => l.inquiryType === 'suggest_brand');
      setLeads(rows);
      setCategories(cats.filter((c) => !c.parentId && c.enabled !== false));
      onCountChange?.(countPendingBrandSuggestions(rows));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load brand suggestions.');
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);
  useEffect(() => {
    void load();
  }, [load]);

  const visible = leads.filter((l) => suggestionOf(l) === view && (view !== 'pending' || l.status !== 'closed'));
  const counts = {
    pending: leads.filter((l) => suggestionOf(l) === 'pending' && l.status !== 'closed').length,
    approved: leads.filter((l) => suggestionOf(l) === 'approved').length,
    rejected: leads.filter((l) => suggestionOf(l) === 'rejected').length,
  };
  const rowOf = (l: OpsLead): Row => ({
    id: l.id,
    name: l.brandName,
    slug: l.suggestionDecision?.communityProfileSlug || '',
    category: l.categoryName || '—',
    createdAt: l.createdAt,
    state: suggestionOf(l),
    stateTone: '',
    owned: false,
    claimPending: false,
    profile: suggestionFields(l),
  });

  return (
    <div className="space-y-4" data-testid="suggested-brands-panel">
      <div className="aws-page-card p-4">
        <div className="text-xs font-black">Suggested brands</div>
        <div className="text-[11px] text-app-text-secondary">
          Brands shoppers suggested on the storefront. Approving creates a community brand profile from the details below (you can correct them first).
        </div>
        <div className="mt-3 flex gap-1.5">
          {(['pending', 'approved', 'rejected'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setView(k)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${view === k ? 'bg-app-accent text-white' : 'text-app-text-secondary hover:bg-[#F1F3F5]'}`}
              data-testid={`suggested-view-${k}`}
            >
              {k === 'pending' ? 'To review' : k} ({counts[k]})
            </button>
          ))}
        </div>
      </div>

      {notice && (
        <div className="aws-page-card p-3 text-[11.5px] font-bold text-emerald-600 flex items-center justify-between gap-2" role="status">
          <span className="break-all">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="aws-page-card overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-app-text-secondary" />
          </div>
        ) : error ? (
          <p className="p-6 text-xs font-bold text-red-500">{error}</p>
        ) : visible.length === 0 ? (
          <p className="p-10 text-center text-xs text-app-text-secondary">
            {view === 'pending' ? 'No brand suggestions to review.' : `No ${view} suggestions.`}
          </p>
        ) : (
          <div className="divide-y divide-app-border">
            {visible.map((l) => (
              <div key={l.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3" data-testid="suggested-brand-row">
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-app-border bg-slate-100">
                  {l.suggestion?.logo ? (
                    <img src={l.suggestion.logo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[11px] font-black text-slate-500">{l.brandName.slice(0, 2).toUpperCase()}</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold truncate">
                    {l.brandName}
                    {l.duplicateSignals?.length ? (
                      <span className="ml-2 rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-700">Possible duplicate</span>
                    ) : null}
                  </div>
                  <div className="text-[10.5px] text-app-text-secondary truncate">
                    {[l.categoryName, `by ${l.contactPerson || l.email}`, l.createdAt.slice(0, 10)].filter(Boolean).join(' · ')}
                  </div>
                  {l.suggestionDecision?.decision === 'rejected' && l.suggestionDecision.note && (
                    <div className="text-[10.5px] text-red-600 truncate">Rejected: {l.suggestionDecision.note}</div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewing(l)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-app-border text-[10px] font-bold"
                    data-testid="suggested-view"
                  >
                    <Eye className="w-3 h-3" /> View
                  </button>
                  {view === 'pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setApproving(l)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-app-accent text-white text-[10px] font-black"
                        data-testid="suggested-approve"
                      >
                        <Plus className="w-3 h-3" /> Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejecting(l)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 text-[10px] font-bold"
                        data-testid="suggested-reject"
                      >
                        <X className="w-3 h-3" /> Reject
                      </button>
                    </>
                  )}
                  {view === 'approved' && l.suggestionDecision?.communityProfileSlug && (
                    <a
                      href={`${publicBase}/${l.suggestionDecision.communityProfileSlug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-app-border text-[10px] font-bold"
                    >
                      Public page <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewing && (
        <CommunityProfileViewCard
          entityType="brand"
          row={rowOf(viewing)}
          onClose={() => setViewing(null)}
          banner={{
            title: `Suggested brand · ${suggestionOf(viewing) === 'pending' ? 'to review' : suggestionOf(viewing)}`,
            text: 'Suggested by a shopper on the storefront. Nothing is public until Choosify approves it as a community profile.',
          }}
          extra={
            <div className="rounded-lg border border-app-border bg-slate-50 p-3 text-[11.5px] space-y-1" data-testid="suggested-by">
              <div className={label}>Suggested by</div>
              <div>
                {viewing.contactPerson || '—'} · {viewing.email}
                {viewing.submittedByUserId ? ' · signed in' : ''}
              </div>
              {viewing.message && (
                <>
                  <div className={label}>Why list this brand</div>
                  <p className="whitespace-pre-line">{viewing.message}</p>
                </>
              )}
              {viewing.duplicateSignals?.length ? (
                <div className="text-amber-700">
                  Possible duplicate: {viewing.duplicateSignals.map((d) => `${d.matchLabel} (${d.matchedOn})`).join(', ')}
                </div>
              ) : null}
            </div>
          }
          actions={
            suggestionOf(viewing) === 'pending' && viewing.status !== 'closed' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setRejecting(viewing);
                    setViewing(null);
                  }}
                  className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg border border-red-200 text-red-600 text-[11px] font-bold"
                >
                  <X className="w-3 h-3" /> Reject
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setApproving(viewing);
                    setViewing(null);
                  }}
                  className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg bg-app-accent text-white text-[11px] font-black"
                >
                  <Plus className="w-3 h-3" /> Approve
                </button>
              </>
            ) : null
          }
        />
      )}
      {approving && (
        <CommunityProfileDialog
          entityType="brand"
          categories={categories}
          editing={null}
          prefill={suggestionFields(approving)}
          title={`Approve suggestion — ${approving.brandName}`}
          createProfile={(input) => operationsApi.approveBrandSuggestion(approving.id, input)}
          onClose={() => setApproving(null)}
          onSaved={(name, slug) => {
            setApproving(null);
            setNotice(`“${name}” approved and listed as a community brand profile — ${publicBase}/${slug}`);
            void load();
          }}
        />
      )}
      {rejecting && (
        <RejectSuggestionDialog
          lead={rejecting}
          onClose={() => setRejecting(null)}
          onRejected={() => {
            setRejecting(null);
            setNotice(`Suggestion “${rejecting.brandName}” rejected.`);
            void load();
          }}
        />
      )}
    </div>
  );
}

function RejectSuggestionDialog({ lead, onClose, onRejected }: { lead: OpsLead; onClose: () => void; onRejected: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await operationsApi.rejectBrandSuggestion(lead.id, note.trim());
      onRejected();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reject the suggestion.');
      setBusy(false);
    }
  };
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Reject ${lead.brandName}`}
      className="fixed inset-0 z-[1000] bg-slate-900/50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-xl w-full max-w-[440px] shadow-xl" data-testid="suggested-reject-dialog">
        <div className="px-5 py-4 space-y-3">
          <div className="text-sm font-black">Reject “{lead.brandName}”?</div>
          <div>
            <label className={label} htmlFor="sg-reject-note">Reason (kept on the inquiry)</label>
            <textarea id="sg-reject-note" className={input} rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && <div className="text-[11.5px] font-bold text-red-600" role="alert">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-app-border">
          <button type="button" onClick={onClose} className="px-3.5 py-2 rounded-lg border border-app-border text-[11px] font-bold">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || note.trim().length < 5}
            onClick={() => void run()}
            className="px-3.5 py-2 rounded-lg bg-red-600 text-white text-[11px] font-black disabled:opacity-50"
            data-testid="suggested-reject-confirm"
          >
            {busy ? 'Rejecting…' : 'Reject suggestion'}
          </button>
        </div>
      </div>
    </div>
  );
}
