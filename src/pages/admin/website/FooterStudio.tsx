/**
 * Website Studio — Footer (Phase 3). Storefront mirror of the real footer. Footer-owned parts
 * (description, link columns, payments, app badges, delivery partners, which blocks show) are
 * edited here; contact details, offices, business identifiers and the copyright holder come from
 * Company Settings, social icons from Social Links — the mirror shows them and says where to edit.
 *
 * Payment methods: only those checkout can take on this server are selectable (server-verified,
 * re-checked at publish). App badges need a real store listing. Couriers need explicit confirmation.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { websiteStudioApi, type CompanySettings, type PaymentCapability } from '../../../services/websiteStudioApi';
import { uploadSiteAssetImage } from '../../../services/mediaUpload';
import { Field, LinkInput, MirrorBlock, MirrorLayout, STOREFRONT, Toggle, iconBtn, inputCls, smallBtn } from './StudioKit';
import { APP_STORES, DEFAULT_FOOTER_HEADINGS, DEFAULT_FOOTER_PARTNER, FOOTER_LIMITS, SOCIAL_PLATFORMS, isExternal, moveIn, nextId, type FooterContent, type FooterHeadings, type SocialContent } from './siteModel';

type Sel =
  | { kind: 'description' | 'social' | 'contact' | 'offices' | 'payments' | 'apps' | 'delivery' | 'ids' | 'copyright' | 'headings' | 'partner' }
  | { kind: 'column'; id: string }
  | null;

const H = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-2 text-[9.5px] font-bold uppercase tracking-[0.08em]" style={{ color: 'rgba(255,255,255,.4)' }}>
    {children}
  </div>
);
const T = ({ children, strong }: { children: React.ReactNode; strong?: boolean }) => (
  <div className="text-[11.5px] font-medium" style={{ color: strong ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.6)' }}>
    {children}
  </div>
);

/** Reads the current Company Settings + Social Links (draft if any, else live) to show them in the mirror. */
function useRelated() {
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [social, setSocial] = useState<SocialContent | null>(null);
  const [payments, setPayments] = useState<PaymentCapability[]>([]);
  useEffect(() => {
    websiteStudioApi.getDocument<CompanySettings>('company').then((d) => setCompany((d.draft ?? d.published?.content ?? null) as CompanySettings | null)).catch(() => undefined);
    websiteStudioApi.getDocument<SocialContent>('social').then((d) => setSocial((d.draft ?? d.published?.content ?? null) as SocialContent | null)).catch(() => undefined);
    websiteStudioApi.capabilities().then((c) => setPayments(c.paymentMethods ?? [])).catch(() => undefined);
  }, []);
  return { company, social, payments };
}

function LogoUpload({ value, onChange, disabled, testId }: { value: string; onChange: (url: string) => void; disabled: boolean; testId: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <div className="flex gap-2">
        <input className={inputCls} value={value} disabled={disabled} placeholder="https://… or upload" data-testid={testId} onChange={(e) => onChange(e.target.value)} />
        <button type="button" className={smallBtn} disabled={disabled || busy} onClick={() => ref.current?.click()}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Upload
        </button>
        <input
          ref={ref}
          type="file"
          className="hidden"
          accept="image/png,image/webp,image/jpeg,image/avif"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            setBusy(true);
            setErr(null);
            try {
              onChange(await uploadSiteAssetImage(f));
            } catch (x) {
              setErr(x instanceof Error ? x.message : 'Upload failed');
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
      {err && <div className="mt-1 text-[11px] font-semibold text-red-600">{err}</div>}
    </div>
  );
}

export function FooterEditor({ value, onChange, disabled }: { value: FooterContent; onChange: (v: FooterContent) => void; disabled: boolean }) {
  const [sel, setSel] = useState<Sel>(null);
  const { company, social, payments } = useRelated();
  const v = value;
  const set = (patch: Partial<FooterContent>) => onChange({ ...v, ...patch });
  const headings: FooterHeadings = { ...DEFAULT_FOOTER_HEADINGS, ...(v.headings || {}) };
  const partner = { ...DEFAULT_FOOTER_PARTNER, ...(v.partner || {}) };
  const is = (kind: string, id?: string) => sel?.kind === kind && (id === undefined || (sel as { id?: string }).id === id);
  const offices = (company?.offices ?? []).filter((o) => o.enabled);
  const verifiedId = (x?: { value: string; verified: boolean }) => (x?.verified && x.value ? x.value : '—');
  const year = new Date().getFullYear();

  const mirror = (
    <div className="m-3 rounded-xl p-5" style={{ background: STOREFRONT.footer }} onClick={() => setSel(null)} data-testid="ws-ft-mirror">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.9fr]">
        <div className="space-y-4">
          <div className="text-[20px] font-extrabold" style={{ color: '#FFFFFF' }}>
            choosify
          </div>
          <button type="button" onClick={(e) => { e.stopPropagation(); setSel({ kind: 'headings' }); }} className="rounded-md border border-dashed border-white/40 px-2 py-1 text-[10px] font-bold" style={{ color: 'rgba(255,255,255,.75)' }} data-testid="ws-ft-headings">
            Edit section headings (Connect, Contact Us, Address, Payments…)
          </button>
          <MirrorBlock selected={is('description')} onSelect={() => setSel({ kind: 'description' })} label="Description" testId="ws-ft-description" className="rounded-md">
            <T>{v.description || 'Bangladesh’s smartest product discovery platform… (built-in text)'}</T>
          </MirrorBlock>
          <MirrorBlock selected={is('social')} onSelect={() => setSel({ kind: 'social' })} label="Social links" testId="ws-ft-social" className="rounded-md">
            <H>{headings.connect}</H>
            <div className="flex flex-wrap gap-1.5">
              {(social?.links ?? []).filter((l) => l.visible).map((l) => (
                <span key={l.platform} className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-white px-2 text-[9.5px] font-extrabold text-[#1A1A2E]">
                  {SOCIAL_PLATFORMS.find((p) => p.id === l.platform)?.label.slice(0, 2) ?? l.platform}
                </span>
              ))}
            </div>
          </MirrorBlock>
          <MirrorBlock selected={is('partner')} onSelect={() => setSel({ kind: 'partner' })} label="Sell or create with us" testId="ws-ft-partner" muted={!partner.show} className="rounded-md">
            <H>{partner.title}</H>
            <T>{partner.sellerLabel}</T>
            <T>{partner.creatorLabel}</T>
          </MirrorBlock>
          <MirrorBlock selected={is('contact')} onSelect={() => setSel({ kind: 'contact' })} label="Contact (Company Settings)" testId="ws-ft-contact" className="rounded-md">
            <H>{headings.contact}</H>
            <T>Email: {company?.supportEmail || 'support@choosify.bd'}</T>
            {company?.supportPhone && <T>Phone: {company.supportPhone}</T>}
          </MirrorBlock>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {v.columns.map((c) => (
            <MirrorBlock key={c.id} selected={is('column', c.id)} onSelect={() => setSel({ kind: 'column', id: c.id })} label="Link column" testId={`ws-ft-column-${c.id}`} className="rounded-md">
              <H>{c.title}</H>
              <div className="space-y-1">
                {c.links.map((l, j) => (
                  <T key={`${l.label}-${j}`}>{l.label}</T>
                ))}
              </div>
            </MirrorBlock>
          ))}
          {v.columns.length < FOOTER_LIMITS.columns && (
            <button
              type="button"
              className="flex min-h-[60px] items-center justify-center gap-1 rounded-md border border-dashed text-[11px] font-bold disabled:opacity-40"
              style={{ borderColor: 'rgba(255,255,255,.3)', color: 'rgba(255,255,255,.7)' }}
              disabled={disabled}
              data-testid="ws-ft-add-column"
              onClick={(e) => {
                e.stopPropagation();
                const id = nextId('column', v.columns.map((c) => c.id));
                set({ columns: [...v.columns, { id, title: 'New column', links: [{ label: 'Deals', url: '/deals' }] }] });
                setSel({ kind: 'column', id });
              }}
            >
              <Plus className="h-3.5 w-3.5" /> Column
            </button>
          )}
          <MirrorBlock selected={is('offices')} onSelect={() => setSel({ kind: 'offices' })} label="Address (Company Settings)" testId="ws-ft-offices" muted={!v.showOffices} className="rounded-md">
            <H>{headings.address}</H>
            {offices.length ? offices.map((o) => (
              <div key={o.id} className="mb-2">
                <T strong>{o.label}</T>
                {o.lines.map((l) => (
                  <T key={l}>{l}</T>
                ))}
              </div>
            )) : <T>No offices in Company Settings</T>}
          </MirrorBlock>
        </div>
      </div>

      <div className="mt-5 grid gap-6 border-t pt-4 lg:grid-cols-2" style={{ borderColor: 'rgba(255,255,255,.1)' }}>
        <MirrorBlock selected={is('payments')} onSelect={() => setSel({ kind: 'payments' })} label="Payments accepted" testId="ws-ft-payments" muted={!v.paymentMethods.length} className="rounded-md">
          <H>Payments accepted</H>
          {v.paymentMethods.length ? (
            <div className="flex flex-wrap gap-1.5">
              {v.paymentMethods.map((id) => (
                <span key={id} className="rounded bg-white px-2 py-1 text-[10.5px] font-bold text-[#1A1A2E]">{payments.find((p) => p.id === id)?.label ?? id}</span>
              ))}
            </div>
          ) : (
            <T>Hidden — no payment method selected</T>
          )}
        </MirrorBlock>
        <MirrorBlock selected={is('apps')} onSelect={() => setSel({ kind: 'apps' })} label="App download badges" testId="ws-ft-apps" muted={!v.apps.length} className="rounded-md">
          <H>Available on platforms</H>
          {v.apps.length ? v.apps.map((a) => <T key={a.platform}>{APP_STORES[a.platform].label}</T>) : <T>Hidden — no real store listing added</T>}
        </MirrorBlock>
      </div>
      <div className="mt-4 grid gap-6 border-t pt-4 lg:grid-cols-2" style={{ borderColor: 'rgba(255,255,255,.1)' }}>
        <MirrorBlock selected={is('delivery')} onSelect={() => setSel({ kind: 'delivery' })} label="Delivery partners" testId="ws-ft-delivery" muted={!v.deliveryPartners.length} className="rounded-md">
          <H>Delivery partner</H>
          {v.deliveryPartners.length ? (
            <div className="flex flex-wrap gap-1.5">
              {v.deliveryPartners.map((p) => (
                <span key={p.id} className="inline-flex h-7 items-center rounded bg-white px-2">
                  {p.logoUrl ? <img src={p.logoUrl} alt={p.name} className="h-4 w-auto" /> : <span className="text-[10px] font-bold text-[#1A1A2E]">{p.name}</span>}
                </span>
              ))}
            </div>
          ) : (
            <T>Hidden — no confirmed courier</T>
          )}
        </MirrorBlock>
        <MirrorBlock selected={is('ids')} onSelect={() => setSel({ kind: 'ids' })} label="Business identifiers" testId="ws-ft-ids" muted={!v.showBusinessIds} className="rounded-md">
          <H>DBID · Trade licence</H>
          <T>DBID No: {verifiedId(company?.identifiers?.dbid)}</T>
          <T>Trade License No: {verifiedId(company?.identifiers?.tradeLicense)}</T>
        </MirrorBlock>
      </div>
      <MirrorBlock selected={is('copyright')} onSelect={() => setSel({ kind: 'copyright' })} label="Copyright (Company Settings)" testId="ws-ft-copyright" className="mt-4 rounded-md border-t pt-3">
        <div className="text-center text-[11px]" style={{ color: 'rgba(255,255,255,.4)' }}>
          <span style={{ color: STOREFRONT.orange }}>©</span> {year} <b style={{ color: STOREFRONT.orange }}>{company?.copyrightText || company?.displayName || 'Choosify'}</b>. All rights reserved.
        </div>
      </MirrorBlock>
    </div>
  );

  const TAB_KEYS: Record<string, string> = { 'Company Settings': 'company', 'Social Links': 'social', 'Brand Assets': 'brand_assets', 'Header & Navigation': 'navigation' };
  const elsewhere = (what: string, tab: string) => (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px] text-slate-600">
      {what} {what.endsWith('s') ? 'are' : 'is'} shared with the rest of the website (<b>{tab}</b>) — edit {what.endsWith('s') ? 'them' : 'it'} just below this footer editor.
      {TAB_KEYS[tab] ? (
        <button
          type="button"
          className="mt-2 flex items-center gap-1 rounded-md bg-[#EF3C23] px-3 py-1.5 text-[11.5px] font-extrabold"
          style={{ color: '#FFFFFF' }}
          data-testid={`ws-open-${TAB_KEYS[tab]}`}
          onClick={() => {
            // On the Footer tab the shared editors sit right below — scroll there; elsewhere open the tab.
            const below = document.getElementById(`ws-footer-${TAB_KEYS[tab]}`);
            if (below) below.scrollIntoView({ behavior: 'smooth', block: 'start' });
            else window.dispatchEvent(new CustomEvent('ws-open-tab', { detail: TAB_KEYS[tab] }));
          }}
        >
          Edit {what.toLowerCase()} ↓
        </button>
      ) : null}
    </div>
  );

  let title = '';
  let inspector: React.ReactNode = null;
  if (is('headings')) {
    title = 'Footer section headings';
    const labels: Record<keyof FooterHeadings, string> = {
      connect: 'Social icons heading',
      contact: 'Contact heading',
      address: 'Address heading',
      payments: 'Payments heading',
      apps: 'App download heading',
      appsNote: 'App download note',
      delivery: 'Delivery partner heading',
    };
    inspector = (
      <div className="space-y-2.5" data-testid="ws-ft-headings-form">
        {(Object.keys(DEFAULT_FOOTER_HEADINGS) as Array<keyof FooterHeadings>).map((k) => (
          <Field key={k} label={labels[k]} hint={`Built-in: “${DEFAULT_FOOTER_HEADINGS[k]}”`}>
            <input
              className={inputCls}
              disabled={disabled}
              maxLength={k === 'appsNote' ? 80 : 40}
              value={headings[k]}
              data-testid={`ws-ft-heading-${k}`}
              onChange={(e) => set({ headings: { ...headings, [k]: e.target.value } })}
            />
          </Field>
        ))}
      </div>
    );
  } else if (is('partner')) {
    title = 'Sell or create with us';
    inspector = (
      <div className="space-y-2.5" data-testid="ws-ft-partner-form">
        <Toggle checked={partner.show} disabled={disabled} label="Show this block" testId="ws-ft-partner-on" onChange={(on) => set({ partner: { ...partner, show: on } })} />
        <Field label="Heading">
          <input className={inputCls} disabled={disabled} maxLength={40} value={partner.title} data-testid="ws-ft-partner-title" onChange={(e) => set({ partner: { ...partner, title: e.target.value } })} />
        </Field>
        <Field label="Seller sign-up link text" hint="Opens the seller sign-up page.">
          <input className={inputCls} disabled={disabled} maxLength={40} value={partner.sellerLabel} onChange={(e) => set({ partner: { ...partner, sellerLabel: e.target.value } })} />
        </Field>
        <Field label="Creator sign-up link text" hint="Opens the creator sign-up page.">
          <input className={inputCls} disabled={disabled} maxLength={40} value={partner.creatorLabel} onChange={(e) => set({ partner: { ...partner, creatorLabel: e.target.value } })} />
        </Field>
      </div>
    );
  } else if (is('description')) {
    title = 'Footer description';
    inspector = (
      <Field label={`Text (max ${FOOTER_LIMITS.description})`} hint="Leave empty to keep the built-in line.">
        <textarea className={inputCls} rows={4} maxLength={FOOTER_LIMITS.description} disabled={disabled} value={v.description} data-testid="ws-ft-description-text" onChange={(e) => set({ description: e.target.value })} />
      </Field>
    );
  } else if (is('social')) {
    title = 'Social links';
    inspector = elsewhere('Social links', 'Social Links');
  } else if (is('contact')) {
    title = 'Contact us';
    inspector = elsewhere('The support email and phone', 'Company Settings');
  } else if (is('copyright')) {
    title = 'Copyright line';
    inspector = elsewhere('The copyright holder', 'Company Settings');
  } else if (is('offices')) {
    title = 'Office addresses';
    inspector = (
      <div className="space-y-3">
        <Toggle checked={v.showOffices} disabled={disabled} label="Show the Address block" testId="ws-ft-offices-on" onChange={(on) => set({ showOffices: on })} />
        {elsewhere('The office addresses', 'Company Settings')}
      </div>
    );
  } else if (is('ids')) {
    title = 'Business identifiers';
    inspector = (
      <div className="space-y-3">
        <Toggle checked={v.showBusinessIds} disabled={disabled} label="Show DBID and trade licence" testId="ws-ft-ids-on" onChange={(on) => set({ showBusinessIds: on })} />
        <div className="text-[11.5px] text-slate-500">Only identifiers marked <b>verified</b> in Company Settings are printed; others show “—”.</div>
      </div>
    );
  } else if (is('payments')) {
    title = 'Payments accepted';
    inspector = (
      <div className="space-y-2" data-testid="ws-ft-payments-form">
        <div className="text-[11.5px] text-slate-500">Only methods checkout can take right now can be shown. The list is checked again when you publish.</div>
        {payments.map((p) => {
          const on = v.paymentMethods.includes(p.id);
          return (
            <label key={p.id} className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${p.available ? 'border-[#E8EDF2]' : 'border-dashed border-slate-200 bg-slate-50'}`}>
              <input
                type="checkbox"
                className="mt-0.5"
                checked={on}
                disabled={disabled || (!p.available && !on)}
                data-testid={`ws-ft-pay-${p.id}`}
                onChange={(e) => set({ paymentMethods: e.target.checked ? [...v.paymentMethods, p.id] : v.paymentMethods.filter((x) => x !== p.id) })}
              />
              <span>
                <span className={`block text-[12px] font-bold ${p.available ? 'text-[#111827]' : 'text-slate-400'}`}>{p.label}</span>
                <span className="block text-[10.5px] text-slate-500">{p.reason}</span>
              </span>
            </label>
          );
        })}
      </div>
    );
  } else if (is('apps')) {
    title = 'App download badges';
    inspector = (
      <div className="space-y-3" data-testid="ws-ft-apps-form">
        <div className="text-[11.5px] text-slate-500">Add a badge only when the Choosify app is live in that store. The link must be the app’s real store listing.</div>
        {(['android', 'ios'] as const).map((platform) => {
          const cur = v.apps.find((a) => a.platform === platform);
          return (
            <Field key={platform} label={APP_STORES[platform].label} hint={`Format: ${APP_STORES[platform].hint}`}>
              <input
                className={inputCls}
                value={cur?.url ?? ''}
                disabled={disabled}
                placeholder="Empty = no badge"
                data-testid={`ws-ft-app-${platform}`}
                onChange={(e) => {
                  const url = e.target.value.trim();
                  const rest = v.apps.filter((a) => a.platform !== platform);
                  set({ apps: url ? [...rest, { platform, url }] : rest });
                }}
              />
            </Field>
          );
        })}
      </div>
    );
  } else if (is('delivery')) {
    title = 'Delivery partners';
    inspector = (
      <div className="space-y-3" data-testid="ws-ft-delivery-form">
        <div className="text-[11.5px] text-slate-500">Choosify has no courier integration yet; sellers ship with couriers of their choice. Show a courier only if Choosify orders really ship with it.</div>
        {v.deliveryPartners.map((p, i) => (
          <div key={p.id} className="space-y-2 rounded-lg border border-[#E8EDF2] p-2.5">
            <div className="flex gap-2">
              <input className={inputCls} value={p.name} maxLength={40} disabled={disabled} placeholder="Courier name" data-testid={`ws-ft-partner-name-${i}`} onChange={(e) => set({ deliveryPartners: v.deliveryPartners.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
              <button type="button" className={iconBtn} disabled={disabled} aria-label="Remove courier" onClick={() => set({ deliveryPartners: v.deliveryPartners.filter((_, j) => j !== i) })}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <LogoUpload value={p.logoUrl} disabled={disabled} testId={`ws-ft-partner-logo-${i}`} onChange={(url) => set({ deliveryPartners: v.deliveryPartners.map((x, j) => (j === i ? { ...x, logoUrl: url } : x)) })} />
            <Toggle checked={p.confirmed} disabled={disabled} label="Choosify orders really ship with this courier" testId={`ws-ft-partner-confirm-${i}`} onChange={(on) => set({ deliveryPartners: v.deliveryPartners.map((x, j) => (j === i ? { ...x, confirmed: on } : x)) })} />
          </div>
        ))}
        <button
          type="button"
          className={smallBtn}
          disabled={disabled || v.deliveryPartners.length >= FOOTER_LIMITS.partners}
          data-testid="ws-ft-add-partner"
          onClick={() => set({ deliveryPartners: [...v.deliveryPartners, { id: nextId('courier', v.deliveryPartners.map((p) => p.id)), name: '', logoUrl: '', confirmed: false }] })}
        >
          <Plus className="h-3.5 w-3.5" /> Add courier
        </button>
      </div>
    );
  } else if (sel?.kind === 'column') {
    const ci = v.columns.findIndex((c) => c.id === sel.id);
    const c = v.columns[ci];
    if (c) {
      const setCol = (patch: Partial<typeof c>) => set({ columns: v.columns.map((x, j) => (j === ci ? { ...x, ...patch } : x)) });
      title = `Link column — ${c.title}`;
      inspector = (
        <div className="space-y-3" data-testid="ws-ft-column-form">
          <Field label="Column title">
            <input className={inputCls} value={c.title} maxLength={30} disabled={disabled} data-testid="ws-ft-column-title" onChange={(e) => setCol({ title: e.target.value })} />
          </Field>
          {c.links.map((l, j) => (
            <div key={j} className="space-y-1.5 rounded-lg border border-[#E8EDF2] p-2">
              <div className="flex gap-1.5">
                <input className={inputCls} value={l.label} maxLength={40} disabled={disabled} placeholder="Link text" data-testid={`ws-ft-link-label-${j}`} onChange={(e) => setCol({ links: c.links.map((x, k) => (k === j ? { ...x, label: e.target.value } : x)) })} />
                <button type="button" className={iconBtn} disabled={disabled || j === 0} aria-label="Move link up" onClick={() => setCol({ links: moveIn(c.links, j, -1) })}><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" className={iconBtn} disabled={disabled || j === c.links.length - 1} aria-label="Move link down" onClick={() => setCol({ links: moveIn(c.links, j, 1) })}><ArrowDown className="h-3.5 w-3.5" /></button>
                <button type="button" className={iconBtn} disabled={disabled || c.links.length === 1} aria-label="Remove link" onClick={() => setCol({ links: c.links.filter((_, k) => k !== j) })}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <LinkInput value={l.url} disabled={disabled} testId={`ws-ft-link-url-${j}`} onChange={(url) => setCol({ links: c.links.map((x, k) => (k === j ? { ...x, url, external: isExternal(url) } : x)) })} />
            </div>
          ))}
          <div className="flex flex-wrap gap-2 border-t border-[#F1F3F5] pt-3">
            <button type="button" className={smallBtn} disabled={disabled || c.links.length >= FOOTER_LIMITS.links} data-testid="ws-ft-add-link" onClick={() => setCol({ links: [...c.links, { label: 'New link', url: '/deals' }] })}>
              <Plus className="h-3.5 w-3.5" /> Link
            </button>
            <button type="button" className={iconBtn} disabled={disabled || ci === 0} aria-label="Move column left" onClick={() => set({ columns: moveIn(v.columns, ci, -1) })}><ArrowLeft className="h-3.5 w-3.5" /></button>
            <button type="button" className={iconBtn} disabled={disabled || ci === v.columns.length - 1} aria-label="Move column right" onClick={() => set({ columns: moveIn(v.columns, ci, 1) })}><ArrowRight className="h-3.5 w-3.5" /></button>
            <button type="button" className={smallBtn} disabled={disabled} data-testid="ws-ft-delete-column" onClick={() => { set({ columns: v.columns.filter((x) => x.id !== c.id) }); setSel(null); }}>
              <Trash2 className="h-3.5 w-3.5" /> Delete column
            </button>
          </div>
        </div>
      );
    }
  }

  return (
    <div data-testid="ws-footer-editor">
      <MirrorLayout mirror={mirror} inspector={inspector} inspectorTitle={title} />
    </div>
  );
}

export function FooterOutline({ value }: { value: FooterContent }) {
  return (
    <div className="rounded-md p-3 text-[11px]" style={{ background: STOREFRONT.footer, color: 'rgba(255,255,255,.7)' }}>
      <div>{value.columns.map((c) => c.title).join(' · ') || 'No columns'}</div>
      <div className="mt-1">Payments: {value.paymentMethods.join(', ') || 'hidden'} · Apps: {value.apps.length || 'hidden'} · Couriers: {value.deliveryPartners.length || 'hidden'}</div>
    </div>
  );
}
