import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'server', 'data');
const cfFunctionsFile = path.join(rootDir, 'functions', 'api', '[[path]].js');

console.log('🧹 [CLEANUP] Starting comprehensive dummy data wipe for client handover...');

// 1. Wipe JSON transactional data in server/data
const emptyArrays = [
  'sales.json',
  'purchases.json',
  'loans.json',
  'expenses.json',
  'farmers.json',
  'parties.json',
  'auditLogs.json',
  'whatsapp_outbox.json',
];

for (const filename of emptyArrays) {
  const filePath = path.join(dataDir, filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf8');
    console.log(`  ✅ Cleared server/data/${filename} -> []`);
  } catch (err) {
    console.warn(`  ⚠️ Could not write ${filename}:`, err.message);
  }
}

// 2. Reset products stock to 0 in server/data/products.json
const productsFile = path.join(dataDir, 'products.json');
try {
  if (fs.existsSync(productsFile)) {
    const raw = fs.readFileSync(productsFile, 'utf8');
    const products = JSON.parse(raw);
    if (Array.isArray(products)) {
      const resetProducts = products.map((p) => ({
        ...p,
        currentStock: 0,
      }));
      fs.writeFileSync(productsFile, JSON.stringify(resetProducts, null, 2), 'utf8');
      console.log(`  ✅ Reset currentStock to 0 for ${resetProducts.length} items in server/data/products.json`);
    }
  }
} catch (err) {
  console.warn('  ⚠️ Could not reset products.json stock:', err.message);
}

// 3. Clear dummy data from Cloudflare Functions API file (functions/api/[[path]].js)
try {
  if (fs.existsSync(cfFunctionsFile)) {
    let content = fs.readFileSync(cfFunctionsFile, 'utf8');
    // Reset all currentStock to 0
    content = content.replace(/"currentStock":\s*\d+/g, '"currentStock":0');
    // Clear sales array
    content = content.replace(/sales:\s*\[[\s\S]*?\n\s*\],\s*\n\s*purchases:/, 'sales: [],\n  purchases:');
    fs.writeFileSync(cfFunctionsFile, content, 'utf8');
    console.log('  ✅ Cleared demo sales and reset stock to 0 in functions/api/[[path]].js');
  }
} catch (err) {
  console.warn('  ⚠️ Could not update functions/api/[[path]].js:', err.message);
}

// 4. Safely wipe WhatsApp session tokens so client connects their own shop phone
const sessionDir = path.join(dataDir, 'whatsapp_session');
try {
  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true, force: true });
    fs.mkdirSync(sessionDir, { recursive: true, mode: 0o700 });
    console.log('  ✅ Cleaned stale WhatsApp credentials folder (ready for client pairing)');
  }
} catch (err) {
  console.warn('  ⚠️ Could not reset whatsapp_session:', err.message);
}

console.log('\n✨ [DONE] All dummy transactional data successfully cleared.');
console.log('Your client starts with 0 sales, 0 fake stock, clean audit logs, and a fresh WhatsApp pairing QR code.\n');

