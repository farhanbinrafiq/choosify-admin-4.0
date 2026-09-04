/**
 * Choosify transactional email design system — one reusable shell + components,
 * shared by every template. Email-client-safe: table layout, fully inline
 * styles, a single progressive-enhancement <style> block for mobile, no
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

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif,'Apple Color Emoji','Segoe UI Emoji'";

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
        <td style="padding:6px 0;font-family:${FONT_STACK};font-size:13px;font-weight:600;color:${BRAND.ink};text-align:right;">${escapeHtml(r.value)}</td>
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
        <div style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:34px;line-height:1;font-weight:700;letter-spacing:.34em;color:${BRAND.navy};">${escapeHtml(code)}</div>
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
  supportEmail?: string;
};

/** Wraps template body HTML in the full Choosify shell (wordmark header,
 *  content surface, footer). */
export function renderEmailShell({ preheader, heading, bodyHtml, supportEmail = 'support@choosify.bd' }: EmailShellInput): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(heading)}</title>
<style>
  /* Progressive enhancement only — the layout is fully inline above. */
  @media only screen and (max-width:600px){
    .cf-container{width:100% !important;}
    .cf-pad{padding-left:22px !important;padding-right:22px !important;}
    .cf-h1{font-size:22px !important;}
  }
  a{color:${BRAND.orange};}
</style>
</head>
<body style="margin:0;padding:0;background:${BRAND.pageBg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.pageBg};">
  <tr>
    <td align="center" style="padding:32px 12px;">
      <table role="presentation" class="cf-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">

        <!-- Header — the official Choosify horizontal lockup (navy). Public,
             unauthenticated HTTPS asset (the same brand file the storefront
             ships at /brand/…). Native 2000x447; rendered proportionally. alt
             text carries the brand name when remote images are blocked. -->
        <tr>
          <td style="padding:6px 4px 20px;">
            <img src="${LOGO_URL}" alt="Choosify" width="179" height="40"
                 style="display:block;width:179px;max-width:179px;height:40px;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />
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
          <td style="padding:24px 8px 8px;">
            <p style="margin:0 0 6px;font-family:${FONT_STACK};font-size:13px;font-weight:700;color:${BRAND.navy};">Choose, Compare &amp; Decide Wisely.</p>
            <p style="margin:0 0 4px;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${BRAND.muted};">
              Bangladesh's product discovery platform — verify brands, compare options and shop with confidence.
            </p>
            <p style="margin:0;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${BRAND.muted};">
              Need help? <a href="mailto:${escapeHtml(supportEmail)}" style="color:${BRAND.orange};">${escapeHtml(supportEmail)}</a>
              &nbsp;·&nbsp; This is an automated message from Choosify.
            </p>
          </td>
        </tr>

      </table>
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
