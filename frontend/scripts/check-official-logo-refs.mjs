/**
 * Fail if frontend code still references retired official logo paths.
 * Run: node scripts/check-official-logo-refs.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const FORBIDDEN = [
  '/brand/zrh-ai-icon-official-v1-source.png',
  'zrh-ai-icon-official-v1-source',
];

const SCAN_DIRS = [
  path.join(root, 'src'),
  path.join(root, 'public', 'manifest.json'),
  path.join(root, 'public', 'sw.js'),
  path.join(root, 'index.html'),
];

const EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.html', '.css']);

function walk(p, out = []) {
  const st = fs.statSync(p);
  if (st.isFile()) {
    out.push(p);
    return out;
  }
  for (const name of fs.readdirSync(p)) {
    if (name === 'node_modules' || name === 'dist') continue;
    walk(path.join(p, name), out);
  }
  return out;
}

const files = [];
for (const p of SCAN_DIRS) {
  if (!fs.existsSync(p)) continue;
  if (fs.statSync(p).isFile()) files.push(p);
  else walk(p, files);
}

let hits = 0;
for (const file of files) {
  if (fs.statSync(file).isFile() && EXT.size && !EXT.has(path.extname(file))) continue;
  const text = fs.readFileSync(file, 'utf8');
  for (const bad of FORBIDDEN) {
    if (text.includes(bad)) {
      console.error('FAIL', file, '→', bad);
      hits += 1;
    }
  }
}

const master = path.join(root, 'public', 'branding', 'zrh-logo-blue-white-master.png');
if (!fs.existsSync(master)) {
  console.error('FAIL missing master', master);
  hits += 1;
}

if (hits > 0) {
  process.exit(1);
}
console.log('PASS official logo reference check');
console.log('Master:', master);
