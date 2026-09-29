# FitGoIn operating rules

This repository is the existing FitGoIn production site. Do not rebuild it from scratch, redesign it, or add unrelated features unless explicitly requested.

## Production
- Domain: https://fitgoin.com
- Cloudflare Worker: `fitgoin`
- Source files: `index.html`, `fitmatch.js`, `styles.css`
- Supabase is the application backend; never commit private keys or service-role credentials.

## Safe change workflow
1. Inspect the current code and `git status` before editing.
2. Make the smallest necessary change.
3. Run `npm run check`.
4. Run `npm run deploy:dry` before any production deployment.
5. Commit and push the reviewed change to `main`.
6. Deploy production only with `npm run deploy`.

Do not bypass `scripts/safe-deploy.mjs` with a direct production `wrangler deploy` unless the user explicitly requests emergency recovery.
