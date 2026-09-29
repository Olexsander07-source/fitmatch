import { access, readFile } from 'node:fs/promises';

const files = ['index.html', 'fitmatch.js', 'styles.css'];
for (const file of files) await access(new URL(`../${file}`, import.meta.url));

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const js = await readFile(new URL('../fitmatch.js', import.meta.url), 'utf8');

if (!html.includes('<title>FitGoIn')) throw new Error('FitGoIn title is missing');
if (!html.includes('fitmatch.js')) throw new Error('fitmatch.js is not linked');
if (!html.includes('styles.css')) throw new Error('styles.css is not linked');
if (!js.includes('supabase')) throw new Error('Expected Supabase integration was not found');

const openSelects = (html.match(/<select\b/gi) || []).length;
const closeSelects = (html.match(/<\/select\s*>/gi) || []).length;
if (openSelects !== closeSelects) throw new Error(`Malformed HTML: ${openSelects} <select> openings but ${closeSelects} closings`);

for (const match of html.matchAll(/<select\b[^>]*>([\s\S]*?)<\/select\s*>/gi)) {
  const inner = match[1];
  const openOptions = (inner.match(/<option\b/gi) || []).length;
  const closeOptions = (inner.match(/<\/option\s*>/gi) || []).length;
  if (openOptions !== closeOptions) throw new Error('Malformed HTML: unmatched <option> tag inside <select>');
  const residual = inner.replace(/<option\b[^>]*>[\s\S]*?<\/option\s*>/gi, '').trim();
  if (residual) throw new Error(`Malformed HTML: unexpected content inside <select>: ${JSON.stringify(residual.slice(0, 80))}`);
}

console.log('FitGoIn source verification passed.');