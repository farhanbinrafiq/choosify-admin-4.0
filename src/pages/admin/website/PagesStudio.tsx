/**
 * Website Studio → Pages: the storefront's information and legal pages (About, Contact, Suggest a
 * Brand, Partnership, Advertise, Terms, Privacy).
 *
 * Each page's content is the structured model the storefront already renders (headings, texts,
 * cards, steps, stats, form labels, success messages, legal sections). The editor below is built
 * from that structure, so every text on the page is editable without changing its design:
 * list items can be shown / hidden, moved up / down, added and removed.
 */
import React, { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { SYSTEM_SITE_PAGES, type SystemSitePage } from '@/shared/website/sitePages';

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

const HIDDEN_KEYS = new Set(['id', 'order', 'enabled']);

/** Friendlier names for the model's field names. */
const LABELS: Record<string, string> = {
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
    const long = LONG_TEXT.test(k) || value.length > 90;
    return (
      <div>
        <label className={labelCls}>{humanize(k)}</label>
        {long ? (
          <textarea className={inputCls} rows={Math.min(8, Math.max(2, Math.ceil(value.length / 90)))} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} data-testid={`pg-field-${path}`} />
        ) : (
          <input className={inputCls} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} data-testid={`pg-field-${path}`} />
        )}
        {/url$/i.test(k) && value ? <img src={value} alt="" className="mt-1.5 h-16 rounded-md border border-[#E2E8F0] object-cover" /> : null}
      </div>
    );
  }
  if (Array.isArray(value)) return <ListField k={k} list={value} onChange={onChange} disabled={disabled} path={path} />;
  if (value && typeof value === 'object') return <GroupField k={k} obj={value as Obj} onChange={onChange} disabled={disabled} path={path} />;
  return null;
}

function ObjectFields({ obj, onChange, disabled, path }: { obj: Obj; onChange: (v: Obj) => void; disabled: boolean; path: string }) {
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

/** Left-hand page list of the Pages tab. */
export function PageList({ selected, onSelect, publishedKeys }: { selected: string; onSelect: (docKey: string) => void; publishedKeys: Set<string> }) {
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
        <div className="rounded-lg border border-dashed border-[#E2E8F0] px-3 py-2 text-[11px] text-[#9CA3AF]">
          Categories, Products & Services, Brands, Recommendations, Deals, Creators, Compare — coming next.
        </div>
      </div>
      <div>
        <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-[#9CA3AF]">Your own pages</div>
        <div className="rounded-lg border border-dashed border-[#E2E8F0] px-3 py-2 text-[11px] text-[#9CA3AF]">
          Create new pages and link them from the menu or footer — coming next.
        </div>
      </div>
    </div>
  );
}
