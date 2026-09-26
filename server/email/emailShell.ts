/**
 * Choosify transactional email design system — one reusable shell + components,
 * shared by every template. Email-client-safe: table layout, fully inline
 * styles, a fluid 600px-max container, a small progressive-enhancement mobile
 * style block (kept separate from the web-font block), no
 * JavaScript, no external CSS, no remote decorative images. Every template also
 * ships a plain-text alternative (see `toPlainText`).
 *
 * Brand: Navy #18154C · Coral #EF3C23 · Orange #FF5B00 · coral→orange CTA.
 */

export const BRAND = {
  navy: '#18154C',
  coral: '#EF3C23',
  orange: '#FF5B00',
  ink: '#1A1A2E',
  bodyText: '#3A3A46',
  muted: '#6B7280',
  hairline: '#E8EDF2',
  surface: '#FFFFFF',
  pageBg: '#F4F5F8',
  infoCardBg: '#F7F8FB',
  noticeBg: '#FFF6ED',
  noticeBorder: '#FFD9B8',
  noticeText: '#8A4B12',
};

/**
 * Typography mirrors the platform: Satoshi (the Choosify typeface, self-hosted
 * on the storefront under /fonts/satoshi/) first, then the platform's own
 * fallbacks ('Helvetica Neue', Arial) plus system UI fonts. Clients that honour
 * @font-face load Satoshi; the rest (Gmail, Outlook desktop) use the fallbacks.
 */
export const FONT_STACK =
  "'Satoshi','Helvetica Neue',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif,'Apple Color Emoji','Segoe UI Emoji'";

/** The platform's monospace face (JetBrains Mono) — used for codes / reference IDs. */
export const MONO_STACK = "'JetBrains Mono','SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace";

const SATOSHI_WOFF2_URL =
  process.env.EMAIL_FONT_URL?.trim() || 'https://choosify.bd/fonts/satoshi/Satoshi-Variable.woff2';

/**
 * The official Choosify horizontal lockup (eyes + wordmark), navy tone — the
 * raster equivalent of the `choosify-logo-horizontal-navy.svg` the storefront's
 * ChoosifyWordmarkLogo component uses. Served publicly and without auth from the
 * production storefront's own `/brand/` directory (verified 200 image/png).
 * Email clients cannot load app/local paths, so this is a fixed public HTTPS
 * URL — override only if the brand file moves.
 */
const LOGO_URL =
  process.env.EMAIL_LOGO_URL?.trim() ||
  'https://choosify.bd/brand/choosify-logo-horizontal-navy.png';

/**
 * Public base for email assets shipped in this app's `public/email/` (served by
 * the dashboard). Override with EMAIL_ASSET_BASE_URL (e.g. for a pre-deploy preview).
 */
const emailAssetBase = (): string =>
  (process.env.EMAIL_ASSET_BASE_URL?.trim() || 'https://dashboard.choosify.bd').replace(/\/+$/, '');

/**
 * Official Choosify social profiles — the same URLs the live storefront footer
 * renders (production site config `socialLinks`, seeded from
 * lib/vercel-catalog/catalogDefaults.ts). Icons are 96px circular PNG badges
 * rasterised from the storefront's own brand SVGs (Choosify-Web/public/icons).
 */
const SOCIAL_LINKS = [
  { name: 'Facebook', url: 'https://www.facebook.com/choosify.bd', icon: 'facebook.png' },
  { name: 'Instagram', url: 'https://www.instagram.com/choosify.bd/', icon: 'instagram.png' },
  { name: 'TikTok', url: 'https://www.tiktok.com/@choosify5', icon: 'tiktok.png' },
  { name: 'YouTube', url: 'https://www.youtube.com/@choosify5', icon: 'youtube.png' },
] as const;

export const CONTACT = {
  email: 'support@choosify.bd',
  phoneDisplay: '+880 01410 423014',
  phoneHref: 'tel:+88001410423014',
} as const;

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── Components ─────────────────────────────────────────────────────────────

/** Coral→orange gradient primary CTA. `background-color` first so Outlook (no
 *  gradient support) still renders a solid orange button. */
export function emailButton(label: string, href: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px auto 4px;">
    <tr>
      <td align="center" bgcolor="${BRAND.orange}" style="border-radius:10px;background-color:${BRAND.orange};background-image:linear-gradient(90deg,${BRAND.coral} 0%,${BRAND.orange} 100%);">
        <a href="${escapeHtml(href)}" target="_blank" rel="noopener"
           style="display:inline-block;padding:14px 34px;font-family:${FONT_STACK};font-size:15px;font-weight:700;line-height:1;color:#ffffff;text-decoration:none;border-radius:10px;">
          ${escapeHtml(label)}
        </a>
      </td>
    </tr>
  </table>`;
}

export type EmailInfoRow = { label: string; value: string };

/** Light "details" card — e.g. an order summary or the account an email is for. */
export function emailInfoCard(title: string, rows: EmailInfoRow[]): string {
  const body = rows
    .map(
      (r) => `
      <tr>
        <td style="padding:6px 0;font-family:${FONT_STACK};font-size:13px;color:${BRAND.muted};">${escapeHtml(r.label)}</td>
        <td style="padding:6px 0;font-family:${FONT_STACK};font-size:13px;font-weight:600;color:${BRAND.ink};text-align:right;word-break:break-word;">${escapeHtml(r.value)}</td>
      </tr>`,
    )
    .join('');
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="margin:22px 0 6px;border:1px solid ${BRAND.hairline};border-radius:12px;background:${BRAND.infoCardBg};">
    <tr><td style="padding:16px 18px 4px;font-family:${FONT_STACK};font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${BRAND.muted};">${escapeHtml(title)}</td></tr>
    <tr><td style="padding:0 18px 14px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${body}</table>
    </td></tr>
  </table>`;
}

/** Amber security callout used on authentication emails. */
export function emailSecurityNotice(text: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="margin:20px 0 4px;border:1px solid ${BRAND.noticeBorder};border-radius:12px;background:${BRAND.noticeBg};">
    <tr><td style="padding:14px 18px;font-family:${FONT_STACK};font-size:12.5px;line-height:1.6;color:${BRAND.noticeText};">
      <strong>Security note.</strong> ${escapeHtml(text)}
    </td></tr>
  </table>`;
}

/** Large, monospace, letter-spaced one-time-code display. */
export function emailCodeBlock(code: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 8px;">
    <tr>
      <td align="center" style="border:1px solid ${BRAND.hairline};border-radius:12px;background:${BRAND.infoCardBg};padding:22px 12px;">
        <div class="cf-code" style="font-family:${MONO_STACK};font-size:34px;line-height:1;font-weight:700;letter-spacing:.34em;color:${BRAND.navy};word-break:break-all;">${escapeHtml(code)}</div>
      </td>
    </tr>
  </table>`;
}

// ── Shell ─────────────────────────────────────────────────────────────────

export type EmailShellInput = {
  /** Hidden inbox-preview line. */
  preheader: string;
  heading: string;
  /** Pre-built inner HTML (paragraphs, button, info card, notice…). */
  bodyHtml: string;
  /** `internal` swaps the customer-facing tagline footer for a minimal team
   *  notification footer (e.g. inquiry alerts sent to the Choosify team). */
  footer?: 'customer' | 'internal';
};

/** Shared "Follow Choosify" icons + support contact row — on every email. Text
 *  contact links stay readable with images blocked. */
function renderSocialContact(): string {
  const base = emailAssetBase();
  const icons = SOCIAL_LINKS.map(
    (s) => `
                <td style="padding:0 5px;">
                  <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener" style="display:inline-block;text-decoration:none;">
                    <img src="${escapeHtml(`${base}/email/social/${s.icon}`)}" alt="${s.name}" title="${s.name}" width="28" height="28"
                         style="display:block;width:28px;height:28px;border:0;outline:none;text-decoration:none;" />
                  </a>
                </td>`,
  ).join('');
  const link = `color:${BRAND.orange};text-decoration:none;font-weight:600;`;
  return `
            <p style="margin:0 0 10px;font-family:${FONT_STACK};font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${BRAND.navy};">Follow Choosify</p>
            <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 12px;">
              <tr>${icons}
              </tr>
            </table>
            <p style="margin:0 0 16px;font-family:${FONT_STACK};font-size:12.5px;line-height:1.9;color:${BRAND.muted};">
              <span style="display:inline-block;white-space:nowrap;padding:0 9px;">Email: <a href="mailto:${CONTACT.email}" style="${link}">${CONTACT.email}</a></span><span style="display:inline-block;white-space:nowrap;padding:0 9px;">Phone: <a href="${CONTACT.phoneHref}" style="${link}">${CONTACT.phoneDisplay}</a></span>
            </p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;">
              <tr><td style="border-top:1px solid ${BRAND.hairline};font-size:0;line-height:0;height:1px;">&nbsp;</td></tr>
            </table>`;
}

function renderFooter(footer: 'customer' | 'internal'): string {
  if (footer === 'internal') {
    return `
            <p style="margin:0 0 4px;font-family:${FONT_STACK};font-size:13px;font-weight:700;color:${BRAND.navy};">Choosify</p>
            <p style="margin:0;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${BRAND.muted};">
              Internal business inquiry notification &nbsp;·&nbsp; This is an automated message for the Choosify team.
            </p>`;
  }
  return `
            <p style="margin:0 0 6px;font-family:${FONT_STACK};font-size:13px;font-weight:700;color:${BRAND.navy};">Choose, Compare &amp; Decide Wisely.</p>
            <p style="margin:0 0 4px;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${BRAND.muted};">
              Bangladesh's product discovery platform — verify brands, compare options and shop with confidence.
            </p>
            <p style="margin:0;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${BRAND.muted};">
              This is an automated message from Choosify.
            </p>`;
}

/** Wraps template body HTML in the full Choosify shell (wordmark header,
 *  content surface, footer). */
export function renderEmailShell({ preheader, heading, bodyHtml, footer = 'customer' }: EmailShellInput): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(heading)}</title>
<!--[if mso]><style>body,table,td,p,a,h1,div,span{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]-->
<!-- Mobile overrides live in their OWN simple style block, first: email
     sanitisers (notably Gmail) drop a whole style block when it contains a
     rule they reject, so the web-font rules below must not share a block with
     these. The layout is already fluid inline; this only refines small screens. -->
<style>
  @media only screen and (max-width:600px){
    .cf-outer{padding-top:20px !important;padding-left:8px !important;padding-right:8px !important;}
    .cf-container{width:100% !important;}
    .cf-pad{padding:28px 20px !important;}
    .cf-h1{font-size:22px !important;}
    .cf-code{font-size:26px !important;letter-spacing:.18em !important;}
  }
  a{color:${BRAND.orange};}
</style>
<style>
  /* Platform typefaces for clients that support web fonts; Outlook desktop
     skips @media screen, so it never sees @font-face (falls back via mso rule). */
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&display=swap');
  @media screen {
    @font-face {
      font-family:'Satoshi';
      font-style:normal;
      font-weight:300 900;
      font-display:swap;
      src:url('${SATOSHI_WOFF2_URL}') format('woff2');
    }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${BRAND.pageBg};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.pageBg};">
  <tr>
    <td align="center" class="cf-outer" style="padding:32px 12px;">
      <!-- Fluid-hybrid container: 100% wide up to 600px everywhere (fits any
           phone even when a client ignores style blocks); Outlook desktop, which
           ignores max-width, gets a fixed 600px ghost table instead. -->
      <!--[if mso]><table role="presentation" align="center" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" class="cf-container" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;margin:0 auto;">

        <!-- Header — the official Choosify horizontal lockup (navy). Public,
             unauthenticated HTTPS asset (the same brand file the storefront
             ships at /brand/…). Native 2000x447; rendered proportionally
             (224x50) and centred. alt text carries the brand name when remote
             images are blocked. -->
        <tr>
          <td align="center" style="padding:8px 4px 24px;text-align:center;">
            <img src="${LOGO_URL}" alt="Choosify" width="224" height="50"
                 style="display:block;margin:0 auto;width:224px;max-width:224px;height:50px;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />
          </td>
        </tr>

        <!-- Content surface -->
        <tr>
          <td class="cf-pad" style="background:${BRAND.surface};border:1px solid ${BRAND.hairline};border-radius:16px;padding:36px 40px;">
            <h1 class="cf-h1" style="margin:0 0 14px;font-family:${FONT_STACK};font-size:24px;line-height:1.3;font-weight:800;color:${BRAND.navy};">${escapeHtml(heading)}</h1>
            ${bodyHtml}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td align="center" style="padding:26px 8px 8px;text-align:center;">${renderSocialContact()}${renderFooter(footer)}
          </td>
        </tr>

      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ── Body-fragment helpers ─────────────────────────────────────────────────

export function paragraph(html: string): string {
  return `<p style="margin:0 0 14px;font-family:${FONT_STACK};font-size:14.5px;line-height:1.7;color:${BRAND.bodyText};">${html}</p>`;
}

export function fallbackLink(href: string): string {
  return `<p style="margin:14px 0 0;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${BRAND.muted};word-break:break-all;">
    If the button doesn't work, copy and paste this link:<br />
    <a href="${escapeHtml(href)}" style="color:${BRAND.orange};">${escapeHtml(href)}</a>
  </p>`;
}

/** Minimal HTML→text for the plain-text alternative. */
export function toPlainText(parts: string[]): string {
  return parts
    .join('\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
