import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { env } from '../config/env.js';
import { ROLES } from '../config/permissions.js';
import { Category, Unit } from '../models/Catalog.js';
import { Party } from '../models/Party.js';
import { Product } from '../models/Product.js';
import { getSettings } from '../models/Setting.js';
import { User } from '../models/User.js';
import { assertPasswordAcceptable, hashPassword } from '../services/auth.js';
import { createExpense } from '../services/expenses.js';
import { recordManualMovement } from '../services/inventory.js';
import { createLoan } from '../services/lending.js';
import { nextEntityCode } from '../services/numbering.js';
import { createPurchase } from '../services/purchases.js';
import { createSale } from '../services/sales.js';
import { withTransaction } from '../config/db.js';

/**
 * Seed script.
 *
 *   npm run seed          baseline only - settings, the administrator, units and
 *                         categories. Safe to run on a live database.
 *   npm run seed:demo     baseline plus a worked example of the whole business
 *                         cycle, so the dashboard and reports have something in
 *                         them on first look.
 *
 * Two rules govern this file.
 *
 * First, it is idempotent. Every write is keyed on a natural key and skipped if
 * already present, so running it twice does not produce two administrators or a
 * second Urea. There is deliberately no `--reset` or `--drop` flag: this is an
 * accounting system, and a one-word typo that empties the ledger is not a
 * convenience worth having. Clearing data is a manual, deliberate act.
 *
 * Second - and this is the important one - the demo history is created by calling
 * the same services the application calls. Not one Sale, Purchase or InventoryTxn
 * is inserted directly. Hand-inserting them would be faster and would produce
 * exactly the disease `verify-integrity` exists to detect: stock caches that
 * disagree with the ledger, and party balances that disagree with the documents.
 * Going through `createSale` and `createPurchase` means the seeded data is
 * consistent by construction, and the seed doubles as a smoke test of the
 * transaction engine.
 */

const DEMO = process.argv.includes('--demo');

const log = (msg) => process.stdout.write(`${msg}\n`);
const step = (msg) => process.stdout.write(`  ${msg}\n`);

// ---------------------------------------------------------------------------
// Baseline master data
// ---------------------------------------------------------------------------

/** `precision` is decimal places: commodities weigh in fractions, bags do not. */
const UNITS = [
  { name: 'Kilogram', symbol: 'kg', precision: 3 },
  { name: 'Quintal', symbol: 'q', precision: 2 },
  { name: 'Litre', symbol: 'L', precision: 3 },
  { name: 'Millilitre', symbol: 'ml', precision: 0 },
  { name: 'Bag', symbol: 'bag', precision: 0 },
  { name: 'Packet', symbol: 'pkt', precision: 0 },
  { name: 'Piece', symbol: 'pc', precision: 0 },
];

const CATEGORIES = [
  { name: 'Seeds', kind: 'INPUT', description: 'Hybrid and certified seed' },
  { name: 'Fertilizers', kind: 'INPUT', description: 'Urea, DAP, potash and complexes' },
  { name: 'Pesticides', kind: 'INPUT', description: 'Insecticides, herbicides, fungicides' },
  { name: 'Farm Tools', kind: 'INPUT', description: 'Sprayers, hand tools, accessories' },
  { name: 'Animal Feed', kind: 'INPUT', description: 'Cattle and poultry feed' },
  { name: 'Grains', kind: 'COMMODITY', description: 'Corn, paddy and other grain' },
  { name: 'Forest Produce', kind: 'COMMODITY', description: 'Mohulo and similar collected produce' },
];

async function seedUnits() {
  const map = new Map();
  for (const spec of UNITS) {
    let doc = await Unit.findOne({ symbol: spec.symbol });
    if (!doc) doc = await Unit.create(spec);
    map.set(spec.symbol, doc);
  }
  step(`units: ${map.size}`);
  return map;
}

async function seedCategories() {
  const map = new Map();
  for (const spec of CATEGORIES) {
    let doc = await Category.findOne({ name: spec.name });
    if (!doc) doc = await Category.create(spec);
    map.set(spec.name, doc);
  }
  step(`categories: ${map.size}`);
  return map;
}

/**
 * The first administrator.
 *
 * The password comes from SEED_ADMIN_PASSWORD and is hashed with bcrypt like any
 * other - there is no back door and no plain-text column anywhere (Section 45).
 * `mustChangePassword` is set, so whoever signs in with the seeded credential is
 * made to replace it before doing anything else.
 */
async function seedAdmin() {
  const { email, password, name } = env.seedAdmin;
  const existing = await User.findOne({ email: email.toLowerCase() });

  if (existing) {
    step(`administrator: ${existing.email} (already present, password untouched)`);
    return existing;
  }

  assertPasswordAcceptable(password);

  const user = await User.create({
    name,
    email,
    passwordHash: await hashPassword(password),
    role: ROLES.ADMIN,
    isActive: true,
    mustChangePassword: true,
  });

  step(`administrator created: ${user.email}`);
  log('');
  log('  ┌──────────────────────────────────────────────────────────────┐');
  log(`  │  Sign in with: ${user.email.padEnd(45)} │`);
  log(`  │  Password:     ${String(password).padEnd(45)} │`);
  log('  │  You will be asked to change it immediately.                 │');
  log('  └──────────────────────────────────────────────────────────────┘');
  log('');

  return user;
}

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

const DEMO_PARTIES = [
  {
    name: 'Ravi Kumar',
    phone: '9861200101',
    village: 'Kansabahal',
    district: 'Sundargarh',
    roles: ['farmer', 'customer'],
    farmerProfile: { landAcres: 6.5, primaryCrop: 'Maize', secondaryCrops: ['Paddy'] },
    notes:
      'One record, several relationships - buys inputs, sells corn, holds an advance. ' +
      'Section 39: not three unconnected Ravi Kumars. Note that "borrower" is not ' +
      'stored as a role: a party is a borrower exactly while an advance is ' +
      'outstanding, so it is derived from the loans rather than kept as a flag ' +
      'that would still say "borrower" long after the advance was cleared.',
  },
  {
    name: 'Sunita Majhi',
    phone: '9861200102',
    village: 'Bargaon',
    district: 'Sundargarh',
    roles: ['farmer', 'customer'],
    farmerProfile: { landAcres: 3, primaryCrop: 'Paddy' },
  },
  {
    name: 'Budhram Oram',
    phone: '9861200103',
    village: 'Lathikata',
    district: 'Sundargarh',
    roles: ['farmer'],
    farmerProfile: { landAcres: 2, primaryCrop: 'Mohulo collection' },
  },
  {
    name: 'Shakti Agro Traders',
    phone: '9861200201',
    village: 'Rourkela',
    district: 'Sundargarh',
    roles: ['customer'],
    customerProfile: { businessName: 'Shakti Agro Traders', creditLimit: 200000 },
    notes: 'Commodity buyer - takes corn in lots.',
  },
  {
    name: 'Krishi Bhandar Distributors',
    phone: '9861200301',
    village: 'Sambalpur',
    district: 'Sambalpur',
    roles: ['supplier'],
    supplierProfile: {
      businessName: 'Krishi Bhandar Distributors',
      materialTypes: ['Fertilizer', 'Seed'],
    },
  },
  {
    name: 'Odisha Crop Care',
    phone: '9861200302',
    village: 'Cuttack',
    district: 'Cuttack',
    roles: ['supplier'],
    supplierProfile: { businessName: 'Odisha Crop Care', materialTypes: ['Pesticide'] },
  },
];

/** `openingStock` is posted as an OPENING ledger row, never written to the field. */
const DEMO_PRODUCTS = [
  { name: 'Hybrid Maize Seed', brand: 'Pioneer 3396', category: 'Seeds', unit: 'bag',
    purchasePrice: 1850, sellingPrice: 2100, minStock: 10, openingStock: 40 },
  { name: 'Paddy Seed IR-64', brand: 'OSSC', category: 'Seeds', unit: 'bag',
    purchasePrice: 640, sellingPrice: 760, minStock: 15, openingStock: 60 },
  { name: 'Urea 46% N', brand: 'IFFCO', category: 'Fertilizers', unit: 'bag',
    purchasePrice: 245, sellingPrice: 275, minStock: 50, openingStock: 200 },
  { name: 'DAP 18-46-0', brand: 'Coromandel', category: 'Fertilizers', unit: 'bag',
    purchasePrice: 1290, sellingPrice: 1385, minStock: 20, openingStock: 80 },
  { name: 'Muriate of Potash', brand: 'IPL', category: 'Fertilizers', unit: 'bag',
    purchasePrice: 890, sellingPrice: 975, minStock: 20, openingStock: 50 },
  { name: 'Cypermethrin 10% EC', brand: 'Crop Care', category: 'Pesticides', unit: 'L',
    purchasePrice: 380, sellingPrice: 445, minStock: 12, openingStock: 36 },
  { name: 'Glyphosate 41% SL', brand: 'Crop Care', category: 'Pesticides', unit: 'L',
    purchasePrice: 420, sellingPrice: 490, minStock: 12, openingStock: 30 },
  { name: 'Knapsack Sprayer 16L', brand: 'Neptune', category: 'Farm Tools', unit: 'pc',
    purchasePrice: 1150, sellingPrice: 1400, minStock: 5, openingStock: 12 },

  // Commodities. No opening stock - these arrive by procurement from farmers.
  { name: 'Corn (Maize)', category: 'Grains', unit: 'kg',
    purchasePrice: 22, sellingPrice: 25.5, minStock: 0, isCommodity: true, openingStock: 0 },
  { name: 'Paddy (Rice)', category: 'Grains', unit: 'kg',
    purchasePrice: 21, sellingPrice: 24, minStock: 0, isCommodity: true, openingStock: 0 },
  { name: 'Mohulo', category: 'Forest Produce', unit: 'kg',
    purchasePrice: 35, sellingPrice: 42, minStock: 0, isCommodity: true, openingStock: 0 },
];

async function seedDemoParties(admin) {
  const map = new Map();
  for (const spec of DEMO_PARTIES) {
    let doc = await Party.findOne({ name: spec.name });
    if (!doc) {
      /**
       * Written inside a transaction with a code from the shared counter, the
       * same way `createParty` does it. The service is not reused here only
       * because it rejects duplicate phone numbers with a message aimed at a
       * clerk on a form, which is not the right shape for a script.
       */
      doc = await withTransaction(async (session) => {
        const partyCode = await nextEntityCode('PTY', { session });
        const [created] = await Party.create(
          [{ ...spec, partyCode, createdBy: admin._id }],
          { session },
        );
        return created;
      });
    }
    map.set(spec.name, doc);
  }
  step(`parties: ${map.size}`);
  return map;
}

async function seedDemoProducts({ admin, units, categories }) {
  const map = new Map();

  for (const spec of DEMO_PRODUCTS) {
    let doc = await Product.findOne({ name: spec.name });

    if (!doc) {
      doc = await withTransaction(async (session) => {
        const productCode = await nextEntityCode('PRD', { session });
        const [created] = await Product.create(
          [
            {
              name: spec.name,
              brand: spec.brand ?? '',
              productCode,
              category: categories.get(spec.category)._id,
              unit: units.get(spec.unit)._id,
              purchasePrice: spec.purchasePrice,
              sellingPrice: spec.sellingPrice,
              minStock: spec.minStock ?? 0,
              isCommodity: Boolean(spec.isCommodity),
              createdBy: admin._id,
            },
          ],
          { session },
        );
        return created;
      });

      /**
       * Opening stock is a ledger movement, not a field assignment. This is
       * Section 20 applied to the seed itself: if the seed set `currentStock`
       * directly, the very first integrity check would report drift on every
       * product, because no ledger row would explain the balance.
       */
      if (spec.openingStock > 0) {
        await recordManualMovement({
          payload: {
            productId: String(doc._id),
            type: 'OPENING',
            qtyDelta: spec.openingStock,
            unitCost: spec.purchasePrice,
            remarks: 'Opening stock at go-live',
          },
          actor: admin,
          req: null,
        });
      }
    }

    map.set(spec.name, doc);
  }

  step(`products: ${map.size} (opening stock posted as ledger movements)`);
  return map;
}

/**
 * A worked example of the business cycle in Section 41 order, every step through
 * the real services:
 *
 *   1. an advance to Ravi Kumar
 *   2. a supplier purchase that restocks fertiliser
 *   3. an input sale to Ravi on credit
 *   4. corn procured from Ravi, with part of his advance recovered from the
 *      proceeds - one document that moves stock, the loan and the cash book
 *   5. that corn sold onward to a trader
 *   6. two operating expenses
 */
async function seedDemoHistory({ admin, parties, products }) {
  const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(11, 0, 0, 0);
    return d;
  };

  const ravi = parties.get('Ravi Kumar');
  const sunita = parties.get('Sunita Majhi');
  const trader = parties.get('Shakti Agro Traders');
  const distributor = parties.get('Krishi Bhandar Distributors');

  const id = (name) => String(products.get(name)._id);

  // 1. Advance ------------------------------------------------------------
  const { loan } = await createLoan({
    payload: {
      partyId: String(ravi._id),
      principal: 50000,
      date: daysAgo(60),
      dueDate: daysAgo(-30),
      purpose: 'Kharif season input and labour advance',
      method: 'BANK_TRANSFER',
      reference: 'NEFT/DEMO/0001',
    },
    actor: admin,
    req: null,
  });
  step(`advance ${loan.loanCode}: ₹${loan.principal.toLocaleString('en-IN')} to Ravi Kumar`);

  // 2. Supplier purchase --------------------------------------------------
  const { purchase: restock } = await createPurchase({
    payload: {
      partyId: String(distributor._id),
      date: daysAgo(45),
      items: [
        { productId: id('Urea 46% N'), qty: 100, rate: 245 },
        { productId: id('DAP 18-46-0'), qty: 40, rate: 1290 },
      ],
      adjustments: [{ type: 'TRANSPORT', label: 'Lorry freight from Sambalpur', amount: 2400 }],
      amountPaid: 40000,
      paymentMethod: 'BANK_TRANSFER',
      referenceNo: 'KBD/INV/8841',
    },
    actor: admin,
    req: null,
  });
  step(`purchase ${restock.purchaseCode}: fertiliser restocked, part paid`);

  // 3. Input sale on credit ----------------------------------------------
  const { sale: inputSale } = await createSale({
    payload: {
      partyId: String(ravi._id),
      date: daysAgo(40),
      items: [
        { productId: id('Urea 46% N'), qty: 20, rate: 275 },
        { productId: id('Hybrid Maize Seed'), qty: 1, rate: 2100 },
      ],
      amountPaid: 0,
      notes: 'On credit against the season advance',
    },
    actor: admin,
    req: null,
  });
  step(`sale ${inputSale.saleCode}: ₹${inputSale.grandTotal.toLocaleString('en-IN')} of inputs on credit`);

  const { sale: sunitaSale } = await createSale({
    payload: {
      partyId: String(sunita._id),
      date: daysAgo(38),
      items: [
        { productId: id('Paddy Seed IR-64'), qty: 4, rate: 760 },
        { productId: id('Cypermethrin 10% EC'), qty: 2, rate: 445 },
      ],
      amountPaid: 3930,
      paymentMethod: 'UPI',
      paymentReference: 'UPI/DEMO/77120',
    },
    actor: admin,
    req: null,
  });
  step(`sale ${sunitaSale.saleCode}: paid in full by UPI`);

  // 4. Procurement with loan recovery ------------------------------------
  const { purchase: procurement } = await createPurchase({
    payload: {
      partyId: String(ravi._id),
      isProcurement: true,
      date: daysAgo(10),
      items: [{ productId: id('Corn (Maize)'), qty: 1000, rate: 22 }],
      adjustments: [
        {
          type: 'LOAN_RECOVERY',
          label: 'Part recovery of season advance',
          amount: 20000,
          loanId: String(loan._id),
        },
        { type: 'QUALITY_CUT', label: 'Moisture 16% - deduction', amount: 600 },
      ],
      amountPaid: 0,
      notes: '1,000 kg maize, moisture-adjusted',
    },
    actor: admin,
    req: null,
  });
  step(
    `procurement ${procurement.purchaseCode}: gross ₹${procurement.grossAmount.toLocaleString('en-IN')}` +
      ` − adjustments ₹${procurement.adjustmentTotal.toLocaleString('en-IN')}` +
      ` = net payable ₹${procurement.netPayable.toLocaleString('en-IN')}`,
  );

  await createPurchase({
    payload: {
      partyId: String(parties.get('Budhram Oram')._id),
      isProcurement: true,
      date: daysAgo(8),
      items: [{ productId: id('Mohulo'), qty: 240, rate: 35 }],
      amountPaid: 8400,
      paymentMethod: 'CASH',
    },
    actor: admin,
    req: null,
  });
  step('procurement: 240 kg mohulo, paid in cash');

  // 5. Commodity sold onward ---------------------------------------------
  const { sale: tradeSale } = await createSale({
    payload: {
      partyId: String(trader._id),
      date: daysAgo(4),
      items: [{ productId: id('Corn (Maize)'), qty: 800, rate: 25.5 }],
      amountPaid: 15000,
      paymentMethod: 'BANK_TRANSFER',
      paymentReference: 'NEFT/SHAKTI/4471',
      notes: '800 kg maize lot',
    },
    actor: admin,
    req: null,
  });
  step(`sale ${tradeSale.saleCode}: 800 kg corn to Shakti Agro Traders`);

  // 6. Expenses -----------------------------------------------------------
  await createExpense({
    payload: {
      category: 'TRANSPORT',
      description: 'Tractor hire - maize collection from Kansabahal',
      amount: 3200,
      date: daysAgo(10),
      method: 'CASH',
    },
    actor: admin,
    req: null,
  });

  await createExpense({
    payload: {
      category: 'LOADING_UNLOADING',
      description: 'Hamali charges - 800 kg maize despatch',
      amount: 1100,
      date: daysAgo(4),
      method: 'CASH',
    },
    actor: admin,
    req: null,
  });
  step('expenses: transport and loading recorded');
}

// ---------------------------------------------------------------------------

async function main() {
  const { replicaSet } = await connectDatabase();
  log(`\nConnected to MongoDB (replica set: ${replicaSet}).\n`);

  log('Baseline');
  await getSettings();
  step('settings singleton ready (tax OFF, weighted-average valuation)');
  const admin = await seedAdmin();
  const units = await seedUnits();
  const categories = await seedCategories();

  if (!DEMO) {
    log('\nBaseline seed complete. Run with --demo for a worked example dataset.\n');
    return;
  }

  const alreadySeeded = await Product.countDocuments({});
  if (alreadySeeded > 0) {
    log('\nDemo data appears to be present already - skipping.');
    log('The demo history is only created on an empty catalogue, so re-running');
    log('this script cannot double-count stock or duplicate a farmer advance.\n');
    return;
  }

  log('\nDemo dataset');
  const parties = await seedDemoParties(admin);
  const products = await seedDemoProducts({ admin, units, categories });
  await seedDemoHistory({ admin, parties, products });

  log('\nDemo seed complete. Every figure above was produced by the same services');
  log('the application uses, so the ledger, the balances and the documents agree.');
  log('Confirm that with:  npm run verify\n');
}

try {
  await main();
} catch (error) {
  process.stderr.write(`\nSeed failed: ${error.message}\n`);
  if (error.details) process.stderr.write(`${JSON.stringify(error.details, null, 2)}\n`);
  process.exitCode = 1;
} finally {
  await disconnectDatabase().catch(() => {});
  await mongoose.disconnect().catch(() => {});
}
