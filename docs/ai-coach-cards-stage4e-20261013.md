# FitGoIn Stage 4E — coach cards in the existing AI chat

## Result and scope

Up to three ranked real coach results render inside existing assistant messages. The component uses real stored public photos or initials, name, actual specialization if provided, backend MATCH/reasons, training format, known EUR price/unit, actual experience and a reviewed rating when available. Missing fields are omitted or labelled unknown. No generated photo, price, availability, rating or MATCH. The existing premium navy/mint palette, coach-card/card-body/tag/button classes and AI message layout are reused; styles are scoped to result cards.

Existing training, nutrition, memory, completed workouts, progress, payments and entitlements are preserved. No booking, payment or subscription feature is added.

## Data and history

The controlled search branch in fitgoin-ai-coaches.mjs creates a bounded allowlisted coach snapshot from actual search_coaches output. fitgoin-coach-card-core.mjs strips private and service fields and validates IDs, MATCH bounds/version, currency/unit, actual reviewed rating and storage avatar path. It does not rank or create another MATCH formula.

New nullable fgi_ai_messages.coach_search JSONB stores this metadata beside the existing assistant message. Limit: 16,000 bytes, version 1, explicit supported status, at most three results; user messages cannot have metadata. Ordinary messages retain NULL. Owner message RLS and existing authenticated SELECT/DELETE permissions apply; clients still cannot INSERT/UPDATE messages or execute fgi_ai_complete. The existing service-only completion transaction changes exactly one INSERT to save assistant metadata atomically. All other production SQL and ACLs were verified unchanged.

History and saved messages already read select('*'), so cards survive reload and conversation changes. Existing Stage 4D text-only messages remain readable; the client does not infer cards or a MATCH from old prose. Full original text stays stored for copy/speech/history context; the chat shows its short introduction with result cards. Snapshots identify conditions at the time of matching; current terms are checked in the existing profile.

## Profile and messages

The existing delegated actions coach-profile and coach-contact pass the selected real UUID to the existing profile and inbox callbacks. Before either action, the AI callback refreshes the existing catalogue and checks publication/auth-session consistency. A withdrawn profile gives a clear unavailable notice.

Profile: existing openProfile(id) and /?trainer=UUID, not a second profile.
Messages: existing contact(id), fgi_threads and openThread; existing Auth/participant RLS and concurrent-thread handling remain. Opening a conversation does not automatically send a message. Production test messages were not sent to trainers.

Real photos use the existing fgi-media public URL resolver, allowlisted project/storage path and lazy loading. A failed photo falls back to initials without an inline JS handler. No external avatar generation or stock face is introduced.

## Changed files

- fitgoin-ai-coach-cards.mjs: bounded card HTML and failed-photo fallback.
- fitgoin-coach-card-core.mjs: shared public snapshot validation/projection.
- fitgoin-ai-coaches.mjs: attach structured snapshots to the controlled search result.
- fitgoin-ai.js: assistant-only rendering from message metadata, existing actions, scoped photo handler and unavailable notice.
- fitgoin-ai.css: scoped responsive result cards and empty state.
- fitmatch.js: reuse existing storage URL/catalogue/profile/contact mechanisms.
- supabase/migrations/20261013073426_ai_coach_search_message_cards.sql: nullable metadata column, bounded constraint, guarded existing INSERT update; no new table, grant or RLS policy.
- scripts/ai-coach-cards.test.mjs: 18 unit/integration checks.
- scripts/build.mjs, scripts/safe-deploy.mjs, package.json: include both public modules and tests.
- This document.

## Verification

316 automated tests pass: previous 298 plus 18 Stage 4E checks. npm run deploy:dry passes with 36 production files. Checks cover real-field projection, one/two/three results, missing values, trusted rating, zero/100 bounds, malformed metadata, duplicate IDs, XSS/avatar traversal, empty state, metadata roundtrip, actual message-rendering code and fresh publication/auth checks.

Ten isolated real Postgres checks (PGlite 0.5.9) use the current production fgi_ai_complete definition with minimal dependency stubs. Migration application, unchanged completion ACL/body apart from its INSERT, atomic answer/cards/memory save, NULL ordinary-message metadata, invalid-payload rollback, bounded constraints, owner isolation and no client metadata writes pass. This is not a production paid-user acceptance call.

Nineteen browser checks pass with actual mountFitGoInAI and production CSS/DOM context: 1–3 results at 320/390/768/1366px without horizontal/card overflow and with 44px buttons; two real public coach photos load/decode; the selected IDs reach profile/contact callbacks; cards restore from stored message metadata; ordinary send/load/history still works; empty results have no fake buttons; both existing anonymous production profile routes open the correct real names. Browser DB/session/provider are controlled; the third layout fixture is not a production coach. Public GET resources were forwarded through the managed runtime because native browser egress failed; real photo HTTP was verified separately.

## Publication status at handoff

Supabase migration 20261013073426 applied and read back. Owner RLS and privileges verified in production. fitgoin-ai version 26 deployed with custom verified Auth unchanged. Old frontend remains compatible through the full text answer.

Frontend publication to fitgoin.com requires the existing npm run deploy safe workflow on the authorized Windows machine. The machine is currently offline; the complete Stage 4E frontend has not yet been deployed there. Existing site release cba770d remains active. Do not call the live Stage 4E UI complete before safe deployment and asset readback.

Full authenticated production AI dialogue after the subscription gate remains unverified because the temporary test entitlement was declined in Stage 4D. Real authenticated search and two-user RLS were previously verified. Stage 4D's temporary AI profiles/conversations were deleted through the existing owner API and sessions signed out; two non-public temporary Auth records remain because their exact SQL deletion returned an expired-request error. No temporary entitlement was created.
