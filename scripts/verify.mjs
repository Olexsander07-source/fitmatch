import { access, readFile } from 'node:fs/promises';

const files = ['index.html', 'fitmatch.js', 'styles.css'];
for (const file of files) await access(new URL(`../${file}`, import.meta.url));

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const js = await readFile(new URL('../fitmatch.js', import.meta.url), 'utf8');

if (!html.includes('<title>FitGoIn')) throw new Error('FitGoIn title is missing');
if (!html.includes('fitmatch.js')) throw new Error('fitmatch.js is not linked');
if (!html.includes('styles.css')) throw new Error('styles.css is not linked');
if (!js.includes('supabase')) throw new Error('Expected Supabase integration was not found');

console.log('FitGoIn source verification passed.');
