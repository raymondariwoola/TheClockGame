import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const excluded = new Set(['node_modules', '.wrangler', '.wrangler-dry-run']);
const patterns = [/api\.github\.com/i, /gist\.github/i, /\bgistId\b/i, /\bgistFile\b/i, /\btokenParts\b/i, /\bGITHUB_TOKEN\b/];
const failures = [];
async function walk(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (excluded.has(item.name)) continue;
    const path = join(directory, item.name);
    if (item.isDirectory()) await walk(path);
    else if (['.js', '.mjs', '.cjs', '.json', '.jsonc', '.html'].includes(extname(item.name))) {
      const source = await readFile(path, 'utf8');
      for (const pattern of patterns) if (pattern.test(source)) failures.push(`${relative(root, path)}: ${pattern}`);
    }
  }
}
await walk(root);
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('✓ no GitHub Gist runtime references found');
