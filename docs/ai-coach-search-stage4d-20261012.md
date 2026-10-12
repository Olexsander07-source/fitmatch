# FitGoIn Stage 4D — controlled AI coach search

## Scope and architecture

Existing fitgoin-ai authenticates the actual caller with Auth getUser, checks the existing module entitlement and AI profile consent, validates conversation ownership, then reads only that owner's recent module history through RLS. Urgent safety advice and existing workout/progress/program/nutrition controls keep priority. Coach intent is a controlled branch of this handler, not a replacement chat.

fitgoin-ai-coaches.mjs parses Russian search requests and necessary clarification replies into the Stage 4B allowlisted contract. It POSTs search_coaches with the caller's bearer and public key, never a service role token. The endpoint reads published fgi_coaches/fgi_sports with RLS and ranks through the same fitgoin-match-core.mjs as ordinary MATCH. No SQL tool is exposed to the language model. Neither model nor adapter invents a MATCH or coach fact.

Results are text composed from the endpoint's real public name, sport, format, known EUR price/unit, trustworthy reviewed rating if present, backend MATCH and reasons, and existing /?trainer=UUID route. They are saved through existing fgi_ai_complete with the usual quota, nonce and atomic consent check. Request retries return the cached result without repeating search. No profile, training, nutrition or workout/progress changes are emitted by this branch. Empty results and backend failure are distinct states.

No frontend markup, coach cards, table, column, migration, grant or RLS policy changes in 4D.

## Intent and parameters

- Find a coach: use consented saved sport or one preferred sport; otherwise ask sport.
- Boxing: maps to the existing combat sport AND requires the actual specialization Бокс; a general combat profile alone is insufficient.
- Standalone muscle-gain goal in training chat: ask whether a human coach or AI program is wanted. Existing program/food intake and nutrition controls continue when applicable. Ordinary goal questions still use normal AI.
- Online budget: never requires a city. Ask the cost unit when missing; unknown price cannot pass the strict budget. Currency is EUR; other currencies and hourly pricing require clarification rather than invented conversion.
- Language: explicit supported language becomes strict. The profile's response language is not automatically a trainer restriction.
- Nearby: requires offline city; no address, GPS or distance invention. Existing saved city can be used for an explicit nearby request with memory allowed.
- Only saved sport and a soft saved goal supplement a generic request; explicit current values win. Saved age, measures, restrictions, equipment, experience, format, budget and response language do not become mandatory filters.
- Natural-language memory refusal or coach_use_memory:false disables saved-data supplementation through clarification replies. This boolean is included in the idempotency hash.
- Ambiguous, negated, multiple or unrecognised supported conditions ask for restatement. Strict conditions are never silently relaxed. New explicit requests reset earlier search conditions; ordinary advice after a clarification uses normal chat.

Pending search is reconstructed from at most 40 owner messages. Only user messages provide filters; the latest exact application question identifies the pending step. No new permanent search-memory fields are introduced.

## Files

- fitgoin-ai-coaches.mjs: intent, extraction, bounded conversation continuation, public text renderer, controlled HTTP call.
- supabase/functions/fitgoin-ai/index.mjs: minimal integration after Auth/consent/owner validation, reuse of existing history read and completeControl.
- scripts/ai-coaches.test.mjs: 26 intent/security/integration tests using the actual search handler and shared MATCH, controlled database/provider responses.
- package.json, scripts/safe-deploy.mjs: checks include the new helper and tests.
- This document.

## Verification before publication

All 298 tests pass: previous 272 plus 26 Stage 4D checks. npm run deploy:dry passes. Six requested utterances, multi-turn units/city, empty/unknown-price results, strict publication/language/mode, foreign conversations, Auth/consent failure, bearer/public-key forwarding, no private fields, memory refusal persistence, cached retries, provider fallthrough and urgent-safety priority are covered. Existing AI memory/program/nutrition/workout/progress suites continue to pass.

Controlled tests are not live browser acceptance. Publication and authenticated production acceptance results are recorded separately in the final Stage 4D report after deployment.

## Remaining limitations

Primary deterministic intake vocabulary is Russian; arbitrary natural-language conditions require clarification. One sport, one language, one format and existing EUR units per request. No hourly/monthly conversion, geocoding, radius search, coach-user level inference or live booking availability. Backend scans at most 1,000 candidates and reports an overly broad search rather than returning an incomplete ranking. Existing AI entitlement and daily message quota remain enforced. The two existing published profiles have unknown prices and empty goals/specializations, so strict budgets/boxing can legitimately return no coaches.
