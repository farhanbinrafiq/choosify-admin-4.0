import React, { useState } from 'react';
import { Heart, MessageCircleMore, MapPin, ShoppingCart } from 'lucide-react';
import { OverviewListItem } from './OverviewListIcon';

type BoxItem = {
  id: string;
  title: string;
  description?: string;
  enabled?: boolean;
  isFree?: boolean;
  price?: number;
  badge?: string;
};

type SpecItem = { key: string; value: string };

/** Two-column Box Content + Physical Specs matching storefront F4F7F9 cards. */
export function BoxPhysicalSpecsPanel({
  boxItems,
  physicalSpecs,
  boxLabel = 'BOX CONTENT',
  specsLabel = 'PHYSICAL SPECS',
}: {
  boxItems: BoxItem[];
  physicalSpecs: SpecItem[];
  boxLabel?: string;
  specsLabel?: string;
}) {
  const enabledBox = boxItems.filter((b) => b.enabled !== false);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 w-full">
      <div className="bg-[#F4F7F9] rounded-[10px] p-4 text-left">
        <div className="text-[11px] font-extrabold text-[#1A1A2E] mb-2.5">{boxLabel}</div>
        {enabledBox.length === 0 ? (
          <p className="text-[11px] text-slate-400 italic">No box items configured.</p>
        ) : (
          enabledBox.map((item) => {
            const line = item.description ? `${item.title} — ${item.description}` : item.title;
            return (
              <OverviewListItem
                key={item.id}
                text={line}
                className="text-[11.5px] text-[#4B5563] mb-1.5"
                iconClassName="text-emerald-500"
              />
            );
          })
        )}
      </div>
      <div className="bg-[#F4F7F9] rounded-[10px] p-4 text-left">
        <div className="text-[11px] font-extrabold text-[#1A1A2E] mb-2.5">{specsLabel}</div>
        {physicalSpecs.length === 0 ? (
          <p className="text-[11px] text-slate-400 italic">No physical specs defined.</p>
        ) : (
          physicalSpecs.map((item, i) => (
            <OverviewListItem
              key={`${item.key}-${i}`}
              text={`${item.key}: ${item.value}`}
              className="text-[11.5px] text-[#4B5563] mb-1.5"
              iconClassName="text-emerald-500"
            />
          ))
        )}
      </div>
    </div>
  );
}

export type CheckoutActionFlags = {
  actionBuyOnline: boolean;
  actionWish: boolean;
  actionLove: boolean;
  actionContactSeller: boolean;
  actionFindInStore: boolean;
  actionPreOrder: boolean;
  actionRequestQuote: boolean;
};

/** Live buy-box preview driven by checkout action toggles. */
export function CheckoutBuyBoxPreview({
  flags,
  price,
  stockLimit,
  productName,
  isService = false,
}: {
  flags: CheckoutActionFlags;
  price: number;
  stockLimit: number;
  productName?: string;
  isService?: boolean;
}) {
  const [qty, setQty] = useState(1);
  const [wish, setWish] = useState(false);
  const outOfStock = stockLimit <= 0;

  return (
    <div className="rounded-xl border border-[#E8EDF2] bg-white p-4 space-y-3 text-left shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono">
          Checkout buy box preview
        </span>
        <span className="text-[11px] font-extrabold text-[#FF5B00] font-mono">
          ৳ {(price || 0).toLocaleString()}
        </span>
      </div>
      {productName ? (
        <p className="text-xs font-bold text-[#1A1A2E] truncate">{productName}</p>
      ) : null}

      {!isService && (
        <div className="flex items-center justify-between bg-[#F4F7F9] rounded-lg px-2.5 py-1.5">
          <span className="text-xs font-bold text-[#1A1A2E]">Quantity</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="w-7 h-7 rounded-md border border-[#E5E7EB] bg-white text-[#1A1A2E] text-sm font-bold cursor-pointer"
            >
              −
            </button>
            <span className="text-[13px] font-extrabold text-[#1A1A2E] min-w-4 text-center">{qty}</span>
            <button
              type="button"
              onClick={() => setQty((q) => q + 1)}
              className="w-7 h-7 rounded-md border border-[#E5E7EB] bg-white text-[#1A1A2E] text-sm font-bold cursor-pointer"
            >
              +
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {(flags.actionBuyOnline || flags.actionPreOrder) && !isService && (
          <button
            type="button"
            disabled={outOfStock && !flags.actionPreOrder}
            className={`w-full border-none py-3 rounded-lg text-[13px] font-bold inline-flex items-center justify-center gap-2 ${
              outOfStock && !flags.actionPreOrder
                ? 'bg-[#F1F1F3] text-[#9AA0AC] cursor-not-allowed'
                : 'bg-[#FF5B00] text-white cursor-pointer'
            }`}
          >
            <ShoppingCart size={14} />
            {flags.actionPreOrder && outOfStock
              ? 'PRE ORDER'
              : outOfStock
                ? 'OUT OF STOCK'
                : 'ADD TO CART'}
          </button>
        )}

        {flags.actionWish && (
          <button
            type="button"
            onClick={() => setWish((w) => !w)}
            className={`w-full bg-white border py-2.5 rounded-lg text-[12.5px] font-semibold inline-flex items-center justify-center gap-2 cursor-pointer ${
              wish ? 'border-[#FF5B00] text-[#FF5B00]' : 'border-[#E5E7EB] text-[#FF5B00]'
            }`}
          >
            <Heart size={14} className={wish || flags.actionLove ? 'fill-[#FF5B00] text-[#FF5B00]' : ''} />
            {wish ? 'Wishlisted' : 'Add to Wishlist'}
          </button>
        )}

        {flags.actionContactSeller && (
          <button
            type="button"
            className="w-full bg-[#18154C] text-white border-none py-2.5 rounded-lg text-[12.5px] font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <MessageCircleMore size={14} />
            Message Seller
          </button>
        )}

        {flags.actionFindInStore && (
          <button
            type="button"
            className="w-full bg-white border border-[#E5E7EB] py-2.5 rounded-lg text-[12.5px] font-semibold inline-flex items-center justify-center gap-2 cursor-pointer text-[#1A1A2E]"
          >
            <MapPin size={14} className="text-[#FF5B00]" />
            Find in Store
          </button>
        )}

        {flags.actionRequestQuote && (
          <button
            type="button"
            className="w-full bg-white border border-[#E5E7EB] py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-wider text-slate-600 cursor-pointer"
          >
            Request Bulk Quote
          </button>
        )}
      </div>

      <div className="bg-[#F4F7F9] rounded-lg p-3 text-[11px] text-[#4B5563] leading-relaxed">
        📍 Delivery in <b className="text-[#1A1A2E]">Dhaka, Bangladesh</b>
        <br />✓ Standard Delivery Available
      </div>
    </div>
  );
}
