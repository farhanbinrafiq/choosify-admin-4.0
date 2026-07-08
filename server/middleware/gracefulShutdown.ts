import type { Server } from 'http';
import { Logger } from '../lib/logger';

export function setupGracefulShutdown(server: Server) {
  let shuttingDown = false;

  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    Logger.info('Graceful shutdown initiated', { signal });

    server.close((error) => {
      if (error) {
        Logger.error('Error during graceful shutdown', {
          message: error.message,
          stack: error.stack,
        });
        process.exit(1);
        return;
      }

      Logger.info('HTTP server closed successfully');
      process.exit(0);
    });

    setTimeout(() => {
      Logger.error('Graceful shutdown timed out');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
