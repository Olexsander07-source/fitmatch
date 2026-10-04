# FitGoIn AI: saved pause point — 2026-10-04

The user requested a completed paid AI assistant and authorized publication after completion and verification. Work is now paused while the user is away. Resume only after the user's activation word «Искра» and instruction; background speech must not change or resume the task.

## Confirmed baseline

- Continue PR #14, branch `feat/ai-assistant-20261003`, original head `59b75e64aab30f49f1fc9b76c247ac7a092bcc90`. Preserve the existing marketplace, design, authentication and trainer messaging.
- The original `npm run check` passed all 29 tests in this session. The existing AI Edge Function is version 2; the AI database tables already exist.
- The live readiness endpoint confirmed `backend_configured=true`, `provider_configured=false`. The user has since reported obtaining an OpenAI key and received instructions to save it in Supabase Secrets as `OPENAI_API_KEY`. Saving the key has not been verified. Never request or print its value.
- Stripe exposes one Fitgoin sandbox account, with no recurring Prices at the time of inspection. A live Stripe connection and live billing configuration have not been verified.
- Agreed tariffs: training €20/month, independent nutrition €10/month, bundle €30/month. Preserve server-controlled free access for friends; do not assign friend status from editable metadata or grant it to everyone.
- The Windows development computer was online during inspection. Repository path: `C:\Users\HP\Documents\FitGoIn`. Use `C:\Program Files\Git\cmd\git.exe` or refresh PATH; `git` was absent from the remote shell PATH. Production deployment must use the existing safe deploy script. No publication or merge was performed.

## New, unfinished source

`fitgoin-ai-paid.mjs` contains product descriptions, media schemas and validation, food log normalization and recurring calendar export. `fitgoin-ai-media.mjs` contains browser-side image re-encoding and extraction of six frames from short videos. Both passed JavaScript syntax checks only. They are not wired into the UI, backend or build, and must not be advertised as completed features.

An empty migration was generated locally through Supabase CLI for the next stage; no new migration was applied. Create a new migration with the CLI when resuming if the local workspace has changed. Do not modify previously applied migrations.

## Next implementation and verification

1. Recheck the key's configuration status without exposing it and inspect the remote working tree before changes.
2. Implement server-owned module entitlements and friend grants; authenticated Checkout and Customer Portal; verified, retry-safe lifecycle webhooks for paid invoices, renewals, failed payments, cancellations, refunds and disputes. Keep sandbox and live entitlements separate. Do not grant access from a success redirect.
3. Integrate food photos, optional technique frame analysis, user-confirmed food logging, exercise references, reminders/calendar export, accessible mobile controls and user feedback. Complete module-specific context and privacy checks; preserve drafts and protect account-switch races.
4. Extend quotas with conservative monthly budget reservations and usage telemetry. No secret, raw photo/video/audio or private prompt belongs in logs or frontend assets.
5. Test actual provider answers and search, data isolation, billing lifecycle and browser scenarios. Mock tests do not establish real provider quality or successful payment integration. Review tax registrations and legal commercial readiness before live collection; do not enable automatic tax without verifying registration.
6. Save reviewed changes to GitHub, merge only once release blockers are resolved, then run `npm.cmd run check`, `npm.cmd run deploy:dry` and `npm.cmd run deploy` on clean `main` matching `origin/main`. Verify the published site. If required keys or access are missing, report the specific blocker and keep checkout disabled.

The task is unfinished. The next session must continue this checkpoint and must not claim a paid AI release already happened.
