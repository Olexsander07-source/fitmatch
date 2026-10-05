# FitGoIn operating rules

This repository is the existing FitGoIn production site. Do not rebuild it from scratch, redesign it, or add unrelated features unless explicitly requested.

## Production
- Domain: https://fitgoin.com
- Cloudflare Worker: `fitgoin-production`
- The legacy `fitgoin` Worker receives incomplete automatic Git builds. Do not point the production domain back to it. `scripts/safe-deploy.mjs` attaches the domain after publishing the complete version; keep generic Wrangler routes empty.
- Source files: `index.html`, `fitmatch.js`, `styles.css`
- Supabase is the application backend; never commit private keys or service-role credentials.

## Safe change workflow
1. Inspect the current code and `git status` before editing.
2. Make the smallest necessary change.
3. Run `npm.cmd run check`.
4. Run `npm.cmd run deploy:dry` before any production deployment.
5. Commit and push the reviewed change to `main`.
6. Deploy production only with `npm.cmd run deploy`.

Do not bypass `scripts/safe-deploy.mjs` with a direct production `wrangler deploy` unless the user explicitly requests emergency recovery.

## Codex on this Windows machine
- Use `npm.cmd run codex -- ...` for Codex CLI tasks in this repository (PowerShell blocks `npm.ps1` on this machine).
- Codex CLI is temporarily pinned to `0.154.0` because newer Windows builds reproduce `helper_unknown_error: setup refresh had errors` on the long internal runtime path.
- The launcher refreshes PATH so sandboxed commands can find Git.
- Do not bypass the sandbox or switch to danger-full-access to work around this issue.
