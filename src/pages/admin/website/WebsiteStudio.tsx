/**
 * Choosify Website Studio (Phase 1) — draft / publish / version history / rollback for the public
 * website, starting with Company Settings and Brand Assets.
 *
 * The server is the authority for every permission and validation rule; this page mirrors
 * GET /website/capabilities so editors see why a button is unavailable instead of hitting a 403.
 * Save Draft never changes the public site; Publish creates a new immutable version; restoring an
 * old version publishes a NEW version copied from it; Reset Defaults only changes the draft.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCopy, Eye, History, ImagePlus, Loader2, Monitor, Pencil, Plus, RotateCcw, Smartphone, Trash2, Upload, X } from 'lucide-react';
import {
  BRAND_ASSET_SLOTS,
  WebsiteStudioApiError,
  websiteStudioApi,
  type BrandAssetSlot,
  type BrandAssets,
  type CompanySettings,
  type WebsiteCapabilities,
  type WebsiteDocument,
  type WebsiteDocumentSummary,
  type WebsitePublication,
  type WebsiteVersionSummary,
} from '../../../services/websiteStudioApi';
import { uploadSiteAssetImage } from '../../../services/mediaUpload';
import { HomepageEditor, HomepageOutline } from './HomepageStudio';
import type { HomepageStudioContent } from './homepageModel';
import { HeaderEditor, HeaderOutline } from './HeaderStudio';
import { FooterEditor, FooterOutline } from './FooterStudio';
import { SocialEditor, SocialOutline } from './SocialStudio';
import type { FooterContent, NavigationContent, SocialContent } from './siteModel';
import { CustomPageEditor, CustomPageOutline, ListingPageOutline, PageList, SitePageEditor, SitePageOutline } from './PagesStudio';
import { listingPageByDocKey } from '@/shared/website/listingPages';
import type { CustomPageRow } from '../../../services/websiteStudioApi';
import { SYSTEM_SITE_PAGES, sitePageByDocKey } from '@/shared/website/sitePages';

// Deals Banners are edited inside the versioned Homepage (Today's Deals section) since Phase 3;
// the old live-saving editor tab is retired.
type TabKey = 'overview' | 'homepage' | 'pages' | 'navigation' | 'footer' | 'social' | 'company' | 'brand_assets' | 'history';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'homepage', label: 'Homepage' },
  { key: 'pages', label: 'Pages' },
  { key: 'navigation', label: 'Header & Navigation' },
  { key: 'footer', label: 'Footer' },
  { key: 'company', label: 'Company Settings' },
  { key: 'brand_assets', label: 'Brand Assets' },
  { key: 'history', label: 'Publish History' },
];

/** The public storefront (same env var the order-confirmation links use). */
const STOREFRONT_URL = String((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_CHOOSIFY_WEB_URL || 'http://localhost:5173').replace(/\/$/, '');

const DOCUMENT_LABELS: Record<string, string> = {
  company: 'Company Settings',
  brand_assets: 'Brand Assets',
  homepage: 'Homepage',
  navigation: 'Navigation',
  footer: 'Footer',
  social: 'Social Links',
  seo: 'SEO',
};

/** Where each document becomes editable / visible on the storefront (approved phase plan). */
const DOCUMENT_PHASE: Record<string, string> = {
  company: 'Editable · footer contact, offices, identifiers and copyright follow it once published',
  brand_assets: 'Editable · header and footer logos follow it once published',
  homepage: 'Editable · the storefront homepage follows it once published',
  navigation: 'Editable · the storefront header follows it once published',
  footer: 'Editable · the storefront footer follows it once published',
  social: 'Editable · footer social icons follow it once published',
  seo: 'Read-only · editable in Phase 5',
};

const ASSET_LABELS: Record<BrandAssetSlot, { label: string; hint: string }> = {
  primaryLogo: { label: 'Primary logo', hint: 'Main Choosify logo (navbar). Transparent PNG or SVG works best.' },
  horizontalLogo: { label: 'Horizontal logo', hint: 'Wide wordmark for narrow headers.' },
  footerLogo: { label: 'Footer logo', hint: 'Shown on the dark footer — use a light version.' },
  favicon: { label: 'Favicon / site icon', hint: 'Square icon for browser tabs (at least 64×64).' },
  emiLogo: { label: 'Emi assistant logo', hint: 'The Emi avatar shown on the assistant button and chat.' },
  defaultShareImage: { label: 'Default share image', hint: 'Used when a page is shared without its own image (1200×630).' },
  defaultPlaceholder: { label: 'Default placeholder', hint: 'Shown when a product or brand has no image yet.' },
};

const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : '—');
const errorText = (e: unknown) => (e instanceof WebsiteStudioApiError || e instanceof Error ? e.message : 'Something went wrong');

const inputCls =
  'w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[12.5px] text-[#111827] outline-none focus:border-[#EF3C23] disabled:bg-slate-50 disabled:text-slate-500';
const labelCls = 'mb-1 block text-[10.5px] font-extrabold uppercase tracking-wide text-[#6B7280]';
const btn = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-bold disabled:cursor-not-allowed disabled:opacity-50';
const btnPrimary = `${btn} bg-[#EF3C23] text-white hover:brightness-110`;
const btnGhost = `${btn} border border-[#E2E8F0] bg-white text-[#1A1A2E] hover:bg-slate-50`;

function SourceTag({ source, restoredFrom }: { source: WebsiteVersionSummary['source']; restoredFrom: number | null }) {
  const map = {
    publish: ['Published', 'bg-emerald-50 text-emerald-700'],
    rollback: [`Restored from v${restoredFrom}`, 'bg-amber-50 text-amber-700'],
    backfill: ['Imported from live site', 'bg-slate-100 text-slate-600'],
  } as const;
  const [text, cls] = map[source];
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${cls}`}>{text}</span>;
}

// ---------------------------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------------------------

function NoteDialog({
  title,
  body,
  confirmLabel,
  onCancel,
  onConfirm,
  busy,
}: {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: (note: string) => void;
  busy: boolean;
}) {
  const [note, setNote] = useState('');
  const ok = note.trim().length >= 3;
  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-[460px] rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-1 text-[14px] font-extrabold text-[#111827]">{title}</div>
        <div className="mb-3 text-[12px] text-[#4B5563]">{body}</div>
        <label className={labelCls} htmlFor="ws-change-note">What changed? (required)</label>
        <textarea
          id="ws-change-note"
          data-testid="ws-change-note"
          className={`${inputCls} h-20 resize-none`}
          maxLength={300}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Updated the support phone number"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className={btnPrimary} data-testid="ws-confirm" onClick={() => onConfirm(note.trim())} disabled={!ok || busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({ title, body, confirmLabel, onCancel, onConfirm, busy }: { title: string; body: React.ReactNode; confirmLabel: string; onCancel: () => void; onConfirm: () => void; busy: boolean }) {
  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-[440px] rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-1 text-[14px] font-extrabold text-[#111827]">{title}</div>
        <div className="mb-4 text-[12px] text-[#4B5563]">{body}</div>
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className={btnPrimary} data-testid="ws-confirm" onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Generic document workspace: toolbar + editor + preview + version history
// ---------------------------------------------------------------------------------------------

type EditorProps<T> = { value: T; onChange: (next: T) => void; disabled: boolean };

function DocumentWorkspace<T>({
  docKey,
  caps,
  title,
  description,
  Editor,
  Preview,
  onPublished,
  storefrontPreview = false,
  previewLabel = 'Live preview of your edits',
  wide = false,
  previewPage,
}: {
  docKey: string;
  caps: WebsiteCapabilities;
  title: string;
  description: string;
  Editor: React.ComponentType<EditorProps<T>>;
  Preview: React.ComponentType<{ value: T }>;
  onPublished: () => void;
  /** Draft preview opens the real storefront (/cms-preview) instead of the raw preview link. */
  storefrontPreview?: boolean;
  previewLabel?: string;
  /** Storefront-mirror editors take the full width; outline + history go below. */
  wide?: boolean;
  /** Page documents: preview opens that page (storefront /cms-preview?page=<key>). */
  previewPage?: string;
}) {
  const [doc, setDoc] = useState<WebsiteDocument<T> | null>(null);
  const [working, setWorking] = useState<T | null>(null);
  const [dirty, setDirty] = useState(false);
  /** View first: fields are locked until "Edit" is pressed (no accidental changes). */
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; field?: string | null } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | { type: 'publish' } | { type: 'reset' } | { type: 'discard' } | { type: 'cancel' } | { type: 'restore'; version: number }>(null);
  const [versions, setVersions] = useState<WebsiteVersionSummary[]>([]);
  const [viewing, setViewing] = useState<(WebsiteVersionSummary & { content: T }) | null>(null);
  const [previewLink, setPreviewLink] = useState<{ url: string; expiresAt: string } | null>(null);

  const load = useCallback(async () => {
    const [d, v] = await Promise.all([websiteStudioApi.getDocument<T>(docKey), websiteStudioApi.versions(docKey)]);
    setDoc(d);
    setVersions(v);
    setWorking((d.draft ?? d.published?.content ?? d.defaults) as T);
    setDirty(false);
  }, [docKey]);

  useEffect(() => {
    load().catch((e) => setError({ message: errorText(e) }));
  }, [load]);

  const showFlash = (text: string) => {
    setFlash(text);
    window.setTimeout(() => setFlash(null), 2600);
  };

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError({ message: errorText(e), field: e instanceof WebsiteStudioApiError ? e.field : null });
      if (e instanceof WebsiteStudioApiError && e.code === 'STALE_DRAFT') await load().catch(() => undefined);
    } finally {
      setBusy(null);
    }
  };

  if (!doc || working === null) {
    return (
      <div className="flex items-center gap-2 py-10 text-[12px] font-bold text-slate-500">
        {error ? <span className="text-red-600">{error.message}</span> : <><Loader2 className="h-4 w-4 animate-spin" /> Loading…</>}
      </div>
    );
  }

  const canPublish = caps.canPublish;
  const status = doc.hasDraft
    ? `Draft saved ${fmt(doc.draftUpdatedAt)} — not public yet`
    : doc.publishedVersion
      ? `Live: version ${doc.publishedVersion}`
      : 'Not published yet';
  const staleBase = doc.hasDraft && doc.draftBaseVersion !== doc.publishedVersion;

  return (
    <div className="space-y-4" data-testid={`ws-workspace-${docKey}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[#E8EDF2] bg-white p-4">
        <div className="min-w-0">
          <div className="text-[14px] font-extrabold text-[#111827]">{title}</div>
          <div className="text-[11.5px] text-[#6B7280]">{description}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] font-bold">
            <span data-testid="ws-status" className={doc.hasDraft ? 'text-amber-700' : 'text-emerald-700'}>{status}</span>
            {dirty && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700" data-testid="ws-unsaved">Unsaved changes</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!editing ? (
            <button type="button" className={btnPrimary} data-testid="ws-edit" disabled={!!busy} onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          ) : !dirty ? (
            <button type="button" className={btnGhost} data-testid="ws-stop-edit" disabled={!!busy} onClick={() => setEditing(false)}>
              Done editing
            </button>
          ) : null}
          {editing && dirty ? (
            <button
              type="button"
              className={btnGhost}
              data-testid="ws-cancel-edits"
              disabled={!!busy}
              onClick={() => setDialog({ type: 'cancel' })}
              title="Undo everything you changed since the last save"
            >
              Cancel changes
            </button>
          ) : null}
          <button
            type="button"
            className={btnGhost}
            data-testid="ws-save-draft"
            disabled={!dirty || !!busy}
            onClick={() =>
              run('save', async () => {
                const d = await websiteStudioApi.saveDraft<T>(docKey, working, doc.draftRevision);
                setDoc({ ...doc, ...d, published: doc.published, defaults: doc.defaults });
                setDirty(false);
                setEditing(false);
                showFlash('Draft saved — the public website is unchanged.');
              })
            }
          >
            {busy === 'save' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Save Draft
          </button>
          {storefrontPreview ? (
            (['desktop', 'mobile'] as const).map((device) => (
              <button
                key={device}
                type="button"
                className={btnGhost}
                data-testid={`ws-preview-${device}`}
                disabled={!doc.hasDraft || dirty || !!busy}
                title={dirty ? 'Save the draft first' : !doc.hasDraft ? 'No draft to preview' : `Opens the real storefront with this draft (${device === 'mobile' ? 'phone-sized window' : 'new tab'}); link valid 15 minutes`}
                onClick={() => {
                  // Open the window inside the click (popup blockers), then point it at the signed URL.
                  const win =
                    device === 'mobile'
                      ? window.open('about:blank', 'ws-preview-mobile', 'popup=yes,width=390,height=844')
                      : window.open('about:blank', 'ws-preview-desktop');
                  void run('preview', async () => {
                    try {
                      const t = await websiteStudioApi.previewToken(docKey);
                      const url = `${STOREFRONT_URL}/cms-preview?token=${encodeURIComponent(t.token)}${previewPage ? `&page=${encodeURIComponent(previewPage)}` : ''}`;
                      setPreviewLink({ url, expiresAt: t.expiresAt });
                      if (win) win.location.href = url;
                    } catch (e) {
                      win?.close();
                      throw e;
                    }
                  });
                }}
              >
                {device === 'desktop' ? <Monitor className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />} {device === 'desktop' ? 'Desktop preview' : 'Mobile preview'}
              </button>
            ))
          ) : (
            <button
              type="button"
              className={btnGhost}
              data-testid="ws-preview-link"
              disabled={!doc.hasDraft || dirty || !!busy}
              title={dirty ? 'Save the draft first' : !doc.hasDraft ? 'No draft to preview' : 'Signed link to this draft, valid 15 minutes'}
              onClick={() =>
                run('preview', async () => {
                  const t = await websiteStudioApi.previewToken(docKey);
                  const url = `${window.location.origin}/api/v1/website/preview/${encodeURIComponent(docKey)}?token=${encodeURIComponent(t.token)}`;
                  setPreviewLink({ url, expiresAt: t.expiresAt });
                })
              }
            >
              <Eye className="h-3.5 w-3.5" /> Preview link
            </button>
          )}
          <span title={canPublish ? '' : 'Publishing needs the publishing permission (Super Admin). You can still save drafts.'}>
            <button
              type="button"
              className={btnPrimary}
              data-testid="ws-publish"
              disabled={!canPublish || !doc.hasDraft || dirty || !!busy}
              onClick={() => setDialog({ type: 'publish' })}
            >
              Publish…
            </button>
          </span>
        </div>
      </div>

      {!canPublish && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-[11.5px] font-semibold text-slate-600" data-testid="ws-no-publish-note">
          You can edit and save drafts. Publishing is done by a Super Admin.
        </div>
      )}
      {staleBase && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[11.5px] font-semibold text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          This draft was started from version {doc.draftBaseVersion ?? '—'}, but version {doc.publishedVersion} has been published since. Check it before publishing.
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] font-semibold text-red-700" data-testid="ws-error">
          {error.message}
          {error.field ? <span className="ml-1 font-mono text-[11px]">({error.field})</span> : null}
        </div>
      )}
      {flash && (
        <div className="flex items-center gap-1.5 text-[12px] font-bold text-emerald-600" data-testid="ws-flash">
          <CheckCircle2 className="h-4 w-4" /> {flash}
        </div>
      )}
      {previewLink && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-4 py-2.5 text-[11.5px]">
          <span className="font-bold text-[#111827]">Draft preview link</span>
          <span className="text-slate-500">expires {fmt(previewLink.expiresAt)} · only this draft · not indexed</span>
          <button type="button" className={btnGhost} onClick={() => navigator.clipboard?.writeText(previewLink.url)}>
            <ClipboardCopy className="h-3.5 w-3.5" /> Copy
          </button>
          <button type="button" className="ml-auto text-slate-400 hover:text-slate-600" aria-label="Close" onClick={() => setPreviewLink(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className={wide ? 'grid gap-4' : 'grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]'}>
        <div className={wide ? 'min-w-0' : 'rounded-xl border border-[#E8EDF2] bg-white p-4'}>
          {!editing ? (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[12px] font-semibold text-[#475569]" data-testid="ws-view-only">
              <span>View only — press Edit to change this.</span>
              <button type="button" className={btnPrimary} disabled={!!busy} onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
            </div>
          ) : null}
          <Editor
            value={working}
            disabled={!!busy || !editing}
            onChange={(next) => {
              setWorking(next);
              setDirty(true);
            }}
          />
          <div className="mt-4 flex flex-wrap gap-2 border-t border-[#F1F3F5] pt-3">
            <button type="button" className={btnGhost} data-testid="ws-discard" disabled={!editing || !doc.hasDraft || !!busy} onClick={() => setDialog({ type: 'discard' })}>
              <Trash2 className="h-3.5 w-3.5" /> Discard draft
            </button>
            <button type="button" className={btnGhost} data-testid="ws-reset" disabled={!editing || !doc.defaults || !!busy} onClick={() => setDialog({ type: 'reset' })}>
              <RotateCcw className="h-3.5 w-3.5" /> Reset to defaults (draft)
            </button>
            {dirty && (
              <button
                type="button"
                className={btnGhost}
                onClick={() => {
                  setWorking((doc.draft ?? doc.published?.content ?? doc.defaults) as T);
                  setDirty(false);
                }}
              >
                Undo unsaved changes
              </button>
            )}
          </div>
        </div>
        <div className={wide ? 'grid gap-4 lg:grid-cols-2' : 'space-y-4'}>
          <div className="rounded-xl border border-[#E8EDF2] bg-white p-4">
            <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide text-[#6B7280]">{previewLabel}</div>
            <Preview value={working} />
          </div>
          <div className="rounded-xl border border-[#E8EDF2] bg-white p-4" data-testid="ws-versions">
            <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-[#6B7280]">
              <History className="h-3.5 w-3.5" /> Version history
            </div>
            {versions.length === 0 ? (
              <div className="text-[11.5px] text-slate-500">No published versions yet.</div>
            ) : (
              <ul className="space-y-2">
                {versions.map((v) => (
                  <li key={v.version} className="rounded-lg border border-[#F1F3F5] p-2.5 text-[11.5px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-[#111827]">v{v.version}</span>
                      {v.version === doc.publishedVersion && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-extrabold text-white">LIVE</span>}
                      <SourceTag source={v.source} restoredFrom={v.restoredFromVersion} />
                    </div>
                    <div className="mt-1 text-[#374151]">{v.changeNote}</div>
                    <div className="mt-0.5 text-[10.5px] text-slate-500">
                      {fmt(v.publishedAt)} · {v.publishedByName || (v.source === 'backfill' ? 'System import' : 'Staff')}
                    </div>
                    <div className="mt-1.5 flex gap-2">
                      <button
                        type="button"
                        className="text-[11px] font-bold text-[#2563EB] hover:underline"
                        onClick={() => run('view', async () => setViewing(await websiteStudioApi.version<T>(docKey, v.version)))}
                      >
                        View
                      </button>
                      {v.version !== doc.publishedVersion && (
                        <button
                          type="button"
                          className="text-[11px] font-bold text-[#EF3C23] hover:underline disabled:text-slate-400 disabled:no-underline"
                          disabled={!canPublish}
                          title={canPublish ? 'Publishes a new version copied from this one' : 'Needs the publishing permission'}
                          data-testid={`ws-restore-v${v.version}`}
                          onClick={() => setDialog({ type: 'restore', version: v.version })}
                        >
                          Restore this version
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {viewing && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[85vh] w-full max-w-[560px] overflow-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-1 flex items-center justify-between">
              <div className="text-[14px] font-extrabold text-[#111827]">{title} — version {viewing.version}</div>
              <button type="button" aria-label="Close" onClick={() => setViewing(null)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>
            <div className="mb-3 text-[11.5px] text-slate-500">{viewing.changeNote} · {fmt(viewing.publishedAt)}</div>
            <Preview value={viewing.content} />
          </div>
        </div>
      )}

      {dialog?.type === 'publish' && (
        <NoteDialog
          title={`Publish ${title}?`}
          body={<>This makes the saved draft public as version {(doc.latestVersion ?? doc.publishedVersion ?? 0) + 1}. The current version stays in the history and can be restored.</>}
          confirmLabel="Publish"
          busy={busy === 'publish'}
          onCancel={() => setDialog(null)}
          onConfirm={(note) =>
            run('publish', async () => {
              await websiteStudioApi.publish(docKey, note, doc.draftRevision);
              setDialog(null);
              await load();
              onPublished();
              showFlash('Published.');
            })
          }
        />
      )}
      {dialog?.type === 'restore' && (
        <NoteDialog
          title={`Restore version ${dialog.version}?`}
          body={<>This publishes a NEW version ({(doc.latestVersion ?? doc.publishedVersion ?? 0) + 1}) with the content of version {dialog.version}. Nothing in the history is deleted.</>}
          confirmLabel="Restore & publish"
          busy={busy === 'restore'}
          onCancel={() => setDialog(null)}
          onConfirm={(note) =>
            run('restore', async () => {
              await websiteStudioApi.rollback(docKey, dialog.version, note);
              setDialog(null);
              await load();
              onPublished();
              showFlash(`Version ${dialog.version} restored as a new version.`);
            })
          }
        />
      )}
      {dialog?.type === 'reset' && (
        <ConfirmDialog
          title="Reset to defaults?"
          body={<>This replaces the DRAFT with the built-in defaults. The public website does not change until someone publishes, and you can discard the draft at any time.</>}
          confirmLabel="Reset draft"
          busy={busy === 'reset'}
          onCancel={() => setDialog(null)}
          onConfirm={() =>
            run('reset', async () => {
              await websiteStudioApi.restoreDefaults(docKey, doc.draftRevision);
              setDialog(null);
              await load();
              showFlash('Defaults restored into the draft — not published.');
            })
          }
        />
      )}
      {dialog?.type === 'cancel' && (
        <ConfirmDialog
          title="Cancel your changes?"
          body={
            <>
              Everything you changed since the last save is undone, and the editor goes back to{' '}
              {doc.hasDraft ? 'your saved draft' : doc.publishedVersion ? `the live version ${doc.publishedVersion}` : 'the defaults'}. The public website is not affected.
            </>
          }
          confirmLabel="Cancel changes"
          busy={false}
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            setWorking((doc.draft ?? doc.published?.content ?? doc.defaults) as T);
            setDirty(false);
            setEditing(false);
            setError(null);
            setDialog(null);
            showFlash('Changes cancelled.');
          }}
        />
      )}
      {dialog?.type === 'discard' && (
        <ConfirmDialog
          title="Discard the draft?"
          body={<>The saved draft is removed. The published version stays exactly as it is.</>}
          confirmLabel="Discard draft"
          busy={busy === 'discard'}
          onCancel={() => setDialog(null)}
          onConfirm={() =>
            run('discard', async () => {
              await websiteStudioApi.discardDraft(docKey, doc.draftRevision);
              setDialog(null);
              await load();
              showFlash('Draft discarded.');
            })
          }
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Company Settings
// ---------------------------------------------------------------------------------------------

function CompanyEditor({ value, onChange, disabled }: EditorProps<CompanySettings>) {
  const set = (patch: Partial<CompanySettings>) => onChange({ ...value, ...patch });
  const setOffice = (i: number, patch: Partial<CompanySettings['offices'][number]>) =>
    set({ offices: value.offices.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  const setId = (k: 'dbid' | 'tradeLicense', patch: Partial<{ value: string; verified: boolean }>) =>
    set({ identifiers: { ...value.identifiers, [k]: { ...value.identifiers[k], ...patch } } });
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="ws-displayName">Display name</label>
          <input id="ws-displayName" className={inputCls} disabled={disabled} value={value.displayName} onChange={(e) => set({ displayName: e.target.value })} />
        </div>
        <div>
          <label className={labelCls} htmlFor="ws-legalName">Registered legal name</label>
          <input id="ws-legalName" className={inputCls} disabled={disabled} value={value.legalName} placeholder="Leave blank until the company is registered" onChange={(e) => set({ legalName: e.target.value })} />
        </div>
        <div>
          <label className={labelCls} htmlFor="ws-email">Support email</label>
          <input id="ws-email" data-testid="ws-support-email" className={inputCls} disabled={disabled} value={value.supportEmail} onChange={(e) => set({ supportEmail: e.target.value })} />
        </div>
        <div>
          <label className={labelCls} htmlFor="ws-phone">Support phone</label>
          <input id="ws-phone" className={inputCls} disabled={disabled} value={value.supportPhone} onChange={(e) => set({ supportPhone: e.target.value })} />
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className={labelCls}>Offices</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11.5px] font-bold text-[#EF3C23] disabled:text-slate-400"
            disabled={disabled || value.offices.length >= 6}
            onClick={() => set({ offices: [...value.offices, { id: `office-${value.offices.length + 1}`, label: 'New office', lines: [], enabled: true }] })}
          >
            <Plus className="h-3.5 w-3.5" /> Add office
          </button>
        </div>
        <div className="space-y-2">
          {value.offices.map((o, i) => (
            <div key={o.id + i} className="rounded-lg border border-[#F1F3F5] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <input className={`${inputCls} max-w-[220px]`} aria-label="Office name" disabled={disabled} value={o.label} onChange={(e) => setOffice(i, { label: e.target.value })} />
                <label className="flex items-center gap-1.5 text-[11.5px] font-bold text-[#374151]">
                  <input type="checkbox" checked={o.enabled} disabled={disabled} onChange={(e) => setOffice(i, { enabled: e.target.checked })} /> Show
                </label>
                <button type="button" className="ml-auto text-[11px] font-bold text-red-600 disabled:text-slate-400" disabled={disabled} onClick={() => set({ offices: value.offices.filter((_, j) => j !== i) })}>
                  Remove
                </button>
              </div>
              <textarea
                className={`${inputCls} mt-2 h-[72px] resize-none`}
                aria-label="Address lines"
                disabled={disabled}
                value={o.lines.join('\n')}
                placeholder="One address line per row"
                onChange={(e) => setOffice(i, { lines: e.target.value.split('\n').slice(0, 6) })}
              />
            </div>
          ))}
          {value.offices.length === 0 && <div className="text-[11.5px] text-slate-500">No offices listed.</div>}
        </div>
      </div>

      <div>
        <span className={labelCls}>Business identifiers</span>
        <div className="mb-2 text-[11px] text-slate-500">Shown on the website ONLY when marked verified. Tick “verified” only when you hold the official certificate.</div>
        <div className="grid gap-3 md:grid-cols-2">
          {(['dbid', 'tradeLicense'] as const).map((k) => (
            <div key={k} className="rounded-lg border border-[#F1F3F5] p-3">
              <label className={labelCls} htmlFor={`ws-${k}`}>{k === 'dbid' ? 'DBID number' : 'Trade licence number'}</label>
              <input id={`ws-${k}`} className={inputCls} disabled={disabled} value={value.identifiers[k].value} onChange={(e) => setId(k, { value: e.target.value })} />
              <label className="mt-2 flex items-center gap-1.5 text-[11.5px] font-bold text-[#374151]">
                <input type="checkbox" data-testid={`ws-${k}-verified`} checked={value.identifiers[k].verified} disabled={disabled} onChange={(e) => setId(k, { verified: e.target.checked })} />
                Verified (official document on file)
              </label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className={labelCls} htmlFor="ws-copyright">Copyright holder</label>
        <input id="ws-copyright" className={inputCls} disabled={disabled} value={value.copyrightText} placeholder="e.g. Choosify" onChange={(e) => set({ copyrightText: e.target.value })} />
        <div className="mt-1 text-[11px] text-slate-500">The footer shows: © {new Date().getFullYear()} {value.copyrightText || '…'}. All rights reserved.</div>
      </div>
    </div>
  );
}

function CompanyPreview({ value }: { value: CompanySettings }) {
  const ids = (['dbid', 'tradeLicense'] as const).filter((k) => value.identifiers[k].verified && value.identifiers[k].value);
  return (
    <div className="rounded-lg p-4" style={{ background: '#18154C', color: '#FFFFFF' }} data-testid="ws-company-preview">
      <div className="text-[13px] font-extrabold">{value.displayName || 'Choosify'}</div>
      <div className="mt-2 text-[10px] font-extrabold uppercase tracking-wide text-white/50">Contact us</div>
      <div className="text-[11.5px] text-white/80">{value.supportEmail ? `Email: ${value.supportEmail}` : 'Email: —'}</div>
      <div className="text-[11.5px] text-white/80">{value.supportPhone ? `Phone: ${value.supportPhone}` : 'Phone: —'}</div>
      {value.offices.filter((o) => o.enabled).map((o) => (
        <div key={o.id} className="mt-2">
          <div className="text-[11.5px] font-bold">{o.label}</div>
          {o.lines.filter(Boolean).map((l, i) => <div key={i} className="text-[11px] text-white/70">{l}</div>)}
        </div>
      ))}
      {ids.map((k) => (
        <div key={k} className="mt-2 text-[11px] text-white/70">{k === 'dbid' ? 'DBID No' : 'Trade License No'}: {value.identifiers[k].value}</div>
      ))}
      <div className="mt-3 border-t border-white/10 pt-2 text-[10.5px] text-white/50">
        {value.copyrightText ? `© ${new Date().getFullYear()} ${value.copyrightText}. All rights reserved.` : '(no copyright holder set)'}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Brand Assets
// ---------------------------------------------------------------------------------------------

function BrandAssetsEditor({ value, onChange, disabled }: EditorProps<BrandAssets>) {
  const [uploading, setUploading] = useState<BrandAssetSlot | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const setSlot = (slot: BrandAssetSlot, patch: Partial<{ url: string; alt: string }>) =>
    onChange({ ...value, [slot]: { ...(value[slot] ?? { url: '', alt: '' }), ...patch } });
  return (
    <div className="space-y-3">
      <div className="text-[11px] text-slate-500">An empty slot keeps the storefront's built-in image. Uploads go to the public website media library.</div>
      {uploadError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11.5px] font-semibold text-red-700">{uploadError}</div>}
      {BRAND_ASSET_SLOTS.map((slot) => {
        const a = value[slot] ?? { url: '', alt: '' };
        return (
          <div key={slot} className="flex flex-wrap items-start gap-3 rounded-lg border border-[#F1F3F5] p-3" data-testid={`ws-asset-${slot}`}>
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#E2E8F0] bg-[repeating-conic-gradient(#f1f5f9_0%_25%,#fff_0%_50%)] bg-[length:12px_12px]">
              {a.url ? <img src={a.url} alt={a.alt || ''} className="max-h-full max-w-full object-contain" /> : <ImagePlus className="h-5 w-5 text-slate-400" />}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="text-[12.5px] font-bold text-[#111827]">{ASSET_LABELS[slot].label}</div>
              <div className="text-[11px] text-slate-500">{ASSET_LABELS[slot].hint}</div>
              <input className={inputCls} aria-label={`${ASSET_LABELS[slot].label} URL`} disabled={disabled} value={a.url} placeholder="/media/... or https://..." onChange={(e) => setSlot(slot, { url: e.target.value })} />
              {slot !== 'favicon' && (
                <input className={inputCls} aria-label={`${ASSET_LABELS[slot].label} alt text`} disabled={disabled} value={a.alt} placeholder="Alt text — describe the image (required when an image is set)" onChange={(e) => setSlot(slot, { alt: e.target.value })} />
              )}
              <div className="flex gap-2">
                <label className={`${btnGhost} cursor-pointer ${disabled || uploading ? 'pointer-events-none opacity-50' : ''}`}>
                  {uploading === slot ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Upload
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      setUploading(slot);
                      setUploadError(null);
                      try {
                        setSlot(slot, { url: await uploadSiteAssetImage(file) });
                      } catch (err) {
                        setUploadError(errorText(err));
                      } finally {
                        setUploading(null);
                      }
                    }}
                  />
                </label>
                {a.url && (
                  <button type="button" className={btnGhost} disabled={disabled} onClick={() => setSlot(slot, { url: '', alt: '' })}>
                    Use built-in
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BrandAssetsPreview({ value }: { value: BrandAssets }) {
  const logo = value.primaryLogo?.url || value.horizontalLogo?.url;
  return (
    <div className="space-y-3" data-testid="ws-assets-preview">
      <div className="flex items-center gap-2 rounded-lg px-3 py-2.5" style={{ background: '#18154C' }}>
        {logo ? <img src={logo} alt={value.primaryLogo?.alt || 'Logo'} className="h-7 max-w-[160px] object-contain" /> : <span className="text-[13px] font-extrabold text-white">choosify <span className="text-[10px] font-semibold text-white/50">(built-in logo)</span></span>}
        <span className="ml-auto text-[10px] font-bold text-white/50">Navbar</span>
      </div>
      <div className="flex items-center gap-2 rounded-lg px-3 py-2.5" style={{ background: '#120F38' }}>
        {value.footerLogo?.url ? <img src={value.footerLogo.url} alt={value.footerLogo.alt} className="h-7 max-w-[160px] object-contain" /> : <span className="text-[12px] font-bold text-white/70">(built-in footer logo)</span>}
        <span className="ml-auto text-[10px] font-bold text-white/50">Footer</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 rounded-t-lg border border-b-0 border-[#E2E8F0] bg-slate-50 px-2.5 py-1.5 text-[11px]">
          {value.favicon?.url ? <img src={value.favicon.url} alt="" className="h-4 w-4 object-contain" /> : <span className="h-4 w-4 rounded bg-[#EF3C23]" />}
          Choosify
        </div>
        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-[#E2E8F0] bg-white" title="Emi assistant">
          {value.emiLogo?.url ? <img src={value.emiLogo.url} alt={value.emiLogo.alt} className="h-full w-full object-cover" /> : <span className="text-[10px] font-bold text-slate-400">Emi</span>}
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-[#E2E8F0]">
        <div className="flex aspect-[1200/630] items-center justify-center bg-slate-100">
          {value.defaultShareImage?.url ? <img src={value.defaultShareImage.url} alt={value.defaultShareImage.alt} className="h-full w-full object-cover" /> : <span className="text-[11px] text-slate-400">Built-in share image</span>}
        </div>
        <div className="px-3 py-2 text-[11px] text-slate-600">Share card preview</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Overview + Publish history
// ---------------------------------------------------------------------------------------------

function Overview({ docs, onOpen }: { docs: WebsiteDocumentSummary[]; onOpen: (k: TabKey) => void }) {
  return (
    <div className="space-y-3" data-testid="ws-overview">
      <div className="rounded-xl border border-[#E8EDF2] bg-white p-4 text-[12px] text-[#374151]">
        Every part of the website is stored as a document with a <b>draft</b> (private) and numbered <b>published versions</b>.
        Saving a draft never changes the public site; publishing creates a new version you can always restore.
      </div>
      <div className="overflow-hidden rounded-xl border border-[#E8EDF2] bg-white">
        <table className="w-full text-left text-[12px]">
          <thead className="bg-slate-50 text-[10.5px] font-extrabold uppercase tracking-wide text-[#6B7280]">
            <tr>
              <th className="px-4 py-2.5">Section</th>
              <th className="px-4 py-2.5">Live version</th>
              <th className="px-4 py-2.5">Draft</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.key} className="border-t border-[#F1F3F5]" data-testid={`ws-doc-${d.key}`}>
                <td className="px-4 py-2.5 font-bold text-[#111827]">
                  {TABS.some((t) => t.key === d.key) ? (
                    <button type="button" className="text-[#2563EB] hover:underline" onClick={() => onOpen(d.key as TabKey)}>{DOCUMENT_LABELS[d.key] ?? d.key}</button>
                  ) : (
                    DOCUMENT_LABELS[d.key] ?? d.key
                  )}
                </td>
                <td className="px-4 py-2.5">{d.publishedVersion ? `v${d.publishedVersion}` : '—'}</td>
                <td className="px-4 py-2.5">{d.hasDraft ? <span className="font-bold text-amber-700">Unpublished draft</span> : '—'}</td>
                <td className="px-4 py-2.5 text-[11.5px] text-slate-500">{DOCUMENT_PHASE[d.key] ?? (d.editable ? 'Editable' : 'Read-only')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PublishHistory({ rows }: { rows: WebsitePublication[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#E8EDF2] bg-white" data-testid="ws-history">
      <table className="w-full text-left text-[12px]">
        <thead className="bg-slate-50 text-[10.5px] font-extrabold uppercase tracking-wide text-[#6B7280]">
          <tr>
            <th className="px-4 py-2.5">When</th>
            <th className="px-4 py-2.5">Section</th>
            <th className="px-4 py-2.5">Version</th>
            <th className="px-4 py-2.5">Change</th>
            <th className="px-4 py-2.5">By</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.documentKey}-${r.version}`} className="border-t border-[#F1F3F5]">
              <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{fmt(r.publishedAt)}</td>
              <td className="px-4 py-2.5 font-bold text-[#111827]">{DOCUMENT_LABELS[r.documentKey] ?? r.documentKey}</td>
              <td className="px-4 py-2.5"><span className="mr-1.5 font-bold">v{r.version}</span><SourceTag source={r.source} restoredFrom={r.restoredFromVersion} /></td>
              <td className="px-4 py-2.5 text-[#374151]">{r.changeNote}</td>
              <td className="px-4 py-2.5 text-slate-500">{r.publishedByName || (r.source === 'backfill' ? 'System import' : 'Staff')}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Nothing published yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

export default function WebsiteStudio() {
  const [tab, setTabRaw] = useState<TabKey>('overview');
  // Social Links are edited inside the Footer tab (no separate tab any more).
  const setTab = useCallback((k: TabKey) => setTabRaw(k === 'social' ? 'footer' : k), []);
  // Other editors can jump here (e.g. Footer → "Edit the office addresses now").
  useEffect(() => {
    const open = (e: Event) => {
      const key = (e as CustomEvent<string>).detail as TabKey;
      if (key) {
        setTab(key);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    window.addEventListener('ws-open-tab', open);
    return () => window.removeEventListener('ws-open-tab', open);
  }, []);
  const [pageKey, setPageKey] = useState<string>(SYSTEM_SITE_PAGES[0].docKey);
  const [caps, setCaps] = useState<WebsiteCapabilities | null>(null);
  const [docs, setDocs] = useState<WebsiteDocumentSummary[]>([]);
  const [history, setHistory] = useState<WebsitePublication[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [customPages, setCustomPages] = useState<CustomPageRow[]>([]);
  const [pageBusy, setPageBusy] = useState(false);
  const [pageMsg, setPageMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [c, d, h, cp] = await Promise.all([
      websiteStudioApi.capabilities(),
      websiteStudioApi.listDocuments(),
      websiteStudioApi.history(),
      websiteStudioApi.listPages().catch(() => [] as CustomPageRow[]),
    ]);
    setCaps(c);
    setDocs(d);
    setHistory(h);
    setCustomPages(cp);
  }, []);

  const pageAction = useCallback(
    async (fn: () => Promise<unknown>, done?: string) => {
      setPageBusy(true);
      setPageMsg(null);
      try {
        await fn();
        await refresh();
        if (done) setPageMsg(done);
      } catch (e) {
        setPageMsg(errorText(e));
      } finally {
        setPageBusy(false);
      }
    },
    [refresh],
  );

  useEffect(() => {
    refresh().catch((e) => setError(errorText(e)));
  }, [refresh]);

  const body = useMemo(() => {
    if (!caps) return null;
    if (tab === 'overview') return <Overview docs={docs} onOpen={setTab} />;
    if (tab === 'history') return <PublishHistory rows={history} />;
    if (tab === 'homepage')
      return (
        <DocumentWorkspace<HomepageStudioContent>
          key="homepage"
          docKey="homepage"
          caps={caps}
          title="Homepage"
          description="Hero banner, section order and visibility, headings, and the products, brands, guides and categories each section shows. Publishing updates choosify.bd."
          Editor={HomepageEditor}
          Preview={HomepageOutline}
          previewLabel="Page outline (top to bottom)"
          storefrontPreview
          wide
          onPublished={() => refresh().catch(() => undefined)}
        />
      );
    if (tab === 'pages') {
      const custom = customPages.find((p) => p.docKey === pageKey);
      const listing = listingPageByDocKey(pageKey);
      const page = sitePageByDocKey(pageKey) ?? SYSTEM_SITE_PAGES[0];
      const published = new Set(docs.filter((d) => d.publishedVersion).map((d) => d.key));
      const list = (
        <div className="h-fit rounded-xl border border-[#E8EDF2] bg-white p-3 lg:sticky lg:top-4">
          <PageList
            selected={custom ? custom.docKey : listing ? listing.docKey : page.docKey}
            onSelect={(k) => {
              setPageMsg(null);
              setPageKey(k);
            }}
            publishedKeys={published}
            customPages={customPages}
            creating={pageBusy}
            onNewPage={(slug, title) =>
              pageAction(async () => {
                const created = await websiteStudioApi.createPage(slug, title);
                setPageKey(created.docKey);
              }, 'Page created as a draft — edit it, then Publish.')
            }
          />
          {pageMsg ? (
            <div className="mt-2 rounded-md bg-[#F9FAFB] px-2 py-1.5 text-[11px] font-semibold text-[#374151]" data-testid="pg-msg">
              {pageMsg}
            </div>
          ) : null}
        </div>
      );
      if (listing) {
        return (
          <div className="grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)]" data-testid="ws-pages">
            {list}
            <div className="min-w-0">
              <DocumentWorkspace<Record<string, never>>
                key={listing.docKey}
                docKey={listing.docKey}
                caps={caps}
                title={`${listing.label} page`}
                description={`The words on ${listing.path}: the small label above the list, an optional intro line, filter titles and an optional call-to-action strip under the list. Products, filters and tabs stay automatic.`}
                Editor={SitePageEditor as unknown as React.ComponentType<EditorProps<Record<string, never>>>}
                Preview={ListingPageOutline as unknown as React.ComponentType<{ value: Record<string, never> }>}
                previewLabel="Page outline"
                storefrontPreview
                previewPage={`listing:${listing.key}`}
                onPublished={() => refresh().catch(() => undefined)}
              />
            </div>
          </div>
        );
      }
      if (custom) {
        const archived = custom.status === 'archived';
        return (
          <div className="grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)]" data-testid="ws-pages">
            {list}
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E8EDF2] bg-white px-3 py-2 text-[12px]">
                <div className="text-[#374151]">
                  Address: <span className="font-bold">/pages/{custom.slug}</span>
                  {custom.publishedVersion && !archived ? (
                    <a href={`${STOREFRONT_URL}/pages/${custom.slug}`} target="_blank" rel="noopener noreferrer" className="ml-2 font-bold text-[#EF3C23]">
                      Open live page ↗
                    </a>
                  ) : null}
                  <span className="ml-2 text-[#9CA3AF]">Link it from Header or Footer with this address.</span>
                </div>
                {archived ? (
                  <button type="button" disabled={pageBusy} onClick={() => pageAction(() => websiteStudioApi.restorePage(custom.slug), 'Page restored as a draft — publish it to show it again.')} className="rounded-md border border-[#E2E8F0] px-2.5 py-1 font-bold" data-testid="pg-restore">
                    Restore
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={pageBusy}
                    onClick={() => {
                      if (window.confirm(`Take "${custom.title}" off the website? Its address will show "Page not found". You can restore it later.`))
                        void pageAction(() => websiteStudioApi.archivePage(custom.slug), 'Page taken off the website.');
                    }}
                    className="rounded-md border border-red-200 px-2.5 py-1 font-bold text-red-600"
                    data-testid="pg-archive"
                  >
                    Take off website
                  </button>
                )}
              </div>
              {archived ? (
                <div className="rounded-xl border border-dashed border-[#E2E8F0] bg-white px-4 py-6 text-center text-[12.5px] text-[#6B7280]">
                  This page is archived and not on the website. Restore it to edit and publish it again.
                </div>
              ) : (
                <DocumentWorkspace<Record<string, never>>
                  key={custom.docKey}
                  docKey={custom.docKey}
                  caps={caps}
                  title={custom.title}
                  description="Your own page: a top section plus blocks (text, image, cards, call to action, questions). Publishing puts it live at its address."
                  Editor={CustomPageEditor as unknown as React.ComponentType<EditorProps<Record<string, never>>>}
                  Preview={CustomPageOutline as unknown as React.ComponentType<{ value: Record<string, never> }>}
                  previewLabel="Page outline"
                  storefrontPreview
                  previewPage={`custom:${custom.slug}`}
                  onPublished={() => refresh().catch(() => undefined)}
                />
              )}
            </div>
          </div>
        );
      }
      return (
        <div className="grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)]" data-testid="ws-pages">
          {list}
          <div className="min-w-0">
            <DocumentWorkspace<Record<string, never>>
              key={page.docKey}
              docKey={page.docKey}
              caps={caps}
              title={`${page.label} page`}
              description={`Everything written on ${page.path} — headings, texts, cards, links, form labels and messages. The page keeps its design; ${
                page.group === 'legal' ? 'legal pages are published by Super Admin only.' : 'publishing updates the live page.'
              }`}
              Editor={SitePageEditor as unknown as React.ComponentType<EditorProps<Record<string, never>>>}
              Preview={SitePageOutline as unknown as React.ComponentType<{ value: Record<string, never> }>}
              previewLabel="Page outline"
              storefrontPreview
              previewPage={page.pageKey}
              onPublished={() => refresh().catch(() => undefined)}
            />
          </div>
        </div>
      );
    }
    if (tab === 'navigation')
      return (
        <DocumentWorkspace<NavigationContent>
          key="navigation"
          docKey="navigation"
          caps={caps}
          title="Header & Navigation"
          description="The announcement bar and the menu in the storefront header (desktop row and phone menu). Publishing updates every page."
          Editor={HeaderEditor}
          Preview={HeaderOutline}
          previewLabel="Header outline"
          storefrontPreview
          wide
          onPublished={() => refresh().catch(() => undefined)}
        />
      );
    if (tab === 'footer')
      return (
        <div className="space-y-6">
          <DocumentWorkspace<FooterContent>
            key="footer"
            docKey="footer"
            caps={caps}
            title="Footer"
            description="Footer text, link columns, payment methods, app badges, delivery partners and which blocks show. Publishing updates every page."
            Editor={FooterEditor}
            Preview={FooterOutline}
            previewLabel="Footer outline"
            storefrontPreview
            wide
            onPublished={() => refresh().catch(() => undefined)}
          />
          {/* Everything else in the footer, editable right here (shared with the rest of the website). */}
          <div id="ws-footer-company" className="scroll-mt-4" data-testid="ws-footer-company">
            <div className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-[#9CA3AF]">Also in the footer · addresses, support email & phone, copyright</div>
            <DocumentWorkspace<CompanySettings>
              key="footer-company"
              docKey="company"
              caps={caps}
              title="Company Settings"
              description="Office addresses, support email & phone and the copyright line shown in the footer (also used on Contact and other pages). Publish here to update them everywhere."
              Editor={CompanyEditor}
              Preview={CompanyPreview}
              onPublished={() => refresh().catch(() => undefined)}
            />
          </div>
          <div id="ws-footer-social" className="scroll-mt-4" data-testid="ws-footer-social">
            <div className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-[#9CA3AF]">Also in the footer · social icons</div>
            <DocumentWorkspace<SocialContent>
              key="footer-social"
              docKey="social"
              caps={caps}
              title="Social Links"
              description="The social network icons in the footer."
              Editor={SocialEditor}
              Preview={SocialOutline}
              previewLabel="Social links"
              wide
              onPublished={() => refresh().catch(() => undefined)}
            />
          </div>
        </div>
      );
    if (tab === 'social')
      return (
        <DocumentWorkspace<SocialContent>
          key="social"
          docKey="social"
          caps={caps}
          title="Social Links"
          description="The social network icons in the footer of every page."
          Editor={SocialEditor}
          Preview={SocialOutline}
          previewLabel="Social links"
          storefrontPreview
          wide
          onPublished={() => refresh().catch(() => undefined)}
        />
      );
    if (tab === 'company')
      return (
        <DocumentWorkspace<CompanySettings>
          key="company"
          docKey="company"
          caps={caps}
          title="Company Settings"
          description="Name, support contacts, offices, business identifiers and copyright — entered once, used across the website."
          Editor={CompanyEditor}
          Preview={CompanyPreview}
          onPublished={() => refresh().catch(() => undefined)}
        />
      );
    return (
      <DocumentWorkspace<BrandAssets>
        key="brand_assets"
        docKey="brand_assets"
        caps={caps}
        title="Brand Assets"
        description="Logos, favicon, the Emi assistant logo, the default share image and placeholder."
        Editor={BrandAssetsEditor}
        Preview={BrandAssetsPreview}
        onPublished={() => refresh().catch(() => undefined)}
      />
    );
  }, [caps, tab, docs, history, refresh, pageKey, customPages, pageBusy, pageMsg, pageAction]);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-5 md:px-6" data-testid="website-studio">
      <div className="mb-4">
        <div className="text-[15px] font-extrabold text-[#111827]">Choosify Website Studio</div>
        <div className="text-[11px] font-semibold text-[#6B7280]">Manage the public website with drafts, previews, versioned publishing and rollback.</div>
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5 border-b border-[#E8EDF2]">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            data-testid={`ws-tab-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-[12.5px] font-bold ${tab === t.key ? 'border-[#EF3C23] text-[#EF3C23]' : 'border-transparent text-[#4B5563] hover:text-[#111827]'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-semibold text-red-700">{error}</div>}
      {!caps && !error ? (
        <div className="flex items-center gap-2 py-10 text-[12px] font-bold text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        body
      )}
    </div>
  );
}
