import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseUploadedVersion, verifyProduction } from './verify-production.mjs';

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
run(git, ['fetch', 'origin', 'refs/heads/main:refs/remotes/origin/main']);
const local = run(git, ['rev-parse', 'HEAD'], true);
const remote = run(git, ['rev-parse', 'origin/main'], true);
if (local !== remote) throw new Error('Refusing deploy: local main differs from origin/main.');

run(node, ['--check', 'fitmatch.js']);
run(node, ['--check', 'fitgoin-ai.js']);
run(node, ['--check', 'fitgoin-premium.js']);
run(node, ['--check', 'supabase/functions/fitgoin-ai/index.mjs']);
run(node, ['--check', 'fitgoin-ai-paid.mjs']);
run(node, ['--check', 'fitgoin-ai-media.mjs']);
run(node, ['--check', 'supabase/functions/fitgoin-ai-billing/index.mjs']);
run(node, ['scripts/verify.mjs']);
run(node, ['--test', 'scripts/voice.test.mjs', 'scripts/ai.test.mjs', 'scripts/ai-paid.test.mjs', 'scripts/premium.test.mjs', 'scripts/verify-production.test.mjs']);
process.env.FGI_RELEASE_COMMIT = local;
run(node, ['scripts/build.mjs']);
run(node, [wrangler, 'deploy', '--dry-run']);
// Publish the exact uploaded version. Domain/subdomain triggers are already
// configured; rewriting them after upload was activating a different version.
const upload = run(node, [wrangler, 'versions', 'upload', '--tag', local.slice(0, 12), '--message', `Verified release ${local}`], true);
console.log(upload);
const versionId = parseUploadedVersion(upload);
run(node, [wrangler, 'versions', 'deploy', `${versionId}@100`, '--yes', '--message', `Verified release ${local}`]);

const report = await verifyProduction();
console.log(`Production verification passed: ${report.assets.length} matching files at ${report.base}`);
