import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';

async function main() {
  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`Nirmala website and API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });

  // The public site is intentionally available even when the local database is
  // not running. Database-backed API calls will still report their own errors,
  // but a marketing/landing page should never be held hostage by MongoDB.
  connectDatabase()
    .then(() => console.log('Database connected.'))
    .catch((err) => console.warn(`Database unavailable; public website is still online.\n${err.message}`));

  let isShuttingDown = false;
  const shutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n${signal} received, beginning graceful shutdown.`);

    // If connections refuse to drain, force exit after 10s
    const forceExitTimer = setTimeout(() => {
      console.error('Graceful shutdown timed out after 10s, forcing exit.');
      process.exit(1);
    }, 10_000);
    forceExitTimer.unref();

    try {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      console.log('HTTP server connections drained.');

      if (disconnectDatabase) {
        await disconnectDatabase();
        console.log('MongoDB connection closed.');
      }
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err.message);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Failed to start the API:\n', err.message);
  process.exit(1);
});
