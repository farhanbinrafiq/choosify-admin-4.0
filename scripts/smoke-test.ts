/**
 * Minimal HTTP smoke against in-memory stores (no Firebase / Socket.IO).
 *
 * Boots createApp() on an ephemeral port and asserts 2xx for:
 *   GET  /health
 *   GET  /api/v1/catalog/products
 *   GET  /api/v1/catalog/brands
 *   POST /api/v1/auth/dev-login  (requires non-production NODE_ENV)
 *
 * Run: npm run smoke
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';

// Force prototype-safe in-memory mode before app module loads (dotenv won't override these).
process.env.NODE_ENV = process.env.NODE_ENV === 'production' ? 'development' : process.env.NODE_ENV || 'development';
process.env.CATALOG_USE_FIRESTORE = 'false';
process.env.OPERATIONS_USE_FIRESTORE = 'false';
process.env.MESSAGING_MODE = process.env.MESSAGING_MODE || 'mock';
process.env.ALLOW_DEV_LOGIN = 'true';
process.env.ALLOWED_ORIGINS =
  process.env.ALLOWED_ORIGINS || 'http://127.0.0.1,http://localhost';
process.env.PAYMENT_GATEWAY_MOCK = 'false';

const { createApp, attachErrorHandler } = await import('../server/app');

function assertOk(label: string, status: number, bodyPreview: string): void {
  if (status < 200 || status >= 300) {
    throw new Error(`${label} expected 2xx, got ${status}: ${bodyPreview.slice(0, 300)}`);
  }
  console.log(`OK ${label} → ${status}`);
}

async function request(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; text: string }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body
      ? { 'Content-Type': 'application/json', Accept: 'application/json' }
      : { Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, text };
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('smoke-test refuses to run with NODE_ENV=production (dev-login must stay off)');
  }

  const app = createApp();
  attachErrorHandler(app);

  const server = http.createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Smoke server on ${baseUrl}`);

  try {
    {
      const { status, text } = await request(baseUrl, 'GET', '/health');
      assertOk('GET /health', status, text);
    }
    {
      const { status, text } = await request(baseUrl, 'GET', '/api/v1/catalog/products');
      assertOk('GET /api/v1/catalog/products', status, text);
    }
    {
      const { status, text } = await request(baseUrl, 'GET', '/api/v1/catalog/brands');
      assertOk('GET /api/v1/catalog/brands', status, text);
    }
    {
      const { status, text } = await request(baseUrl, 'POST', '/api/v1/auth/dev-login', {
        email: 'admin@choosify.com.bd',
        role: 'admin',
      });
      assertOk('POST /api/v1/auth/dev-login', status, text);
    }

    console.log('Smoke passed.');
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  // App modules may leave timers/clients open (Firestore, persist schedulers).
  // Exit explicitly so CI does not hang after assertions succeed.
  process.exit(0);
}

main().catch((err) => {
  console.error('Smoke failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});