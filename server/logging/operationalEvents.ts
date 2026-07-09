import { Logger } from '../lib/logger';
import {
  getAppName,
  getAppVersion,
  getEnvironment,
  getNodeVersion,
} from '../lib/runtimeInfo';

type StartupContext = {
  port: number;
  allowedOrigins: string[];
  loadedModules: string[];
  warnings?: string[];
};

type ShutdownContext = {
  signal: string;
};

type FailureContext = {
  requestId?: string;
  path?: string;
  message?: string;
  metadata?: Record<string, unknown>;
};

export const operationalEvents = {
  applicationStarted(context: StartupContext) {
    Logger.info('Application started', {
      event: 'application_started',
      app: getAppName(),
      version: getAppVersion(),
      environment: getEnvironment(),
      nodeVersion: getNodeVersion(),
      port: context.port,
      allowedOrigins: context.allowedOrigins,
      loadedModules: context.loadedModules,
      warnings: context.warnings?.length ? context.warnings : undefined,
    });
  },

  applicationShutdown(context: ShutdownContext) {
    Logger.info('Application shutdown', {
      event: 'application_shutdown',
      signal: context.signal,
      uptimeSeconds: Math.floor(process.uptime()),
    });
  },

  configurationWarning(message: string, metadata?: Record<string, unknown>) {
    Logger.warn('Configuration warning', {
      event: 'configuration_warning',
      message,
      ...metadata,
    });
  },

  securityWarning(message: string, metadata?: Record<string, unknown>) {
    Logger.security('Security warning', {
      event: 'security_warning',
      message,
      ...metadata,
    });
  },

  validationFailure(context: FailureContext) {
    Logger.warn('Validation failure', {
      event: 'validation_failure',
      ...context,
    });
  },

  authenticationFailure(context: FailureContext) {
    Logger.security('Authentication failure', {
      event: 'authentication_failure',
      ...context,
    });
  },
};
