/**
 * Ads Studio preview of a Sponsored Listing: the promoted brand / product drawn like its storefront
 * card (Web BrandCardDesign / ProductCard) with the "Sponsored" label — not a stand-in gradient.
 */
import React, { useEffect, useState } from 'react';
import { catalogApi } from '../../services/catalogApi';

type Rec = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);
const isImg = (u: string) => /^(https?:)?\/\//i.test(u) || u.startsWith('/media/');

const cache = new Map<string, Promise<Rec[]>>();
function load(type: 'product' | 'brand'): Promise<Rec[]> {
  const hit = cache.get(type);
  if (hit) return hit;
  const p = (type === 'brand' ? catalogApi.listBrands() : catalogApi.listProducts()).then((r) => r as unknown as Rec[]).catch(() => []);
  cache.set(type, p);
  return p;
}

const Chip = () => (
  <span className="absolute left-1/2 top-2 z-20 -translate-x-1/2 rounded-full bg-black/70 px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-white" data-testid="sponsored-preview-chip" style={{ color: '#FFFFFF', background: 'rgba(0,0,0,.72)' }}>
    Sponsored
  </span>
);

export function SponsoredListingPreview({ type, id }: { type: 'product' | 'brand'; id: string }) {
  const [item, setItem] = useState<Rec | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    if (!id) {
      setItem(null);
      return;
    }
    setItem(undefined);
    load(type).then((rows) => alive && setItem(rows.find((r) => str(r.id) === id) ?? null));
    return () => {
      alive = false;
    };
  }, [type, id]);

  if (!id) return <div className="rounded-lg border border-dashed border-slate-300 px-3 py-8 text-center text-[11.5px] text-slate-500">Choose the {type} you are promoting to see its card.</div>;
  if (item === undefined) return <div className="h-[300px] w-[260px] animate-pulse rounded-[10px] bg-slate-100" />;
  if (item === null) return <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-6 text-center text-[11.5px] font-semibold text-red-700">This {type} was not found — it will not be shown.</div>;

  if (type === 'brand') {
    const name = str(item.name);
    const logo = str(item.logo);
    const cover = str(item.coverImage);
    const verified = str(item.verifiedStatus) === 'verified';
    return (
      <div className="relative w-[260px] overflow-hidden rounded-[10px] border border-[#E8EDF2] bg-white shadow-sm" data-testid="sponsored-preview-brand">
        <Chip />
        <div className="h-[92px] w-full bg-gradient-to-br from-[#2323FF] to-[#1A1D4E]">{isImg(cover) ? <img src={cover} alt="" className="h-full w-full object-cover" /> : null}</div>
        <div className="-mt-9 flex flex-col items-center px-4 pb-4">
          <div className="flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-full border-4 border-white text-[20px] font-extrabold shadow" style={{ background: '#1A1D4E', color: '#FFFFFF' }}>
            {isImg(logo) ? <img src={logo} alt="" className="h-full w-full object-cover" /> : name.slice(0, 2).toUpperCase()}
          </div>
          <div className="mt-2 text-[15px] font-extrabold text-[#1A1A2E]">{name}</div>
          <div className={`mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${verified ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{verified ? 'Verified' : 'Not yet verified'}</div>
          {str(item.category) ? <div className="mt-2 text-center text-[11px] text-[#6B7280]">{str(item.category)}</div> : null}
          <div className="mt-3 w-full rounded-md py-2 text-center text-[12px] font-extrabold" style={{ background: '#4A1D3A', color: '#FFFFFF' }}>View Brand</div>
        </div>
      </div>
    );
  }

  const title = str(item.title) || str(item.name);
  const image = str(item.image);
  const price = num(item.price);
  const original = num(item.originalPrice) || num(item.compareAtPrice);
  const off = original > price && price > 0 ? Math.round(((original - price) / original) * 100) : 0;
  return (
    <div className="relative w-[230px] overflow-hidden rounded-[10px] border border-[#E8EDF2] bg-white shadow-sm" data-testid="sponsored-preview-product">
      <Chip />
      <div className="relative aspect-square w-full bg-[#F4F7F9]">
        {isImg(image) ? <img src={image} alt="" className="h-full w-full object-cover" /> : null}
        {off ? <span className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-extrabold" style={{ background: '#DC2626', color: '#FFFFFF' }}>{off}% Off</span> : null}
      </div>
      <div className="p-3">
        <div className="line-clamp-2 text-[13px] font-extrabold text-[#1A1A2E]">{title}</div>
        {str(item.brandName) ? <div className="mt-0.5 text-[10.5px] text-[#9AA0AC]">{str(item.brandName)}</div> : null}
        <div className="mt-1.5 flex items-baseline gap-1.5">
          {price ? <span className="text-[15px] font-extrabold text-[#1A1A2E]">৳{price.toLocaleString('en-US')}</span> : null}
          {off ? <span className="text-[11px] text-[#9AA0AC] line-through">৳{original.toLocaleString('en-US')}</span> : null}
        </div>
      </div>
    </div>
  );
}
