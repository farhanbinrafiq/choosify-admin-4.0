import React, { useEffect, useMemo, useState } from 'react';
import { X, Loader2, CheckCircle2, Search, Plus, Trash2, Copy } from 'lucide-react';
import { catalogApi } from '../../services/catalogApi';
import { operationsApi } from '../../services/operationsApi';
import { useAuth } from '../../contexts/AuthContext';
import { isPlausibleEmail, isPlausibleBdPhone } from '../../lib/identityNormalizeClient';
import type { ExtractedOrderDraft, ExtractOptionGroup } from '../../lib/manualOrderExtract';

/**
 * Create Manual Order — the single Seller-facing manual-order UI, on the
 * canonical /operations/manual-offers flow.
 *
 *  • native   — an existing Choosify Buyer (prefill.buyerId): the Offer Card
 *    lands in their Messages; they Accept/Reject; no claim link.
 *  • external — a Meta/offline customer (no account): Name + Email + Phone
 *    mandatory; the server returns a secure review/claim link the Seller
 *    sends back through the conversation. The customer signs in, verifies a
 *    matching identity, and confirms — the SAME order then appears in their
 *    My Orders. No second order engine, no address-book here (the Buyer
 *    picks their canonical address at confirmation).
 *
 * Extraction (`extracted`) only pre-fills the draft — nothing is submitted
 * without the Seller reviewing the whole form.
 */

type ProvSource =
  | 'manual'
  | 'external_whatsapp'
  | 'external_facebook'
  | 'external_instagram'
  | 'external_offline';

export interface ManualOrderPrefill {
  buyerId?: string;
  buyerName?: string;
  customerName?: string;
  email?: string;
  phone?: string;
  addressHint?: string;
  conversationId?: string;
  provenanceSource?: ProvSource;
}

interface CatalogLine {
  key: string;
  productId: string;
  picked: boolean;
  query: string;
  quantity: number;
  unitPrice: string;
}

interface MappedProduct {
  id: string;
  name: string;
  brand: string;
  price: number;
}

const newLine = (): CatalogLine => ({
  key: Math.random().toString(36).slice(2),
  productId: '',
  picked: false,
  query: '',
  quantity: 1,
  unitPrice: '',
});

function DetectedBadge({ low }: { low?: boolean }) {
  return (
    <span
      className={`ml-1 inline-flex items-center text-[8.5px] font-bold uppercase tracking-wide px-1 py-0.5 rounded border ${
        low
          ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
          : 'bg-sky-500/10 text-sky-600 border-sky-500/20'
      }`}
    >
      {low ? 'needs review' : 'detected'}
    </span>
  );
}

export function ManualOrderDialog({
  open,
  onClose,
  prefill,
  extracted,
  productOptionGroups,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  prefill?: ManualOrderPrefill;
  extracted?: ExtractedOrderDraft;
  productOptionGroups?: ExtractOptionGroup[];
  onCreated?: (result: { offerId: string; claimUrl?: string }) => void;
}) {
  const { profile } = useAuth();
  const isNative = !!prefill?.buyerId;

  const [products, setProducts] = useState<MappedProduct[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [lines, setLines] = useState<CatalogLine[]>([newLine()]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [addressHint, setAddressHint] = useState('');
  const [deliveryTotal, setDeliveryTotal] = useState('0');
  const [notes, setNotes] = useState('');

  const [detected, setDetected] = useState<{
    name?: boolean; email?: boolean; phone?: boolean; address?: boolean; low: Set<string>;
  }>({ low: new Set() });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<
    { offerId: string; claim?: { url: string; expiresAt?: string }; native: boolean } | null
  >(null);
  const [copied, setCopied] = useState(false);

  // ── reset on open, apply prefill + extraction ────────────────────────
  useEffect(() => {
    if (!open) return;
    setLines([newLine()]);
    setDeliveryTotal('0');
    setNotes('');
    setError(null);
    setResult(null);
    setCopied(false);

    const low = new Set<string>();
    const g = extracted;
    const pName = g?.name?.value || prefill?.customerName || prefill?.buyerName || '';
    const pEmail = g?.email?.value || prefill?.email || '';
    const pPhone = g?.phone?.value || prefill?.phone || '';
    const pAddr = g?.address?.value || prefill?.addressHint || '';
    setName(pName);
    setEmail(pEmail);
    setPhone(pPhone);
    setAddressHint(pAddr);
    if (g?.name?.confidence === 'low') low.add('name');
    if (g?.email?.confidence === 'low') low.add('email');
    if (g?.phone?.confidence === 'low') low.add('phone');
    if (g?.address?.confidence === 'low') low.add('address');
    setDetected({
      name: !!g?.name, email: !!g?.email, phone: !!g?.phone, address: !!g?.address, low,
    });
    if (g?.quantity) {
      setLines((prev) => [{ ...prev[0], quantity: g.quantity!.value }, ...prev.slice(1)]);
    }
  }, [open, prefill, extracted]);

  useEffect(() => {
    if (!open || products.length > 0) return;
    let cancelled = false;
    setCatalogLoading(true);
    catalogApi
      .listProducts({ status: 'active' })
      .then((rows) => {
        if (cancelled) return;
        setProducts(
          rows
            .filter((p) => !!p.sellerId)
            .map((p) => ({ id: p.id, name: p.title, brand: p.brandName, price: p.price })),
        );
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load your catalog'))
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, products.length]);

  const findProduct = (id: string) => products.find((p) => p.id === id) || null;

  const lineItems = useMemo(
    () =>
      lines
        .filter((l) => l.productId)
        .map((l) => {
          const p = findProduct(l.productId);
          const price = l.unitPrice ? Number.parseFloat(l.unitPrice) : p?.price || 0;
          return { productId: l.productId, quantity: l.quantity || 1, price };
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines, products],
  );

  const subtotal = lineItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const delivery = Number.parseFloat(deliveryTotal) || 0;
  const total = subtotal + delivery;

  if (!open) return null;

  const setLine = (key: string, patch: Partial<CatalogLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lineItems.length === 0) {
      setError('Add at least one product.');
      return;
    }
    if (lineItems.some((i) => !(i.price > 0))) {
      setError('Every line needs a unit price greater than 0.');
      return;
    }
    if (!isNative) {
      if (!name.trim()) return setError('Customer name is required.');
      if (!isPlausibleEmail(email)) return setError('A valid customer email is required.');
      if (!isPlausibleBdPhone(phone)) return setError('A valid Bangladesh phone number is required.');
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await operationsApi.createManualOffer({
        buyerId: isNative ? prefill!.buyerId : undefined,
        buyerName: isNative ? prefill?.buyerName : undefined,
        customerName: isNative ? undefined : name.trim(),
        email: isNative ? undefined : email.trim(),
        phone: isNative ? undefined : phone.trim(),
        addressHint: isNative || !addressHint.trim() ? undefined : addressHint.trim(),
        conversationId: prefill?.conversationId,
        provenanceSource: prefill?.provenanceSource || (isNative ? 'manual' : 'external_offline'),
        deliveryTotal: delivery,
        notes: notes.trim() || undefined,
        sellerName: profile?.displayName,
        items: lineItems,
      });
      const offerId = res.data.offerId || res.data.orderId || 'offer';
      setResult({ offerId, claim: res.claim, native: isNative });
      onCreated?.({ offerId, claimUrl: res.claim?.url });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the order offer');
    } finally {
      setSubmitting(false);
    }
  };

  const suggestedMessage = result?.claim
    ? `Your Choosify order has been prepared. Review and confirm it here:\n${result.claim.url}`
    : '';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-lg bg-app-card border border-app-border rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-app-border sticky top-0 bg-app-card z-10">
          <h3 className="text-sm font-black text-app-text-primary m-0">
            {isNative ? 'Create Manual Order' : 'Create Manual Order · External customer'}
          </h3>
          <button type="button" onClick={onClose} className="text-app-text-secondary hover:text-app-text-primary">
            <X className="w-4 h-4" />
          </button>
        </div>

        {result ? (
          <div className="p-5 space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            {result.native ? (
              <>
                <p className="text-sm font-bold text-app-text-primary text-center m-0">Offer sent</p>
                <p className="text-xs text-app-text-secondary text-center m-0">
                  {prefill?.buyerName || 'The buyer'} will see it in their Messages and can Accept or
                  Decline. Status: <b>awaiting buyer response</b>.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-app-text-primary text-center m-0">
                  Order prepared — awaiting customer confirmation
                </p>
                <p className="text-[11px] text-app-text-secondary text-center m-0">
                  Send this secure link to the customer through your Meta conversation. They sign in,
                  verify a matching identity, and confirm — the order then appears in their My Orders.
                </p>
                <textarea
                  readOnly
                  value={suggestedMessage}
                  rows={3}
                  className="w-full p-2 border border-app-border rounded-lg text-[11px] bg-app-bg text-app-text-primary resize-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(result.claim!.url).then(
                      () => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      },
                      () => undefined,
                    );
                  }}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-app-accent text-white text-xs font-bold"
                >
                  <Copy className="w-3.5 h-3.5" /> {copied ? 'Copied' : 'Copy Order Link'}
                </button>
                <p className="text-[9.5px] text-app-text-secondary text-center m-0">
                  Live Meta send arrives with outbound messaging — until then, paste it into the chat.
                </p>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-full mt-1 px-4 py-2 rounded-xl border border-app-border text-xs font-bold text-app-text-secondary"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-4 space-y-3">
            {/* ── Items ─────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary">
                Products
              </span>
              <button
                type="button"
                onClick={() => setLines((p) => [...p, newLine()])}
                className="flex items-center gap-1 text-[10.5px] font-bold text-app-accent"
              >
                <Plus className="w-3 h-3" /> Add item
              </button>
            </div>

            {lines.map((l) => {
              const selected = findProduct(l.productId);
              const matches =
                l.query.trim() && !l.picked
                  ? products
                      .filter(
                        (p) =>
                          p.name.toLowerCase().includes(l.query.toLowerCase()) ||
                          p.brand.toLowerCase().includes(l.query.toLowerCase()),
                      )
                      .slice(0, 10)
                  : [];
              return (
                <div key={l.key} className="rounded-xl border border-app-border p-2.5 space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-app-text-secondary absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      value={l.query}
                      onChange={(e) => setLine(l.key, { query: e.target.value, picked: false })}
                      onFocus={() => setLine(l.key, { picked: false })}
                      placeholder={catalogLoading ? 'Loading inventory…' : 'Search item by name…'}
                      disabled={catalogLoading}
                      className="w-full pl-8 pr-8 py-1.5 border border-app-border rounded-lg text-[11.5px] bg-transparent text-app-text-primary"
                    />
                    {lines.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => setLines((p) => p.filter((x) => x.key !== l.key))}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-app-text-secondary hover:text-red-500"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : null}
                    {matches.length > 0 ? (
                      <ul className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-app-border bg-app-card shadow-lg">
                        {matches.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              onClick={() =>
                                setLine(l.key, {
                                  productId: p.id,
                                  query: p.name,
                                  picked: true,
                                  unitPrice: l.unitPrice || String(p.price),
                                })
                              }
                              className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-app-accent/[0.06]"
                            >
                              {p.name}{' '}
                              <span className="text-app-text-secondary">
                                — ৳{p.price.toLocaleString()} ({p.brand})
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  {selected ? (
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-[9px] font-bold uppercase tracking-wide text-app-text-secondary">
                          Qty
                        </span>
                        <input
                          type="number"
                          min={1}
                          value={l.quantity}
                          onChange={(e) =>
                            setLine(l.key, {
                              quantity: Math.max(1, Number.parseInt(e.target.value, 10) || 1),
                            })
                          }
                          className="mt-0.5 w-full p-1.5 border border-app-border rounded-lg text-[11px] bg-transparent text-app-text-primary"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[9px] font-bold uppercase tracking-wide text-app-text-secondary">
                          Unit price (৳) · platform ৳{selected.price.toLocaleString()}
                        </span>
                        <input
                          value={l.unitPrice}
                          onChange={(e) => setLine(l.key, { unitPrice: e.target.value })}
                          className="mt-0.5 w-full p-1.5 border border-app-border rounded-lg text-[11px] bg-transparent text-app-text-primary"
                        />
                      </label>
                    </div>
                  ) : null}
                </div>
              );
            })}

            {extracted && (Object.keys(extracted.options).length > 0 || extracted.unmatchedOptionValues.length > 0) ? (
              <div className="rounded-lg border border-app-border bg-app-bg p-2 text-[10.5px] space-y-0.5">
                {Object.entries(extracted.options).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-app-text-secondary">{k}</span>
                    <span className="text-app-text-primary font-semibold">
                      {v.value}
                      <DetectedBadge low={v.confidence === 'low'} />
                    </span>
                  </div>
                ))}
                {extracted.unmatchedOptionValues.map((u) => (
                  <div key={u} className="text-amber-600">
                    {u} — no exact variant match, Seller review required
                  </div>
                ))}
              </div>
            ) : null}

            {/* ── Customer (external only) ──────────────────────────── */}
            {isNative ? (
              <p className="text-[11px] text-app-text-secondary m-0">
                Sending to <b>{prefill?.buyerName || 'the selected buyer'}</b> — they confirm their
                own delivery address at acceptance.
              </p>
            ) : (
              <>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary">
                    Customer name{detected.name ? <DetectedBadge low={detected.low.has('name')} /> : null}
                  </span>
                  <input
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setDetected((d) => ({ ...d, name: false }));
                    }}
                    className="mt-1 w-full p-2 border border-app-border rounded-lg text-xs bg-transparent text-app-text-primary"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary">
                      Email{detected.email ? <DetectedBadge low={detected.low.has('email')} /> : null}
                    </span>
                    <input
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setDetected((d) => ({ ...d, email: false }));
                      }}
                      className="mt-1 w-full p-2 border border-app-border rounded-lg text-xs bg-transparent text-app-text-primary"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary">
                      Phone{detected.phone ? <DetectedBadge low={detected.low.has('phone')} /> : null}
                    </span>
                    <input
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setDetected((d) => ({ ...d, phone: false }));
                      }}
                      placeholder="01XXXXXXXXX"
                      className="mt-1 w-full p-2 border border-app-border rounded-lg text-xs bg-transparent text-app-text-primary"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary">
                    Address from chat (context only)
                    {detected.address ? <DetectedBadge low={detected.low.has('address')} /> : null}
                  </span>
                  <textarea
                    value={addressHint}
                    onChange={(e) => {
                      setAddressHint(e.target.value);
                      setDetected((d) => ({ ...d, address: false }));
                    }}
                    rows={2}
                    className="mt-1 w-full p-2 border border-app-border rounded-lg text-xs resize-none bg-transparent text-app-text-primary"
                  />
                  <span className="text-[9px] text-app-text-secondary">
                    The customer picks their canonical Choosify delivery address when they confirm.
                  </span>
                </label>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary">
                  Delivery charge (৳)
                </span>
                <input
                  value={deliveryTotal}
                  onChange={(e) => setDeliveryTotal(e.target.value)}
                  className="mt-1 w-full p-2 border border-app-border rounded-lg text-xs bg-transparent text-app-text-primary"
                />
              </label>
              <div className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary">
                  Order total
                </span>
                <div className="mt-1 w-full p-2 border border-app-border rounded-lg text-xs bg-app-bg text-app-text-primary font-bold">
                  ৳{total.toLocaleString()}
                </div>
              </div>
            </div>

            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary">
                Notes (optional)
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full p-2 border border-app-border rounded-lg text-xs resize-none bg-transparent text-app-text-primary"
              />
            </label>

            {error ? <p className="text-[11px] font-semibold text-red-500 m-0">{error}</p> : null}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-app-border text-xs font-bold text-app-text-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || catalogLoading}
                className="px-4 py-2 rounded-xl bg-app-accent text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {isNative ? 'Send Offer' : 'Create Order & Link'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default ManualOrderDialog;
