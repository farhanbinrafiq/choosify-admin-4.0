const SENSITIVE_KEY_PATTERN =
  /(authorization|password|token|secret|api[_-]?key|bearer|cookie|firebase|credential|private[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token)/i;

const BEARER_PATTERN = /^Bearer\s+.+/i;

export function maskValue(value: unknown): unknown {
  if (typeof value === 'string') {
    if (BEARER_PATTERN.test(value)) return '[REDACTED_BEARER_TOKEN]';
    if (value.length > 256) return `[REDACTED_STRING length=${value.length}]`;
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item));
  }

  if (value && typeof value === 'object') {
    return sanitizeLogMeta(value as Record<string, unknown>);
  }

  return value;
}

export function sanitizeLogValue(value: unknown): unknown {
  return maskValue(value);
}

export function sanitizeLogMeta(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return meta;

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(meta)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    if (key === 'payload' || key === 'body' || key === 'headers') {
      sanitized[key] = sanitizeLogMeta(value as Record<string, unknown>) ?? '[REDACTED_OBJECT]';
      continue;
    }

    if (key === 'data' && typeof value === 'string' && value.length > 256) {
      sanitized[key] = `[REDACTED_BASE64 length=${value.length}]`;
      continue;
    }

    sanitized[key] = maskValue(value);
  }

  return sanitized;
}
