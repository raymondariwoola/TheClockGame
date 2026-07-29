import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/(.:)/, '$1');
const ignored = new Set(['vendor']);
const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (ignored.has(name) || name === 'node_modules') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(?:js|mjs|cjs)$/.test(name)) files.push(path);
  }
}
walk(root);
for (const file of files) execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
console.log(`✓ syntax checked ${files.length} files under ${relative(process.cwd(), root) || '.'}`);
