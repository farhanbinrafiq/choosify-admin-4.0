/**
 * Public business inquiries (Suggest a Brand / Partnership / Advertise /
 * Contact) on top of the existing operations "lead" record. Persistence is
 * the source of truth: notification (in-app + email) runs only after the
 * inquiry is saved, and its failure is recorded on the inquiry, never thrown.
 */
import {
  AD_BUDGET_RANGES,
  INQUIRY_LIMITS,
  INQUIRY_TYPES,
  PARTNERSHIP_MODELS,
  buildAdPlacementInterests,
  inquiryStatusLabel,
  type InquiryType,
} from '../../shared/inquiries/inquiryOptions';
import type {
  OpsLead,
  OpsLeadDelivery,
  OpsLeadDuplicateSignal,
} from '../operations/types';
import type { CatalogBrand, CatalogCategory } from '../../lib/vercel-catalog/catalogTypes';
import { notifyRoles } from '../communication/systemNotify';
import { sendEmail } from '../email/emailService';
import {
  BRAND,
  FONT_STACK,
  emailButton,
  emailCodeBlock,
  emailInfoCard,
  fallbackLink,
  paragraph,
  renderEmailShell,
  type EmailInfoRow,
} from '../email/emailShell';
import type { RenderedEmail } from '../email/templates';

export type InquiryFieldErrors = Partial<Record<string, string>>;

export type ValidatedInquiry = {
  inquiryType: InquiryType;
  brandName: string;
  contactPerson?: string;
  email: string;
  website?: string;
  categoryId?: string;
  categoryName?: string;
  country?: string;
  subject?: string;
  partnershipModel?: string;
  budget?: string;
  placementInterest?: string;
  message?: string;
  sourcePath?: string;
};

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
// Strip control characters (keeps tab/newline) — text is always rendered escaped, never as HTML.
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function clean(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v.replace(CONTROL_RE, '').trim().slice(0, max + 1);
}

/** Accepts bare domains ("brand.com") by assuming https; rejects non-http(s) schemes. */
export function normalizeInquiryUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (!url.hostname.includes('.') || url.hostname.length > 253) return null;
  return url.toString();
}

export function inquiryOptionsPayload(categories: CatalogCategory[]) {
  return {
    inquiryTypes: INQUIRY_TYPES.map(({ value, label }) => ({ value, label })),
    categories: categories
      .filter((c) => c.enabled)
      .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name))
      .map((c) => ({ value: c.id, label: c.name, parentId: c.parentId })),
    partnershipModels: PARTNERSHIP_MODELS,
    adBudgetRanges: AD_BUDGET_RANGES,
    adPlacementInterests: buildAdPlacementInterests().map(({ value, label }) => ({ value, label })),
    limits: INQUIRY_LIMITS,
  };
}

export function validateInquiry(
  body: Record<string, unknown>,
  categories: CatalogCategory[],
): { ok: true; value: ValidatedInquiry } | { ok: false; errors: InquiryFieldErrors } {
  const errors: InquiryFieldErrors = {};
  const type = body.inquiryType as InquiryType;
  if (!INQUIRY_TYPES.some((t) => t.value === type)) {
    return { ok: false, errors: { inquiryType: 'Unknown inquiry type.' } };
  }

  const req = (field: string, value: string, max: number, label: string) => {
    if (!value) errors[field] = `${label} is required.`;
    else if (value.length > max) errors[field] = `${label} must be ${max} characters or fewer.`;
  };
  const opt = (field: string, value: string, max: number, label: string) => {
    if (value.length > max) errors[field] = `${label} must be ${max} characters or fewer.`;
  };

  const email = clean(body.email, INQUIRY_LIMITS.email).toLowerCase();
  req('email', email, INQUIRY_LIMITS.email, 'Email');
  if (email && !errors.email && !EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';

  const message = clean(body.message, INQUIRY_LIMITS.message);
  const sourcePath = clean(body.sourcePath, 200);
  const v: ValidatedInquiry = { inquiryType: type, brandName: '', email, sourcePath: sourcePath || undefined };

  if (type === 'suggest_brand') {
    const brandName = clean(body.brandName, INQUIRY_LIMITS.name);
    req('brandName', brandName, INQUIRY_LIMITS.name, 'Brand name');
    const websiteRaw = clean(body.website, INQUIRY_LIMITS.url);
    req('website', websiteRaw, INQUIRY_LIMITS.url, 'Website or social profile');
    const website = websiteRaw ? normalizeInquiryUrl(websiteRaw) : null;
    if (websiteRaw && !errors.website && !website) errors.website = 'Enter a valid website or social profile URL.';
    const categoryId = clean(body.categoryId, 100);
    let categoryName: string | undefined;
    if (categoryId) {
      const cat = categories.find((c) => c.id === categoryId && c.enabled);
      if (!cat) errors.categoryId = 'Choose a category from the list.';
      else categoryName = cat.name;
    }
    const country = clean(body.country, INQUIRY_LIMITS.country);
    opt('country', country, INQUIRY_LIMITS.country, 'Country');
    req('message', message, INQUIRY_LIMITS.message, 'Reason');
    const contactPerson = clean(body.contactPerson, INQUIRY_LIMITS.name);
    opt('contactPerson', contactPerson, INQUIRY_LIMITS.name, 'Your name');
    Object.assign(v, {
      brandName,
      website: website ?? undefined,
      categoryId: categoryId || undefined,
      categoryName,
      country: country || undefined,
      contactPerson: contactPerson || undefined,
      message,
    });
  } else if (type === 'partnership') {
    const brandName = clean(body.brandName, INQUIRY_LIMITS.name);
    req('brandName', brandName, INQUIRY_LIMITS.name, 'Company / brand name');
    const contactPerson = clean(body.contactPerson, INQUIRY_LIMITS.name);
    req('contactPerson', contactPerson, INQUIRY_LIMITS.name, 'Primary contact name');
    const partnershipModel = clean(body.partnershipModel, 40);
    if (!PARTNERSHIP_MODELS.some((m) => m.value === partnershipModel)) {
      errors.partnershipModel = 'Choose a partnership model from the list.';
    }
    opt('message', message, INQUIRY_LIMITS.message, 'Proposal');
    Object.assign(v, { brandName, contactPerson, partnershipModel, message: message || undefined });
  } else if (type === 'advertising') {
    const brandName = clean(body.brandName, INQUIRY_LIMITS.name);
    req('brandName', brandName, INQUIRY_LIMITS.name, 'Brand name');
    const contactPerson = clean(body.contactPerson, INQUIRY_LIMITS.name);
    req('contactPerson', contactPerson, INQUIRY_LIMITS.name, 'Contact person');
    const budget = clean(body.budget, 40);
    if (!AD_BUDGET_RANGES.some((b) => b.value === budget)) errors.budget = 'Choose a budget range from the list.';
    const placementInterest = clean(body.placementInterest, 60);
    if (!buildAdPlacementInterests().some((p) => p.value === placementInterest)) {
      errors.placementInterest = 'Choose a placement from the list.';
    }
    opt('message', message, INQUIRY_LIMITS.message, 'Campaign goals');
    Object.assign(v, { brandName, contactPerson, budget, placementInterest, message: message || undefined });
  } else {
    const contactPerson = clean(body.contactPerson, INQUIRY_LIMITS.name);
    req('contactPerson', contactPerson, INQUIRY_LIMITS.name, 'Name');
    const subject = clean(body.subject, INQUIRY_LIMITS.subject);
    req('subject', subject, INQUIRY_LIMITS.subject, 'Subject');
    req('message', message, INQUIRY_LIMITS.message, 'Message');
    Object.assign(v, { brandName: subject, subject, contactPerson, message });
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: v };
}

const normName = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');

function hostKey(raw: string | undefined): string | null {
  if (!raw) return null;
  const url = normalizeInquiryUrl(raw);
  if (!url) return null;
  const u = new URL(url);
  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  // Social profile URLs share a host; key them by host + first path segment.
  if (/(^|\.)(facebook|instagram|tiktok|youtube|linkedin|x|twitter)\.com$/.test(host)) {
    const seg = u.pathname.split('/').filter(Boolean)[0]?.toLowerCase();
    return seg ? `${host}/${seg}` : null;
  }
  return host;
}

/**
 * Exact normalized-name or website matches only. Signals are shown to Admin;
 * they never block a submission, so similarly named but different brands are
 * still recorded.
 */
export function detectBrandDuplicateSignals(
  value: ValidatedInquiry,
  brands: CatalogBrand[],
  leads: OpsLead[],
): OpsLeadDuplicateSignal[] {
  if (value.inquiryType !== 'suggest_brand') return [];
  const name = normName(value.brandName);
  const host = hostKey(value.website);
  const signals: OpsLeadDuplicateSignal[] = [];
  for (const b of brands) {
    const nameHit = name.length >= 3 && (normName(b.name) === name || normName(b.slug ?? '') === name);
    const siteHit = !!host && hostKey((b as CatalogBrand & { website?: string }).website) === host;
    if (nameHit || siteHit) {
      signals.push({ kind: 'existing_brand', matchId: b.id, matchLabel: b.name, matchedOn: siteHit ? 'website' : 'name' });
    }
  }
  for (const l of leads) {
    if (l.inquiryType !== 'suggest_brand' || ['closed', 'rejected', 'spam'].includes(l.status)) continue;
    const nameHit = name.length >= 3 && normName(l.brandName) === name;
    const siteHit = !!host && hostKey(l.website) === host;
    if (nameHit || siteHit) {
      signals.push({ kind: 'existing_suggestion', matchId: l.id, matchLabel: `${l.referenceId ?? l.id} — ${l.brandName}`, matchedOn: siteHit ? 'website' : 'name' });
    }
  }
  return signals.slice(0, 10);
}

/** Same person re-sending the same inquiry within the window (double-click, retry, refresh). */
export function findRecentResubmission(value: ValidatedInquiry, leads: OpsLead[], windowMs = 10 * 60 * 1000): OpsLead | null {
  const now = Date.now();
  return (
    leads.find(
      (l) =>
        l.inquiryType === value.inquiryType &&
        l.email.toLowerCase() === value.email &&
        normName(l.brandName) === normName(value.brandName) &&
        (l.message ?? '') === (value.message ?? '') &&
        now - Date.parse(l.createdAt) < windowMs,
    ) ?? null
  );
}

const esc = (s: string | undefined) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// ── Internal notification email ────────────────────────────────────────────

/** Short type name used in the email subject/eyebrow ("New <name> Inquiry"). */
const EMAIL_TYPE_NAME: Record<InquiryType, string> = {
  suggest_brand: 'Brand Suggestion',
  partnership: 'Partnership',
  advertising: 'Advertising',
  general_contact: 'Contact',
};

const optionLabel = (list: Array<{ value: string; label: string }>, value?: string) =>
  value ? list.find((o) => o.value === value)?.label ?? value : undefined;

/**
 * Submitted fields per inquiry type, labelled exactly as the public forms label
 * them (Choosify-Web cmsSitePages defaults + form pages, required-field "*"
 * markers dropped). `long` is the form's free-text answer, shown as its own
 * section. Empty values are omitted by the caller.
 */
function inquiryEmailFields(lead: OpsLead): { rows: EmailInfoRow[]; long?: { label: string; text?: string } } {
  const row = (label: string, value?: string): EmailInfoRow => ({ label, value: value ?? '' });
  switch (lead.inquiryType) {
    case 'suggest_brand':
      return {
        rows: [
          row('Brand Name', lead.brandName),
          row('Website / Social Profile', lead.website),
          row('Category', lead.categoryName),
          row('Country', lead.country),
          row('Your Name', lead.contactPerson),
          row('Your Email', lead.email),
        ],
        long: { label: 'Why should we list this brand?', text: lead.message },
      };
    case 'partnership':
      return {
        rows: [
          row('Company / Brand Name', lead.brandName),
          row('Primary Contact Name', lead.contactPerson),
          row('Business Email', lead.email),
          row('Partnership Model', optionLabel(PARTNERSHIP_MODELS, lead.partnershipModel)),
        ],
        long: { label: 'Brief Proposal / Message', text: lead.message },
      };
    case 'advertising':
      return {
        rows: [
          row('Brand Name', lead.brandName),
          row('Contact Person', lead.contactPerson),
          row('Business Email', lead.email),
          row('Monthly Budget Scope', optionLabel(AD_BUDGET_RANGES, lead.budget)),
          row('Placement Interest', optionLabel(buildAdPlacementInterests(), lead.placementInterest)),
        ],
        long: { label: 'Campaign Goals', text: lead.message },
      };
    default:
      return {
        rows: [
          row('Your Name', lead.contactPerson),
          row('Email Address', lead.email),
          row('Subject', lead.subject || lead.brandName),
        ],
        long: { label: 'Message Content', text: lead.message },
      };
  }
}

/** e.g. "24 September 2026, 7:30 PM (Dhaka time)" — Choosify operates in Bangladesh. */
export function formatInquiryTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dhaka',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute} ${String(parts.dayPeriod).toUpperCase()} (Dhaka time)`;
}

/** Free-text answer as its own card — same card language as emailInfoCard; text escaped, line breaks kept. */
function longFormSection(label: string, text: string): string {
  const safe = esc(text).replace(/\r\n|\r|\n/g, '<br />');
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="margin:22px 0 6px;border:1px solid ${BRAND.hairline};border-radius:12px;background:${BRAND.surface};">
    <tr><td style="padding:16px 18px 6px;font-family:${FONT_STACK};font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${BRAND.muted};">${esc(label)}</td></tr>
    <tr><td style="padding:0 18px 16px;font-family:${FONT_STACK};font-size:14px;line-height:1.7;color:${BRAND.bodyText};word-break:break-word;">${safe}</td></tr>
  </table>`;
}

/**
 * The internal team notification for a saved inquiry, built on the shared
 * Choosify email shell. Subject/preheader use only system values (type +
 * reference) — never submitted free text.
 */
export function renderInquiryNotificationEmail(lead: OpsLead, opts: { adminUrl?: string } = {}): RenderedEmail {
  const typeName = lead.inquiryType ? EMAIL_TYPE_NAME[lead.inquiryType] : 'Business';
  const ref = lead.referenceId;
  const status = inquiryStatusLabel(lead.status);
  const submitted = formatInquiryTimestamp(lead.createdAt);
  const { rows, long } = inquiryEmailFields(lead);
  const filled = rows.filter((r) => r.value.trim());
  const longText = long?.text?.trim() ? long.text : undefined;

  const summary: EmailInfoRow[] = [
    ...(ref ? [{ label: 'Reference', value: ref }] : []),
    { label: 'Inquiry Type', value: typeName },
    { label: 'Status', value: status },
    { label: 'Submitted', value: submitted },
  ];

  const body = [
    paragraph(
      `<span style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${BRAND.coral};">${esc(typeName)}</span>`,
    ),
    ref ? emailCodeBlock(ref) : '',
    emailInfoCard('Inquiry summary', summary),
    filled.length ? emailInfoCard('Submitted information', filled) : '',
    long && longText ? longFormSection(long.label, longText) : '',
    opts.adminUrl ? `<div style="height:14px;line-height:14px;">&nbsp;</div>${emailButton('View Inquiry in Admin', opts.adminUrl)}` : '',
    opts.adminUrl ? fallbackLink(opts.adminUrl) : '',
  ]
    .filter(Boolean)
    .join('\n');

  // Plain-text part is built from the raw values (text/plain needs no escaping,
  // and toPlainText would strip anything tag-like from what the visitor typed).
  const text = [
    'New Business Inquiry',
    typeName,
    summary.map((r) => `${r.label}: ${r.value}`).join('\n'),
    filled.length ? ['Submitted information', ...filled.map((r) => `${r.label}: ${r.value}`)].join('\n') : '',
    long && longText ? `${long.label}\n${longText}` : '',
    opts.adminUrl ? `View Inquiry in Admin: ${opts.adminUrl}` : '',
    'Choosify — Internal business inquiry notification',
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    subject: `New ${typeName} Inquiry${ref ? ` — ${ref}` : ''}`,
    html: renderEmailShell({
      preheader: `New business inquiry received${ref ? ` — ${ref}` : ''}`,
      heading: 'New Business Inquiry',
      bodyHtml: body,
      footer: 'internal',
    }),
    text,
  };
}

export function inquiryNotifyRecipients(): string[] {
  return (process.env.INQUIRY_NOTIFY_EMAILS || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => EMAIL_RE.test(s));
}

/** Runs after the inquiry is persisted. Never throws. */
export async function notifyInquiryCreated(lead: OpsLead): Promise<OpsLeadDelivery> {
  const delivery: OpsLeadDelivery = { adminNotified: false, emailAttempted: false, emailSent: false };
  const typeDef = INQUIRY_TYPES.find((t) => t.value === lead.inquiryType);
  const title = typeDef?.notificationTitle ?? 'New Inquiry';
  const adminPath = `/admin/inquiries/${encodeURIComponent(lead.id)}`;

  try {
    await notifyRoles(['admin', 'super_admin'], {
      type: 'system_alert',
      category: 'admin',
      title,
      summary: `${lead.referenceId ? `${lead.referenceId} · ` : ''}${lead.brandName} (${lead.email})`,
      actionUrl: adminPath,
      metadata: { leadId: lead.id, referenceId: lead.referenceId, inquiryType: lead.inquiryType },
    });
    delivery.adminNotified = true;
  } catch (err) {
    delivery.adminNotifyError = err instanceof Error ? err.message.slice(0, 200) : 'notification failed';
    console.error('[Inquiry] Admin notification failed:', err);
  }

  const recipients = inquiryNotifyRecipients();
  if (recipients.length === 0) {
    delivery.emailSkippedReason = 'INQUIRY_NOTIFY_EMAILS not configured';
    return delivery;
  }
  const dashboardBase = (process.env.CHOOSIFY_DASHBOARD_URL || '').replace(/\/+$/, '');
  const link = dashboardBase ? `${dashboardBase}${adminPath}` : '';
  const { subject, html, text } = renderInquiryNotificationEmail(lead, { adminUrl: link || undefined });

  delivery.emailAttempted = true;
  for (const to of recipients) {
    try {
      const result = await sendEmail({ to, subject, html, text });
      delivery.emailVia = result.via;
      if (result.sent) delivery.emailSent = true;
    } catch (err) {
      console.error('[Inquiry] Team email failed:', err);
    }
  }
  if (!delivery.emailSent) delivery.emailSkippedReason = 'email provider did not accept the message';
  return delivery;
}
