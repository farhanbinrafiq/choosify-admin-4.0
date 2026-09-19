import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { warrantyClaimsApi, type WarrantyClaimResolutionType } from '../../services/warrantyClaimsApi';

/**
 * WARRANTY DELIVERY INVOICE — a service/case record, deliberately NOT a sales
 * invoice. It reuses the same Choosify document visual language (logo, print
 * layout, monospace reference-id block) as the canonical invoice system, but
 * carries only warranty-claim facts: no line items, no tax, no totals.
 *
 * Only exists once a claim has actually been accepted and is moving through
 * repair — there is nothing to generate for a request still pending review,
 * and the backend (GET /operations/warranty-claims/:id/document) rejects the
 * request with a 400 before that. Available from approval through
 * resolution. All data is never fabricated client-side, and internal-only
 * notes are never included in that response.
 */

const RESOLUTION_TYPE_LABEL: Record<WarrantyClaimResolutionType, string> = {
  repaired: 'Repaired',
  replaced: 'Replaced',
  refunded: 'Refunded',
  rejected: 'Rejected',
  no_fault_found: 'No Fault Found',
  other: 'Other',
};

const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

export default function WarrantyClaimDocumentView() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Awaited<ReturnType<typeof warrantyClaimsApi.getDocument>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    warrantyClaimsApi
      .getDocument(id)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load document'));
  }, [id]);

  if (error) {
    return <div className="p-10 text-center text-sm text-rose-600">{error}</div>;
  }
  if (!data) {
    return <div className="p-10 text-center text-sm text-slate-400">Loading…</div>;
  }

  const { claim, buyer, seller, product } = data;
  const isResolved = claim.status === 'resolved' || claim.status === 'rejected';

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
          <div className="text-sm font-black uppercase tracking-wide">Warranty Delivery Invoice</div>
          <div className="text-[10px] text-slate-500 font-semibold">Not a tax invoice — service/case record only</div>
          <div className="mt-1 font-mono text-xs font-bold">{claim.referenceId || claim.id}</div>
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
          <div>{claim.orderId}</div>
        </div>
        <div>
          <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Product</div>
          <div>{product?.title || '—'}</div>
          {product?.variant && <div className="text-slate-500">Variant: {product.variant}</div>}
          {product?.serialNumber && <div className="text-slate-500">Serial: {product.serialNumber}</div>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 text-xs mb-6 border-t border-slate-100 pt-4">
        <div>
          <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Warranty duration</div>
          <div>{claim.warrantyMonthsAtPurchase ? `${claim.warrantyMonthsAtPurchase} months` : '—'}</div>
        </div>
        <div>
          <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Coverage start</div>
          <div>{fmt(claim.warrantyStartsAt)}</div>
        </div>
        <div>
          <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Coverage expiry</div>
          <div>{fmt(claim.warrantyExpiresAt)}</div>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4 mb-6 text-xs">
        <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Claim submitted</div>
        <div className="mb-3">{fmt(claim.submittedAt)}</div>
        <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Issue reported</div>
        <div className="mb-1 font-bold">{claim.issueType.replace(/_/g, ' ')}</div>
        <div className="text-slate-600 whitespace-pre-wrap">{claim.description}</div>
      </div>

      <div className="border-t border-slate-100 pt-4 mb-6 text-xs">
        <div className="text-[10px] font-black uppercase text-slate-400 mb-2">Case status</div>
        <div className="font-bold mb-1">
          {isResolved ? 'Resolved' : `Status: ${claim.status.replace(/_/g, ' ')}`}
          {claim.serviceStage ? ` · ${claim.serviceStage.replace(/_/g, ' ')}` : ''}
        </div>
        {claim.estimatedCompletionDate && !isResolved && (
          <div className="text-slate-500">Estimated completion: {fmt(claim.estimatedCompletionDate)}</div>
        )}
        {isResolved && (
          <>
            <div className="mt-2">
              <span className="font-bold">Outcome:</span>{' '}
              {claim.resolutionType ? RESOLUTION_TYPE_LABEL[claim.resolutionType] : '—'}
            </div>
            <div className="text-slate-600 whitespace-pre-wrap mt-1">{claim.resolutionNotes}</div>
            <div className="text-slate-500 mt-1">Resolved: {fmt(claim.resolvedAt)}</div>
          </>
        )}
      </div>

      <div className="text-center text-[10px] text-slate-400 pt-6 border-t border-slate-100">
        This document reflects the canonical warranty claim record as of {new Date().toLocaleString()}. Generated by Choosify.
      </div>
    </div>
  );
}
