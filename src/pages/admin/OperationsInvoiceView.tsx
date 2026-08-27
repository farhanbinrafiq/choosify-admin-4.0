import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Printer, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { operationsApi } from '../../services/operationsApi';
import type { OpsStorefrontOrder, OpsSubOrder } from '../../services/operationsApi';

/**
 * Real, canonical invoice for the actual Operations order engine -- the
 * legacy /admin/invoice/:id route (InvoiceView.tsx) reads from Commerce,
 * which is dead/non-canonical and has no bearing on real orders placed
 * today. This mirrors the same visual design as choosify-web's
 * InvoicePage so buyer, seller, and admin all see one consistent
 * invoice, sourced from GET /operations/orders/:id (already authorizes
 * the order's buyer / the sub-order's seller / staff server-side).
 */
export function OperationsInvoiceView() {
  const { orderId, sellerId } = useParams<{ orderId: string; sellerId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [order, setOrder] = useState<OpsStorefrontOrder | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    setLoadState('loading');
    operationsApi
      .getOrder(orderId)
      .then((row) => {
        if (cancelled) return;
        setOrder(row);
        setLoadState('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load invoice.');
        setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (!profile) {
    return (
      <div className="p-8 text-center bg-app-bg text-app-text-secondary min-h-screen flex flex-col items-center justify-center">
        <ShieldCheck className="w-12 h-12 text-app-accent mb-4" />
        <p className="text-xs">Please log in to view this invoice.</p>
      </div>
    );
  }

  if (loadState === 'loading') {
    return (
      <div className="flex items-center justify-center h-64 text-app-text-secondary text-sm font-bold">
        Loading invoice…
      </div>
    );
  }

  if (loadState === 'error' || !order) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center gap-2">
        <p className="text-sm font-bold text-app-text-primary">Couldn&apos;t load this invoice.</p>
        <p className="text-xs text-app-text-secondary">{loadError || 'Invoice not found.'}</p>
      </div>
    );
  }

  const isStaff = ['admin', 'super_admin', 'support_agent', 'moderator', 'finance_manager'].includes(profile.role);
  const sub: OpsSubOrder | undefined = order.subOrders.find((s) => s.sellerId === sellerId);
  const authorized = isStaff || (sub && sub.sellerId === profile.id);

  if (!authorized || !sub) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-sm font-bold text-app-text-primary">
          {!sub ? "This seller's invoice couldn't be found on this order." : "You don't have access to this invoice."}
        </p>
      </div>
    );
  }

  const subtotal = sub.items.reduce((acc, it) => acc + it.price * it.quantity, 0);
  const total = subtotal + sub.deliveryFee;
  const invoiceDate = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';
  const paymentLabel = order.isCOD ? 'Cash on Delivery' : order.paymentMethod === 'online' ? 'Online Payment' : 'Credit / EMI';
  const paidLabel = order.isCOD
    ? order.codDeliveryFeePaid
      ? 'Delivery fee paid online, balance due on delivery'
      : 'Balance due on delivery'
    : order.paidAt
      ? `Paid ${new Date(order.paidAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`
      : 'Awaiting payment';

  return (
    <div className="min-h-screen bg-[#F0F8FF] p-4 sm:p-8">
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            .no-print { display: none !important; }
            /* This page renders inside AdminLayout -- its sidebar/header chrome
               isn't part of this component and has no .no-print class of its
               own to opt into, so print/PDF output was showing the whole
               dashboard shell around the invoice. Hide it by the layout's own
               stable selectors instead of restructuring the route. */
            aside, header.glass-header { display: none !important; }
            main { margin: 0 !important; padding: 0 !important; }
            body { background: #ffffff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .invoice-card { box-shadow: none !important; border: none !important; margin: 0 !important; }
            @page { margin: 15mm; size: A4; }
          }
        `,
      }} />

      <div className="max-w-[840px] mx-auto mb-6 flex items-center justify-between gap-4 no-print">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-app-border rounded-lg text-xs font-bold text-app-text-secondary hover:text-app-accent hover:border-app-accent/40 transition-colors"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-app-text-secondary bg-white border border-app-border px-2 py-1 rounded-md">
            {isStaff ? 'Admin View' : 'Seller View'}
          </span>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 bg-app-accent hover:bg-[#E64A00] text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
          >
            <Printer size={14} /> Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="invoice-card max-w-[840px] mx-auto bg-white rounded-lg border border-slate-200 shadow-2xl p-6 sm:p-12 flex flex-col justify-between">
        <div>
          {/* Choosify header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 mb-6">
            <div>
              <img src="/brand/choosify-logo-horizontal-navy.svg" alt="Choosify" className="h-10 w-auto max-w-[220px] mb-2" />
              <div className="text-[11px] font-black tracking-widest text-slate-400 uppercase">Choosify Marketplace</div>
              <div className="text-xs text-slate-400 mt-2 leading-relaxed font-medium">
                choosify.bd<br />
                support@choosify.bd
              </div>
            </div>
            <div className="sm:text-right font-medium">
              <div className="text-[11px] font-black tracking-widest text-slate-900 uppercase mb-1">Business Address</div>
              <div className="text-xs text-slate-800 leading-relaxed">
                <span className="font-semibold text-slate-900">Uttara, Dhaka - 1230, Bangladesh</span><br />
                Trade License: TR-2026-REG-1099
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100 my-5" />

          {/* Billed to / invoice meta */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
            <div>
              <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-2">Billed To</div>
              <div className="text-base font-extrabold text-[#000435]">{order.shipping?.fullName || 'Buyer'}</div>
              <div className="text-xs text-slate-500 mt-1.5 leading-relaxed font-medium">
                {order.shipping?.address || '—'}{order.shipping?.region ? `, ${order.shipping.region}` : ''}<br />
                Phone: {order.shipping?.phone || '—'}
              </div>
            </div>
            <div className="flex flex-col md:items-end">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-left md:text-right">
                <div className="text-slate-400 uppercase tracking-wider font-semibold">Invoice Number</div>
                <div className="font-extrabold text-[#000435]">#{sub.invoiceId}</div>

                <div className="text-slate-400 uppercase tracking-wider font-semibold self-center">Invoice Amount</div>
                <div className="text-[26px] font-black text-app-accent leading-none">৳ {total.toLocaleString()}</div>

                <div className="text-slate-400 uppercase tracking-wider font-semibold">Order Reference</div>
                <div className="font-semibold text-slate-800">{order.orderId}</div>

                <div className="text-slate-400 uppercase tracking-wider font-semibold">Invoice Date</div>
                <div className="font-semibold text-slate-800">{invoiceDate}</div>
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100 my-5" />

          {/* Seller strip -- real business name only, no fabricated license/verification claims */}
          <div className="bg-[#F8F8F8] border border-slate-100 rounded-lg p-4 flex items-center justify-between gap-4 mb-5">
            <div>
              <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-0.5">Sold By</div>
              <div className="font-extrabold text-slate-900 text-sm">{sub.sellerBusinessName || 'Choosify Marketplace Seller'}</div>
            </div>
            <span className="text-[9.5px] font-black text-app-accent bg-orange-50 border border-orange-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
              Marketplace Seller
            </span>
          </div>

          {/* Items table -- every real line item, not a single hardcoded row */}
          <div className="mb-6">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="pb-3 text-[11px] font-bold text-slate-400 tracking-wider uppercase text-left">Item</th>
                  <th className="pb-3 text-[11px] font-bold text-slate-400 tracking-wider uppercase text-right">Qty</th>
                  <th className="pb-3 text-[11px] font-bold text-slate-400 tracking-wider uppercase text-right">Rate</th>
                  <th className="pb-3 text-[11px] font-bold text-slate-400 tracking-wider uppercase text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {sub.items.map((item, idx) => (
                  <tr key={item.itemId || idx} className="border-b border-slate-100">
                    <td className="py-4">
                      <div className="font-bold text-[#000435] text-sm">{item.productTitle}</div>
                      {item.productType === 'service' && item.serviceCategory && (
                        <div className="text-[11px] text-slate-400 mt-1">{item.serviceCategory}</div>
                      )}
                    </td>
                    <td className="py-4 text-right text-slate-700 font-medium">{item.quantity}</td>
                    <td className="py-4 text-right text-slate-700 font-medium">৳ {item.price.toLocaleString()}</td>
                    <td className="py-4 text-right text-slate-900 font-extrabold">৳ {(item.price * item.quantity).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div className="flex justify-end mb-6">
            <div className="w-full sm:w-[300px] text-xs space-y-2 font-medium">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal:</span>
                <span>৳ {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Delivery Fee:</span>
                <span>৳ {sub.deliveryFee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-extrabold text-sm text-app-accent border-t border-slate-100 pt-2.5">
                <span>Total:</span>
                <span className="text-base font-black">৳ {total.toLocaleString()}</span>
              </div>
              <div className="text-right space-y-1">
                <span className="inline-block mt-2 text-[10px] font-bold text-white bg-[#000435] px-2.5 py-0.5 rounded uppercase tracking-wider">
                  {paymentLabel}
                </span>
                <div className="text-[10.5px] text-slate-500">{paidLabel}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t-2 border-app-accent pt-5 flex justify-between items-start">
          <div className="max-w-[80%]">
            <div className="text-lg font-extrabold text-[#000435] mb-1">Thanks for shopping with Choosify.</div>
            <div className="text-[10px] text-slate-400 leading-relaxed">
              This is a system-generated invoice — no signature required. Powered by Choosify.bd
            </div>
          </div>
          <img src="/brand/choosify-logo-icon.svg" alt="" className="w-14 h-14 opacity-15 object-contain shrink-0" />
        </div>
      </div>

      {isStaff && (
        <div className="max-w-[840px] mx-auto mt-6 no-print">
          <div className="p-4 bg-app-bg border border-app-border rounded-lg flex items-center justify-between text-xs text-app-text-secondary">
            <span>Order status: <strong className="text-app-text-primary">{order.status}</strong></span>
            <Link to={`/admin/orders?order=${order.orderId}`} className="text-app-accent font-bold hover:underline">
              View in Order Hub →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default OperationsInvoiceView;
