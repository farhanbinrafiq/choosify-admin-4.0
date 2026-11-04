/**
 * Website Studio — Header & Navigation (Phase 3). Storefront mirror of the real header: the orange
 * announcement bar, the dark top bar, the desktop menu row and the phone menu drawer. Click any
 * part to edit it in the inspector. The server validates every link against the real storefront
 * pages (reserved staff/checkout/preview routes refused) and keeps a visible Home link.
 */
import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, Menu, Monitor, Plus, Search, ShoppingCart, Smartphone, Trash2, User } from 'lucide-react';
import { Field, LinkInput, MirrorBlock, MirrorLayout, STOREFRONT, Toggle, iconBtn, inputCls, smallBtn } from './StudioKit';
import { NAV_LIMITS, isExternal, moveIn, nextId, type NavigationContent, type NavItem } from './siteModel';

type Sel = { kind: 'announcement' } | { kind: 'item'; id: string } | null;

function Wordmark() {
  return (
    <span className="inline-flex items-center gap-1 text-[18px] font-extrabold tracking-tight" style={{ color: '#FFFFFF' }}>
      <span className="inline-flex gap-0.5">
        <span className="inline-block h-4 w-4 rounded-full border-[3px]" style={{ borderColor: STOREFRONT.orange }} />
        <span className="inline-block h-4 w-4 rounded-full border-[3px]" style={{ borderColor: STOREFRONT.orange }} />
      </span>
      choosify
    </span>
  );
}

export function HeaderEditor({ value, onChange, disabled }: { value: NavigationContent; onChange: (v: NavigationContent) => void; disabled: boolean }) {
  const [sel, setSel] = useState<Sel>(null);
  const v = value;
  const set = (patch: Partial<NavigationContent>) => onChange({ ...v, ...patch });
  const setItem = (id: string, patch: Partial<NavItem>) => set({ items: v.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
  const desktop = v.items.filter((i) => i.showOnDesktop);
  const mobile = v.items.filter((i) => i.showOnMobile);
  const selectedItem = sel?.kind === 'item' ? v.items.find((i) => i.id === sel.id) : undefined;

  const addItem = () => {
    const id = nextId('new-link', v.items.map((i) => i.id));
    set({ items: [...v.items, { id, label: 'New link', url: '/deals', external: false, showOnDesktop: true, showOnMobile: true }] });
    setSel({ kind: 'item', id });
  };

  const mirror = (
    <div onClick={() => setSel(null)} className="pb-4">
      {/* Announcement bar */}
      <MirrorBlock selected={sel?.kind === 'announcement'} onSelect={() => setSel({ kind: 'announcement' })} label="Announcement bar" testId="ws-hd-announcement" muted={!v.announcement.enabled}>
        {v.announcement.enabled && v.announcement.text ? (
          <div className="py-1.5 text-center text-[11px] font-semibold" style={{ background: STOREFRONT.orange, color: '#FFFFFF' }}>
            {v.announcement.text}
          </div>
        ) : (
          <div className="border-b border-dashed border-slate-300 bg-white py-1.5 text-center text-[11px] font-semibold text-slate-400">Announcement bar is off — click to add one</div>
        )}
      </MirrorBlock>

      {/* Top bar + desktop menu row */}
      <div style={{ background: STOREFRONT.header }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <Wordmark />
          <div className="mx-2 flex h-8 flex-1 items-center gap-2 rounded-full bg-white px-3 text-[11px] text-slate-400">
            <Search className="h-3.5 w-3.5" /> Search Products, Brands, Reviews…
          </div>
          <ShoppingCart className="h-4 w-4" style={{ color: '#FFFFFF' }} />
          <User className="h-4 w-4" style={{ color: '#FFFFFF' }} />
        </div>
        <div className="flex flex-wrap items-center gap-1 border-t px-3 py-2" style={{ borderColor: 'rgba(255,255,255,.08)' }} data-testid="ws-hd-desktop-row">
          <Monitor className="mr-1 h-3.5 w-3.5" style={{ color: 'rgba(255,255,255,.5)' }} />
          {desktop.map((i) => (
            <MirrorBlock key={i.id} selected={sel?.kind === 'item' && sel.id === i.id} onSelect={() => setSel({ kind: 'item', id: i.id })} label="Menu item" testId={`ws-hd-item-${i.id}`} className="rounded-md">
              <span className="inline-flex items-center gap-1 px-2 py-1 text-[12px] font-semibold" style={{ color: '#FFFFFF' }}>
                {i.label}
                {i.external && <ExternalLink className="h-3 w-3" />}
              </span>
            </MirrorBlock>
          ))}
          <button type="button" className="ml-1 inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-1 text-[11px] font-bold disabled:opacity-40" style={{ borderColor: 'rgba(255,255,255,.35)', color: 'rgba(255,255,255,.8)' }} disabled={disabled || v.items.length >= NAV_LIMITS.items} data-testid="ws-hd-add" onClick={(e) => { e.stopPropagation(); addItem(); }}>
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
      </div>

      {/* Phone menu drawer */}
      <div className="mt-4 flex flex-wrap gap-4 px-4">
        <div className="w-[230px] overflow-hidden rounded-2xl border border-[#E8EDF2] bg-white shadow-sm" data-testid="ws-hd-mobile">
          <div className="flex items-center gap-2 px-3 py-2" style={{ background: STOREFRONT.header }}>
            <Menu className="h-4 w-4" style={{ color: '#FFFFFF' }} />
            <Wordmark />
          </div>
          <div className="p-3">
            <div className="mb-1.5 flex items-center gap-1 text-[10px] font-bold text-slate-400">
              <Smartphone className="h-3 w-3" /> PHONE MENU · Sections
            </div>
            {mobile.map((i) => (
              <MirrorBlock key={i.id} selected={sel?.kind === 'item' && sel.id === i.id} onSelect={() => setSel({ kind: 'item', id: i.id })} label="Menu item" testId={`ws-hd-mobile-item-${i.id}`} className="rounded-md">
                <div className="px-2 py-1.5 text-[12px] font-semibold text-[#1A1A2E]">{i.label}</div>
              </MirrorBlock>
            ))}
          </div>
        </div>
        <div className="min-w-[200px] flex-1 text-[11.5px] text-slate-500">
          <div className="font-bold text-[#111827]">How the menu works</div>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>The same items show in the desktop menu row and the phone menu; switch either off per item.</li>
            <li>Links must open a real storefront page (or an https:// site). Staff, checkout and preview pages can’t be linked.</li>
            <li>“Home” always stays visible. Max {NAV_LIMITS.items} items. The menu is one level (no dropdowns) — that is how the storefront header works.</li>
          </ul>
        </div>
      </div>
    </div>
  );

  let inspector: React.ReactNode = null;
  let title = '';
  if (sel?.kind === 'announcement') {
    title = 'Announcement bar';
    inspector = (
      <div className="space-y-3" data-testid="ws-hd-announcement-form">
        <Toggle checked={v.announcement.enabled} disabled={disabled} label="Show the bar above the header" testId="ws-hd-announcement-on" onChange={(on) => set({ announcement: { ...v.announcement, enabled: on } })} />
        <Field label={`Text (max ${NAV_LIMITS.announcement})`}>
          <input className={inputCls} value={v.announcement.text} maxLength={NAV_LIMITS.announcement} disabled={disabled} data-testid="ws-hd-announcement-text" placeholder="e.g. Free delivery on Eid orders over ৳2,000" onChange={(e) => set({ announcement: { ...v.announcement, text: e.target.value } })} />
        </Field>
        <Field label="Link (optional)" hint="The whole bar becomes a link.">
          <LinkInput value={v.announcement.linkUrl} disabled={disabled} testId="ws-hd-announcement-link" onChange={(url) => set({ announcement: { ...v.announcement, linkUrl: url } })} />
        </Field>
      </div>
    );
  } else if (selectedItem) {
    const i = selectedItem;
    const idx = v.items.findIndex((x) => x.id === i.id);
    const isHome = i.url === '/' && v.items.filter((x) => x.url === '/').length === 1;
    title = `Menu item — ${i.label || 'untitled'}`;
    inspector = (
      <div className="space-y-3" data-testid="ws-hd-item-form">
        <Field label={`Label (max ${NAV_LIMITS.label})`}>
          <input className={inputCls} value={i.label} maxLength={NAV_LIMITS.label} disabled={disabled} data-testid="ws-hd-item-label" onChange={(e) => setItem(i.id, { label: e.target.value })} />
        </Field>
        <Field label="Opens" hint={isExternal(i.url) ? 'External site — opens in a new tab.' : 'A storefront page.'}>
          <LinkInput value={i.url} disabled={disabled || isHome} testId="ws-hd-item-url" onChange={(url) => setItem(i.id, { url, external: isExternal(url) })} />
        </Field>
        <div className="flex flex-wrap gap-4">
          <Toggle checked={i.showOnDesktop} disabled={disabled || isHome} label="Desktop menu" testId="ws-hd-item-desktop" onChange={(on) => setItem(i.id, { showOnDesktop: on })} />
          <Toggle checked={i.showOnMobile} disabled={disabled || isHome} label="Phone menu" testId="ws-hd-item-mobile" onChange={(on) => setItem(i.id, { showOnMobile: on })} />
        </div>
        {isHome && <div className="text-[11px] text-slate-500">Home always links to / and stays visible.</div>}
        <div className="flex flex-wrap gap-2 border-t border-[#F1F3F5] pt-3">
          <button type="button" className={iconBtn} disabled={disabled || idx === 0} aria-label="Move left" data-testid="ws-hd-item-left" onClick={() => set({ items: moveIn(v.items, idx, -1) })}>
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <button type="button" className={iconBtn} disabled={disabled || idx === v.items.length - 1} aria-label="Move right" data-testid="ws-hd-item-right" onClick={() => set({ items: moveIn(v.items, idx, 1) })}>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button type="button" className={smallBtn} disabled={disabled || isHome} data-testid="ws-hd-item-delete" onClick={() => { set({ items: v.items.filter((x) => x.id !== i.id) }); setSel(null); }}>
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="ws-header-editor">
      <MirrorLayout mirror={mirror} inspector={inspector} inspectorTitle={title} />
    </div>
  );
}

/** Compact outline for version history "View". */
export function HeaderOutline({ value }: { value: NavigationContent }) {
  return (
    <div className="space-y-2 text-[11.5px]">
      <div className="rounded-md px-2 py-1 font-semibold" style={value.announcement.enabled ? { background: STOREFRONT.orange, color: '#FFFFFF' } : { border: '1px dashed #CBD5E1', color: '#94A3B8' }}>
        {value.announcement.enabled ? value.announcement.text : 'No announcement bar'}
      </div>
      <div className="flex flex-wrap gap-1 rounded-md p-2" style={{ background: STOREFRONT.header }}>
        {value.items.map((i) => (
          <span key={i.id} className="rounded px-1.5 py-0.5 font-semibold" style={{ color: i.showOnDesktop ? '#FFFFFF' : 'rgba(255,255,255,.35)' }}>
            {i.label}
          </span>
        ))}
      </div>
    </div>
  );
}
