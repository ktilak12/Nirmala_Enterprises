import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve('server/data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const action = process.argv[2] || 'pull';
const keys = ['products', 'farmers', 'parties', 'sales', 'purchases', 'loans', 'expenses', 'auditLogs', 'settings'];

console.log(`\n========================================`);
console.log(` Nirmala Enterprises Data Sync (${action.toUpperCase()})`);
console.log(`========================================\n`);

if (action === 'pull') {
  console.log('Fetching live database from Cloudflare KV to server/data/...\n');
  for (const key of keys) {
    try {
      const raw = execSync(`npx wrangler kv key get --binding=NIRMALA_DB --remote "${key}"`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();

      if (raw) {
        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = raw;
        }
        const targetFile = path.join(DATA_DIR, `${key}.json`);
        fs.writeFileSync(targetFile, JSON.stringify(parsed, null, 2), 'utf8');
        const count = Array.isArray(parsed) ? `${parsed.length} records` : 'synced';
        console.log(`  ✓ ${key.padEnd(12)} -> server/data/${key}.json (${count})`);
      } else {
        console.log(`  - ${key.padEnd(12)} -> (empty remote)`);
      }
    } catch (err) {
      console.warn(`  ! ${key.padEnd(12)} -> Not yet initialized in remote KV.`);
    }
  }
} else if (action === 'push') {
  console.log('Uploading server/data/ to Cloudflare KV...\n');
  const tempFile = path.resolve('scratch_sync_temp.json');
  for (const key of keys) {
    const srcFile = path.join(DATA_DIR, `${key}.json`);
    if (fs.existsSync(srcFile)) {
      try {
        const content = fs.readFileSync(srcFile, 'utf8');
        fs.writeFileSync(tempFile, content, 'utf8');
        execSync(`npx wrangler kv key put --binding=NIRMALA_DB --remote "${key}" --path="${tempFile}"`, {
          stdio: ['pipe', 'pipe', 'ignore']
        });
        const parsed = JSON.parse(content);
        const count = Array.isArray(parsed) ? `${parsed.length} records` : 'uploaded';
        console.log(`  ✓ ${key.padEnd(12)} <- server/data/${key}.json (${count})`);
      } catch (err) {
        console.error(`  X ${key.padEnd(12)} failed to push:`, err.message);
      }
    } else {
      console.log(`  - ${key.padEnd(12)} skipped (file not found)`);
    }
  }
  if (fs.existsSync(tempFile)) {
    fs.unlinkSync(tempFile);
  }
} else {
  console.error(`Unknown action: ${action}. Use 'pull' or 'push'.`);
  process.exit(1);
}

console.log(`\n========================================`);
console.log(` Sync completed successfully.`);
console.log(`========================================\n`);
