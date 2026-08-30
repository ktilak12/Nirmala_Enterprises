/**
 * Initialise MongoDB as a SINGLE-NODE REPLICA SET.
 *
 * Why this exists
 * ---------------
 * The concept document's governing rule is "one transaction should update every
 * related part of the business automatically". In MongoDB, multi-document ACID
 * transactions are ONLY available on a replica set or sharded cluster. A plain
 * standalone `mongod` will reject `session.startTransaction()` outright, which
 * would quietly reduce every composite write (sale -> stock -> invoice ->
 * payment -> balance) to a series of non-atomic steps that can half-fail.
 *
 * A single-node replica set gives us real transactions with no cluster, no
 * extra machines and no administrator rights.
 *
 * We use the Node driver rather than `mongosh` because `mongosh` is a separate
 * download and is NOT bundled in the MongoDB server ZIP.
 *
 * Safe to run repeatedly - an already-initialised set is treated as success.
 */
import { MongoClient } from 'mongodb';

const HOST = process.env.MONGO_HOST ?? '127.0.0.1:27017';
const REPL_SET = process.env.MONGO_REPLSET ?? 'rs0';

// directConnection is essential: before initiation the node is not yet a
// discoverable replica-set member, so normal topology discovery would hang.
const uri = `mongodb://${HOST}/?directConnection=true`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
  await client.connect();
  const admin = client.db('admin');

  try {
    await admin.command({
      replSetInitiate: {
        _id: REPL_SET,
        members: [{ _id: 0, host: HOST }],
      },
    });
    console.log(`replSetInitiate sent for "${REPL_SET}".`);
  } catch (err) {
    if (err.codeName === 'AlreadyInitialized' || /already initialized/i.test(err.message)) {
      console.log(`Replica set "${REPL_SET}" is already initialised.`);
    } else {
      await client.close();
      throw err;
    }
  }

  // Election of a single-node set takes a moment. Wait for PRIMARY.
  process.stdout.write('Waiting for PRIMARY');
  let primary = false;
  for (let i = 0; i < 30; i += 1) {
    try {
      const status = await admin.command({ hello: 1 });
      if (status.isWritablePrimary) {
        primary = true;
        break;
      }
    } catch {
      /* still stepping up */
    }
    process.stdout.write('.');
    await sleep(1000);
  }
  console.log('');

  if (!primary) {
    await client.close();
    throw new Error('Node did not reach PRIMARY within 30s. Check the mongod log.');
  }

  console.log('Replica set is PRIMARY.');

  // Prove transactions actually work, rather than assuming they do.
  const session = client.startSession();
  const probe = client.db('nirmala').collection('__txn_probe');
  try {
    await session.withTransaction(async () => {
      await probe.insertOne({ probe: true }, { session });
      throw new Error('intentional rollback');
    });
  } catch (err) {
    if (err.message !== 'intentional rollback') {
      await session.endSession();
      await client.close();
      throw new Error(`Transactions are NOT working: ${err.message}`);
    }
  } finally {
    await session.endSession();
  }

  const leftovers = await probe.countDocuments({ probe: true });
  await probe.drop().catch(() => {});
  await client.close();

  if (leftovers !== 0) {
    throw new Error(
      `Transaction rollback did not work - ${leftovers} orphan document(s) survived.`,
    );
  }

  console.log('Verified: multi-document transactions commit and roll back correctly.');
  console.log('MongoDB is ready for the Nirmala transaction engine.');
}

main().catch((err) => {
  console.error(`\nReplica-set setup failed: ${err.message}`);
  process.exit(1);
});
