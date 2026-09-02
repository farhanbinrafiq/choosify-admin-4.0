import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Send, Paperclip, MessageCircleMore, Search, X } from 'lucide-react';

/**
 * Shared presentation primitives for every Inbox surface (Admin Support,
 * Creator Support, Seller Customers + Support). Visual reference: the approved
 * "ADMIN MESSAGE CENTER" — conversation list │ active thread │ context — wired
 * here to the real canonical APIs. Role-specific data/controls live in the
 * screens; the look is shared.
 */

export type MsgRole = 'Consumer' | 'Seller' | 'Creator' | 'Admin' | 'System';

const ROLE_STYLE: Record<MsgRole, string> = {
  Consumer: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
  Seller: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  Creator: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  Admin: 'bg-[#FF5B00]/10 text-[#FF5B00] border-[#FF5B00]/20',
  System: 'bg-slate-400/10 text-slate-500 border-slate-400/20',
};

export function RoleBadge({ role, className = '' }: { role: MsgRole; className?: string }) {
  return (
    <span
      className={`inline-flex items-center text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${ROLE_STYLE[role]} ${className}`}
    >
      {role}
    </span>
  );
}

export function formatWhen(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function Avatar({
  name,
  src,
  size = 32,
}: {
  name: string;
  src?: string;
  size?: number;
}) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('') || 'U';
  return (
    <div
      className="rounded-full bg-app-accent/10 text-app-accent flex items-center justify-center font-bold shrink-0 overflow-hidden"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        initials
      )}
    </div>
  );
}

/** Header + list/thread/context grid. `context` column is optional. */
export function InboxShell({
  title,
  subtitle,
  actions,
  list,
  thread,
  context,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  list: React.ReactNode;
  thread: React.ReactNode;
  context?: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-app-accent/10 border border-app-accent/20">
            <MessageCircleMore className="w-5 h-5 text-app-accent" />
          </div>
          <div>
            <h1 className="text-xl font-black text-app-text-primary tracking-tight m-0">{title}</h1>
            {subtitle ? <p className="text-xs text-app-text-secondary m-0">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      <div
        className={`grid grid-cols-1 gap-4 h-[calc(100vh-210px)] min-h-[440px] ${
          context ? 'lg:grid-cols-[300px_1fr_260px]' : 'md:grid-cols-[320px_1fr]'
        }`}
      >
        <div className="bg-app-card border border-app-border rounded-2xl overflow-hidden flex flex-col min-h-0">
          {list}
        </div>
        <div className="bg-app-card border border-app-border rounded-2xl overflow-hidden flex flex-col min-h-0">
          {thread}
        </div>
        {context ? (
          <div className="bg-app-card border border-app-border rounded-2xl overflow-hidden hidden lg:flex flex-col min-h-0">
            {context}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Left-column search box. Purely presentational — the screen owns the filter. */
export function ThreadListSearch({
  value,
  onChange,
  placeholder = 'Search by name, message…',
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="p-2.5 border-b border-app-border">
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-app-text-secondary absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-app-border bg-transparent text-[11.5px] text-app-text-primary placeholder:text-app-text-secondary/70 focus:outline-none focus:border-app-accent/50"
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-app-text-secondary hover:text-app-text-primary"
            title="Clear"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

const CHANNEL_STYLE: Record<string, string> = {
  whatsapp: 'bg-[#25D366]/12 text-[#128C7E] border-[#25D366]/25',
  facebook: 'bg-[#0084FF]/12 text-[#0084FF] border-[#0084FF]/25',
  messenger: 'bg-[#0084FF]/12 text-[#0084FF] border-[#0084FF]/25',
  instagram: 'bg-[#E1306C]/12 text-[#C13584] border-[#E1306C]/25',
};
const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  facebook: 'Messenger',
  messenger: 'Messenger',
  instagram: 'Instagram',
};

export function ChannelBadge({ channel, className = '' }: { channel: string; className?: string }) {
  const key = channel.toLowerCase();
  return (
    <span
      className={`inline-flex items-center text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${
        CHANNEL_STYLE[key] || 'bg-slate-400/10 text-slate-500 border-slate-400/20'
      } ${className}`}
    >
      {CHANNEL_LABEL[key] || channel}
    </span>
  );
}

/** Right-hand contextual rail — a scrollable stack of titled sections. */
export function ContextRail({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 overflow-y-auto p-3 space-y-4 min-h-0">{children}</div>;
}

export function ContextSection({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <h4 className="text-[9.5px] font-black uppercase tracking-wider text-app-text-secondary m-0">
          {title}
        </h4>
        {action}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

export function ContextRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-[11.5px]">
      <span className="text-app-text-secondary shrink-0">{label}</span>
      <span className="text-app-text-primary font-semibold text-right break-words min-w-0">{value}</span>
    </div>
  );
}

export function ContextActionButton({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="w-full text-left px-2.5 py-1.5 rounded-lg border border-app-border text-[11px] font-bold text-app-text-primary hover:border-app-accent/40 hover:bg-app-accent/[0.04] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

export function ThreadListItem({
  title,
  preview,
  when,
  active,
  unread,
  badge,
  sub,
  onClick,
}: {
  title: string;
  preview?: string;
  when?: string;
  active?: boolean;
  unread?: number;
  badge?: React.ReactNode;
  sub?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-3 border-b border-app-border/60 transition-colors ${
        active ? 'bg-app-accent/10' : 'hover:bg-black/[0.03]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-[13px] text-app-text-primary truncate flex items-center gap-1.5">
          {unread ? <span className="w-2 h-2 rounded-full bg-app-accent shrink-0" /> : null}
          {title}
        </span>
        <span className="text-[10px] text-app-text-secondary shrink-0">{when}</span>
      </div>
      <div className="flex items-center gap-1.5 mt-1">
        {badge}
        {sub ? <span className="text-[10px] text-app-text-secondary truncate">{sub}</span> : null}
      </div>
      {preview ? (
        <p className="text-[11.5px] text-app-text-secondary truncate mt-1 m-0">{preview}</p>
      ) : null}
    </button>
  );
}

/**
 * Renders a canonical structured commerce message (messageType
 * order_card | product_card | service_card | booking_card | counter_offer)
 * from its persisted metadata. Falls back to the text body when a shape
 * isn't recognised so no commerce message is ever silently dropped.
 */
export function StructuredMessageCard({
  messageType,
  body,
  metadata,
}: {
  messageType: string;
  body: string;
  metadata?: Record<string, unknown> | null;
}) {
  const m = (metadata || {}) as Record<string, unknown>;
  const money = (v: unknown) =>
    typeof v === 'number' ? `৳${v.toLocaleString()}` : typeof v === 'string' && v ? v : undefined;

  const TITLE: Record<string, string> = {
    order_card: 'Order',
    product_card: 'Product',
    service_card: 'Service',
    booking_card: 'Booking request',
    counter_offer: 'Counter offer',
  };

  const rows: Array<[string, string | undefined]> = [];
  if (messageType === 'order_card') {
    rows.push(['Order', (m.orderNumber as string) || (m.orderId as string)]);
    rows.push(['Total', money(m.total ?? m.amount)]);
    rows.push(['Status', m.status as string | undefined]);
  } else if (messageType === 'counter_offer') {
    rows.push(['Offer', money(m.amount ?? m.price)]);
    rows.push(['Status', (m.status as string) || 'proposed']);
  } else if (messageType === 'booking_card') {
    rows.push(['Service', (m.serviceName as string) || (m.listingId as string)]);
    rows.push(['When', m.scheduledFor as string | undefined]);
    rows.push(['Status', m.status as string | undefined]);
  } else {
    rows.push(['Item', (m.title as string) || (m.name as string) || (m.listingId as string)]);
    rows.push(['Price', money(m.price ?? m.amount)]);
  }

  const shown = rows.filter(([, v]) => v);

  return (
    <div className="rounded-xl border border-app-border bg-app-bg p-2.5 min-w-[180px] max-w-[260px]">
      <div className="text-[9px] font-black uppercase tracking-wider text-app-accent mb-1">
        {TITLE[messageType] || 'Update'}
      </div>
      {shown.length ? (
        <div className="space-y-0.5">
          {shown.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 text-[11px]">
              <span className="text-app-text-secondary">{label}</span>
              <span className="text-app-text-primary font-semibold text-right">{value}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-app-text-primary m-0 whitespace-pre-wrap break-words">{body}</p>
      )}
    </div>
  );
}

/**
 * Canonical offer/booking/order card — one renderer, role-aware actions.
 * Feeds from the structured snapshot already stored on the message
 * (System-A metadata OR the System-B UnifiedMessage.bookingOffer/orderOffer);
 * the screen resolves live status and composes the authorized `actions`.
 */
const OFFER_STATUS_TONE: Record<string, string> = {
  pending: 'bg-amber-500/12 text-amber-600 border-amber-500/25',
  countered: 'bg-sky-500/12 text-sky-600 border-sky-500/25',
  accepted: 'bg-emerald-500/12 text-emerald-600 border-emerald-500/25',
  buyer_accepted: 'bg-emerald-500/12 text-emerald-600 border-emerald-500/25',
  paid: 'bg-emerald-500/12 text-emerald-600 border-emerald-500/25',
  declined: 'bg-red-500/12 text-red-600 border-red-500/25',
  buyer_declined: 'bg-red-500/12 text-red-600 border-red-500/25',
  rejected: 'bg-red-500/12 text-red-600 border-red-500/25',
  expired: 'bg-slate-400/12 text-slate-500 border-slate-400/25',
  payment_expired: 'bg-slate-400/12 text-slate-500 border-slate-400/25',
};

export function OfferCard({
  kind,
  title,
  image,
  subtitle,
  price,
  originalPrice,
  status,
  fields,
  items,
  total,
  mine,
  when,
  actions,
}: {
  kind: 'product' | 'service' | 'booking' | 'order';
  title: string;
  image?: string;
  subtitle?: string;
  price?: string;
  originalPrice?: string;
  status?: string;
  fields?: Array<[string, string]>;
  items?: Array<{ name: string; quantity?: number; price?: string }>;
  total?: string;
  mine: boolean;
  when?: string;
  actions?: React.ReactNode;
}) {
  const KIND_LABEL: Record<string, string> = {
    product: 'Product request',
    service: 'Service request',
    booking: 'Booking request',
    order: 'Order offer',
  };
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[85%] w-[300px] rounded-2xl border border-app-border bg-app-bg overflow-hidden">
        <div className="flex items-center gap-2 px-3 pt-2.5">
          <span className="text-[9px] font-black uppercase tracking-wider text-app-accent">
            {KIND_LABEL[kind]}
          </span>
          {status ? (
            <span
              className={`ml-auto text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                OFFER_STATUS_TONE[status] || 'bg-slate-400/10 text-slate-500 border-slate-400/20'
              }`}
            >
              {status.replace(/_/g, ' ')}
            </span>
          ) : null}
        </div>
        <div className="flex gap-2.5 p-3">
          {image ? (
            <img
              src={image}
              alt=""
              className="w-12 h-12 rounded-lg object-cover shrink-0 border border-app-border"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
              }}
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-bold text-app-text-primary m-0 truncate">{title}</p>
            {subtitle ? (
              <p className="text-[10.5px] text-app-text-secondary m-0 truncate">{subtitle}</p>
            ) : null}
            {price ? (
              <p className="text-[11.5px] m-0 mt-0.5">
                {originalPrice ? (
                  <span className="line-through text-app-text-secondary mr-1">{originalPrice}</span>
                ) : null}
                <span className="font-bold text-app-text-primary">{price}</span>
              </p>
            ) : null}
          </div>
        </div>
        {fields && fields.length ? (
          <div className="px-3 pb-2 space-y-0.5">
            {fields.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 text-[10.5px]">
                <span className="text-app-text-secondary">{k}</span>
                <span className="text-app-text-primary font-semibold text-right truncate">{v}</span>
              </div>
            ))}
          </div>
        ) : null}
        {items && items.length ? (
          <div className="px-3 pb-2 space-y-0.5 border-t border-app-border/60 pt-2">
            {items.map((it, i) => (
              <div key={i} className="flex justify-between gap-3 text-[10.5px]">
                <span className="text-app-text-primary truncate">
                  {it.name}
                  {it.quantity ? ` ×${it.quantity}` : ''}
                </span>
                {it.price ? <span className="text-app-text-secondary">{it.price}</span> : null}
              </div>
            ))}
          </div>
        ) : null}
        {total ? (
          <div className="px-3 pb-2 flex justify-between text-[11.5px] font-bold text-app-text-primary border-t border-app-border/60 pt-2">
            <span>Total</span>
            <span>{total}</span>
          </div>
        ) : null}
        {actions ? (
          <div className="px-3 pb-3 pt-1 flex flex-wrap gap-1.5">{actions}</div>
        ) : null}
        {when ? (
          <div className="px-3 pb-2 text-[9px] text-app-text-secondary text-right">{when}</div>
        ) : null}
      </div>
    </div>
  );
}

export function OfferCardButton({
  children,
  onClick,
  tone = 'default',
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tone?: 'default' | 'accent' | 'danger';
  disabled?: boolean;
}) {
  const cls =
    tone === 'accent'
      ? 'bg-app-accent text-white border-app-accent'
      : tone === 'danger'
        ? 'border-red-500/40 text-red-600'
        : 'border-app-border text-app-text-primary';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-2.5 py-1 rounded-lg border text-[10.5px] font-bold transition-colors hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed ${cls}`}
    >
      {children}
    </button>
  );
}

export function MessageBubble({
  body,
  mine,
  when,
  system,
  senderLabel,
  messageType,
  metadata,
}: {
  body: string;
  mine: boolean;
  when?: string;
  system?: boolean;
  senderLabel?: string;
  messageType?: string;
  metadata?: Record<string, unknown> | null;
}) {
  if (system || messageType === 'system') {
    return (
      <div className="text-center my-2">
        <span className="text-[10.5px] text-app-text-secondary bg-app-bg border border-app-border rounded-full px-3 py-1">
          {body}
        </span>
      </div>
    );
  }

  const isCard =
    messageType &&
    ['order_card', 'product_card', 'service_card', 'booking_card', 'counter_offer'].includes(
      messageType,
    );

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[78%]">
        {senderLabel && !mine ? (
          <div className="text-[9.5px] font-bold uppercase tracking-wide text-app-text-secondary mb-0.5 ml-1">
            {senderLabel}
          </div>
        ) : null}
        {isCard ? (
          <div className={mine ? 'flex justify-end' : ''}>
            <div>
              <StructuredMessageCard messageType={messageType!} body={body} metadata={metadata} />
              <div className="text-[9px] mt-1 text-app-text-secondary text-right">{when}</div>
            </div>
          </div>
        ) : (
          <div
            className={`rounded-2xl px-3.5 py-2 text-[12px] leading-relaxed whitespace-pre-wrap break-words ${
              mine
                ? 'bg-app-accent text-white rounded-br-sm'
                : 'bg-app-bg border border-app-border text-app-text-primary rounded-bl-sm'
            }`}
          >
            {body}
            <div className={`text-[9px] mt-1 ${mine ? 'text-white/70' : 'text-app-text-secondary'}`}>
              {when}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function MessageScroller({ children }: { children: React.ReactNode }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  });
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-0">
      {children}
      <div ref={endRef} />
    </div>
  );
}

export function Composer({
  onSend,
  disabled,
  placeholder = 'Type a message…',
  attachmentsDisabledReason,
}: {
  onSend: (body: string) => Promise<void> | void;
  disabled?: boolean;
  placeholder?: string;
  attachmentsDisabledReason?: string;
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    const body = text.trim();
    if (!body || sending || disabled) return;
    setSending(true);
    try {
      await onSend(body);
      setText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-3 border-t border-app-border">
      <div className="flex items-end gap-2">
        <button
          type="button"
          disabled
          title={attachmentsDisabledReason || 'Attachments are not available yet'}
          className="h-10 w-10 rounded-xl border border-app-border text-app-text-secondary/40 flex items-center justify-center shrink-0 cursor-not-allowed"
        >
          <Paperclip className="w-4 h-4" />
        </button>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          disabled={disabled}
          placeholder={placeholder}
          className="flex-1 p-2.5 border border-app-border rounded-xl text-[12px] resize-none bg-transparent text-app-text-primary disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending || disabled || !text.trim()}
          className="h-10 w-10 rounded-xl bg-app-accent text-white flex items-center justify-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Send"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
      {attachmentsDisabledReason ? (
        <p className="text-[9.5px] text-app-text-secondary mt-1.5 m-0">{attachmentsDisabledReason}</p>
      ) : null}
    </div>
  );
}

export function CenterState({
  loading,
  message,
  error,
}: {
  loading?: boolean;
  message?: string;
  error?: string;
}) {
  return (
    <div className="flex-1 flex items-center justify-center text-sm text-app-text-secondary p-6 text-center">
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : error ? (
        <span className="text-red-500">{error}</span>
      ) : (
        message
      )}
    </div>
  );
}
