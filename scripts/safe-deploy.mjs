import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseUploadedVersion, verifyProduction } from './verify-production.mjs';
import { configureProductionHosting, productionWorkerExists, PRODUCTION_HOSTING } from './production-hosting.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const winGit = 'C:\\Program Files\\Git\\cmd\\git.exe';
const git = process.platform === 'win32' && existsSync(winGit) ? winGit : 'git';
const node = process.execPath;
const wrangler = resolve(repo, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const workerConfig = JSON.parse(readFileSync(resolve(repo, 'wrangler.jsonc'), 'utf8'));
if (workerConfig.name !== PRODUCTION_HOSTING.service || workerConfig.account_id !== PRODUCTION_HOSTING.account || workerConfig.routes?.length) {
  throw new Error('Refusing deploy: Worker, account or domain route configuration is unexpected.');
}

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
run(node, ['--check', 'fitgoin-ai-meals.mjs']);
run(node, ['--check', 'fitgoin-ai-workout-log.mjs']);
run(node, ['--check', 'fitgoin-ai-progress.mjs']);
run(node, ['--check', 'fitgoin-ai-analysis.mjs']);
run(node, ['--check', 'fitgoin-ai-paid.mjs']);
run(node, ['--check', 'fitgoin-ai-media.mjs']);
run(node, ['--check', 'supabase/functions/fitgoin-ai-billing/index.mjs']);
run(node, ['scripts/verify.mjs']);
run(node, ['--test', 'scripts/voice.test.mjs', 'scripts/ai.test.mjs', 'scripts/ai-meals.test.mjs', 'scripts/ai-workout-log.test.mjs', 'scripts/ai-progress.test.mjs', 'scripts/ai-analysis.test.mjs', 'scripts/ai-paid.test.mjs', 'scripts/premium.test.mjs', 'scripts/verify-production.test.mjs', 'scripts/production-hosting.test.mjs']);
process.env.FGI_RELEASE_COMMIT = local;
run(node, ['scripts/build.mjs']);
run(node, [wrangler, 'deploy', '--dry-run']);
// Read only the existing Wrangler credential. Never write it to artifacts/logs.
const configRoot = process.platform === 'win32'
  ? resolve(process.env.APPDATA, 'xdg.config')
  : process.env.XDG_CONFIG_HOME || resolve(homedir(), '.config');
const token = process.env.CLOUDFLARE_API_TOKEN || readFileSync(resolve(configRoot, '.wrangler', 'config', 'default.toml'), 'utf8').match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
if (!await productionWorkerExists({ token })) {
  // A new Worker needs an initial deployment before versions upload is allowed.
  // All checks have passed; config has no routes and workers.dev is disabled.
  run(node, [wrangler, 'deploy']);
}
// Publish the exact uploaded version. The production Worker is separate from
// the legacy Git build; configure its domain after the version is activated.
const upload = run(node, [wrangler, 'versions', 'upload', '--tag', local.slice(0, 12), '--message', `Verified release ${local}`], true);
console.log(upload);
const versionId = parseUploadedVersion(upload);
run(node, [wrangler, 'versions', 'deploy', `${versionId}@100`, '--yes', '--message', `Verified release ${local}`]);

// Keep production independent of the legacy automatic Git publisher.
const hosting = await configureProductionHosting({ token });
console.log(`Production domain ${hosting.hostname} is attached to ${hosting.service}; workers.dev and previews disabled.`);

const report = await verifyProduction();
console.log(`Production verification passed: ${report.assets.length} matching files at ${report.base}`);
