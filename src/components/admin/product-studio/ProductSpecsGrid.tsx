import React from 'react';
import { Trash2 } from 'lucide-react';
import { resolveOverviewListIcon } from './OverviewListIcon';

export type SpecItem = { key: string; value: string };

export function SpecIconCard({
  label,
  value,
  index = 0,
  compact = false,
}: {
  label: string;
  value: string;
  index?: number;
  compact?: boolean;
}) {
  const Icon = resolveOverviewListIcon(`${label} ${value}`);
  return (
    <div
      className={`min-w-0 overflow-hidden rounded-[5px] border border-gray-100 flex flex-col gap-2 ${
        compact ? 'p-2.5' : 'p-3 sm:p-4'
      } ${index % 2 !== 0 ? 'bg-white' : 'bg-gray-50'}`}
    >
      <div className="flex items-start gap-2 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-[#FF5B00]/10 text-[#FF5B00] flex items-center justify-center shrink-0">
          <Icon size={14} aria-hidden />
        </div>
        <span className="min-w-0 flex-1 text-[9px] font-black text-gray-400 uppercase tracking-wider break-words leading-snug">
          {label || 'Attribute'}
        </span>
      </div>
      <span className="min-w-0 text-xs font-black text-[#1A1D4E] uppercase tracking-wide leading-snug break-words [overflow-wrap:anywhere]">
        {value || '—'}
      </span>
    </div>
  );
}

/** Storefront-parity Product Specifications grid. */
export function ProductSpecsGrid({
  specs,
  productTitle,
  title = 'Product Specifications',
  emptyLabel = 'No attributes defined yet.',
}: {
  specs: SpecItem[];
  productTitle?: string;
  title?: string;
  emptyLabel?: string;
}) {
  if (!specs.length) {
    return (
      <div className="py-12 border border-dashed border-[#E5E7EB] rounded-2xl bg-[#FAFAFA]/50 text-center text-slate-400 text-xs italic">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="w-full text-left overflow-hidden">
      <div className="text-center mb-5 border-b border-gray-100 pb-4">
        <h3 className="text-sm sm:text-base font-black text-[#1A1D4E] tracking-tight uppercase mb-1">{title}</h3>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest italic font-mono bg-gray-50 border border-gray-100 rounded-full px-3 py-1.5 w-fit max-w-full mx-auto break-words">
          {productTitle ? `Technical details for ${productTitle}` : 'Technical product details'}
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {specs.map((spec, i) => (
          <SpecIconCard key={`${spec.key}-${i}`} label={spec.key} value={spec.value} index={i} />
        ))}
      </div>
    </div>
  );
}

/** Edit row: key/value inputs + live mini icon-card preview. */
export function SpecEditRow({
  item,
  index,
  onChange,
  onRemove,
}: {
  item: SpecItem;
  index: number;
  onChange: (next: SpecItem) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-2 items-stretch bg-[#FAFAFA] p-2 rounded-xl border border-[#E5E7EB]">
      <div className="grid grid-cols-2 gap-2 flex-grow text-xs font-mono min-w-0">
        <input
          value={item.key}
          onChange={(e) => onChange({ ...item, key: e.target.value })}
          className="bg-white border border-[#E5E7EB] rounded-lg px-2 outline-none uppercase font-bold text-slate-500 py-1.5"
          placeholder="Attribute key"
        />
        <input
          value={item.value}
          onChange={(e) => onChange({ ...item, value: e.target.value })}
          className="bg-white border border-[#E5E7EB] rounded-lg px-2 outline-none font-bold text-[#1A1A2E] py-1.5"
          placeholder="Value"
        />
      </div>
      <div className="w-full sm:w-36 shrink-0">
        <SpecIconCard label={item.key} value={item.value} index={index} compact />
      </div>
      <button type="button" onClick={onRemove} className="text-slate-400 hover:text-red-500 p-1 cursor-pointer self-center">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
