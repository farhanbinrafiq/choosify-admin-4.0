/**
 * Render every Choosify transactional email template to a standalone .html file
 * for visual review. No network, no secrets. Output: scripts/_tmp_email-previews/
 *
 * Usage: npx tsx scripts/preview-emails.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  orderConfirmedEmail,
  orderDeliveredEmail,
  orderDispatchedEmail,
  passwordAddedEmail,
  passwordChangedEmail,
  passwordResetEmail,
  verificationCodeEmail,
  verifyEmail,
  welcomeEmail,
} from '../server/email/templates';

const OUT = join(process.cwd(), 'scripts', '_tmp_email-previews');
mkdirSync(OUT, { recursive: true });

const WEB = 'https://choosify.bd';
const samples = {
  '1-welcome': welcomeEmail({ name: 'Farhan Rafiq', exploreUrl: `${WEB}/` }),
  '2-verify-email': verifyEmail({ name: 'Farhan Rafiq', verifyUrl: `${WEB}/verify-email?token=EXAMPLE_TOKEN`, ttlHours: 24 }),
  '3-password-reset': passwordResetEmail({ resetUrl: `${WEB}/reset-password?token=EXAMPLE_TOKEN`, ttlMinutes: 60 }),
  '4-password-changed': passwordChangedEmail({ supportUrl: 'mailto:support@choosify.bd', when: new Date().toUTCString() }),
  '4a-verification-code': verificationCodeEmail({ code: '284917', ttlMinutes: 10 }),
  '4b-password-added': passwordAddedEmail({ supportUrl: 'mailto:support@choosify.bd', when: new Date().toUTCString() }),
  '5-order-confirmed': orderConfirmedEmail({
    name: 'Farhan Rafiq',
    orderNumber: 'OR-10482',
    items: [
      { title: 'Studio Screens Watch — 64GB · Leather', qty: 1, price: '৳ 9,500' },
      { title: 'Screen Protector', qty: 2, price: '৳ 600' },
    ],
    total: '৳ 10,220',
    orderUrl: `${WEB}/orders/OR-10482`,
  }),
  '6-order-dispatched': orderDispatchedEmail({
    orderNumber: 'OR-10482',
    items: [],
    total: '',
    courier: 'Pathao',
    trackingNumber: 'PA-77Q31X',
    trackingUrl: 'https://pathao.com/track/PA-77Q31X',
    orderUrl: `${WEB}/orders/OR-10482`,
  }),
  '7-order-delivered': orderDeliveredEmail({
    orderNumber: 'OR-10482',
    items: [],
    total: '',
    deliveredWhen: new Date().toUTCString(),
    orderUrl: `${WEB}/orders/OR-10482`,
  }),
};

const index: string[] = [
  `<!doctype html><meta charset="utf-8"><title>Choosify email previews</title>`,
  `<body style="font-family:system-ui;background:#eef0f4;margin:0;padding:24px;">`,
  `<h1 style="font-size:16px;color:#18154C;">Choosify transactional emails</h1>`,
];

for (const [name, tmpl] of Object.entries(samples)) {
  writeFileSync(join(OUT, `${name}.html`), tmpl.html, 'utf8');
  writeFileSync(join(OUT, `${name}.txt`), `Subject: ${tmpl.subject}\n\n${tmpl.text}\n`, 'utf8');
  index.push(
    `<section style="margin:18px 0;"><div style="font-size:12px;color:#6B7280;margin-bottom:6px;">${name} — <b>${tmpl.subject}</b></div>` +
      `<iframe src="./${name}.html" style="width:640px;height:720px;border:1px solid #dcdfe6;border-radius:10px;background:#fff;"></iframe></section>`,
  );
}
index.push(`</body>`);
writeFileSync(join(OUT, 'index.html'), index.join('\n'), 'utf8');

console.log('wrote', Object.keys(samples).length, 'previews (+ .txt + index.html) to', OUT);
