import { copyFile, mkdir, rm } from 'node:fs/promises';

const out = new URL('../.deploy/', import.meta.url);
const files = ['index.html', 'fitmatch.js', 'styles.css', 'fitgoin-ai.js', 'fitgoin-ai-core.mjs', 'fitgoin-ai-paid.mjs', 'fitgoin-ai-media.mjs', 'fitgoin-ai.css', 'cookie-consent.js', 'robots.txt', 'sitemap.xml', 'favicon.svg', 'site.webmanifest', 'privacy.html', 'terms.html', 'legal.html', 'cookies.html', 'support.html', '_headers'];

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const file of files) {
  await copyFile(new URL(`../${file}`, import.meta.url), new URL(file, out));
}

console.log(`Prepared ${files.length} production files in .deploy/`);
