import { copyFile, mkdir, rm } from 'node:fs/promises';

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

console.log(`Prepared ${files.length} production files in .deploy/`);
