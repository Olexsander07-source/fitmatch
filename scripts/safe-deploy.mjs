import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const winGit = 'C:\\Program Files\\Git\\cmd\\git.exe';
const git = process.platform === 'win32' && existsSync(winGit) ? winGit : 'git';
const node = process.execPath;
const wrangler = resolve(repo, 'node_modules', 'wrangler', 'bin', 'wrangler.js');

const run = (cmd, args, capture = false) => {
  const result = execFileSync(cmd, args, {
    cwd: repo,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  });
  return capture ? result.trim() : '';
};

const status = run(git, ['status', '--porcelain'], true);
if (status) throw new Error('Refusing deploy: Git working tree is not clean.');

const branch = run(git, ['branch', '--show-current'], true);
if (branch !== 'main') throw new Error(`Refusing deploy from branch: ${branch}`);
run(git, ['fetch', 'origin', 'main']);
const local = run(git, ['rev-parse', 'HEAD'], true);
const remote = run(git, ['rev-parse', 'origin/main'], true);
if (local !== remote) throw new Error('Refusing deploy: local main differs from origin/main.');

run(node, ['--check', 'fitmatch.js']);
run(node, ['--check', 'fitgoin-ai.js']);
run(node, ['--check', 'supabase/functions/fitgoin-ai/index.mjs']);
run(node, ['scripts/verify.mjs']);
run(node, ['--test', 'scripts/voice.test.mjs', 'scripts/ai.test.mjs']);
run(node, ['scripts/build.mjs']);
run(node, [wrangler, 'deploy', '--dry-run']);
run(node, [wrangler, 'deploy']);

let ok = false;
for (let attempt = 1; attempt <= 3; attempt++) {
  const response = await fetch(`https://fitgoin.com/?deploy_verify=${Date.now()}`, { cache: 'no-store' });
  const body = await response.text();
  if (response.ok && body.includes('<title>FitGoIn')) { ok = true; break; }
  await new Promise((resolve) => setTimeout(resolve, 2000));
}
if (!ok) throw new Error('Deploy completed, but production verification failed.');
console.log('Production verification passed: https://fitgoin.com/');
