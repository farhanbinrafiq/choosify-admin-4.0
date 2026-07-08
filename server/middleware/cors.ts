import type { CorsOptions } from 'cors';
import cors from 'cors';

function parseAllowedOrigins(): string[] {
  const configured = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configured.length > 0) {
    return configured;
  }

  return ['http://localhost:3000', 'http://localhost:3001'];
}

export function getAllowedOrigins(): string[] {
  return parseAllowedOrigins();
}

export function createCorsMiddleware() {
  const allowedOrigins = getAllowedOrigins();

  const options: CorsOptions = {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID'],
    credentials: true,
  };

  return cors(options);
}
