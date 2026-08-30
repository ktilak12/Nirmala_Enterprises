/**
 * End-to-end acceptance test, driven through the HTTP API.
 *
 *   npm run verify:acceptance          (server must already be running)
 *
 * `test-atomicity.js` proves the transaction engine works by calling the service
 * layer directly. This script is the other half: it proves the *whole* system
 * behaves, over the same wire a clerk's browser uses - routing, validation, RBAC,
 * numbering, the ledger, invoicing and the exports. A bug that lives in a route
 * or a permission table is invisible to a service-level test and obvious here.
 *
 * The centrepiece is the connectedness test the build plan named as its
 * acceptance criterion for Section 41 - "one transaction should update every
 * related part of the business automatically":
 *
 *   a Rs 50,000 advance to a farmer
 *   -> sell that same farmer Rs 8,000 of fertiliser
 *   -> procure 1,000 kg of corn from them at Rs 22 with a Rs 20,000 recovery
 *
 * and then, in one pass, check that all seven consequences landed: corn stock up,
 * fertiliser stock down, the advance down to Rs 30,000, net payable Rs 2,000, an
 * invoice raised, four entries on the farmer's timeline, and a cash book that
 * agrees with all of it.
 *
 * On data: this script CREATES records and deletes nothing, because the system is
 * deliberately append-only - there is no API to unwind a sale, and inventing one
 * for a test would be the worst possible reason to add it. Everything it makes is
 * prefixed `[ACCEPTANCE]` so it is obvious in any list, and it reuses those same
 * fixtures on later runs rather than breeding new ones. Run it against a dev or
 * staging database, never against the real books.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = resolve(HERE, '../..');

/* --------------------------------------------------------------------------
 * Reporting
 * ------------------------------------------------------------------------ */

let passes = 0;
let failures = 0;
const problems = [];

const log = (msg = '') => process.stdout.write(`${msg}\n`);
const heading = (text) => log(`\n${text}\n${'-'.repeat(text.length)}`);

function assert(ok, label, detail = '') {
  if (ok) {
    passes += 1;
    log(`   PASS  ${label}`);
  } else {
    failures += 1;
    problems.push(label);
    log(`   FAIL  ${label}${detail ? `\n         ${detail}` : ''}`);
  }
  return Boolean(ok);
}

/** Money comparison. Rupee arithmetic is decimal, so compare to the paisa. */
const eq = (a, b, tolerance = 0.01) => Math.abs(Number(a) - Number(b)) <= tolerance;
const round2 = (n) => Math.round(Number(n) * 100) / 100;

/** A fatal problem: the test cannot continue, and saying why beats a stack trace. */
class Abort extends Error {}
const abort = (message) => {
  throw new Abort(message);
};

/* --------------------------------------------------------------------------
 * Configuration
 * ------------------------------------------------------------------------ */

/**
 * Read the server's own .env rather than importing config/env.js, which would
 * pull in the whole Mongoose stack for two strings. Deliberately minimal: KEY=value,
 * comments and blanks skipped, no quoting rules, no interpolation.
 */
function readEnvFile(path) {
  const out = {};
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return out;
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const at = trimmed.indexOf('=');
    if (at < 1) continue;
    out[trimmed.slice(0, at).trim()] = trimmed.slice(at + 1).trim();
  }
  return out;
}

const fileEnv = readEnvFile(resolve(SERVER_ROOT, '.env'));
const cfg = {
  base: process.env.API_BASE ?? `http://127.0.0.1:${process.env.PORT ?? fileEnv.PORT ?? 5000}/api`,
  adminEmail: process.env.SEED_ADMIN_EMAIL ?? fileEnv.SEED_ADMIN_EMAIL,
  adminPassword: process.env.SEED_ADMIN_PASSWORD ?? fileEnv.SEED_ADMIN_PASSWORD,
};

/* --------------------------------------------------------------------------
 * HTTP
 * ------------------------------------------------------------------------ */

let requests = 0;

/**
 * One request. Returns `{ status, body, headers }` and never throws on a non-2xx,
 * because half the assertions in this file are *about* the error responses - a
 * 403 from a financial report is a pass, not an exception.
 */
async function call(method, path, { token, body, raw = false } = {}) {
  requests += 1;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${cfg.base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    abort(
      `Cannot reach ${cfg.base}${path} (${err.message}).\n` +
        '         Start the API first:  cd server && npm run dev',
    );
  }

  if (raw) {
    return { status: res.status, buffer: Buffer.from(await res.arrayBuffer()), headers: res.headers };
  }

  const text = await res.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { error: text.slice(0, 200) };
    }
  }
  return { status: res.status, body: parsed, headers: res.headers };
}

const GET = (path, token) => call('GET', path, { token });
const POST = (path, body, token) => call('POST', path, { token, body });

/** For setup steps, where anything but success means the test cannot proceed. */
function must(res, what) {
  if (res.status < 200 || res.status >= 300) {
    abort(`${what} failed with HTTP ${res.status}: ${res.body?.error ?? '(no message)'}`);
  }
  return res.body;
}

/* --------------------------------------------------------------------------
 * Fixtures
 * ------------------------------------------------------------------------ */

const MARK = '[ACCEPTANCE]';
const FIXTURES = {
  farmer: `${MARK} Ravi Kumar`,
  corn: `${MARK} Corn (test)`,
  fertiliser: `${MARK} Urea 50kg (test)`,
  staffEmail: 'acceptance.sales@nirmala.test',
  staffPassword: 'Acceptance@12345',
};

/** Find one of our own fixtures by exact name, or create it. */
async function findOrCreate({ listPath, createPath, name, matchIn, payload, token, label }) {
  const found = must(await GET(`${listPath}${listPath.includes('?') ? '&' : '?'}q=${encodeURIComponent(name)}`, token), `Looking up ${label}`);
  const rows = found.rows ?? [];
  const hit = rows.find((r) => r[matchIn] === name);
  if (hit) return { record: hit, created: false };

  const made = must(await POST(createPath, payload, token), `Creating ${label}`);
  return { record: made.party ?? made.product ?? made.user ?? made, created: true };
}

/* --------------------------------------------------------------------------
 * 1. Reachability and sign-in
 * ------------------------------------------------------------------------ */

async function signIn() {
  heading('1. The API is up and the administrator can sign in');

  const health = await GET('/health');
  assert(health.status === 200 && health.body?.ok === true, 'GET /health returns ok', `HTTP ${health.status}`);

  if (!cfg.adminEmail || !cfg.adminPassword) {
    abort('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in server/.env.');
  }

  const login = await POST('/auth/login', { email: cfg.adminEmail, password: cfg.adminPassword });
  if (login.status === 429) {
    abort(
      'The login rate limiter has kicked in (10 attempts per 15 minutes, by design).\n' +
        '         Wait for the window to clear and run this again.',
    );
  }
  if (login.status !== 200) {
    abort(`Administrator sign-in failed with HTTP ${login.status}: ${login.body?.error ?? ''}`);
  }
  assert(typeof login.body.token === 'string' && login.body.token.length > 20, 'Sign-in returns a bearer token');

  const me = must(await GET('/auth/me', login.body.token), 'GET /auth/me');
  assert(me.user?.role === 'ADMIN', 'The seeded account is an ADMIN', `got ${me.user?.role}`);
  assert(
    Array.isArray(me.user?.permissions) && me.user.permissions.includes('*'),
    'ADMIN carries the wildcard permission',
  );

  /**
   * Not a failure - the seed sets this deliberately so the shipped credential
   * cannot survive as a live password. Worth printing, because it is exactly the
   * kind of thing that gets forgotten before a handover.
   */
  if (me.user?.mustChangePassword) {
    log('   NOTE  This account still has mustChangePassword set - change it before going live.');
  }

  return login.body.token;
}

/* --------------------------------------------------------------------------
 * 2. Fixtures
 * ------------------------------------------------------------------------ */

async function setUpFixtures(token) {
  heading('2. Test fixtures');

  const categories = must(await GET('/catalog/categories', token), 'Listing categories').rows ?? [];
  const units = must(await GET('/catalog/units', token), 'Listing units').rows ?? [];
  if (!categories.length || !units.length) {
    abort('No categories or units exist. Run `npm run seed` first.');
  }

  const pickCategory = (kind) => categories.find((c) => c.kind === kind) ?? categories[0];
  const pickUnit = (...names) => {
    for (const n of names) {
      const hit = units.find((u) => u.symbol?.toLowerCase() === n || u.name?.toLowerCase() === n);
      if (hit) return hit;
    }
    return units[0];
  };

  const kgUnit = pickUnit('kg', 'kilogram');
  const bagUnit = pickUnit('bag', 'bags', 'nos', 'pcs') ?? kgUnit;

  const farmer = await findOrCreate({
    listPath: '/parties',
    createPath: '/parties',
    name: FIXTURES.farmer,
    matchIn: 'name',
    label: 'the test farmer',
    token,
    payload: {
      name: FIXTURES.farmer,
      phone: '9000000001',
      village: 'Test Village',
      district: 'Sundargarh',
      roles: ['farmer', 'customer'],
      farmerProfile: { landAcres: 4, primaryCrop: 'Corn' },
      notes: 'Created by verify-acceptance.mjs. Safe to keep; do not use for real trade.',
    },
  });
  log(`   ${farmer.created ? 'made' : 'reusing'}  farmer ${farmer.record.partyCode} ${farmer.record.name}`);

  const corn = await findOrCreate({
    listPath: '/products',
    createPath: '/products',
    name: FIXTURES.corn,
    matchIn: 'name',
    label: 'the test commodity',
    token,
    payload: {
      name: FIXTURES.corn,
      category: pickCategory('COMMODITY')._id,
      unit: kgUnit._id,
      purchasePrice: 22,
      sellingPrice: 26,
      isCommodity: true,
      minStock: 0,
    },
  });
  log(`   ${corn.created ? 'made' : 'reusing'}  commodity ${corn.record.productCode} ${corn.record.name}`);

  const fert = await findOrCreate({
    listPath: '/products',
    createPath: '/products',
    name: FIXTURES.fertiliser,
    matchIn: 'name',
    label: 'the test input',
    token,
    payload: {
      name: FIXTURES.fertiliser,
      category: pickCategory('INPUT')._id,
      unit: bagUnit._id,
      purchasePrice: 700,
      sellingPrice: 800,
      isCommodity: false,
      minStock: 2,
    },
  });
  log(`   ${fert.created ? 'made' : 'reusing'}  input ${fert.record.productCode} ${fert.record.name}`);

  /**
   * The fertiliser sale below is 10 bags at Rs 800. Top the stock up if it has
   * run down over previous runs - through an OPENING ledger movement, which is
   * the only way stock can move at all (Section 20). There is no "set stock to N".
   */
  const stocked = must(await GET(`/products/${fert.record._id}`, token), 'Reading test input').product;
  if (stocked.currentStock < 20) {
    const topUp = 100;
    must(
      await POST(
        '/inventory/movements',
        {
          productId: fert.record._id,
          type: 'OPENING',
          qtyDelta: topUp,
          unitCost: 700,
          remarks: 'Opening stock for the acceptance test run.',
        },
        token,
      ),
      'Recording opening stock',
    );
    log(`   stock    added ${topUp} to ${fert.record.name} (was ${stocked.currentStock})`);
  }

  return { farmer: farmer.record, corn: corn.record, fert: fert.record };
}

/* --------------------------------------------------------------------------
 * 3. Atomicity over HTTP
 * ------------------------------------------------------------------------ */

async function testAtomicity(token, fx) {
  heading('3. Atomicity: an oversell leaves nothing behind');

  const before = await snapshot(token, fx.fert._id);
  const overSell = before.stock + 5000;

  const res = await POST(
    '/sales',
    {
      partyId: fx.farmer._id,
      items: [{ productId: fx.fert._id, qty: overSell, rate: 800 }],
    },
    token,
  );

  assert(res.status === 400, 'Selling more than we hold is refused with HTTP 400', `got HTTP ${res.status}`);
  assert(
    typeof res.body?.error === 'string' && /stock|available|enough/i.test(res.body.error),
    'The refusal explains that stock is short',
    `message was: ${res.body?.error ?? '(none)'}`,
  );

  const after = await snapshot(token, fx.fert._id);
  assert(after.sales === before.sales, 'No Sale document was written', `${before.sales} -> ${after.sales}`);
  assert(after.invoices === before.invoices, 'No Invoice was written', `${before.invoices} -> ${after.invoices}`);
  assert(after.movements === before.movements, 'No inventory movement was written', `${before.movements} -> ${after.movements}`);
  assert(eq(after.stock, before.stock), 'Stock is unchanged', `${before.stock} -> ${after.stock}`);
}

/** The four counters the atomicity test compares, read over the API. */
async function snapshot(token, productId) {
  const [sales, invoices, movements, product] = await Promise.all([
    GET('/sales?limit=1', token),
    GET('/invoices?limit=1', token),
    GET(`/inventory/movements?limit=1&productId=${productId}`, token),
    GET(`/products/${productId}`, token),
  ]);
  return {
    sales: must(sales, 'Counting sales').total,
    invoices: must(invoices, 'Counting invoices').total,
    movements: must(movements, 'Counting movements').total,
    stock: must(product, 'Reading stock').product.currentStock,
  };
}

/* --------------------------------------------------------------------------
 * 4. Connectedness - the acceptance criterion for Section 41
 * ------------------------------------------------------------------------ */

async function testConnectedness(token, fx) {
  heading('4. Connectedness (Section 41): one farmer, three transactions, seven consequences');

  const ADVANCE = 50_000;
  const FERT_QTY = 10;
  const FERT_RATE = 800; //   -> Rs 8,000
  const CORN_QTY = 1_000;
  const CORN_RATE = 22; //    -> Rs 22,000 gross
  const RECOVERY = 20_000; // -> Rs 2,000 net payable, Rs 30,000 advance left
  const SETTLED = 2_000; //   the net, handed over in cash at the yard

  const opening = {
    corn: (await readStock(token, fx.corn._id)),
    fert: (await readStock(token, fx.fert._id)),
    cash: (await readCashBook(token)),
  };

  // -- the advance -----------------------------------------------------------
  const loanRes = await POST(
    '/loans',
    {
      partyId: fx.farmer._id,
      principal: ADVANCE,
      purpose: 'Seed and fertiliser for the season',
      method: 'CASH',
      notes: 'Acceptance test advance.',
    },
    token,
  );
  const loan = must(loanRes, 'Disbursing the advance').loan;
  assert(loanRes.status === 201, 'A Rs 50,000 advance is recorded', `HTTP ${loanRes.status}`);
  assert(eq(loan.outstanding, ADVANCE), 'The new advance is outstanding in full', `outstanding ${loan.outstanding}`);
  assert(
    Boolean(must(loanRes, 'Disbursing the advance').payment),
    'Disbursing it also wrote the cash-out entry',
  );

  // -- the input sale -------------------------------------------------------
  const saleRes = await POST(
    '/sales',
    {
      partyId: fx.farmer._id,
      items: [{ productId: fx.fert._id, qty: FERT_QTY, rate: FERT_RATE }],
      notes: 'Acceptance test sale.',
    },
    token,
  );
  const { sale, invoice } = must(saleRes, 'Selling the fertiliser');
  assert(saleRes.status === 201, 'A Rs 8,000 fertiliser sale is recorded', `HTTP ${saleRes.status}`);
  assert(eq(sale.grandTotal, FERT_QTY * FERT_RATE), 'The sale totals Rs 8,000', `got ${sale.grandTotal}`);
  assert(Boolean(invoice?.invoiceCode), 'The sale raised an invoice by itself', 'no invoice came back');

  // -- the procurement, with the recovery netted off ------------------------
  const purchaseRes = await POST(
    '/purchases',
    {
      partyId: fx.farmer._id,
      isProcurement: true,
      items: [{ productId: fx.corn._id, qty: CORN_QTY, rate: CORN_RATE }],
      /**
       * A positive adjustment is a deduction: `netPayable = gross - adjustmentTotal`.
       * The service refuses a negative LOAN_RECOVERY outright, which is the right
       * reading - "recovering" a negative amount would be lending more money
       * through the settlement screen.
       */
      adjustments: [
        {
          type: 'LOAN_RECOVERY',
          label: 'Advance recovered from this settlement',
          amount: RECOVERY,
          loanId: loan._id,
        },
      ],
      amountPaid: SETTLED,
      paymentMethod: 'CASH',
      notes: 'Acceptance test procurement.',
    },
    token,
  );
  const { purchase, repayments } = must(purchaseRes, 'Procuring the corn');
  assert(purchaseRes.status === 201, 'A 1,000 kg corn procurement is recorded', `HTTP ${purchaseRes.status}`);

  // -- and now the seven consequences --------------------------------------
  log('');
  assert(
    eq(purchase.grossAmount, CORN_QTY * CORN_RATE),
    '(1) Gross procurement value is Rs 22,000',
    `got ${purchase.grossAmount}`,
  );
  assert(
    eq(purchase.netPayable, CORN_QTY * CORN_RATE - RECOVERY),
    '(2) Net payable to the farmer is Rs 2,000 after the recovery',
    `got ${purchase.netPayable}`,
  );

  const cornAfter = await readStock(token, fx.corn._id);
  assert(
    eq(cornAfter, opening.corn + CORN_QTY),
    '(3) Corn stock rose by exactly 1,000',
    `${opening.corn} -> ${cornAfter}`,
  );

  const fertAfter = await readStock(token, fx.fert._id);
  assert(
    eq(fertAfter, opening.fert - FERT_QTY),
    '(4) Fertiliser stock fell by exactly 10',
    `${opening.fert} -> ${fertAfter}`,
  );

  const loanAfter = must(await GET(`/loans/${loan._id}`, token), 'Re-reading the advance').loan;
  assert(
    eq(loanAfter.outstanding, ADVANCE - RECOVERY),
    '(5) The advance is down to Rs 30,000 without anyone touching the loan screen',
    `outstanding ${loanAfter.outstanding}`,
  );
  assert(
    Array.isArray(repayments) && repayments.length === 1,
    'The recovery wrote a repayment record against the advance',
    `got ${repayments?.length ?? 0}`,
  );

  const profile = must(await GET(`/parties/${fx.farmer._id}/profile`, token), 'Reading the farmer profile');
  const kinds = profile.timeline.map((t) => t.kind);
  const wanted = ['ADVANCE', 'SALE', 'PROCUREMENT', 'ADVANCE_REPAID'];
  const missing = wanted.filter((k) => !kinds.includes(k));
  assert(
    missing.length === 0,
    '(6) All four dealings appear on the one farmer timeline',
    missing.length ? `missing ${missing.join(', ')}` : '',
  );
  assert(
    eq(profile.totals.loanOutstanding, loanAfter.outstanding),
    'The profile total agrees with the advance record',
    `${profile.totals.loanOutstanding} vs ${loanAfter.outstanding}`,
  );

  /**
   * The cash book must move by the advance paid out and the Rs 2,000 settlement
   * handed over - and NOT by the Rs 20,000 recovery, because no rupee changed
   * hands for that. It was netted off the settlement. Counting the recovery as
   * real cash is the classic way a farmer-advance ledger goes quietly wrong, so
   * this assertion is worth more than it looks.
   */
  const cashAfter = await readCashBook(token);
  const outMoved = round2(cashAfter.cashOut - opening.cash.cashOut);
  const inMoved = round2(cashAfter.cashIn - opening.cash.cashIn);
  assert(
    eq(outMoved, ADVANCE + SETTLED),
    '(7) Cash out moved by Rs 52,000 - the advance plus the net settlement, with the netted recovery excluded',
    `moved ${outMoved}, expected ${ADVANCE + SETTLED}`,
  );
  assert(
    eq(inMoved, 0),
    'Cash in did not move: the fertiliser went out on credit, and nothing was received',
    `moved ${inMoved}`,
  );

  const dash = must(await GET('/dashboard', token), 'Reading the dashboard');
  assert(Boolean(dash.data ?? dash.kpis ?? dash.financials), 'The dashboard renders with the new figures');
  assert(!dash.meta?.financialsWithheld, 'An ADMIN sees the financial block on the dashboard');

  return { loan: loanAfter, sale, invoice, purchase };
}

async function readStock(token, productId) {
  return must(await GET(`/products/${productId}`, token), 'Reading stock').product.currentStock;
}

async function readCashBook(token) {
  const res = must(await GET('/payments?limit=1', token), 'Reading the cash book');
  return res.totals ?? { cashIn: 0, cashOut: 0, net: 0 };
}

/* --------------------------------------------------------------------------
 * 5. RBAC, enforced by the API rather than hidden in the UI
 * ------------------------------------------------------------------------ */

async function testRbac(adminToken, fx, made) {
  heading('5. Role limits are enforced by the API, not just hidden in the menu');

  const users = must(await GET('/users', adminToken), 'Listing users').rows ?? [];
  let staff = users.find((u) => u.email === FIXTURES.staffEmail);

  if (!staff) {
    staff = must(
      await POST(
        '/users',
        {
          name: `${MARK} Sales Clerk`,
          email: FIXTURES.staffEmail,
          password: FIXTURES.staffPassword,
          role: 'SALES_STAFF',
        },
        adminToken,
      ),
      'Creating the test sales clerk',
    ).user;
    log(`   made     SALES_STAFF ${staff.email}`);
  } else {
    /* Reset the password so a run after a manual change still gets in. */
    must(
      await POST(`/users/${staff._id}/reset-password`, { newPassword: FIXTURES.staffPassword }, adminToken),
      'Resetting the test clerk password',
    );
    log(`   reusing  SALES_STAFF ${staff.email}`);
  }

  const login = await POST('/auth/login', { email: FIXTURES.staffEmail, password: FIXTURES.staffPassword });
  if (login.status === 429) {
    log('   SKIP  Login rate limit reached; cannot sign in as the clerk this run.');
    return;
  }
  if (login.status !== 200) {
    assert(false, 'The sales clerk can sign in', `HTTP ${login.status}: ${login.body?.error ?? ''}`);
    return;
  }
  const t = login.body.token;
  assert(true, 'The sales clerk can sign in');

  /* What the role is for. */
  for (const [path, label] of [
    ['/sales?limit=1', 'read sales'],
    ['/products?limit=1', 'read products'],
    ['/parties?limit=1', 'read parties'],
    ['/invoices?limit=1', 'read invoices'],
    ['/reports', 'see the report list'],
  ]) {
    const r = await GET(path, t);
    assert(r.status === 200, `Allowed: the clerk can ${label}`, `HTTP ${r.status}`);
  }

  /* The report list must already be filtered - not merely gated on opening. */
  const list = must(await GET('/reports', t), 'Clerk report list').rows ?? [];
  assert(
    list.length > 0 && list.every((r) => r.financial !== true),
    'The clerk\'s report list contains no financial reports at all',
    `offered: ${list.filter((r) => r.financial).map((r) => r.key).join(', ') || 'none'}`,
  );

  /* What the role is not for. Each of these is a 403 from the server. */
  const denied = [
    ['GET', '/reports/profit?format=json', 'open the profit report'],
    ['GET', '/reports/cash-book?format=json', 'open the cash book report'],
    ['GET', '/reports/inventory?format=json', 'open the inventory valuation'],
    ['GET', '/reports/sales?format=json&groupBy=product', 'open a sales report grouped by product'],
    ['GET', '/purchases?limit=1', 'see purchases'],
    ['GET', '/expenses?limit=1', 'see expenses'],
    ['GET', '/loans?limit=1', 'see farmer advances'],
    ['GET', '/users?limit=1', 'see the user list'],
    ['GET', '/audit?limit=1', 'read the audit trail'],
    ['GET', '/settings', 'read settings'],
  ];
  for (const [method, path, label] of denied) {
    const r = await call(method, path, { token: t });
    assert(r.status === 403, `Refused: the clerk cannot ${label}`, `HTTP ${r.status}`);
  }

  /* And the two write refusals the plan called out by name. */
  const cancel = await POST(`/loans/${made.loan._id}/cancel`, { reason: 'Testing the refusal' }, t);
  assert(cancel.status === 403, 'Refused: the clerk cannot cancel a farmer advance', `HTTP ${cancel.status}`);

  const adjust = await POST(
    '/inventory/movements',
    { productId: fx.fert._id, type: 'ADJUSTMENT', qtyDelta: 5, remarks: 'Testing the refusal' },
    t,
  );
  assert(adjust.status === 403, 'Refused: the clerk cannot hand-adjust stock', `HTTP ${adjust.status}`);

  /* The advance really is untouched by that attempt. */
  const still = must(await GET(`/loans/${made.loan._id}`, adminToken), 'Re-reading the advance').loan;
  assert(still.status !== 'CANCELLED', 'The advance survived the refused cancellation', `status ${still.status}`);

  /* The dashboard withholds figures rather than failing. */
  const dash = await GET('/dashboard', t);
  assert(dash.status === 200, 'The clerk still gets a working dashboard', `HTTP ${dash.status}`);
  assert(
    dash.body?.meta?.financialsWithheld === true && dash.body?.data?.financials === undefined,
    'The clerk\'s dashboard withholds the financial block and says so',
  );

  /* A token that is not a token gets nowhere. */
  const forged = await GET('/sales?limit=1', 'not.a.real.token');
  assert(forged.status === 401, 'A forged bearer token is rejected with 401', `HTTP ${forged.status}`);
  const none = await GET('/sales?limit=1');
  assert(none.status === 401, 'No token at all is rejected with 401', `HTTP ${none.status}`);
}

/* --------------------------------------------------------------------------
 * 6. Exports and the invoice PDF
 * ------------------------------------------------------------------------ */

const XLSX_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // a zip, which .xlsx is

async function testExports(token, made) {
  heading('6. Every report exports, and an invoice prints');

  const reports = must(await GET('/reports', token), 'Listing reports').rows ?? [];
  assert(reports.length > 0, 'The report registry is not empty');

  for (const r of reports) {
    const json = await GET(`/reports/${r.key}?format=json`, token);
    const ok = assert(json.status === 200, `${r.key}: renders as JSON`, `HTTP ${json.status}`);
    if (ok) {
      const report = json.body.report;
      assert(
        Array.isArray(report?.columns) && report.columns.length > 0 && Array.isArray(report?.rows),
        `${r.key}: has columns and rows`,
      );
    }

    const xlsx = await call('GET', `/reports/${r.key}?format=excel`, { token, raw: true });
    assert(
      xlsx.status === 200 && xlsx.buffer.subarray(0, 4).equals(XLSX_MAGIC),
      `${r.key}: exports a real .xlsx workbook`,
      `HTTP ${xlsx.status}, ${xlsx.buffer.length} bytes, starts ${xlsx.buffer.subarray(0, 4).toString('hex')}`,
    );
    assert(
      /attachment/i.test(xlsx.headers.get('content-disposition') ?? ''),
      `${r.key}: the workbook is sent as a download`,
      xlsx.headers.get('content-disposition') ?? '(no Content-Disposition)',
    );

    const csv = await call('GET', `/reports/${r.key}?format=csv`, { token, raw: true });
    const text = csv.buffer.toString('utf8');
    assert(csv.status === 200 && text.includes(','), `${r.key}: exports CSV`, `HTTP ${csv.status}`);
  }

  /* An unknown report is a 404, not a 500 or an empty workbook. */
  const bogus = await GET('/reports/not-a-report?format=json', token);
  assert(bogus.status === 404, 'An unknown report key is a clean 404', `HTTP ${bogus.status}`);

  /* And the invoice PDF, which is the one document a customer ever sees. */
  const pdf = await call('GET', `/invoices/${made.invoice._id}/pdf`, { token, raw: true });
  assert(pdf.status === 200, 'The invoice PDF renders', `HTTP ${pdf.status}`);
  assert(
    pdf.buffer.subarray(0, 5).toString('latin1') === '%PDF-',
    'It is a real PDF file',
    `starts with ${JSON.stringify(pdf.buffer.subarray(0, 8).toString('latin1'))}`,
  );
  assert(pdf.buffer.length > 1000, 'The PDF has real content in it', `${pdf.buffer.length} bytes`);
  assert(
    /inline/i.test(pdf.headers.get('content-disposition') ?? ''),
    'It opens inline by default, so Print goes straight to the viewer',
    pdf.headers.get('content-disposition') ?? '(no Content-Disposition)',
  );

  const attached = await call('GET', `/invoices/${made.invoice._id}/pdf?download=1`, { token, raw: true });
  assert(
    /attachment/i.test(attached.headers.get('content-disposition') ?? ''),
    '?download=1 turns it into an attachment',
    attached.headers.get('content-disposition') ?? '(no Content-Disposition)',
  );
}

/* --------------------------------------------------------------------------
 * 7. The ledger still agrees with itself
 * ------------------------------------------------------------------------ */

async function testIntegrity(token) {
  heading('7. Cached stock still agrees with the ledger');

  const res = must(await GET('/inventory/integrity', token), 'Running the integrity check');
  assert(res.drifted === 0, 'No product has drifted from its ledger', `${res.drifted} of ${res.checked} drifted`);
  assert((res.orphans?.length ?? 0) === 0, 'No orphaned movements', `${res.orphans?.length ?? 0} orphans`);
  log(`   checked  ${res.checked} products`);
  log('   NOTE  This is the API view. `npm run verify` also checks party balances.');
}

/* --------------------------------------------------------------------------
 * Run
 * ------------------------------------------------------------------------ */

async function main() {
  log('Nirmala Enterprises - acceptance test');
  log(`Target: ${cfg.base}`);
  log('This creates records marked [ACCEPTANCE] and deletes nothing. Dev databases only.');

  const token = await signIn();
  const fx = await setUpFixtures(token);
  await testAtomicity(token, fx);
  const made = await testConnectedness(token, fx);
  await testRbac(token, fx, made);
  await testExports(token, made);
  await testIntegrity(token);

  heading('Result');
  log(`   ${passes} passed, ${failures} failed, ${requests} requests`);
  if (failures) {
    log('');
    for (const p of problems) log(`   - ${p}`);
    log('\n   The system is not behaving as specified. Do not trust the books until this is green.');
  } else {
    log('\n   Section 41 holds: one transaction updated every related part of the business.');
  }
  return failures === 0;
}

main()
  .then((ok) => process.exit(ok ? 0 : 1))
  .catch((err) => {
    if (err instanceof Abort) {
      log(`\n   STOPPED  ${err.message}`);
    } else {
      log(`\n   CRASHED  ${err?.stack ?? err}`);
    }
    log(`\n   ${passes} passed, ${failures} failed before stopping.`);
    process.exit(1);
  });
