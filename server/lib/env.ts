type EnvRule = {
  key: string;
  requiredInProduction?: boolean;
  description: string;
};

const ENV_RULES: EnvRule[] = [
  { key: 'NODE_ENV', description: 'Runtime environment' },
  { key: 'PORT', description: 'HTTP server port' },
  { key: 'APP_NAME', description: 'Application display name' },
  { key: 'APP_VERSION', description: 'Application version' },
  { key: 'ALLOWED_ORIGINS', requiredInProduction: true, description: 'Comma-separated CORS origins' },
];

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function validateEnvironment(): void {
  const missing: string[] = [];

  for (const rule of ENV_RULES) {
    const value = process.env[rule.key]?.trim();
    if (!value && rule.requiredInProduction && isProduction()) {
      missing.push(`${rule.key} (${rule.description})`);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables for production startup:\n- ${missing.join('\n- ')}`,
    );
  }

  if (isProduction() && process.env.ALLOW_DEV_LOGIN === 'true') {
    console.warn('[env] ALLOW_DEV_LOGIN=true in production is discouraged.');
  }
}

export function readPositiveIntEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw?.trim()) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export function readBytesEnv(key: string, fallback: string): string {
  const raw = process.env[key]?.trim();
  return raw || fallback;
}
