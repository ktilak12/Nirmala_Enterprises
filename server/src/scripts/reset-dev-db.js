import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { env } from '../config/env.js';

/**
 * Development database reset.
 *
 *   node src/scripts/reset-dev-db.js --yes
 *
 * Deliberately a separate script rather than a `--reset` flag on `seed.js`.
 * Seeding is something you may reasonably run against a live database; emptying
 * one is not, and the two should not be one keystroke apart. Hence:
 *
 *   - refuses outright when NODE_ENV is production
 *   - refuses unless `--yes` is passed, so it cannot run by accident
 *   - names every collection it drops as it goes
 *
 * This exists because the verification suite needs a known-empty starting point.
 * It is not a business feature, and nothing in the application calls it.
 */

if (env.isProduction) {
  process.stderr.write(
    '\nRefusing to run: NODE_ENV is production.\n' +
      'This script empties the database. It is for development only.\n\n',
  );
  process.exit(1);
}

if (!process.argv.includes('--yes')) {
  process.stderr.write(
    [
      '',
      'This will DELETE EVERY RECORD in the database:',
      `  ${env.mongoUri}`,
      '',
      'Nothing is backed up first. Re-run with --yes if that is what you want:',
      '  node src/scripts/reset-dev-db.js --yes',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

try {
  await connectDatabase();

  const collections = await mongoose.connection.db.listCollections().toArray();

  if (collections.length === 0) {
    process.stdout.write('\nDatabase is already empty.\n\n');
  } else {
    process.stdout.write(`\nDropping ${collections.length} collections:\n`);
    for (const { name } of collections) {
      await mongoose.connection.db.collection(name).drop();
      process.stdout.write(`  dropped  ${name}\n`);
    }
    process.stdout.write('\nDone. Run `npm run seed:demo` to repopulate.\n\n');
  }
} catch (error) {
  process.stderr.write(`\nReset failed: ${error.message}\n`);
  process.exitCode = 1;
} finally {
  await disconnectDatabase().catch(() => {});
}
