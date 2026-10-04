# FitGoIn AI: verified release candidate — 2026-10-04

The user asked to finish the paid AI trainer while preserving the existing site and will connect the AI key after implementation. Status questions continue this active task. Never request, print or commit secret values.

## Implementation and saved branch

Continue draft PR #14 on feat/ai-assistant-20261003; parent before completion was 3f5b71b0721652f61da11104b25399aa65fee168. Production main remains bb2e6f0a0a8adc44d48a3ef510b10232e442a675. The PR has not been merged and static production has not been published.

- Training €20/month, independent nutrition €10/month, bundle €30/month; explicit server-owned invited access. Editable metadata and return pages never unlock access.
- Authenticated Checkout/Customer Portal, signed and retry-safe lifecycle webhooks, live/test separation, paid periods, separate refund/dispute risks and a shared pending Checkout session preventing duplicate sessions across tabs.
- Module-specific AI context, including confirmed food history only for nutrition; monthly cost reservations before provider calls and retained daily/search/rate limits.
- Locally re-encoded food photos and selected video frames, fresh consent, strict result validation and separate editable food confirmation. Text assessments remain private; raw media is not persisted by this pipeline.
- Food diary/history, feedback, fatigue/pain adaptation, real weekly workout totals and reminders through calendar import. No background push feature is claimed.
- Extended account-switch, export and deletion protection. Financial records remain separate; AI deletion does not cancel a subscription.

## Deployed backend and verification

Supabase project ypbhcgcwkpiujcakvaji has migration 20261004151824_complete_paid_fitgoin_ai applied. Its local filename matches the recorded version; older applied migrations are unchanged. AI function v3 and billing function v1 are deployed with custom authentication. Existing marketplace Stripe functions were not replaced.

Actual deployed GET: AI backend_configured=true, provider_configured=false, configured=false; billing checkout_enabled=false, livemode=true. Unauthenticated POST to either function returned 401.

All 45 automated tests passed. The non-publishing deploy dry run passed with 19 public files. Both real Supabase SQL integration suites passed against the applied schema and rolled back all fixtures. Final Windows Chrome smoke checks passed at 390/768/1440 px across seven tabs, with no page errors/overflow, disabled checkout, photo consent/confirmation, technique dialog and account switching. Browser/provider/billing scenarios use mocks; they do not establish real model or payment quality.

Advisor review: no new security warning/error or missing foreign-key index. Seven informational RLS-without-policy notices are deliberate server-only tables with browser grants revoked. The existing leaked-password-protection warning remains.

## Remaining release blockers

1. User privately saves OPENAI_API_KEY in Supabase Edge Function Secrets. Verify real plans, timing, nutrition/allergens, media uncertainty, safety, search/transcription, latency and costs afterward.
2. Only a Stripe sandbox account was exposed. Configure the separate AI Stripe key, monthly Prices and signing secret; both functions must use the same billing mode. Complete actual sandbox lifecycle acceptance.
3. Verify merchant/subscription/refund/tax readiness before live collection. FGI_AI_BILLING_ENABLED and live FGI_AI_COMMERCIAL_READY are required gates. Adding only the AI key cannot enable checkout. Exact settings are in the function README.
4. After acceptance, merge and publish only through the safe workflow on clean main matching origin/main: npm.cmd run check, npm.cmd run deploy:dry, npm.cmd run deploy. Never bypass safe-deploy.mjs.

Windows repository: C:\\Users\\HP\\Documents\\FitGoIn. Git: C:\\Program Files\\Git\\cmd\\git.exe. Production working tree was clean. Browser QA was isolated in C:\\Users\\HP\\Documents\\FitGoIn-AI-QA-20261004 and used no signed-in session.

The candidate is prepared. Live paid release still requires credentials and acceptance. Do not claim a published, ideal, medically validated or unlimited product.
