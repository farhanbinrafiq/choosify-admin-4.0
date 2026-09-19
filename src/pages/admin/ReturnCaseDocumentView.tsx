import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { operationsApi } from '../../services/operationsApi';

/**
 * RETURN / REFUND CASE DOCUMENT — a service/case record, deliberately NOT a
 * sales invoice. Mirrors WarrantyClaimDocumentView.tsx (same Choosify
 * document language) — all data derives from GET /operations/returns/:id/
 * document, never fabricated, and internal-only notes are never included.
 */

const STATUS_LABEL: Record<string, string> = {
  initiated: 'New Request',
  approved: 'Approved',
  rejected: 'Rejected',
  returned_in_transit: 'Return In Transit',
  received: 'Item Received',
  refunded: 'Refunded',
  dispute: 'Disputed',
};

const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

export default function ReturnCaseDocumentView() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Awaited<ReturnType<typeof operationsApi.getReturnDocument>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    operationsApi
      .getReturnDocument(id)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load document'));
  }, [id]);

  if (error) {
    return <div className="p-10 text-center text-sm text-rose-600">{error}</div>;
  }
  if (!data) {
    return <div className="p-10 text-center text-sm text-slate-400">Loading…</div>;
  }

  const { returnCase: rc, buyer, seller, product } = data;
  const isResolved = rc.status === 'refunded' || rc.status === 'rejected';

  return (
    <div className="max-w-3xl mx-auto p-8 print:p-0 bg-white text-[#111827]">
      <div className="flex items-center justify-between mb-8 print:hidden">
        <div />
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-lg bg-slate-100 text-slate-700"
        >
          <Printer className="w-3.5 h-3.5" /> Print / Save PDF
        </button>
      </div>

      <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 mb-6">
        <div>
          <div className="text-lg font-black tracking-tight">choosify</div>
          <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Choosify Bangladesh Ltd.</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-black uppercase tracking-wide">
            {isResolved ? 'Return / Refund Service Record' : 'Return / Refund Case Document'}
          </div>
          <div className="text-[10px] text-slate-500 font-semibold">Not a tax invoice — service/case record only</div>
          <div className="mt-1 font-mono text-xs font-bold">{rc.referenceId || rc.id}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 text-xs mb-6">
        <div>
          <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Buyer</div>
          <div className="font-bold">{buyer?.name || '—'}</div>
          <div className="text-slate-500">{buyer?.choosifyUserId || '—'}</div>
          <div className="text-slate-500">{buyer?.email || '—'}</div>
        </div>
        <div>
          <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Seller</div>
          <div className="font-bold">{seller?.name || '—'}</div>
          <div className="text-slate-500">{seller?.choosifyUserId || '—'}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 text-xs mb-6 border-t border-slate-100 pt-4">
        <div>
          <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Order</div>
          <div>{rc.orderId}</div>
        </div>
        <div>
          <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Product</div>
          <div>{product?.title || '—'}</div>
          {product?.variant && <div className="text-slate-500">Variant: {product.variant}</div>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs mb-6 border-t border-slate-100 pt-4">
        <div>
          <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Resolution</div>
          <div className="font-bold">
            {rc.status === 'initiated' ? 'Pending decision' : rc.requiresReturn === false ? 'Refund without return' : 'Return + Refund'}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Refund amount</div>
          <div className="font-bold font-mono">{typeof rc.refundAmount === 'number' ? `৳${rc.refundAmount.toLocaleString()}` : '—'}</div>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4 mb-6 text-xs">
        <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Case submitted</div>
        <div className="mb-3">{fmt(rc.createdAt)}</div>
        <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Reason reported</div>
        <div className="mb-1 font-bold capitalize">{rc.reason.replace(/_/g, ' ')}</div>
        <div className="text-slate-600 whitespace-pre-wrap">{rc.description}</div>
      </div>

      {rc.returnTrackingId && (
        <div className="border-t border-slate-100 pt-4 mb-6 text-xs">
          <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Return shipment</div>
          <div>{rc.returnCourier} · <span className="font-mono">{rc.returnTrackingId}</span></div>
        </div>
      )}

      <div className="border-t border-slate-100 pt-4 mb-6 text-xs">
        <div className="text-[10px] font-black uppercase text-slate-400 mb-2">Case status</div>
        <div className="font-bold">{STATUS_LABEL[rc.status] || rc.status}</div>
        {isResolved && rc.updatedAt && <div className="text-slate-500 mt-1">Last updated: {fmt(rc.updatedAt)}</div>}
      </div>

      <div className="text-center text-[10px] text-slate-400 pt-6 border-t border-slate-100">
        This document reflects the canonical return/refund case record as of {new Date().toLocaleString()}. Generated by Choosify.
      </div>
    </div>
  );
}
