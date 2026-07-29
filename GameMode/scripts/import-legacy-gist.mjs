import fs from 'node:fs/promises';

const [inputPath, apiBase] = process.argv.slice(2);
if (!inputPath || !apiBase) {
  console.error('Usage: node scripts/import-legacy-gist.mjs <exported-json> <worker-base-url>');
  process.exit(1);
}
if (!process.env.CHRONOS_ADMIN_CODE) {
  console.error('Set CHRONOS_ADMIN_CODE in this terminal before importing.');
  process.exit(1);
}

const parsed = JSON.parse(await fs.readFile(inputPath, 'utf8'));
const entries = Array.isArray(parsed) ? parsed : parsed.entries;
if (!Array.isArray(entries)) throw new Error('Export must be an array or an object with entries[].');

const groups = new Map();
for (const entry of entries) {
  if (!entry || typeof entry !== 'object') continue;
  const partition = {
    scope: entry.dailyDate ? 'daily' : 'standard',
    mode: entry.dailyDate ? 'classic' : (entry.mode || 'classic'),
    difficulty: entry.hc ? 'hardcore' : 'normal',
    rulesetVersion: entry.rulesetVersion || 1,
    dailyDate: entry.dailyDate || null,
  };
  const key = JSON.stringify(partition);
  if (!groups.has(key)) groups.set(key, { partition, entries: [] });
  groups.get(key).entries.push(entry);
}

let imported = 0;
for (const group of groups.values()) {
  const response = await fetch(`${apiBase.replace(/\/+$/, '')}/v1/admin/import-leaderboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.CHRONOS_ADMIN_CODE}` },
    body: JSON.stringify(group),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Import failed with ${response.status}`);
  imported += result.imported || 0;
}
console.log(`Imported ${imported} legacy entries into ${groups.size} partition(s).`);
