import { access, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const files = ['index.html', 'fitmatch.js', 'styles.css'];
const migrations = new Map([
  ['20260927144002_fitgoin_stage1_foundation.sql', '0033aacf37052dc6ce150b0dca9669e9'],
  ['20260929062004_add_fgi_messages_sender_index.sql', '38fe7f22d0fac6cf8e667fc80842f7bd'],
  ['20260929062127_track_fgi_thread_activity.sql', '35d115737d8f41ec3d90d1a8f63da45b'],
  ['20260929080940_tighten_fgi_storage_policies.sql', 'df85b11aa2289dee956104069d642cb6'],
  ['20260929081241_harden_fgi_data_integrity.sql', 'd994e020f1d3540df5fb2832ba46a7fd'],
]);
for (const file of files) await access(new URL(`../${file}`, import.meta.url));
for (const file of migrations.keys()) await access(new URL(`../supabase/migrations/${file}`, import.meta.url));

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const js = await readFile(new URL('../fitmatch.js', import.meta.url), 'utf8');

if (!html.includes('<title>FitGoIn')) throw new Error('FitGoIn title is missing');
if (!html.includes('fitmatch.js')) throw new Error('fitmatch.js is not linked');
if (!html.includes('styles.css')) throw new Error('styles.css is not linked');
if (!js.includes('supabase')) throw new Error('Expected Supabase integration was not found');
if ((html.match(/minlength="12"/g) || []).length !== 3) throw new Error('Strong password minimum is not enforced in signup/reset forms');
if (!js.includes('function assertStrongPassword')) throw new Error('Strong password validation is missing');
if (!js.includes('b.updated_at||b.created_at')) throw new Error('Inbox is not ordered by latest thread activity');
if (js.includes('FITGOIN_SETUP_SQL_BEGIN')) throw new Error('Database setup SQL must not be embedded in frontend JavaScript');

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

for (const [file, expected] of migrations) {
  const body = await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url));
  const actual = createHash('md5').update(body).digest('hex');
  if (actual !== expected) throw new Error(`Migration ${file} differs from production history: ${actual}`);
}

console.log('FitGoIn source verification passed.');
