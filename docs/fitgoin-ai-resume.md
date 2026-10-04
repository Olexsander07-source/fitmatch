# FitGoIn AI: release checkpoint — 2026-10-04

## Current frontend publication status

The premium frontend is now published and verified at https://fitgoin.com. Release commit: `02b9095c57a649129279eb6068079040a62c688c` (PR #15). Cloudflare version: `1c3cc769-4d63-4164-b709-32f82f39b050`. The authorized safe deploy on clean main completed with exit code 0; 49/49 tests passed. The git bundle transfer is complete and its SHA-256 matches. All 28 public files match the release bytes; real guest-browser checks passed at 360/390/768/1440 px without page errors, failed requests, own-resource HTTP errors or horizontal overflow. Current public billing status is `checkout_enabled=false`, `livemode=true`. No new real provider-generation or payment acceptance was performed. See `premium-redesign-release.md` and `qa/premium/production-results-20261004.json`.

Do not repeat the transfer, merge, or frontend publication. Next work is real AI-provider availability/answer acceptance, then Stripe sandbox lifecycle acceptance before enabling collection. The candidate/main/unpublished statements below describe the historical AI preparation stage and are superseded by this publication checkpoint.

> Later release instruction, 2026-10-04: the user authorized finishing and publishing the premium redesign after verification, then explicitly asked to retry checking and publication. The current redesign report is `docs/premium-redesign-release.md`. Publish the verified frontend through the safe workflow with AI Checkout disabled. The real AI provider/payment acceptance blockers below remain; do not claim successful live AI or activate collection. Earlier statements that main/frontend were untouched describe the historical AI preparation stage.

The user asked to finish the paid AI trainer while preserving the existing site, has now connected the AI key and authorized publication if verification passes. The latest user instruction is to finish release preparation now, then complete real acceptance and publication in the following stage. Status questions continue this active task. Never request, print or commit secret values.

## Implementation and saved branch

Continue draft PR #14 on feat/ai-assistant-20261003; parent before completion was 3f5b71b0721652f61da11104b25399aa65fee168. Production main remains bb2e6f0a0a8adc44d48a3ef510b10232e442a675. The PR has not been merged and static production has not been published.

- Training €20/month, independent nutrition €10/month, bundle €30/month; explicit server-owned invited access. Editable metadata and return pages never unlock access.
- Authenticated Checkout/Customer Portal, signed and retry-safe lifecycle webhooks, live/test separation, paid periods, separate refund/dispute risks and a shared pending Checkout session preventing duplicate sessions across tabs.
- Module-specific AI context, including confirmed food history only for nutrition; monthly cost reservations before provider calls and retained daily/search/rate limits.
- Locally re-encoded food photos and selected video frames, fresh consent, strict result validation and separate editable food confirmation. Text assessments remain private; raw media is not persisted by this pipeline.
- Food diary/history, feedback, fatigue/pain adaptation, real weekly workout totals and reminders through calendar import. No background push feature is claimed.
- Extended account-switch, export and deletion protection. Financial records remain separate; AI deletion does not cancel a subscription.

## Deployed backend and verification

Supabase project ypbhcgcwkpiujcakvaji has migration 20261004151824_complete_paid_fitgoin_ai applied. Its local filename matches the recorded version; older applied migrations are unchanged. AI function v5 and billing function v2 are deployed with custom authentication. Existing marketplace Stripe functions were not replaced. Provider failure diagnostics now distinguish quota, credentials, permissions and temporary rate limits; logs contain only bounded status/code/request ID, never raw provider messages, prompts or keys.

Latest deployed GET: AI backend_configured=true, provider_configured=true, configured=true; billing checkout_enabled=false, livemode=true. Configuration=true means the secret exists, not a successful answer. Two real test requests failed: the initial 429 was generically reported as provider_busy; after the diagnostic fix it was correctly classified as provider_quota. No successful provider answer was obtained.

All 46 automated tests and the final non-publishing deploy dry run passed with 19 public files. Both real Supabase SQL integration suites passed against the applied schema and rolled back all fixtures. Windows Chrome smoke checks passed at 390/768/1440 px across seven tabs. Those browser/provider/billing scenarios use mocks. New real deployed HTTP checks passed for authentication, origin, foreign conversation, unpaid access, forged friend metadata, photo consent, disabled Checkout, owner/foreign food RLS and underage-plan refusal. Temporary test users, sessions, grants and credentials were removed; SQL confirmed zero remaining fixture users/profiles/grants. No successful AI quality or payment acceptance is claimed.

Advisor review: no new security warning/error or missing foreign-key index. Seven informational RLS-without-policy notices are deliberate server-only tables with browser grants revoked. The existing leaked-password-protection warning remains.

## Remaining release blockers

1. The key is present, but the real provider log records HTTP 429 with code credit_balance_exhausted (2026-10-04T15:38:57Z): no prepaid API credits remain. Resolve API Billing balance first; check usage/spend limits if a different quota code follows. Do not repeatedly retry or request the secret. After resolving this, verify real plans, timing, nutrition/allergens, media uncertainty, safety, search/transcription, latency and costs.
2. Only a Stripe sandbox account was exposed. Its active Price and webhook endpoint lists are empty. Configure the separate AI Stripe key, monthly Prices and signing secret; both functions must use the same billing mode. Complete actual sandbox lifecycle acceptance.
3. Verify merchant/subscription/refund/tax readiness before live collection. FGI_AI_BILLING_ENABLED and live FGI_AI_COMMERCIAL_READY are required gates. Adding only the AI key cannot enable checkout. Exact settings are in the function README.
4. After acceptance, merge and publish only through the safe workflow on clean main matching origin/main: npm.cmd run check, npm.cmd run deploy:dry, npm.cmd run deploy. Never bypass safe-deploy.mjs.

Windows repository: C:\\Users\\HP\\Documents\\FitGoIn. Git: C:\\Program Files\\Git\\cmd\\git.exe. Production working tree was clean. Browser QA was isolated in C:\\Users\\HP\\Documents\\FitGoIn-AI-QA-20261004 and used no signed-in session.

The candidate is prepared. Live paid release still requires credentials and acceptance. Do not claim a published, ideal, medically validated or unlimited product.

## Final preparation check

The current candidate passed npm.cmd run deploy:dry again: 46/46 automated tests and 19 public assets. The expanded scripts/ai-ui-smoke.cjs passed at 390/768/1440 px, now including the distinct quota/credential/permission messages as well as the previous seven-tab/consent/account-switch checks. The deployed AI v5 source exactly matches the saved candidate. No additional provider requests, billing activation, main merge or frontend publication occurred in this preparation stage.

The Russian handover and acceptance order are in docs/fitgoin-ai-release.md. Preserve this checkpoint and continue with the outstanding real provider/payment checks, not a rebuild.
