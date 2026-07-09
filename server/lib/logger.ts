import { sanitizeLogMeta } from './sanitizeLog';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SECURITY' | 'AUDIT' | 'DEBUG';
type LogMeta = Record<string, unknown>;

function formatLog(level: LogLevel, message: string, meta?: LogMeta) {
  const safeMeta = sanitizeLogMeta(meta);
  return JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    app: process.env.APP_NAME || 'choosify-admin',
    version: process.env.APP_VERSION || process.env.npm_package_version || '0.0.0',
    ...safeMeta,
  });
}

function write(level: LogLevel, message: string, meta?: LogMeta) {
  const line = formatLog(level, message, meta);
  if (level === 'ERROR') {
    console.error(line);
    return;
  }
  if (level === 'WARN' || level === 'SECURITY') {
    console.warn(line);
    return;
  }
  if (level === 'DEBUG' && process.env.NODE_ENV === 'production') {
    return;
  }
  console.log(line);
}

export const Logger = {
  info(message: string, meta?: LogMeta) {
    write('INFO', message, meta);
  },
  warn(message: string, meta?: LogMeta) {
    write('WARN', message, meta);
  },
  error(message: string, meta?: LogMeta) {
    write('ERROR', message, meta);
  },
  security(message: string, meta?: LogMeta) {
    write('SECURITY', message, meta);
  },
  audit(message: string, meta?: LogMeta) {
    write('AUDIT', message, meta);
  },
  debug(message: string, meta?: LogMeta) {
    write('DEBUG', message, meta);
  },
};
