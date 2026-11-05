/**
 * Website Studio → Pages: the storefront's information and legal pages (About, Contact, Suggest a
 * Brand, Partnership, Advertise, Terms, Privacy).
 *
 * Each page's content is the structured model the storefront already renders (headings, texts,
 * cards, steps, stats, form labels, success messages, legal sections). The editor below is built
 * from that structure, so every text on the page is editable without changing its design:
 * list items can be shown / hidden, moved up / down, added and removed.
 */
import React, { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Eye, EyeOff, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { SYSTEM_SITE_PAGES, type SystemSitePage } from '@/shared/website/sitePages';
import { CUSTOM_BLOCK_LABELS, CUSTOM_SLUG_RE, blankBlock, blankCard, blankFaq, type CustomBlockType } from '@/shared/website/customPages';
import type { CustomPageRow } from '../../../services/websiteStudioApi';
import { uploadSiteAssetImage } from '../../../services/mediaUpload';
import { LISTING_PAGES } from '@/shared/website/listingPages';

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

const HIDDEN_KEYS = new Set(['id', 'order', 'enabled']);

/** Friendlier names for the model's field names. */
const LABELS: Record<string, string> = {
  intro: 'Intro line under the heading (optional)',
  filterTitle: 'Filter panel title',
  quickSpecsTitle: 'Quick Specs box title',
  ctaStrip: 'Call-to-action strip under the list',
  show: 'Show this strip',
  hero: 'Top of the page',
  badge: 'Small label above the title',
  title: 'Title',
  description: 'Text',
  desc: 'Text',
  body: 'Text',
  sideCardTitle: 'Side card — title',
  sideCardSubtitle: 'Side card — subtitle',
  sideCardBody: 'Side card — text',
  sideCardIcon: 'Side card — icon (emoji)',
  icon: 'Icon (emoji)',
  eyebrow: 'Small label above the heading',
  heading: 'Heading',
  text: 'Text',
  imageUrl: 'Image (https:// or /media/…)',
  buttonLabel: 'Button text',
  buttonHref: 'Button link (/page, #section, mailto:, tel: or https://)',
  seoDescription: 'Search engine description',
  caption: 'Caption',
  alt: 'Image description (for screen readers)',
  question: 'Question',
  answer: 'Answer',
  items: 'Items',
  bg: 'Icon background colour',
  href: 'Link (/page, #section, mailto:, tel: or https://)',
  ctaHref: 'Button link',
  ctaLabel: 'Button text',
  cta: 'Link text',
  heroImageUrl: 'Hero image (https:// or /media/…)',
  successBodyTemplate: 'Thank-you message ({{…}} fills in the visitor’s answers)',
  successTitle: 'Thank-you heading',
  successSubtitle: 'Thank-you subheading',
  successResetLabel: '“Send another” button text',
  submitLabel: 'Send button text',
  formHeading: 'Form heading',
  formSubheading: 'Form subheading',
  fields: 'Form fields',
  label: 'Label',
  placeholder: 'Hint inside the box',
  paragraphs: 'Paragraphs',
  bullets: 'Bullet points',
  sections: 'Sections',
  indexLabel: 'Name in the contents list',
  number: 'Number',
  lastUpdatedText: '“Last updated” text',
  indexTitle: 'Contents heading',
  value: 'Value',
  step: 'Step number',
  helpBox: 'Help box',
  contactBox: 'Contact box',
  useGlobalOfficeAddress: 'Use the office address from Company Settings',
  useGlobalSupportEmail: 'Use the support email from Company Settings',
};

const LONG_TEXT = /(description|desc|body|paragraph|template|subtitle|intro|address)$/i;

export function humanize(key: string): string {
  if (LABELS[key]) return LABELS[key];
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/(\d+)/g, ' $1').trim();
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}

/** Fields that hold an image: uploaded (or, if really needed, a pasted link). */
const IMAGE_KEY = /(^image$|imageurl$)/i;

function ImageUploadField({ label, value, onChange, disabled, path }: { label: string; value: string; onChange: (v: string) => void; disabled: boolean; path: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showLink, setShowLink] = useState(false);
  const label2 = label.replace(/\s*\(.*\)\s*$/, '');
  return (
    <div data-testid={`pg-image-${path}`}>
      <label className={labelCls}>{label2}</label>
      <div className="flex items-start gap-2.5">
        {value ? (
          <img src={value} alt="" className="h-20 w-28 shrink-0 rounded-md border border-[#E2E8F0] object-cover" data-testid={`pg-image-thumb-${path}`} />
        ) : (
          <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-md border border-dashed border-[#CBD5E1] bg-[#F8FAFC] text-[10.5px] font-bold text-[#94A3B8]">No image</div>
        )}
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap gap-1.5">
            <button type="button" disabled={disabled || busy} onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1 text-[11.5px] font-bold text-[#111827] disabled:opacity-40" data-testid={`pg-image-upload-${path}`}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} {value ? 'Replace' : 'Upload image'}
            </button>
            {value ? (
              <button type="button" disabled={disabled || busy} onClick={() => onChange('')} className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1 text-[11.5px] font-bold text-red-600 disabled:opacity-40" data-testid={`pg-image-remove-${path}`}>
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            ) : null}
          </div>
          <div className="text-[10.5px] text-[#9CA3AF]">JPG, PNG or WebP · landscape works best</div>
          {showLink ? (
            <input className={inputCls} value={value} disabled={disabled} placeholder="https://… or /media/…" onChange={(e) => onChange(e.target.value)} data-testid={`pg-field-${path}`} />
          ) : (
            <button type="button" disabled={disabled} onClick={() => setShowLink(true)} className="w-fit text-[10.5px] font-bold text-[#6B7280] underline disabled:opacity-40">
              Paste a link instead
            </button>
          )}
          {err ? <div className="text-[11px] font-semibold text-red-600">{err}</div> : null}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        className="hidden"
        data-testid={`pg-image-file-${path}`}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setBusy(true);
          setErr(null);
          try {
            onChange(await uploadSiteAssetImage(file));
          } catch (x) {
            setErr(x instanceof Error ? x.message : 'Upload failed');
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

const inputCls = 'w-full rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[12.5px] text-[#111827] outline-none focus:border-[#EF3C23] disabled:bg-slate-50';
const labelCls = 'mb-1 block text-[10.5px] font-extrabold uppercase tracking-wide text-[#6B7280]';

/** A blank copy of a list item (same shape, empty texts, new id) for "Add". */
function blankLike(sample: Json): Json {
  if (typeof sample === 'string') return '';
  if (typeof sample === 'number') return 0;
  if (typeof sample === 'boolean') return sample;
  if (Array.isArray(sample)) return [];
  if (sample && typeof sample === 'object') {
    const out: Obj = {};
    for (const [k, v] of Object.entries(sample)) {
      if (k === 'id') out[k] = `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      else if (k === 'enabled') out[k] = true;
      else if (k === 'bg' || k === 'icon') out[k] = v;
      else out[k] = blankLike(v);
    }
    return out;
  }
  return null;
}

/** Keep `order` in step with the list position (the storefront sorts by it). */
function withOrder(list: Json[]): Json[] {
  return list.map((x, i) => (x && typeof x === 'object' && !Array.isArray(x) && 'order' in x ? { ...x, order: i } : x));
}

function titleOf(item: Json, i: number): string {
  if (item && typeof item === 'object' && !Array.isArray(item)) {
    const o = item as Obj;
    const t = o.title || o.label || o.indexLabel || o.step || o.value;
    if (typeof t === 'string' && t.trim()) return t;
  }
  if (typeof item === 'string' && item.trim()) return item.length > 60 ? `${item.slice(0, 60)}…` : item;
  return `Item ${i + 1}`;
}

function ValueField({ k, value, onChange, disabled, path }: { k: string; value: Json; onChange: (v: Json) => void; disabled: boolean; path: string }) {
  if (typeof value === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-[12px] font-semibold text-[#374151]">
        <input type="checkbox" checked={value} disabled={disabled} onChange={(e) => onChange(e.target.checked)} data-testid={`pg-field-${path}`} />
        {humanize(k)}
      </label>
    );
  }
  if (typeof value === 'number') {
    return (
      <div>
        <label className={labelCls}>{humanize(k)}</label>
        <input type="number" className={inputCls} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} data-testid={`pg-field-${path}`} />
      </div>
    );
  }
  if (typeof value === 'string') {
    if (k === 'bg') {
      return (
        <div>
          <label className={labelCls}>{humanize(k)}</label>
          <div className="flex items-center gap-2">
            <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#FFF3EA'} disabled={disabled} onChange={(e) => onChange(e.target.value.toUpperCase())} className="h-8 w-10 rounded border border-[#E2E8F0]" />
            <input className={inputCls} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
          </div>
        </div>
      );
    }
    if (IMAGE_KEY.test(k)) return <ImageUploadField label={humanize(k)} value={value} disabled={disabled} onChange={onChange} path={path} />;
    const long = LONG_TEXT.test(k) || value.length > 90;
    return (
      <div>
        <label className={labelCls}>{humanize(k)}</label>
        {long ? (
          <textarea className={inputCls} rows={Math.min(8, Math.max(2, Math.ceil(value.length / 90)))} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} data-testid={`pg-field-${path}`} />
        ) : (
          <input className={inputCls} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} data-testid={`pg-field-${path}`} />
        )}
      </div>
    );
  }
  if (Array.isArray(value)) return <ListField k={k} list={value} onChange={onChange} disabled={disabled} path={path} />;
  if (value && typeof value === 'object') return <GroupField k={k} obj={value as Obj} onChange={onChange} disabled={disabled} path={path} />;
  return null;
}

export function ObjectFields({ obj, onChange, disabled, path }: { obj: Obj; onChange: (v: Obj) => void; disabled: boolean; path: string }) {
  const entries = Object.entries(obj).filter(([k]) => !HIDDEN_KEYS.has(k));
  const simple = entries.filter(([, v]) => v === null || typeof v !== 'object');
  const nested = entries.filter(([, v]) => v !== null && typeof v === 'object');
  return (
    <div className="space-y-2.5">
      {simple.length ? (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {simple.map(([k, v]) => (
            <div key={k} className={typeof v === 'string' && (LONG_TEXT.test(k) || v.length > 90) ? 'sm:col-span-2' : ''}>
              <ValueField k={k} value={v} disabled={disabled} path={`${path}.${k}`} onChange={(nv) => onChange({ ...obj, [k]: nv })} />
            </div>
          ))}
        </div>
      ) : null}
      {nested.map(([k, v]) => (
        <ValueField key={k} k={k} value={v} disabled={disabled} path={`${path}.${k}`} onChange={(nv) => onChange({ ...obj, [k]: nv })} />
      ))}
    </div>
  );
}

function GroupField({ k, obj, onChange, disabled, path }: { k: string; obj: Obj; onChange: (v: Json) => void; disabled: boolean; path: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-lg border border-[#E8EDF2] bg-[#FAFBFC]">
      <button type="button" onClick={() => setOpen((x) => !x)} className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-[12px] font-extrabold text-[#111827]">
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />} {humanize(k)}
      </button>
      {open ? (
        <div className="border-t border-[#E8EDF2] px-3 py-2.5">
          <ObjectFields obj={obj} onChange={onChange as (v: Obj) => void} disabled={disabled} path={path} />
        </div>
      ) : null}
    </div>
  );
}

function ListField({ k, list, onChange, disabled, path }: { k: string; list: Json[]; onChange: (v: Json) => void; disabled: boolean; path: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const set = (next: Json[]) => onChange(withOrder(next));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    set(next);
    setOpen(open === i ? j : open);
  };
  const strings = list.every((x) => typeof x === 'string');
  return (
    <div className="rounded-lg border border-[#E8EDF2] bg-[#FAFBFC]" data-testid={`pg-list-${path}`}>
      <div className="flex items-center justify-between px-3 py-2">
        <div className="text-[12px] font-extrabold text-[#111827]">
          {humanize(k)} <span className="font-semibold text-[#9CA3AF]">· {list.length}</span>
        </div>
        <button
          type="button"
          disabled={disabled || (!strings && list.length === 0)}
          onClick={() => {
            set([...list, strings ? '' : blankLike(list[0])]);
            setOpen(list.length);
          }}
          className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-white px-2 py-1 text-[11px] font-bold text-[#111827] disabled:opacity-40"
          data-testid={`pg-add-${path}`}
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>
      <div className="space-y-1.5 border-t border-[#E8EDF2] p-2">
        {list.map((item, i) => {
          const o = item && typeof item === 'object' && !Array.isArray(item) ? (item as Obj) : null;
          const hidden = o?.enabled === false;
          const controls = (
            <div className="flex shrink-0 items-center gap-0.5">
              {o && 'enabled' in o ? (
                <button type="button" disabled={disabled} title={hidden ? 'Hidden — click to show' : 'Shown — click to hide'} onClick={() => set(list.map((x, j) => (j === i ? { ...(x as Obj), enabled: hidden } : x)))} className="rounded p-1 text-[#6B7280] hover:bg-slate-100">
                  {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              ) : null}
              <button type="button" disabled={disabled || i === 0} onClick={() => move(i, -1)} className="rounded p-1 text-[#6B7280] hover:bg-slate-100 disabled:opacity-30" aria-label="Move up">
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button type="button" disabled={disabled || i === list.length - 1} onClick={() => move(i, 1)} className="rounded p-1 text-[#6B7280] hover:bg-slate-100 disabled:opacity-30" aria-label="Move down">
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <button type="button" disabled={disabled} onClick={() => set(list.filter((_, j) => j !== i))} className="rounded p-1 text-red-500 hover:bg-red-50" aria-label="Remove">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
          if (typeof item === 'string') {
            return (
              <div key={i} className="flex items-start gap-1.5">
                <textarea className={inputCls} rows={Math.min(6, Math.max(1, Math.ceil(item.length / 90)))} value={item} disabled={disabled} onChange={(e) => set(list.map((x, j) => (j === i ? e.target.value : x)))} />
                {controls}
              </div>
            );
          }
          return (
            <div key={(o?.id as string) || i} className={`rounded-md border bg-white ${hidden ? 'border-dashed border-slate-300 opacity-60' : 'border-[#E8EDF2]'}`}>
              <div className="flex items-center gap-1.5 px-2 py-1.5">
                <button type="button" onClick={() => setOpen(open === i ? null : i)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[12px] font-bold text-[#111827]">
                  {open === i ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                  {o && typeof o.icon === 'string' && o.icon ? <span>{o.icon}</span> : null}
                  <span className="truncate">{titleOf(item, i)}</span>
                  {hidden ? <span className="shrink-0 rounded bg-slate-100 px-1 text-[9.5px] font-extrabold uppercase text-slate-500">Hidden</span> : null}
                </button>
                {controls}
              </div>
              {open === i && o ? (
                <div className="border-t border-[#F1F3F5] px-2.5 py-2.5">
                  <ObjectFields obj={o} disabled={disabled} path={`${path}[${i}]`} onChange={(nv) => set(list.map((x, j) => (j === i ? nv : x)))} />
                </div>
              ) : null}
            </div>
          );
        })}
        {list.length === 0 ? <div className="px-1 py-1 text-[11px] text-[#9CA3AF]">Nothing here yet.</div> : null}
      </div>
    </div>
  );
}

/** Editor for one page document (DocumentWorkspace Editor contract). */
export function SitePageEditor({ value, onChange, disabled }: { value: Obj; onChange: (next: Obj) => void; disabled: boolean }) {
  return (
    <div className="space-y-3" data-testid="pg-editor">
      <ObjectFields obj={value} onChange={onChange} disabled={disabled} path="page" />
    </div>
  );
}

/** Outline of a storefront listing page's words. */
export function ListingPageOutline({ value }: { value: Obj }) {
  const cta = (value?.ctaStrip || {}) as Obj;
  return (
    <div className="space-y-1.5 text-[11.5px]" data-testid="lp-outline">
      {value?.eyebrow ? <div className="rounded-md bg-[#F4F7F9] px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-[#6B7280]">{String(value.eyebrow)}</div> : null}
      <div className="rounded-md border border-[#E8EDF2] bg-white px-2.5 py-1.5 text-[#374151]">{value?.intro ? String(value.intro) : <span className="text-[#9CA3AF]">No intro line</span>}</div>
      {value?.filterTitle ? <div className="rounded-md border border-[#E8EDF2] bg-white px-2.5 py-1.5 font-semibold text-[#374151]">Filters: {String(value.filterTitle)}</div> : null}
      <div className="rounded-md border border-[#E8EDF2] bg-white px-2.5 py-1.5 font-semibold text-[#374151]">
        Call-to-action strip: {cta.show ? `${String(cta.heading || '')} → ${String(cta.buttonLabel || '')}` : 'hidden'}
      </div>
    </div>
  );
}

/** Short outline of a page (version history "View" + side preview). */
export function SitePageOutline({ value }: { value: Obj }) {
  const hero = (value?.hero || {}) as Obj;
  const heading = (hero.title || value?.heroTitleLine1 || '') as string;
  const lists = Object.entries(value || {}).filter(([, v]) => Array.isArray(v));
  return (
    <div className="space-y-1.5 text-[11.5px]" data-testid="pg-outline">
      <div className="rounded-md bg-[#F4F7F9] px-2.5 py-2 font-extrabold text-[#111827]">{heading || 'Page'}</div>
      {lists.map(([k, v]) => (
        <div key={k} className="rounded-md border border-[#E8EDF2] bg-white px-2.5 py-1.5 font-semibold text-[#374151]">
          {humanize(k)} · {(v as Json[]).filter((x) => !(x && typeof x === 'object' && (x as Obj).enabled === false)).length} shown
        </div>
      ))}
    </div>
  );
}

type Obj2 = Record<string, unknown>;

/** Editor for "your own pages": page settings, top section, and an ordered list of blocks. */
export function CustomPageEditor({ value, onChange, disabled }: { value: Obj2; onChange: (next: Obj2) => void; disabled: boolean }) {
  const blocks = (Array.isArray(value.blocks) ? value.blocks : []) as Obj2[];
  const [open, setOpen] = useState<string | null>(null);
  const setBlocks = (next: Obj2[]) => onChange({ ...value, blocks: next });
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    setBlocks(next);
  };
  const add = (type: CustomBlockType) => {
    const b = blankBlock(type) as unknown as Obj2;
    setBlocks([...blocks, b]);
    setOpen(String(b.id));
  };
  return (
    <div className="space-y-3" data-testid="cp-editor">
      <div className="rounded-lg border border-[#E8EDF2] bg-[#FAFBFC] px-3 py-2.5">
        <div className="mb-2 text-[12px] font-extrabold text-[#111827]">Page</div>
        <ObjectFields obj={{ title: value.title ?? '', seoDescription: value.seoDescription ?? '' } as never} disabled={disabled} path="cp" onChange={(nv) => onChange({ ...value, ...(nv as Obj2) })} />
      </div>
      <div className="rounded-lg border border-[#E8EDF2] bg-[#FAFBFC] px-3 py-2.5" data-testid="cp-hero-fields">
        <div className="mb-2 text-[12px] font-extrabold text-[#111827]">Top of the page</div>
        <ObjectFields obj={(value.hero || {}) as never} disabled={disabled} path="cp.hero" onChange={(nv) => onChange({ ...value, hero: nv })} />
      </div>
      <div className="rounded-lg border border-[#E8EDF2] bg-[#FAFBFC]">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <div className="text-[12px] font-extrabold text-[#111827]">
            Blocks <span className="font-semibold text-[#9CA3AF]">· top to bottom</span>
          </div>
          <div className="flex flex-wrap gap-1" data-testid="cp-add-block">
            {(Object.keys(CUSTOM_BLOCK_LABELS) as CustomBlockType[]).map((t) => (
              <button key={t} type="button" disabled={disabled} onClick={() => add(t)} className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-white px-2 py-1 text-[11px] font-bold text-[#111827] disabled:opacity-40" data-testid={`cp-add-${t}`}>
                <Plus className="h-3 w-3" /> {CUSTOM_BLOCK_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5 border-t border-[#E8EDF2] p-2">
          {blocks.map((b, i) => {
            const hidden = b.enabled === false;
            const bid = String(b.id);
            const type = String(b.type) as CustomBlockType;
            const label = (b.heading as string) || (b.caption as string) || (b.buttonLabel as string) || CUSTOM_BLOCK_LABELS[type];
            const { id: _id, type: _t, enabled: _e, items, ...fields } = b;
            void _id;
            void _t;
            void _e;
            return (
              <div key={bid} className={`rounded-md border bg-white ${hidden ? 'border-dashed border-slate-300 opacity-60' : 'border-[#E8EDF2]'}`} data-testid={`cp-block-${type}`}>
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  <button type="button" onClick={() => setOpen(open === bid ? null : bid)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[12px] font-bold text-[#111827]">
                    {open === bid ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                    <span className="shrink-0 rounded bg-[#EEF2FF] px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase text-[#3730A3]">{CUSTOM_BLOCK_LABELS[type]}</span>
                    <span className="truncate">{label}</span>
                    {hidden ? <span className="shrink-0 rounded bg-slate-100 px-1 text-[9.5px] font-extrabold uppercase text-slate-500">Hidden</span> : null}
                  </button>
                  <button type="button" disabled={disabled} title={hidden ? 'Hidden — click to show' : 'Shown — click to hide'} onClick={() => setBlocks(blocks.map((x, j) => (j === i ? { ...x, enabled: hidden } : x)))} className="rounded p-1 text-[#6B7280] hover:bg-slate-100">
                    {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" disabled={disabled || i === 0} onClick={() => move(i, -1)} className="rounded p-1 text-[#6B7280] hover:bg-slate-100 disabled:opacity-30" aria-label="Move up">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" disabled={disabled || i === blocks.length - 1} onClick={() => move(i, 1)} className="rounded p-1 text-[#6B7280] hover:bg-slate-100 disabled:opacity-30" aria-label="Move down">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" disabled={disabled} onClick={() => setBlocks(blocks.filter((_, j) => j !== i))} className="rounded p-1 text-red-500 hover:bg-red-50" aria-label="Remove block">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {open === bid ? (
                  <div className="space-y-2.5 border-t border-[#F1F3F5] px-2.5 py-2.5">
                    <ObjectFields obj={fields as never} disabled={disabled} path={`cp.blocks[${i}]`} onChange={(nv) => setBlocks(blocks.map((x, j) => (j === i ? { ...x, ...(nv as Obj2) } : x)))} />
                    {Array.isArray(items) ? (
                      <ListFieldTyped
                        label={type === 'faq' ? 'Questions' : 'Cards'}
                        list={items as Obj2[]}
                        disabled={disabled}
                        path={`cp.blocks[${i}].items`}
                        blank={() => (type === 'faq' ? blankFaq() : blankCard()) as unknown as Obj2}
                        onChange={(next) => setBlocks(blocks.map((x, j) => (j === i ? { ...x, items: next } : x)))}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
          {blocks.length === 0 ? <div className="px-1 py-1 text-[11px] text-[#9CA3AF]">No blocks yet — add one above.</div> : null}
        </div>
      </div>
    </div>
  );
}

/** Right-hand outline of a custom page. */
export function CustomPageOutline({ value }: { value: Obj2 }) {
  const hero = (value.hero || {}) as Obj2;
  const blocks = (Array.isArray(value.blocks) ? value.blocks : []) as Obj2[];
  return (
    <div className="space-y-1.5 text-[12px]" data-testid="cp-outline">
      <div className="rounded-md border border-[#E8EDF2] bg-white px-2.5 py-2">
        <div className="text-[10px] font-extrabold uppercase text-[#9CA3AF]">Top</div>
        <div className="font-bold text-[#111827]">{String(hero.heading || value.title || 'Untitled')}</div>
      </div>
      {blocks.map((b) => (
        <div key={String(b.id)} className={`rounded-md border border-[#E8EDF2] bg-white px-2.5 py-2 ${b.enabled === false ? 'opacity-50' : ''}`}>
          <div className="text-[10px] font-extrabold uppercase text-[#9CA3AF]">
            {CUSTOM_BLOCK_LABELS[String(b.type) as CustomBlockType] || String(b.type)}
            {b.enabled === false ? ' · hidden' : ''}
          </div>
          <div className="truncate text-[#374151]">{String(b.heading || b.caption || b.buttonLabel || '—')}</div>
        </div>
      ))}
    </div>
  );
}

/** A list whose "Add" makes a known blank item (cards / questions). */
function ListFieldTyped({ label, list, onChange, disabled, path, blank }: { label: string; list: Obj2[]; onChange: (v: Obj2[]) => void; disabled: boolean; path: string; blank: () => Obj2 }) {
  return (
    <div>
      <ListField k={label} list={list as never} onChange={(v) => onChange(v as unknown as Obj2[])} disabled={disabled} path={path} />
      <button type="button" disabled={disabled} onClick={() => onChange([...list, blank()])} className="mt-1 inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-white px-2 py-1 text-[11px] font-bold" data-testid={`cp-add-item-${path}`}>
        <Plus className="h-3 w-3" /> Add {label === 'Questions' ? 'question' : 'card'}
      </button>
    </div>
  );
}

/** "+ New page" form for the Pages tab. */
export function NewPageForm({ onCreate, busy }: { onCreate: (slug: string, title: string) => void; busy: boolean }) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [touched, setTouched] = useState(false);
  const auto = title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  const finalSlug = touched ? slug : auto;
  const ok = title.trim().length >= 2 && CUSTOM_SLUG_RE.test(finalSlug);
  return (
    <div className="space-y-1.5 rounded-lg border border-[#E2E8F0] bg-white p-2" data-testid="pg-new-form">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Page title" className="w-full rounded border border-[#E2E8F0] px-2 py-1 text-[12px]" data-testid="pg-new-title" />
      <div className="flex items-center gap-1 text-[11px] text-[#6B7280]">
        /pages/
        <input
          value={finalSlug}
          onChange={(e) => {
            setTouched(true);
            setSlug(e.target.value.toLowerCase());
          }}
          className="min-w-0 flex-1 rounded border border-[#E2E8F0] px-1.5 py-0.5 text-[11px]"
          data-testid="pg-new-slug"
        />
      </div>
      <button type="button" disabled={!ok || busy} onClick={() => onCreate(finalSlug, title.trim())} className="w-full rounded-md bg-[#EF3C23] px-2 py-1.5 text-[11.5px] font-extrabold text-white disabled:opacity-40" data-testid="pg-new-create">
        Create page
      </button>
    </div>
  );
}

/** Left-hand page list of the Pages tab. */
export function PageList({
  selected,
  onSelect,
  publishedKeys,
  customPages = [],
  onNewPage,
  creating = false,
}: {
  selected: string;
  onSelect: (docKey: string) => void;
  publishedKeys: Set<string>;
  customPages?: CustomPageRow[];
  onNewPage?: (slug: string, title: string) => void;
  creating?: boolean;
}) {
  const [showNew, setShowNew] = useState(false);
  const group = (g: SystemSitePage['group'], title: string, note?: string) => (
    <div>
      <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-[#9CA3AF]">{title}</div>
      {note ? <div className="mb-1.5 text-[10.5px] text-[#9CA3AF]">{note}</div> : null}
      <div className="space-y-1">
        {SYSTEM_SITE_PAGES.filter((p) => p.group === g).map((p) => (
          <button
            key={p.docKey}
            type="button"
            onClick={() => onSelect(p.docKey)}
            data-testid={`pg-page-${p.pageKey}`}
            className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[12.5px] font-bold ${selected === p.docKey ? 'bg-[#FFF4EE] text-[#EF3C23]' : 'text-[#374151] hover:bg-[#F9FAFB]'}`}
          >
            <span className="min-w-0">
              <span className="block truncate">{p.label}</span>
              <span className="block truncate text-[10px] font-semibold text-[#9CA3AF]">{p.path}</span>
            </span>
            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${publishedKeys.has(p.docKey) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              {publishedKeys.has(p.docKey) ? 'Live' : 'Built-in'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <div className="space-y-4" data-testid="pg-list">
      {group('info', 'Information pages')}
      {group('legal', 'Legal pages', 'Drafts for everyone; only Super Admin can publish.')}
      <div>
        <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-[#9CA3AF]">Storefront pages</div>
        <div className="mb-1.5 text-[10.5px] text-[#9CA3AF]">Labels, intro line and a call-to-action strip. Lists, filters and tabs stay automatic.</div>
        <div className="space-y-1">
          {LISTING_PAGES.map((p) => (
            <button
              key={p.docKey}
              type="button"
              onClick={() => onSelect(p.docKey)}
              data-testid={`pg-listing-${p.key}`}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[12.5px] font-bold ${selected === p.docKey ? 'bg-[#FFF4EE] text-[#EF3C23]' : 'text-[#374151] hover:bg-[#F9FAFB]'}`}
            >
              <span className="min-w-0">
                <span className="block truncate">{p.label}</span>
                <span className="block truncate text-[10px] font-semibold text-[#9CA3AF]">{p.path}</span>
              </span>
              <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${publishedKeys.has(p.docKey) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {publishedKeys.has(p.docKey) ? 'Live' : 'Built-in'}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <div className="text-[10.5px] font-extrabold uppercase tracking-wide text-[#9CA3AF]">Your own pages</div>
          {onNewPage ? (
            <button type="button" onClick={() => setShowNew((x) => !x)} className="inline-flex items-center gap-0.5 text-[11px] font-extrabold text-[#EF3C23]" data-testid="pg-new">
              <Plus className="h-3 w-3" /> New page
            </button>
          ) : null}
        </div>
        {showNew && onNewPage ? <NewPageForm busy={creating} onCreate={(slug, title) => onNewPage(slug, title)} /> : null}
        <div className="mt-1 space-y-1">
          {customPages.map((p) => (
            <button
              key={p.docKey}
              type="button"
              onClick={() => onSelect(p.docKey)}
              data-testid={`pg-custom-${p.slug}`}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[12.5px] font-bold ${selected === p.docKey ? 'bg-[#FFF4EE] text-[#EF3C23]' : 'text-[#374151] hover:bg-[#F9FAFB]'}`}
            >
              <span className="min-w-0">
                <span className="block truncate">{p.title}</span>
                <span className="block truncate text-[10px] font-semibold text-[#9CA3AF]">/pages/{p.slug}</span>
              </span>
              <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${p.status === 'archived' ? 'bg-slate-100 text-slate-500' : p.publishedVersion ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {p.status === 'archived' ? 'Archived' : p.publishedVersion ? 'Live' : 'Draft'}
              </span>
            </button>
          ))}
          {customPages.length === 0 && !showNew ? (
            <div className="rounded-lg border border-dashed border-[#E2E8F0] px-3 py-2 text-[11px] text-[#9CA3AF]">
              No pages yet. Create one, publish it, then link it from the menu or footer (/pages/…).
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
