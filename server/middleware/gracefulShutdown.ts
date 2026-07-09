import type { Server } from 'http';
import { operationalEvents } from '../logging/operationalEvents';

export function setupGracefulShutdown(server: Server) {
  let shuttingDown = false;

  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    operationalEvents.applicationShutdown({ signal });

    server.close((error) => {
      if (error) {
        operationalEvents.securityWarning('Error during graceful shutdown', {
          message: error.message,
        });
        process.exit(1);
        return;
      }

      process.exit(0);
    });

    setTimeout(() => {
      operationalEvents.securityWarning('Graceful shutdown timed out');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
