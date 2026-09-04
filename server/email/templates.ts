/**
 * Choosify transactional email templates. Each returns { subject, html, text }.
 * Every template is built from the shared shell + components in emailShell.ts —
 * one design system, no duplicated markup.
 *
 * Auth templates for this phase: Welcome, Verify Email, Password Reset,
 * Password Changed. Order templates are built too (for design review) but are
 * NOT wired to order lifecycle events yet.
 */
import {
  emailButton,
  emailCodeBlock,
  emailInfoCard,
  emailSecurityNotice,
  fallbackLink,
  paragraph,
  renderEmailShell,
  toPlainText,
  type EmailInfoRow,
} from './emailShell';

export type RenderedEmail = { subject: string; html: string; text: string };

const firstName = (name?: string): string => (name || '').trim().split(/\s+/)[0] || 'there';

// ── Auth ──────────────────────────────────────────────────────────────────

export function welcomeEmail(input: { name?: string; exploreUrl: string }): RenderedEmail {
  const hi = firstName(input.name);
  const body = [
    paragraph(`Hi ${hi}, your Choosify account is ready.`),
    paragraph(
      `Save the products and brands you're considering, follow price and review changes, and get picks tailored to what you actually care about.`,
    ),
    emailButton('Explore Choosify', input.exploreUrl),
  ].join('\n');
  return {
    subject: 'Welcome to Choosify',
    html: renderEmailShell({
      preheader: 'Your Choosify account is ready — choose, compare & decide wisely.',
      heading: 'Welcome to Choosify',
      bodyHtml: body,
    }),
    text: toPlainText([
      `Hi ${hi}, your Choosify account is ready.`,
      `Save products and brands, follow price and review changes, and get tailored picks.`,
      `Explore Choosify: ${input.exploreUrl}`,
      `Choose, Compare & Decide Wisely. — Choosify`,
    ]),
  };
}

export function verifyEmail(input: { name?: string; verifyUrl: string; ttlHours?: number }): RenderedEmail {
  const ttl = input.ttlHours ?? 24;
  const body = [
    paragraph(`Confirm this is your email address to finish setting up your Choosify account.`),
    emailButton('Verify email address', input.verifyUrl),
    emailSecurityNotice(
      `This link expires in ${ttl} hours and can only be used once. If you didn't create a Choosify account, you can ignore this email.`,
    ),
    fallbackLink(input.verifyUrl),
  ].join('\n');
  return {
    subject: 'Verify your Choosify email address',
    html: renderEmailShell({
      preheader: 'Confirm your email to finish setting up your Choosify account.',
      heading: 'Verify your email address',
      bodyHtml: body,
    }),
    text: toPlainText([
      `Confirm your email to finish setting up your Choosify account.`,
      `Verify: ${input.verifyUrl}`,
      `This link expires in ${ttl} hours and can only be used once. If this wasn't you, ignore this email.`,
      `Choose, Compare & Decide Wisely. — Choosify`,
    ]),
  };
}

export function passwordResetEmail(input: { resetUrl: string; ttlMinutes?: number }): RenderedEmail {
  const ttl = input.ttlMinutes ?? 60;
  const body = [
    paragraph(`We received a request to reset the password for your Choosify account.`),
    emailButton('Reset password', input.resetUrl),
    emailSecurityNotice(
      `This link expires in ${ttl} minutes and can be used once. If you didn't request a reset, you can safely ignore this email — your password will not change.`,
    ),
    fallbackLink(input.resetUrl),
  ].join('\n');
  return {
    subject: 'Reset your Choosify password',
    html: renderEmailShell({
      preheader: 'Reset your Choosify password — this link expires soon.',
      heading: 'Reset your Choosify password',
      bodyHtml: body,
    }),
    text: toPlainText([
      `We received a request to reset the password for your Choosify account.`,
      `Reset: ${input.resetUrl}`,
      `This link expires in ${ttl} minutes and can be used once. If you didn't request this, ignore this email — your password will not change.`,
      `Choose, Compare & Decide Wisely. — Choosify`,
    ]),
  };
}

export function passwordChangedEmail(input: { supportUrl: string; when?: string }): RenderedEmail {
  const body = [
    paragraph(`Your Choosify account password was just changed${input.when ? ` on ${input.when}` : ''}.`),
    paragraph(`Every other signed-in session was signed out as a precaution.`),
    emailSecurityNotice(
      `If you did not make this change, reset your password immediately and contact Choosify support.`,
    ),
    emailButton('Contact support', input.supportUrl),
  ].join('\n');
  return {
    subject: 'Your Choosify password was changed',
    html: renderEmailShell({
      preheader: 'Your Choosify password was changed. If this was not you, act now.',
      heading: 'Your password was changed',
      bodyHtml: body,
    }),
    text: toPlainText([
      `Your Choosify account password was just changed${input.when ? ` on ${input.when}` : ''}.`,
      `Every other signed-in session was signed out.`,
      `If this wasn't you, reset your password immediately and contact support: ${input.supportUrl}`,
      `Choose, Compare & Decide Wisely. — Choosify`,
    ]),
  };
}

export function verificationCodeEmail(input: { code: string; ttlMinutes?: number }): RenderedEmail {
  const ttl = input.ttlMinutes ?? 10;
  const body = [
    paragraph(`Use this code to set up a password for your Choosify account — the one you're signed in to right now.`),
    emailCodeBlock(input.code),
    paragraph(`This code expires in ${ttl} minutes.`),
    emailSecurityNotice(
      `If you didn't ask to set up a password, you can ignore this email — nothing will change, and your account stays sign-in-with-Google only. Never share this code with anyone; Choosify staff will never ask for it.`,
    ),
  ].join('\n');
  return {
    subject: 'Your Choosify verification code',
    html: renderEmailShell({
      preheader: `Your Choosify verification code — expires in ${ttl} minutes.`,
      heading: 'Your verification code',
      bodyHtml: body,
    }),
    text: toPlainText([
      `Use this code to set up a password for your Choosify account (the one you're signed in to now):`,
      input.code,
      `This code expires in ${ttl} minutes.`,
      `If you didn't request this, ignore this email — nothing changes and your account stays Google sign-in only. Never share this code with anyone.`,
      `Choose, Compare & Decide Wisely. — Choosify`,
    ]),
  };
}

export function passwordAddedEmail(input: { supportUrl: string; when?: string }): RenderedEmail {
  const body = [
    paragraph(`A password was just added to your Choosify account${input.when ? ` on ${input.when}` : ''}.`),
    paragraph(`You can now sign in with your email and password as well as with Google. Your Google sign-in still works and nothing else about your account changed.`),
    emailSecurityNotice(
      `If you did not add this password, contact Choosify support immediately — someone may have access to your email or your signed-in session.`,
    ),
    emailButton('Contact support', input.supportUrl),
  ].join('\n');
  return {
    subject: 'A password was added to your Choosify account',
    html: renderEmailShell({
      preheader: 'A password was added to your Choosify account. If this was not you, act now.',
      heading: 'A password was added to your account',
      bodyHtml: body,
    }),
    text: toPlainText([
      `A password was just added to your Choosify account${input.when ? ` on ${input.when}` : ''}.`,
      `You can now sign in with email and password as well as with Google. Google sign-in still works; nothing else changed.`,
      `If you did not do this, contact Choosify support immediately: ${input.supportUrl}`,
      `Choose, Compare & Decide Wisely. — Choosify`,
    ]),
  };
}

// ── Order lifecycle (design review only — NOT wired to events this phase) ──

type OrderEmailInput = {
  name?: string;
  orderNumber: string;
  items: Array<{ title: string; qty: number; price: string }>;
  total: string;
  orderUrl: string;
  courier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  deliveredWhen?: string;
};

function orderItemRows(items: OrderEmailInput['items']): EmailInfoRow[] {
  return items.map((i) => ({ label: `${i.title} × ${i.qty}`, value: i.price }));
}

export function orderConfirmedEmail(input: OrderEmailInput): RenderedEmail {
  const body = [
    paragraph(`Hi ${firstName(input.name)}, thanks for your order — we've received it and the seller is preparing it.`),
    emailInfoCard(`Order ${input.orderNumber}`, [...orderItemRows(input.items), { label: 'Total', value: input.total }]),
    emailButton('View order', input.orderUrl),
  ].join('\n');
  return {
    subject: `Order ${input.orderNumber} confirmed`,
    html: renderEmailShell({
      preheader: `We've received order ${input.orderNumber}.`,
      heading: 'Order confirmed',
      bodyHtml: body,
    }),
    text: toPlainText([
      `Hi ${firstName(input.name)}, we've received order ${input.orderNumber}.`,
      input.items.map((i) => `- ${i.title} x ${i.qty}  ${i.price}`).join('\n'),
      `Total: ${input.total}`,
      `View order: ${input.orderUrl}`,
    ]),
  };
}

export function orderDispatchedEmail(input: OrderEmailInput): RenderedEmail {
  const rows: EmailInfoRow[] = [
    { label: 'Courier', value: input.courier || 'Assigned courier' },
    ...(input.trackingNumber ? [{ label: 'Tracking number', value: input.trackingNumber }] : []),
  ];
  const body = [
    paragraph(`Good news — order ${input.orderNumber} is on its way.`),
    emailInfoCard('Shipment', rows),
    emailButton('Track shipment', input.trackingUrl || input.orderUrl),
  ].join('\n');
  return {
    subject: `Order ${input.orderNumber} is on the way`,
    html: renderEmailShell({
      preheader: `Order ${input.orderNumber} has been dispatched.`,
      heading: 'Your order is on the way',
      bodyHtml: body,
    }),
    text: toPlainText([
      `Order ${input.orderNumber} has been dispatched.`,
      `Courier: ${input.courier || 'Assigned courier'}`,
      input.trackingNumber ? `Tracking: ${input.trackingNumber}` : '',
      `Track: ${input.trackingUrl || input.orderUrl}`,
    ]),
  };
}

export function orderDeliveredEmail(input: OrderEmailInput): RenderedEmail {
  const body = [
    paragraph(`Order ${input.orderNumber} was delivered${input.deliveredWhen ? ` on ${input.deliveredWhen}` : ''}.`),
    paragraph(`If everything looks good, a quick review helps other shoppers decide.`),
    emailButton('Leave a review', input.orderUrl),
  ].join('\n');
  return {
    subject: `Order ${input.orderNumber} delivered`,
    html: renderEmailShell({
      preheader: `Order ${input.orderNumber} has been delivered.`,
      heading: 'Your order was delivered',
      bodyHtml: body,
    }),
    text: toPlainText([
      `Order ${input.orderNumber} was delivered${input.deliveredWhen ? ` on ${input.deliveredWhen}` : ''}.`,
      `Leave a review: ${input.orderUrl}`,
    ]),
  };
}
