/**
 * Today's Deals banners, edited INSIDE the versioned homepage document (draft → preview → publish →
 * history), replacing the old live-saving Deals Banners editor.
 *
 * Where they appear: ONLY on the homepage, in the "Today's Deals" section — a horizontal carousel
 * of wide image cards (shown 120px tall, cropped to fill; upload ~800×320, a 5:2 landscape image).
 * Up to 5 show at once. A card links to a product, a brand or a site page and may carry a sponsor
 * chip ("PROMOTED" + brand name/logo). Paid ad campaigns are managed separately in Ads Manager.
 */
import React, { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Info, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { uploadSiteAssetImage } from '../../../services/mediaUpload';
import type { PickItem } from './CatalogPicker';
import { Field, LinkInput, Toggle, iconBtn, inputCls, smallBtn } from './StudioKit';
import { HOMEPAGE_LIMITS, moveItem, type HomepageDealsBanner } from './homepageModel';

function ImageField({ value, onChange, disabled, testId, placeholder }: { value: string; onChange: (url: string) => void; disabled: boolean; testId: string; placeholder: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <div className="flex gap-2">
        <input className={inputCls} value={value} disabled={disabled} placeholder={placeholder} data-testid={testId} onChange={(e) => onChange(e.target.value)} />
        <button type="button" className={smallBtn} disabled={disabled || busy} onClick={() => ref.current?.click()}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Upload
        </button>
        <input
          ref={ref}
          type="file"
          className="hidden"
          accept="image/jpeg,image/png,image/webp,image/avif"
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

export function DealsBannersPanel({
  banners,
  onChange,
  disabled,
  products,
  brands,
}: {
  banners: HomepageDealsBanner[];
  onChange: (b: HomepageDealsBanner[]) => void;
  disabled: boolean;
  products: PickItem[];
  brands: PickItem[];
}) {
  const active = banners.filter((b) => b.isActive).length;
  const set = (i: number, patch: Partial<HomepageDealsBanner>) => onChange(banners.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  return (
    <div className="space-y-3" data-testid="ws-hp-deals-banners">
      <div className="flex gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-[11.5px] text-sky-900" data-testid="ws-hp-deals-placement">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <b>Where these appear:</b> only on the <b>homepage</b>, in the <b>Today’s Deals</b> section, as a horizontal carousel. Each card is a <b>wide landscape image</b> shown 120px tall and cropped to fill — upload about <b>800×320 px (5:2)</b>. Up to {HOMEPAGE_LIMITS.activeDealsBanners} show at once. They follow this homepage’s draft → preview → publish workflow and version history. Paid ad campaigns live in <b>Ads Manager</b>.
        </div>
      </div>
      <div className="text-[11px] font-bold text-slate-500">
        {active} of {HOMEPAGE_LIMITS.activeDealsBanners} showing · {banners.length} saved
      </div>
      {banners.map((b, i) => (
        <div key={b.id} className={`space-y-2 rounded-lg border p-2.5 ${b.isActive ? 'border-[#E8EDF2]' : 'border-dashed border-slate-200 bg-slate-50'}`} data-testid={`ws-hp-banner-${i}`}>
          <div className="flex items-center gap-2">
            {b.image ? <img src={b.image} alt="" className="h-10 w-[100px] shrink-0 rounded object-cover" /> : <span className="h-10 w-[100px] shrink-0 rounded bg-slate-100" />}
            <Toggle checked={b.isActive} disabled={disabled || (!b.isActive && active >= HOMEPAGE_LIMITS.activeDealsBanners)} label="Show" testId={`ws-hp-banner-active-${i}`} onChange={(on) => set(i, { isActive: on })} />
            <div className="ml-auto flex gap-1">
              <button type="button" className={iconBtn} disabled={disabled || i === 0} aria-label="Move banner up" onClick={() => onChange(moveItem(banners, i, -1))}><ArrowUp className="h-3.5 w-3.5" /></button>
              <button type="button" className={iconBtn} disabled={disabled || i === banners.length - 1} aria-label="Move banner down" onClick={() => onChange(moveItem(banners, i, 1))}><ArrowDown className="h-3.5 w-3.5" /></button>
              <button type="button" className={iconBtn} disabled={disabled} aria-label="Delete banner" data-testid={`ws-hp-banner-delete-${i}`} onClick={() => onChange(banners.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
          <Field label="Banner image (landscape, ~800×320)">
            <ImageField value={b.image} disabled={disabled} testId={`ws-hp-banner-image-${i}`} placeholder="https://… or upload" onChange={(url) => set(i, { image: url })} />
          </Field>
          <Field label="Opens">
            <div className="flex gap-2">
              <select
                className={`${inputCls} w-[130px] shrink-0`}
                value={b.destinationType}
                disabled={disabled}
                data-testid={`ws-hp-banner-type-${i}`}
                onChange={(e) => set(i, { destinationType: e.target.value as HomepageDealsBanner['destinationType'], destinationRef: e.target.value === 'custom-url' ? '/deals' : '' })}
              >
                <option value="custom-url">Site page</option>
                <option value="product">Product</option>
                <option value="brand">Brand</option>
              </select>
              {b.destinationType === 'custom-url' ? (
                <LinkInput value={b.destinationRef} disabled={disabled} testId={`ws-hp-banner-link-${i}`} onChange={(url) => set(i, { destinationRef: url })} />
              ) : (
                <select className={inputCls} value={b.destinationRef} disabled={disabled} data-testid={`ws-hp-banner-ref-${i}`} onChange={(e) => set(i, { destinationRef: e.target.value })}>
                  <option value="">Choose…</option>
                  {(b.destinationType === 'product' ? products : brands).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Sponsor name (optional)">
              <input className={inputCls} value={b.brandName} maxLength={60} disabled={disabled} data-testid={`ws-hp-banner-sponsor-${i}`} onChange={(e) => set(i, { brandName: e.target.value })} />
            </Field>
            <Field label="Sponsor logo (optional)">
              <ImageField value={b.brandLogoUrl} disabled={disabled} testId={`ws-hp-banner-logo-${i}`} placeholder="https://…" onChange={(url) => set(i, { brandLogoUrl: url })} />
            </Field>
          </div>
        </div>
      ))}
      <button
        type="button"
        className={smallBtn}
        disabled={disabled || banners.length >= HOMEPAGE_LIMITS.dealsBanners}
        data-testid="ws-hp-add-banner"
        onClick={() => {
          let n = banners.length + 1;
          while (banners.some((b) => b.id === `deal-banner-${n}`)) n++;
          onChange([...banners, { id: `deal-banner-${n}`, image: '', destinationType: 'custom-url', destinationRef: '/deals', brandName: '', brandLogoUrl: '', isActive: active < HOMEPAGE_LIMITS.activeDealsBanners }]);
        }}
      >
        <Plus className="h-3.5 w-3.5" /> Add banner
      </button>
    </div>
  );
}
