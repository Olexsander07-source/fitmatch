import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const controls = new Set(['_headers', '_redirects']);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export function parseUploadedVersion(output) {
  const plain = String(output).replace(/\x1b\[[0-9;]*m/g, '');
  const ids = [...plain.matchAll(/^Worker Version ID:\s*([a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12})\s*$/gim)];
  if (ids.length !== 1) throw new Error('Upload did not identify exactly one Worker version; refusing to publish.');
  return ids[0][1];
}

async function assetsIn(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || controls.has(entry.name)) continue;
    const file = prefix + entry.name;
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) files.push(...await assetsIn(url, file + '/'));
    else if (entry.isFile()) files.push({ file, sha256: digest(await readFile(url)) });
  }
  return files.sort((a, b) => a.file.localeCompare(b.file));
}

function expectedType(file) {
  if (/\.m?js$/.test(file)) return /^(?:text|application)\/javascript(?:;|$)/i;
  if (/\.css$/.test(file)) return /^text\/css(?:;|$)/i;
  if (/\.html$/.test(file)) return /^text\/html(?:;|$)/i;
  if (/\.webp$/.test(file)) return /^image\/webp(?:;|$)/i;
  return null;
}

// Check the deployed bytes, including every imported module and background image.
// A successful HTML response alone does not mean that the application can start.
export async function verifyProduction({
  directory = new URL('../.deploy/', import.meta.url),
  base = 'https://fitgoin.com/',
  fetchAsset = fetch,
  attempts = 3,
  retryDelayMs = 2000,
} = {}) {
  const expected = await assetsIn(directory);
  if (!expected.some(asset => asset.file === 'index.html')) throw new Error('Production build has no index.html');
  const checked = new Map();
  let failures = [];
  for (let attempt = 1; attempt <= attempts; attempt++) {
    failures = [];
    const pending = expected.filter(asset => !checked.has(asset.file));
    for (let start = 0; start < pending.length; start += 4) {
      await Promise.all(pending.slice(start, start + 4).map(async asset => {
        try {
          const url = new URL(asset.file, base);
          url.searchParams.set('deploy_verify', `${Date.now()}-${attempt}`);
          const response = await fetchAsset(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const type = response.headers.get('content-type') || '';
          if (expectedType(asset.file) && !expectedType(asset.file).test(type)) throw new Error(`wrong Content-Type: ${type || 'missing'}`);
          const bytes = Buffer.from(await response.arrayBuffer());
          if (digest(bytes) !== asset.sha256) throw new Error('content differs from this production build');
          checked.set(asset.file, { file: asset.file, status: response.status, sha256: asset.sha256, bytes: bytes.length });
        } catch (error) {
          failures.push(`${asset.file}: ${error.message}`);
        }
      }));
    }
    if (!failures.length) return { at: new Date().toISOString(), base, assets: expected.map(asset => checked.get(asset.file)), status: 'passed' };
    if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, retryDelayMs));
  }
  throw new Error(`Production verification failed:\n${failures.sort().join('\n')}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await verifyProduction();
  console.log(`Production verification passed: ${report.assets.length} matching files at ${report.base}`);
}
