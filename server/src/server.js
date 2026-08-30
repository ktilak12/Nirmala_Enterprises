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

  const shutdown = async (signal) => {
    console.log(`\n${signal} received, shutting down.`);
    server.close(async () => {
      if (disconnectDatabase) await disconnectDatabase();
      process.exit(0);
    });
    // If connections refuse to drain, do not hang a deployment forever.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Failed to start the API:\n', err.message);
  process.exit(1);
});
