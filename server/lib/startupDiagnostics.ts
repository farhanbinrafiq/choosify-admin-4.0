import { validateEnvironment } from './env';
import { operationalEvents } from '../logging/operationalEvents';
import {
  getAppName,
  getAppVersion,
  getEnvironment,
  getNodeVersion,
} from './runtimeInfo';

export type StartupDiagnosticsInput = {
  port: number;
  allowedOrigins: string[];
  loadedModules: string[];
};

function collectStartupWarnings(): string[] {
  const warnings: string[] = [];

  if (getEnvironment() === 'production' && process.env.ALLOW_DEV_LOGIN === 'true') {
    warnings.push('ALLOW_DEV_LOGIN=true in production is discouraged.');
  }

  if (!process.env.APP_NAME?.trim()) {
    warnings.push('APP_NAME is not configured.');
  }

  if (!process.env.APP_VERSION?.trim()) {
    warnings.push('APP_VERSION is not configured.');
  }

  return warnings;
}

export function runStartupEnvironmentValidation(): void {
  validateEnvironment();
}

export function logStartupDiagnostics(input: StartupDiagnosticsInput): void {
  const warnings = collectStartupWarnings();

  warnings.forEach((warning) => {
    operationalEvents.configurationWarning(warning);
  });

  operationalEvents.applicationStarted({
    port: input.port,
    allowedOrigins: input.allowedOrigins,
    loadedModules: input.loadedModules,
    warnings,
  });

  console.log(
    JSON.stringify({
      level: 'INFO',
      message: 'Startup diagnostics summary',
      timestamp: new Date().toISOString(),
      app: getAppName(),
      version: getAppVersion(),
      environment: getEnvironment(),
      nodeVersion: getNodeVersion(),
      port: input.port,
      allowedOrigins: input.allowedOrigins,
      loadedModules: input.loadedModules,
      warnings,
    }),
  );
}
