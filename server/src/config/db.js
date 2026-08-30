import mongoose from 'mongoose';
import { env } from './env.js';
// Registering every model as a side effect of importing the database module
// decouples "is this model registered?" from "did some route happen to import
// it?". Without this, a sale's `.populate('unit')` works only because the
// catalog route is mounted and pulls the Unit model in transitively - a refactor
// to the route graph could silently break an unrelated populate with a
// MissingSchemaError. Every process that connects (server, seed, verify,
// recompute, the atomicity test) now starts with the whole set registered.
import '../models/index.js';

/**
 * Connect to MongoDB and assert that we are talking to a replica set.
 *
 * Every composite business operation in this system (sale -> inventory ->
 * invoice -> payment -> party balance) runs inside a multi-document
 * transaction. Those are only available on a replica set. If we are connected
 * to a standalone mongod the transactions would throw at runtime, so we detect
 * it here and fail loudly with instructions rather than at 4pm mid-invoice.
 */
export async function connectDatabase() {
  mongoose.set('strictQuery', true);

  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 10_000,
  });

  const topology = await detectTopology();
  if (!topology.supportsTransactions) {
    throw new Error(
      [
        '',
        'MongoDB is running as a STANDALONE server, not a replica set.',
        '',
        'Multi-document transactions are unavailable in this mode, which means',
        'a sale could reduce stock but fail to write its invoice, leaving the',
        'books inconsistent. The system refuses to start in this state.',
        '',
        'Fix:  bash scripts/start-db.sh',
        '',
      ].join('\n'),
    );
  }

  return { replicaSet: topology.setName };
}

async function detectTopology() {
  const admin = mongoose.connection.db.admin();
  try {
    const hello = await admin.command({ hello: 1 });
    return {
      setName: hello.setName ?? null,
      supportsTransactions: Boolean(hello.setName) || hello.msg === 'isdbgrid',
    };
  } catch {
    return { setName: null, supportsTransactions: false };
  }
}

export async function disconnectDatabase() {
  await mongoose.connection.close();
}

/**
 * Run `work` inside a transaction and return its result.
 *
 * This is THE integrity primitive of the application. Anything that touches
 * more than one collection must go through here, so a partial failure can
 * never leave stock, invoices, payments and balances disagreeing.
 *
 * Mongoose's withTransaction also retries on transient errors and write
 * conflicts, which matters when two clerks bill the same product at once.
 */
export async function withTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
