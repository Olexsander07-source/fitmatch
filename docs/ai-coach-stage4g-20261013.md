# FitGoIn Stage 4G — final verification

The exact requested phrase `Сравни этих двух тренеров` now enters the controlled coach comparison route. Without previous results it requests a search; with fewer than two it refuses to fabricate a second profile. The phrase also supports `без памяти` and applies the existing refusal before comparison. Three added regression cases verify actual backend scores, no provider call, missing context and memory refusal.

No MATCH formula, database schema, privilege, production coach record or unrelated feature is changed. `fitgoin-ai-coaches.mjs` is the sole changed application module. `scripts/ai-coach-context.test.mjs` extends the existing suite (42 cases). `scripts/coach-search-stage4g-smoke.mjs` adds a reproducible full-application test with real public catalogue records and controlled local external boundaries.

## Validation

- `npm run check`: 358 passed (216 existing AI/site cases, 142 coach/search/MATCH/card/context cases).
- `npm run deploy:dry`: checks and complete 36-file production asset build passed.
- Existing mounted-card Chromium regression: 20 passed at 320/390/768/1366 px, 1–3 card layouts, real photos, full comparison text, history, empty state, profile/contact callbacks and anonymous production profile routes. The third card is a layout fixture only.
- Isolated Postgres completion/metadata/RLS regression: 10 passed, no production writes.
- Live public Data API checks: 7 passed (catalogue, sport, online/offline, language, strict budget/unit and public projection). An initial optional local-handler/actual-Auth probe timed out and returned 503; it is not counted as a successful Auth test.
- Live deployed endpoints rejected missing/invalid tokens in four cases with 401. Eight private table reads exposed zero rows to an anonymous caller.
- Known secret-key literal/JWT service-role scan: eight local frontend modules and three live modules passed; this is not a claim of universal secret detection.
- Real published coach roles were inspected: both existing profiles have `coach`; owner RLS, private-message ACLs and coach-profile synchronisation trigger remain present.

## Full application smoke test

Run with installed Playwright/Chrome using `FGI_PLAYWRIGHT_MODULE`, `FGI_CHROME` and an optional absolute `FGI_G_QA_REPORT` output path:

```sh
node scripts/coach-search-stage4g-smoke.mjs
```

The test serves the existing complete `index.html`, styles and application modules, injects only test SDK/endpoint configuration and exercises actual `createAIHandler`, `createCoachSearchHandler`, shared MATCH, card rendering, `freshAICoach`, `openProfile` and `contact`. It reads real coach/sport rows through the public production Data API. Auth, consent, paid access, persistence, provider and thread writes are explicitly local fixtures. No production account/grant or coach message is created. A separate browser context checks public production registration entries, login dialog and both profile routes through GET-only resource forwarding.

These boundaries must remain explicit in any report. This is not a successful paid authenticated production AI conversation or a new-user email-confirmation/login test. The catalogue currently has only two published coaches in different sports and both lack prices: strict budgets yield no results, and a two-coach comparison in one sport cannot be claimed from live records. Positive comparison/tie tests use labelled fixture data.

## Deployment and remaining verification

Publish only from clean current `main` through `npm.cmd run deploy` and the existing `scripts/safe-deploy.mjs` to `fitgoin-production`. Do not use the legacy Worker or direct Wrangler. Keep the existing original Windows working directory and its unrelated untracked files intact; use the established isolated release clone.

Record the actual resulting main SHA, Supabase function version, Cloudflare version and `https://fitgoin.com/release.json` in the final report. Publishing source/backend alone is not frontend publication. After deployment, compare live asset hashes with the exact uploaded `.deploy` files and verify real profile routes.

Production AI acceptance still requires a legitimate signed-in account with current consent and an existing entitlement. Do not create friend grants or alter paid access merely to make the test pass. New-account confirmation and an actual two-user customer conversation remain unverified without suitable accounts.
