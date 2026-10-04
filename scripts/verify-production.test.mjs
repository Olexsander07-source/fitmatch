import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyProduction } from './verify-production.mjs';

async function build(t) {
  const dir = await mkdtemp(join(tmpdir(), 'fitgoin-deploy-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'assets'));
  const files = new Map([
    ['index.html', ['<title>FitGoIn</title>', 'text/html']],
    ['fitmatch.js', ['import "./premium.mjs";', 'text/javascript']],
    ['premium.mjs', ['export const ready = true;', 'application/javascript']],
    ['styles.css', ['body { color: white; }', 'text/css']],
    ['assets/hero.webp', ['fixture-image-bytes', 'image/webp']],
    ['_headers', ['/*\n  X-Frame-Options: DENY', 'text/plain']],
  ]);
  for (const [file, [body]] of files) await writeFile(join(dir, file), body);
  const fetchAsset = async url => {
    const file = new URL(url).pathname.slice(1);
    const [body, type] = files.get(file) || ['', 'text/plain'];
    return new Response(body, { status: files.has(file) ? 200 : 404, headers: { 'Content-Type': type } });
  };
  return { directory: pathToFileURL(dir + '/'), base: 'https://fixture.invalid/', attempts: 1, retryDelayMs: 0, fetchAsset };
}

test('complete deployed build includes modules and images, excluding hosting controls', async t => {
  const report = await verifyProduction(await build(t));
  assert.equal(report.status, 'passed');
  assert.equal(report.assets.length, 5);
  assert(report.assets.some(asset => asset.file === 'premium.mjs'));
  assert(report.assets.some(asset => asset.file === 'assets/hero.webp'));
});

for (const missing of ['premium.mjs', 'assets/hero.webp']) {
  test(`HTML-only success cannot hide missing ${missing}`, async t => {
    const options = await build(t), original = options.fetchAsset;
    options.fetchAsset = url => new URL(url).pathname.endsWith('/' + missing) ? new Response(null, { status: 404 }) : original(url);
    await assert.rejects(verifyProduction(options), error => error.message.includes(`${missing}: HTTP 404`));
  });
}

test('HTML fallback for a module is rejected even with HTTP 200', async t => {
  const options = await build(t), original = options.fetchAsset;
  options.fetchAsset = url => new URL(url).pathname.endsWith('.mjs') ? new Response('<html></html>', { headers: { 'Content-Type': 'text/html' } }) : original(url);
  await assert.rejects(verifyProduction(options), /premium\.mjs: wrong Content-Type/);
});

test('a stale release is rejected even when it has the right title', async t => {
  const options = await build(t), original = options.fetchAsset;
  options.fetchAsset = url => new URL(url).pathname.endsWith('index.html') ? new Response('<title>FitGoIn</title>old release', { headers: { 'Content-Type': 'text/html' } }) : original(url);
  await assert.rejects(verifyProduction(options), /index\.html: content differs/);
});

test('transient missing assets are retried before declaring success', async t => {
  const options = await build(t), original = options.fetchAsset;
  let calls = 0;
  options.attempts = 2;
  options.fetchAsset = url => new URL(url).pathname.endsWith('.mjs') && ++calls === 1 ? new Response(null, { status: 404 }) : original(url);
  assert.equal((await verifyProduction(options)).status, 'passed');
  assert.equal(calls, 2);
});
