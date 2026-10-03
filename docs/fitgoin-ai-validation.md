# FitGoIn AI — validation, 3 October 2026

This change adds an AI workspace to the existing site. Static production publishing is deferred; the Supabase tables/policies and `fitgoin-ai` Edge Function v2 have been prepared in the existing project. Production readiness GET returned `backend_configured: true`, `provider_configured: false`, `configured: false`. No live OpenAI responses, real research retrieval or provider billing were tested. An OpenAI API key and live acceptance test are required before activation.

## Completed verification

- `npm run check`: source verification, JavaScript syntax, 17 AI tests and 12 existing voice-message regression tests passed (29 total).
- `npm run deploy:dry`: passed; 17 public assets prepared. Backend source and private credentials are not public assets.
- `scripts/ai-rls.test.sql`: executed in Supabase and rolled back. Verified owner reads/edits; another account cannot read or write private data or photo metadata; only the consented trainer sees the snapshot; expiry removes trainer access; browser roles cannot forge assistant messages/plans or allocate budgets; quotas/idempotent responses/deletion work; the main account remains after AI cleanup. No test users or test content remain.
- Security advisor: no new security findings. The pre-existing leaked-password-protection warning remains. New foreign-key index and share-policy performance findings were resolved in a separate recorded migration.
- Public Edge Function GET returns readiness only. Unauthenticated POST returned 401 and did not call OpenAI.

## Browser verification

Chromium 153.0.8010.0, actual frontend modules and actual server handler, isolated fixture data and a mock OpenAI provider. No production user data or real provider calls were used.

Verified intake/consent persistence; a validated weekly workout plan; shortening a workout to 12 minutes with low sleep/energy; recording sets and the live rest timer; actual MediaRecorder audio flowing to transcription and review before a command; nutrition totals, meals and shopping list; actual logged progress points; existing MATCH ranking against a published coach; snapshot preview/consent/revocation; inert rendering of untrusted model markup; clickable retrieved citations; account switching/sign-out clearing private content; JSON history download; a late workout insert after switching accounts not restoring the previous user's workout; and AI-only deletion preserving the main account.

Screens were checked at 390, 768 and 1440 px with no horizontal overflow. Browser page errors: zero.

## Activation acceptance

Configure `OPENAI_API_KEY` in Supabase Edge Function Secrets, then test a real consenting user against the configured provider, including six-day plan completeness, duration constraints, nutritional estimates/allergen exclusions, missing intake questions, safety/refusal responses, research citations, automatic uncertainty-triggered search, multilingual responses and real microphone transcription. Verify actual output quality, latency and API costs. Readiness=true proves configuration exists, not provider quality or billing access.

The shipped intake is a persistent profile form. Food-photo recognition, video technique analysis and automatic push notifications are future features and are not advertised as working. Publish the website only with the existing safe deploy script after review and activation checks.
