import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const out = new URL('../.deploy/', import.meta.url);
const files = ['index.html', 'fitmatch.js', 'styles.css', 'fitgoin-ai.js', 'fitgoin-ai-core.mjs', 'fitgoin-ai-paid.mjs', 'fitgoin-ai-media.mjs', 'fitgoin-ai.css', 'cookie-consent.js', 'robots.txt', 'sitemap.xml', 'favicon.svg', 'site.webmanifest', 'privacy.html', 'terms.html', 'legal.html', 'cookies.html', 'support.html', '_headers'];

files.push('fitgoin-premium.js','fitgoin-premium-core.mjs','fitgoin-i18n.mjs','fitgoin-premium.css');
for(const name of ['coaching','online','boxing'])for(const width of [800,1600])files.push(`assets/brand/${name}-${width}.webp`);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const file of files) {
  await mkdir(new URL('.',new URL(file,out)),{recursive:true});
  await copyFile(new URL(`../${file}`, import.meta.url), new URL(file, out));
}

// Always give the assets upload session a new hash. Empty-upload deployments
// can otherwise retain a stale manifest (cloudflare/developer-platform#20).
const release = { commit: process.env.FGI_RELEASE_COMMIT || null, built_at: new Date().toISOString(), build_id: randomUUID() };
await writeFile(new URL('release.json', out), JSON.stringify(release) + '\n');
console.log(`Prepared ${files.length + 1} production files in .deploy/`);
