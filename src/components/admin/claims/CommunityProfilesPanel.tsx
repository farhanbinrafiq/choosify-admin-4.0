import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Copy, ExternalLink, Loader2, Plus, X } from 'lucide-react';
import { catalogApi } from '../../../services/catalogApi';
import {
  operationsApi,
  type CommunityDuplicate,
  type CommunityProfileCopy,
} from '../../../services/operationsApi';
import type { CatalogBrand, CatalogCategory, CatalogCreator } from '../../../types/catalog';
import { getPublishedStorefrontUrl } from '../../../lib/storefrontUrls';

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
};

const STATE_LABEL: Record<string, [string, string]> = {
  community: ['Unclaimed', 'bg-slate-500/10 text-slate-600'],
  claim_pending: ['Claim pending', 'bg-amber-500/10 text-amber-600'],
  owned_verified: ['Claimed · verified owner', 'bg-emerald-500/10 text-emerald-600'],
  owned: ['Claimed', 'bg-emerald-500/10 text-emerald-600'],
  unavailable: ['Unavailable', 'bg-red-500/10 text-red-600'],
};
const SOCIALS = ['facebook', 'instagram', 'youtube', 'tiktok', 'linkedin'] as const;
const input = 'w-full bg-white border border-app-border rounded-lg px-3 py-2 text-xs outline-none focus:border-app-accent';
const label = 'block text-[9.5px] font-black uppercase tracking-wider text-app-text-secondary mb-1';

export function CommunityProfilesPanel({ entityType }: { entityType: 'brand' | 'creator' }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
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
            return {
              id: r.id,
              name: r.name,
              slug: r.slug,
              category: String((r as { category?: string }).category || '—'),
              createdAt: String(r.createdAt || ''),
              state: stateLabel,
              stateTone: tone,
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

  const copyLink = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(`${publicBase}/${slug}`);
      setNotice('Public profile link copied.');
    } catch {
      setNotice(`${publicBase}/${slug}`);
    }
  };

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
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold truncate">{r.name}</div>
                  <div className="text-[10.5px] text-app-text-secondary">
                    {entityType === 'brand' ? `${r.category} · ` : ''}/{r.slug} · created {r.createdAt.slice(0, 10) || '—'}
                  </div>
                </div>
                <span className={`text-[9px] font-black uppercase px-2 py-1 rounded shrink-0 w-max ${r.stateTone}`}>{r.state}</span>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => void copyLink(r.slug)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-app-border text-[10px] font-bold"
                  >
                    <Copy className="w-3 h-3" /> Copy public link
                  </button>
                  <a
                    href={`${publicBase}/${r.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-app-border text-[10px] font-bold"
                  >
                    View <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CommunityCopyEditor entityType={entityType} />

      {creating && (
        <CreateCommunityProfileDialog
          entityType={entityType}
          categories={categories}
          onClose={() => setCreating(false)}
          onCreated={(name, slug) => {
            setCreating(false);
            setNotice(`Community profile “${name}” created — ${publicBase}/${slug}`);
            void load();
          }}
        />
      )}
    </div>
  );
}

function CreateCommunityProfileDialog({
  entityType,
  categories,
  onClose,
  onCreated,
}: {
  entityType: 'brand' | 'creator';
  categories: CatalogCategory[];
  onClose: () => void;
  onCreated: (name: string, slug: string) => void;
}) {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [logo, setLogo] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [website, setWebsite] = useState('');
  const [location, setLocation] = useState('');
  const [socials, setSocials] = useState<Record<string, string>>({});
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

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (duplicates === null) {
        const found = await operationsApi.findCommunityDuplicates({ entityType, name: name.trim(), website: website.trim(), socialLinks: cleanSocials });
        if (found.length) {
          setDuplicates(found);
          return;
        }
      }
      const created = await operationsApi.createCommunityProfile({
        entityType,
        name: name.trim(),
        categoryId: categoryId || undefined,
        description: description.trim(),
        logo: logo.trim(),
        coverImage: coverImage.trim(),
        website: website.trim(),
        location: location.trim(),
        socialLinks: cleanSocials,
        acknowledgeDuplicates: Boolean(duplicates?.length),
      });
      onCreated(created.name, created.slug);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the profile.');
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = name.trim().length >= 2 && (!isBrand || categoryId) && !busy;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Create community ${entityType}`}
      className="fixed inset-0 z-[1000] bg-slate-900/50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div className="bg-white rounded-xl w-full max-w-[560px] shadow-xl" onClick={(e) => e.stopPropagation()} data-testid="community-create-dialog">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-app-border">
          <div className="text-sm font-black">Create community {isBrand ? 'brand' : 'creator'} profile</div>
          <button type="button" onClick={onClose} aria-label="Close">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="cp-logo">{isBrand ? 'Logo URL' : 'Profile photo URL'}</label>
              <input id="cp-logo" className={input} value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://" />
            </div>
            <div>
              <label className={label} htmlFor="cp-cover">Cover image URL</label>
              <input id="cp-cover" className={input} value={coverImage} onChange={(e) => setCoverImage(e.target.value)} placeholder="https://" />
            </div>
            {isBrand && (
              <div>
                <label className={label} htmlFor="cp-web">Official website</label>
                <input id="cp-web" className={input} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
              </div>
            )}
            <div>
              <label className={label} htmlFor="cp-loc">Location</label>
              <input id="cp-loc" className={input} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Dhaka, Bangladesh" />
            </div>
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
          {duplicates && duplicates.length > 0 && (
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
          <button type="button" onClick={onClose} className="px-3.5 py-2 rounded-lg border border-app-border text-[11px] font-bold">
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void submit()}
            className="px-3.5 py-2 rounded-lg bg-app-accent text-white text-[11px] font-black disabled:opacity-50"
            data-testid="community-create-submit"
          >
            {busy ? 'Working…' : duplicates?.length ? 'Create anyway' : 'Create profile'}
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
