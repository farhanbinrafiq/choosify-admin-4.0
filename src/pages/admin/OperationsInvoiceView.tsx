import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Printer, Download, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { operationsApi } from '../../services/operationsApi';
import type { OpsStorefrontOrder } from '../../services/operationsApi';
import { buildInvoiceViewModel, invoiceActionEligible, resolveOrderHubViewer } from './orderHubModel';

/** Fetches the same logo used on-screen/in emails and returns it as a data:
 *  URL for jsPDF's addImage (same-origin static asset — no CORS concerns). */
async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch('/brand/choosify-logo-horizontal-navy.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Real, canonical invoice for the actual Operations order engine -- the
 * legacy /admin/invoice/:id route (InvoiceView.tsx) reads from Commerce,
 * which is dead/non-canonical and has no bearing on real orders placed
 * today. This mirrors the same visual design as choosify-web's
 * InvoicePage so buyer, seller, and admin all see one consistent
 * invoice, sourced from GET /operations/orders/:id (already authorizes
 * the order's buyer / the sub-order's seller / staff server-side).
 *
 * Screen, Print and (later) Download-PDF all read the SAME
 * buildInvoiceViewModel() — zero duplicated financial calculations. If the
 * sub-order has no invoiceId yet and is otherwise eligible, this page asks
 * the server to lazily/idempotently mint one (POST .../subs/:sellerId/invoice)
 * — the first real request for an eligible order gets a permanent number;
 * every request after that (including for pre-existing historical orders)
 * gets the same one back.
 */
export function OperationsInvoiceView() {
  const { orderId, sellerId } = useParams<{ orderId: string; sellerId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();

  const [order, setOrder] = useState<OpsStorefrontOrder | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [invoicePrep, setInvoicePrep] = useState<'pending' | 'ready' | 'unavailable'>('pending');
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);
  const [pdfState, setPdfState] = useState<'idle' | 'generating' | 'error'>('idle');
  const autoPrinted = useRef(false);
  const printRootRef = useRef<HTMLDivElement | null>(null);

  /** Fire the browser print dialog only once the invoice's fonts + images are
   *  actually ready — deterministic, not a fixed delay. */
  const printInvoice = React.useCallback(async () => {
    try {
      const root = printRootRef.current;
      if (root) {
        const imgs = Array.from(root.querySelectorAll('img'));
        await Promise.all(
          imgs.map((img) =>
            img.complete
              ? Promise.resolve()
              : new Promise<void>((res) => {
                  img.addEventListener('load', () => res(), { once: true });
                  img.addEventListener('error', () => res(), { once: true });
                }),
          ),
        );
      }
      if ('fonts' in document) {
        await (document as Document & { fonts: FontFaceSet }).fonts.ready;
      }
    } catch {
      /* best effort — still print */
    }
    await new Promise((res) => requestAnimationFrame(() => res(null)));
    window.print();
  }, []);

  // Order Hub "Print" opens this page with ?autoprint=1 → auto-fire once the
  // real invoice is actually ready to print (not merely once the order loaded).
  useEffect(() => {
    if (loadState !== 'ready' || invoicePrep !== 'ready' || autoPrinted.current) return;
    if (searchParams.get('autoprint') !== '1') return;
    autoPrinted.current = true;
    void printInvoice();
  }, [loadState, invoicePrep, searchParams, printInvoice]);

  useEffect(() => {
    if (!orderId || !sellerId) return;
    let cancelled = false;
    setLoadState('loading');
    setInvoicePrep('pending');
    operationsApi
      .getOrder(orderId)
      .then(async (row) => {
        if (cancelled) return;
        setOrder(row);
        setLoadState('ready');

        const viewer = resolveOrderHubViewer(profile);
        if (!invoiceActionEligible(row, viewer, sellerId)) {
          if (cancelled) return;
          setInvoicePrep('unavailable');
          setUnavailableReason(
            row.status === 'cancelled' || row.status === 'pending_payment'
              ? `This order is ${row.status === 'pending_payment' ? 'awaiting payment' : 'cancelled'} — no invoice is issued for it.`
              : "This order's financial data hasn't been finalized yet, so an invoice can't be generated.",
          );
          return;
        }
        const existingInvoiceId = row.subOrders.find((s) => s.sellerId === sellerId)?.invoiceId;
        if (existingInvoiceId) {
          if (!cancelled) setInvoicePrep('ready');
          return;
        }
        try {
          const result = await operationsApi.ensureInvoiceNumber(orderId, sellerId);
          if (cancelled) return;
          if (!result.eligible || !result.invoiceId) {
            setInvoicePrep('unavailable');
            setUnavailableReason("This order's financial data hasn't been finalized yet, so an invoice can't be generated.");
            return;
          }
          setOrder((prev) =>
            prev
              ? {
                  ...prev,
                  subOrders: prev.subOrders.map((s) =>
                    s.sellerId === sellerId ? { ...s, invoiceId: result.invoiceId! } : s,
                  ),
                }
              : prev,
          );
          setInvoicePrep('ready');
        } catch (err) {
          if (cancelled) return;
          setInvoicePrep('unavailable');
          setUnavailableReason(err instanceof Error ? err.message : 'Unable to prepare this invoice.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load invoice.');
        setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, sellerId]);

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
  const sub = order.subOrders.find((s) => s.sellerId === sellerId);
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

  if (invoicePrep === 'pending') {
    return (
      <div className="flex items-center justify-center h-64 text-app-text-secondary text-sm font-bold">
        Preparing invoice…
      </div>
    );
  }

  if (invoicePrep === 'unavailable') {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center gap-3 px-6">
        <AlertTriangle className="w-10 h-10 text-amber-500" />
        <p className="text-sm font-bold text-app-text-primary">Invoice unavailable</p>
        <p className="text-xs text-app-text-secondary max-w-sm">{unavailableReason}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-2 flex items-center gap-1.5 px-3 py-2 bg-white border border-app-border rounded-lg text-xs font-bold text-app-text-secondary hover:text-app-accent hover:border-app-accent/40 transition-colors"
        >
          <ArrowLeft size={14} /> Back
        </button>
      </div>
    );
  }

  const viewer = resolveOrderHubViewer(profile);
  const vm = buildInvoiceViewModel(order, viewer, sellerId);
  const invoiceDate = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  /** Direct .pdf download — no print dialog, no Chrome header/footer
   *  dependency. Same InvoiceViewModel as screen/print; zero duplicate math.
   *  jsPDF/jspdf-autotable are dynamically imported so they never load into
   *  the bundle for pages that never open an invoice. */
  const downloadPdf = async () => {
    if (pdfState === 'generating') return;
    setPdfState('generating');
    try {
      const [{ buildInvoicePdf, invoicePdfFilename }, logoDataUrl] = await Promise.all([
        import('./invoicePdf'),
        loadLogoDataUrl(),
      ]);
      const doc = buildInvoicePdf({ vm, order, invoiceDate, logoDataUrl });
      doc.save(invoicePdfFilename(vm.invoiceNumber, order.orderId));
      setPdfState('idle');
    } catch (err) {
      console.error('Invoice PDF generation failed', err);
      setPdfState('error');
    }
  };

  return (
    <div className="invoice-print-page min-h-screen bg-[#F0F8FF] p-4 sm:p-8">
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            /* 1. Remove the dashboard shell. AdminLayout renders a mobile
                  <aside class="sidebar">, a desktop <div class="sidebar"> inside
                  a resizable panel, and a <header class="glass-header"> topbar
                  (search + messenger + notifications + avatar). None of these
                  belong on a printed invoice. */
            aside,
            .sidebar,
            header.glass-header,
            .glass-header,
            .no-print,
            [data-print="hide"] { display: none !important; }

            /* 2. Neutralize the shell's full-height / overflow / flex layout so
                  the invoice is ordinary block content that paginates naturally. */
            html, body, #root, #root > div, main {
              display: block !important;
              height: auto !important;
              min-height: 0 !important;
              max-height: none !important;
              overflow: visible !important;
              background: #ffffff !important;
              margin: 0 !important;
              padding: 0 !important;
              float: none !important;
            }
            main { flex: none !important; }
            .invoice-print-page {
              background: #ffffff !important;
              padding: 0 !important;
              min-height: 0 !important;
            }

            /* 3. The invoice itself fills the printable width; drop the on-screen
                  card decoration. */
            #invoice-print-root {
              width: 100% !important;
              max-width: none !important;
              margin: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
              border: none !important;
              border-radius: 0 !important;
            }

            /* 4. A4 portrait with sensible margins — not dependent on the user's
                  print-scale setting. Chrome's own Headers & footers checkbox is
                  browser-owned; we add none of our own. */
            @page { size: A4 portrait; margin: 14mm 12mm; }

            /* 5. Multi-page hygiene. */
            #invoice-print-root table { width: 100% !important; border-collapse: collapse; }
            #invoice-print-root thead { display: table-header-group !important; } /* repeat item header on each page */
            #invoice-print-root tfoot { display: table-footer-group !important; }
            #invoice-print-root tr { break-inside: avoid !important; page-break-inside: avoid !important; }
            #invoice-print-root .invoice-summary,
            #invoice-print-root .invoice-footer,
            #invoice-print-root .invoice-billing { break-inside: avoid !important; page-break-inside: avoid !important; }
            #invoice-print-root .invoice-header { break-after: avoid !important; }

            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
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
            onClick={() => void printInvoice()}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-app-border hover:border-app-accent/40 hover:text-app-accent text-app-text-secondary rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
          >
            <Printer size={14} /> Print Invoice
          </button>
          <button
            onClick={() => void downloadPdf()}
            disabled={pdfState === 'generating'}
            className="flex items-center gap-1.5 px-4 py-2 bg-app-accent hover:bg-[#FF5B00] text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {pdfState === 'generating' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {pdfState === 'generating' ? 'Generating PDF…' : 'Download PDF'}
          </button>
        </div>
      </div>
      {pdfState === 'error' && (
        <div className="max-w-[840px] mx-auto mb-4 -mt-2 no-print">
          <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
            We couldn&apos;t generate this invoice PDF. Please try again.
          </div>
        </div>
      )}

      <div
        ref={printRootRef}
        id="invoice-print-root"
        className="invoice-card max-w-[840px] mx-auto bg-white rounded-lg border border-slate-200 shadow-2xl p-6 sm:p-12 flex flex-col justify-between"
      >
        <div>
          {/* Choosify header */}
          <div className="invoice-header flex flex-col sm:flex-row sm:items-start justify-between gap-6 mb-6">
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
          <div className="invoice-billing grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
            <div>
              <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-2">Billed To</div>
              <div className="text-base font-extrabold text-[#18154C]">{order.shipping?.fullName || 'Buyer'}</div>
              <div className="text-xs text-slate-500 mt-1.5 leading-relaxed font-medium">
                {order.shipping?.address || '—'}{order.shipping?.region ? `, ${order.shipping.region}` : ''}<br />
                Phone: {order.shipping?.phone || '—'}
              </div>
            </div>
            <div className="flex flex-col md:items-end">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-left md:text-right">
                <div className="text-slate-400 uppercase tracking-wider font-semibold">Invoice Number</div>
                <div className="font-extrabold text-[#18154C]">{vm.invoiceNumber ? `#${vm.invoiceNumber}` : '—'}</div>

                <div className="text-slate-400 uppercase tracking-wider font-semibold self-center">Invoice Amount</div>
                <div className="text-[26px] font-black text-app-accent leading-none">৳ {vm.grandTotal.toLocaleString()}</div>

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
                {vm.lines.map((item, idx) => (
                  <tr key={item.itemId || idx} className="border-b border-slate-100">
                    <td className="py-4">
                      <div className="font-bold text-[#18154C] text-sm">{item.title}</div>
                      {item.serviceCategory && (
                        <div className="text-[11px] text-slate-400 mt-1">{item.serviceCategory}</div>
                      )}
                      {item.variantLabel || item.variantSku ? (
                        <div className="text-[11px] text-slate-500 mt-1">
                          {item.variantLabel}
                          {item.variantLabel && item.variantSku ? ' · ' : ''}
                          {item.variantSku ? `SKU ${item.variantSku}` : ''}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-4 text-right text-slate-700 font-medium">{item.qty}</td>
                    <td className="py-4 text-right text-slate-700 font-medium">৳ {item.unitPrice.toLocaleString()}</td>
                    <td className="py-4 text-right text-slate-900 font-extrabold">৳ {item.lineTotal.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div className="invoice-summary flex justify-end mb-6">
            <div className="w-full sm:w-[300px] text-xs space-y-2 font-medium">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal:</span>
                <span>৳ {vm.itemsSubtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Delivery Fee:</span>
                <span>৳ {vm.deliveryTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-extrabold text-sm text-app-accent border-t border-slate-100 pt-2.5">
                <span>Total:</span>
                <span className="text-base font-black">৳ {vm.grandTotal.toLocaleString()}</span>
              </div>
              <div className="text-right space-y-1">
                <span className="inline-block mt-2 text-[10px] font-bold text-white bg-[#18154C] px-2.5 py-0.5 rounded uppercase tracking-wider">
                  {vm.paymentMethodLabel}
                </span>
                <div className="text-[10.5px] text-slate-500">{vm.paymentStatusLabel}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="invoice-footer border-t-2 border-app-accent pt-5 flex justify-between items-start">
          <div className="max-w-[80%]">
            <div className="text-lg font-extrabold text-[#18154C] mb-1">Thanks for shopping with Choosify.</div>
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
