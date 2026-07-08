import helmet from 'helmet';

export const ACTIVE_SECURITY_HEADERS = [
  'Content-Security-Policy (disabled — SPA/Vite compatibility)',
  'Cross-Origin-Embedder-Policy (disabled — third-party embeds)',
  'Cross-Origin-Opener-Policy',
  'Cross-Origin-Resource-Policy',
  'Origin-Agent-Cluster',
  'Referrer-Policy',
  'Strict-Transport-Security (production HTTPS only)',
  'X-Content-Type-Options',
  'X-DNS-Prefetch-Control',
  'X-Download-Options',
  'X-Frame-Options',
  'X-Permitted-Cross-Domain-Policies',
  'X-XSS-Protection (legacy browsers)',
] as const;

export function createHelmetMiddleware() {
  return helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'no-referrer' },
    xContentTypeOptions: true,
    xFrameOptions: { action: 'sameorigin' },
    hidePoweredBy: true,
  });
}
