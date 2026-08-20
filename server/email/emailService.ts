/**
 * Pre-VPS self-hosting pass — provider-neutral transactional email. Generic
 * SMTP via nodemailer, configured entirely through env vars — no provider
 * SDK, so swapping SMTP hosts (Hostinger's own mail, SendGrid's SMTP relay,
 * a self-hosted Postfix, etc.) never touches application code.
 *
 * When SMTP isn't configured (e.g. local dev with nothing set up), emails
 * are logged to the console instead of thrown away silently — verification/
 * reset links stay usable for manual testing without a real mail server.
 */
import nodemailer, { type Transporter } from 'nodemailer';

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

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

/** Never throws — a failed/unconfigured send should never break the calling request (registration, reset request, etc. must still succeed). */
export async function sendEmail(message: EmailMessage): Promise<{ sent: boolean; devLogged?: boolean }> {
  const transporter = getTransporter();
  if (!transporter) {
    console.log(
      `[EmailService] SMTP not configured — logging instead of sending.\nTo: ${message.to}\nSubject: ${message.subject}\n${message.text}`,
    );
    return { sent: false, devLogged: true };
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM?.trim() || 'Choosify <no-reply@choosify.bd>',
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    return { sent: true };
  } catch (error) {
    console.error('[EmailService] Send failed:', error instanceof Error ? error.message : error);
    return { sent: false };
  }
}

function appUrl(): string {
  return process.env.APP_URL?.trim() || 'http://localhost:3001';
}

function webUrl(): string {
  return process.env.VITE_CHOOSIFY_WEB_URL?.trim() || 'http://localhost:5173';
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const link = `${webUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to,
    subject: 'Verify your Choosify email address',
    text: `Verify your email by visiting: ${link}\n\nThis link expires in 24 hours. If you didn't create a Choosify account, ignore this email.`,
    html: `<p>Verify your Choosify email address:</p><p><a href="${link}">${link}</a></p><p>This link expires in 24 hours. If you didn't create a Choosify account, you can ignore this email.</p>`,
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const link = `${webUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to,
    subject: 'Reset your Choosify password',
    text: `Reset your password by visiting: ${link}\n\nThis link expires in 1 hour and can only be used once. If you didn't request this, you can safely ignore this email — your password won't change.`,
    html: `<p>Reset your Choosify password:</p><p><a href="${link}">${link}</a></p><p>This link expires in 1 hour and can only be used once. If you didn't request this, you can safely ignore this email — your password won't change.</p>`,
  });
}

export async function sendPasswordChangedEmail(to: string): Promise<void> {
  await sendEmail({
    to,
    subject: 'Your Choosify password was changed',
    text: `Your Choosify account password was just changed. If this wasn't you, contact support immediately at ${appUrl()}.`,
    html: `<p>Your Choosify account password was just changed.</p><p>If this wasn't you, contact support immediately.</p>`,
  });
}
