# FitGoIn AI — validation, 4 October 2026

The existing AI workspace now has a paid release candidate. Static production publication and PR merge are deferred. Supabase migration 20261004151824_complete_paid_fitgoin_ai, AI function v5 and billing function v2 are deployed. The user connected the OpenAI key and authorized publication if checks pass. Actual requests were attempted, but OpenAI rejected them due to API quota/account limits. Checkout remains disabled. No successful AI answer or Stripe payment acceptance has been established.

## Automated verification

npm run check passed all 46 tests: original AI/voice regressions plus server access, billing configuration/signature/mode/ownership, lifecycle reconciliation, duplicate Checkout protection, media/schema validation, fatigue/calendar behavior, monthly denial, module context, a food-photo handler round trip and safe distinction of provider quota/credential/permission/rate failures. Provider and Stripe objects in these tests are mocks.

npm run deploy:dry passed and prepared 19 public assets. Private backend source and credentials are excluded. No Cloudflare production publication occurred.

## Database verification

Both scripts/ai-rls.test.sql and scripts/ai-paid-rls.test.sql passed against the applied schema in real Supabase and completely rolled back.

Verified owner isolation, consented trainer snapshots/expiry, immutable assistant output, quotas/idempotency, AI-only deletion, explicit friend grants, paid periods and live/test modules, event ordering/idempotency, separate risks, monthly reservation/settlement, pending Checkout reuse, food ownership and preservation of billing ownership after AI deletion. No fixture users/content remain.

No new security warning/error or missing foreign-key index was reported. Seven informational RLS-without-policy notices are server-only fgi_private tables with browser grants revoked. The existing [leaked-password-protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains. Unused-index notices are expected on new or low-traffic tables.

## Browser verification

The October 3 suite used the actual frontend/server handler with a mock OpenAI provider. It covered intake/plans, shortening a workout to 12 minutes, sets/rest, MediaRecorder transcription/review, nutrition/shopping lists, recorded progress, existing MATCH, snapshot consent/revocation, inert model markup, citations, history export/deletion and account-switch races.

The final October 4 smoke suite used current frontend modules on actual Windows Chrome with an isolated mock backend at 390/768/1440 px. All seven tabs had no horizontal overflow or page errors. It verified disabled checkout, actual JPEG re-encoding, explicit analysis consent, no food insert before separate editable confirmation, technique dialog and clearing the previous user's assessment on account change. It did not test continuous-video inference, actual payment or a live provider.

Reproduce with scripts/ai-ui-smoke.cjs and an independently installed playwright-core (QA only). Set FGI_AI_PLAYWRIGHT_MODULE to the installed module path, FGI_AI_CHROME to an available Chrome executable and optionally FGI_AI_REPO to the source directory. Run node scripts/ai-ui-smoke.cjs.

## Actual deployed endpoint checks

- AI GET after the user's key configuration: backend_configured=true, provider_configured=true, configured=true.
- Billing GET: checkout_enabled=false, livemode=true.
- Unauthenticated POST to either: HTTP 401.

Status booleans establish configuration only. Two real requests using a temporary invited account returned HTTP 503; the underlying 429 was initially provider_busy, then correctly provider_quota after the diagnostic fix. The safe provider log confirms HTTP 429 credit_balance_exhausted at 2026-10-04T15:38:57Z. The official OpenAI error guide identifies this as no prepaid credits remaining. Provider credit/usage/spend failure cannot be resolved by code retries. No secret value was retrieved/printed. Existing marketplace Stripe functions were not replaced.

Additional actual deployed HTTP checks passed: Auth sign-in, unauthenticated denial, disallowed origin, foreign conversation denial, unpaid access denial, editable friend metadata not granting access, media consent enforcement, disabled Checkout, owner food insert/foreign read-write denial and underage personalized-plan refusal. These checks made no provider call. Both temporary accounts were signed out, sessions/users deleted, fixture grants/profiles confirmed absent and temporary credential file removed.

The only available Stripe account is Fitgoin sandbox. Active Prices and webhook endpoint lists were empty. No live account configuration or actual billing lifecycle is inferred.

## Live acceptance still required

Resolve OpenAI API balance/quota and organization/project spend limits first; OPENAI_API_KEY is already stored. Then verify actual day completeness/durations, nutritional estimates/allergens, missing questions, safety/refusals, media uncertainty, search citations/automatic research, languages, microphone transcription, latency and costs. Configuration=true alone proves none of those.

Configure the separate AI Stripe key, three EUR monthly Prices, webhook signing secret and consistent mode. Exercise actual sandbox Checkout → signed webhook → entitlement → renewal/failure/cancellation/refund/dispute → Portal, including concurrent Checkout attempts and mode isolation. Only a sandbox connection has been observed; live readiness is unverified.

After merchant/subscription/refund/tax readiness and acceptance, merge/publish through the existing safe deploy script. Until then the PR stays draft and checkout stays disabled. Imported calendar reminders are implemented; automatic push/email reminders are not.

## Final release-preparation rerun

npm.cmd run deploy:dry passed on the current candidate: 46/46 automated tests and all 19 public assets. The expanded browser smoke script passed again at 390/768/1440 px. It now verifies that quota, authentication and permission failures show their separate support messages, and quota does not invite repeated retries. The prior seven tabs, disabled Checkout, food consent/confirmation, technique dialog and account switching also passed. This browser check uses an isolated mock backend and does not establish real AI or payment quality.

Supabase read-back confirms AI v5 and billing v2 ACTIVE with the existing custom authentication. The AI v5 source exactly matches the saved candidate. The two temporary real-acceptance user IDs have zero rows in auth.users. Stripe sandbox active Prices and webhook endpoint inventories were rechecked and remain empty. The production frontend and checkout were left unchanged, as requested for this preparation stage.
