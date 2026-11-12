// Copia src/ a dist/ y estampa el Service Worker con un hash del contenido y la lista de precache.
import { cpSync, rmSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';

const src = 'src',
  dist = 'dist';
rmSync(dist, { recursive: true, force: true });
cpSync(src, dist, { recursive: true });

const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const files = walk(dist)
  .map((p) => relative(dist, p).split(sep).join('/'))
  .filter((f) => f !== 'sw.js')
  .sort();

const hash = createHash('sha256');
for (const f of files) {
  hash.update(f);
  hash.update(readFileSync(join(dist, f)));
}
const buildId = hash.digest('hex').slice(0, 12);

const precache = ['./', ...files.map((f) => `./${f}`)];
let sw = readFileSync(join(dist, 'sw.js'), 'utf8');
sw = sw.replaceAll('__BUILD_ID__', buildId).replaceAll('__PRECACHE__', JSON.stringify(precache));
if (sw.includes('__BUILD_ID__') || sw.includes('__PRECACHE__')) throw new Error('marcadores sin sustituir en sw.js');
writeFileSync(join(dist, 'sw.js'), sw);
console.log(`build ${buildId}: ${precache.length} recursos precacheados en ${dist}/`);
