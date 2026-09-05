/**
 * Centralized server-side transactional email.
 *
 * Delivery order: Resend (RESEND_API_KEY) -> generic SMTP (SMTP_HOST) ->
 * console log (local dev with neither configured — links stay usable for
 * manual testing). A failed / unconfigured send NEVER throws: registration,
 * password-reset requests, etc. must always succeed regardless.
 *
 * The RESEND_API_KEY is read from process.env only. It is never logged, never
 * returned, never sent to any client.
 *
 * In-app notifications are a SEPARATE channel (server/communication/*) — this
 * module does not touch them.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { Logger } from '../lib/logger';
import {
  passwordAddedEmail,
  passwordChangedEmail,
  passwordResetEmail,
  verificationCodeEmail,
  verifyEmail as verifyEmailTemplate,
  welcomeEmail,
} from './templates';

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type ResetSurface = 'web' | 'dashboard';

function fromAddress(): string {
  return (
    process.env.EMAIL_FROM?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    'Choosify <no-reply@choosify.bd>'
  );
}
function replyTo(): string | undefined {
  return process.env.EMAIL_REPLY_TO?.trim() || undefined;
}

// ── Resend transport (no SDK — a single POST) ──────────────────────────────

function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/** `name@host.tld` -> `n***@host.tld` for safe logging. */
function maskRecipient(addr: string): string {
  const [local, domain] = String(addr || '').split('@');
  if (!domain) return '***';
  return `${local.slice(0, 1)}***@${domain}`;
}

async function sendViaResend(message: EmailMessage): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromAddress(),
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(replyTo() ? { reply_to: replyTo() } : {}),
      }),
    });
    if (res.ok) {
      // Success audit trail — recipient masked, no key, no HTML. Gives every
      // transactional send a verifiable Resend message id in the logs.
      const body = (await res.json().catch(() => ({}))) as { id?: string };
      Logger.info('[EmailService] Resend accepted', {
        status: res.status,
        messageId: body?.id || null,
        to: maskRecipient(message.to),
        subject: message.subject,
      });
      return true;
    }
    // Log status + a safe snippet — never the key, never the full body.
    const detail = await res.text().catch(() => '');
    Logger.warn('[EmailService] Resend send failed', {
      status: res.status,
      detail: detail.slice(0, 300),
    });
    return false;
  } catch (error) {
    Logger.warn('[EmailService] Resend request error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

// ── SMTP fallback (unchanged, provider-neutral) ───────────────────────────

let cachedTransporter: Transporter | null | undefined;
function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim());
}
function getTransporter(): Transporter | null {
  if (cachedTransporter !== undefined) return cachedTransporter;
  if (!isSmtpConfigured()) {
    cachedTransporter = null;
    return cachedTransporter;
  }
  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST!.trim(),
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER.trim(), pass: process.env.SMTP_PASSWORD || '' }
      : undefined,
  });
  return cachedTransporter;
}

async function sendViaSmtp(message: EmailMessage): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) return false;
  try {
    await transporter.sendMail({
      from: fromAddress(),
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(replyTo() ? { replyTo: replyTo() } : {}),
    });
    return true;
  } catch (error) {
    Logger.warn('[EmailService] SMTP send failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

// ── Public send ──────────────────────────────────────────────────────────

/** Never throws. Returns which transport (if any) accepted the message. */
export async function sendEmail(
  message: EmailMessage,
): Promise<{ sent: boolean; via: 'resend' | 'smtp' | 'none'; devLogged?: boolean }> {
  if (isResendConfigured() && (await sendViaResend(message))) {
    return { sent: true, via: 'resend' };
  }
  if (isSmtpConfigured() && (await sendViaSmtp(message))) {
    return { sent: true, via: 'smtp' };
  }
  // Nothing configured (or every transport failed) — log so the link stays
  // usable in local dev. This line is what the auth-email probes read.
  console.log(
    `[EmailService] No transport delivered — logging instead.\nTo: ${message.to}\nSubject: ${message.subject}\n${message.text}`,
  );
  return { sent: false, via: 'none', devLogged: true };
}

// ── URL helpers ──────────────────────────────────────────────────────────

function webBase(): string {
  return (process.env.CHOOSIFY_WEB_URL || process.env.VITE_CHOOSIFY_WEB_URL || 'http://localhost:5173').replace(/\/$/, '');
}
function dashboardBase(): string {
  return (process.env.CHOOSIFY_DASHBOARD_URL || process.env.APP_URL || 'http://localhost:3001').replace(/\/$/, '');
}
/** The correct auth surface for a given account context. Trusted config only —
 *  never a client-supplied URL. */
export function surfaceBaseUrl(surface: ResetSurface): string {
  return surface === 'dashboard' ? dashboardBase() : webBase();
}

// ── Typed senders ────────────────────────────────────────────────────────

export async function sendVerificationEmail(to: string, token: string, opts?: { name?: string; surface?: ResetSurface }): Promise<void> {
  const base = surfaceBaseUrl(opts?.surface ?? 'web');
  const link = `${base}/verify-email?token=${encodeURIComponent(token)}`;
  const t = verifyEmailTemplate({ name: opts?.name, verifyUrl: link, ttlHours: 24 });
  await sendEmail({ to, subject: t.subject, html: t.html, text: t.text });
}

export async function sendPasswordResetEmail(to: string, token: string, opts?: { surface?: ResetSurface }): Promise<void> {
  const base = surfaceBaseUrl(opts?.surface ?? 'web');
  const link = `${base}/reset-password?token=${encodeURIComponent(token)}`;
  // TEMP DIAGNOSTIC (2026-09-05) — surface/base only, never the token. Remove
  // once the production reset-URL-host investigation is closed out.
  Logger.info('[DIAG] password-reset link host', { requestedSurface: opts?.surface, resolvedSurface: opts?.surface ?? 'web', base });
  const t = passwordResetEmail({ resetUrl: link, ttlMinutes: 60 });
  await sendEmail({ to, subject: t.subject, html: t.html, text: t.text });
}

export async function sendPasswordChangedEmail(to: string, opts?: { surface?: ResetSurface }): Promise<void> {
  const base = surfaceBaseUrl(opts?.surface ?? 'web');
  const t = passwordChangedEmail({
    supportUrl: `mailto:${process.env.EMAIL_REPLY_TO?.trim() || 'support@choosify.bd'}`,
    when: new Date().toUTCString(),
  });
  void base;
  await sendEmail({ to, subject: t.subject, html: t.html, text: t.text });
}

export async function sendWelcomeEmail(to: string, displayName?: string): Promise<void> {
  const t = welcomeEmail({ name: displayName, exploreUrl: `${webBase()}/` });
  await sendEmail({ to, subject: t.subject, html: t.html, text: t.text });
}

/**
 * The 6-digit code for the "add a local password to a social-only Consumer"
 * flow. `code` is a transient secret — it is passed straight through to the
 * transport and never logged here (sendEmail only console-logs in local dev
 * when NO transport is configured; that path is not used when Resend is set).
 */
export async function sendLocalPasswordOtpEmail(to: string, code: string): Promise<void> {
  const t = verificationCodeEmail({ code, ttlMinutes: 10 });
  await sendEmail({ to, subject: t.subject, html: t.html, text: t.text });
}

export async function sendPasswordAddedEmail(to: string): Promise<void> {
  const t = passwordAddedEmail({
    supportUrl: `mailto:${process.env.EMAIL_REPLY_TO?.trim() || 'support@choosify.bd'}`,
    when: new Date().toUTCString(),
  });
  await sendEmail({ to, subject: t.subject, html: t.html, text: t.text });
}
