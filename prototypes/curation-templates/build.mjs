// Inlines src/shared/*.js into each src/*.src.html and writes standalone files next to this script.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const shared = ['palette.js', 'art-samples.js', 'core.js']
  .map((f) => fs.readFileSync(path.join(root, 'src/shared', f), 'utf8'))
  .join('\n');

const samples = fs.readFileSync(path.join(root, 'src/shared/art-samples.js'), 'utf8');
const palette = fs.readFileSync(path.join(root, 'src/shared/palette.js'), 'utf8');
const only = process.argv[2];
for (const f of fs.readdirSync(path.join(root, 'src'))) {
  if (!f.endsWith('.src.html')) continue;
  const out = f.replace('.src.html', '.html');
  if (only && !out.startsWith(only)) continue;
  const html = fs.readFileSync(path.join(root, 'src', f), 'utf8').replace('/*@shared*/', () => shared).replace('/*@samples*/', () => samples).replace('/*@palette*/', () => palette);
  fs.writeFileSync(path.join(root, out), html);
  console.log('built', out, (html.length / 1024).toFixed(1) + ' KB');
}
