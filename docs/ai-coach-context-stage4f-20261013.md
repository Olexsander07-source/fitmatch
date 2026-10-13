# FitGoIn — Stage 4F: conversational coach search

The existing `fitgoin-ai` handler recognises refinements of a coach search and comparisons of its first two results. It continues to call `search_coaches` with the caller's verified bearer and public key. The ordinary search, shared MATCH formula, profile route, contact flow, program/nutrition/progress handlers and access checks remain in place.

## State and memory

The existing owner-scoped `fgi_ai_messages.coach_search` JSON contains:

- `parameters`: current search conditions, selected soft preferences and default limit 3;
- `use_memory` / `memory_fields`: permission and provenance of sport, soft goal or offline city taken from the existing consented `fgi_ai_profiles` memory;
- `pending`: a necessary clarification or unsupported condition;
- `reset_context`: a boundary for a new search;
- `ids` / `coaches`: actual last successful results in backend order, including public snapshots and the MATCH proof;
- `presentation: comparison`: preserves the full comparison text above the current cards.

Current conditions and last completed results are read separately from assistant metadata in the latest 40 messages of this user, conversation and module. User-role metadata is ignored. An ordinary intervening sports question continues through the existing AI route and does not delete the search context. A new search or cancellation stops reuse of earlier results. With missing, old or expired context, the assistant asks for a new search instead of guessing.

There is no second memory table, global state, local storage or profile-memory update for coach search. Explicit requirements replace corresponding filters; explicit goals cease to be soft remembered preferences. Refusing memory also removes fields sourced from it, while retaining explicit requirements. Durable user preferences are unchanged.

## Refinements

| Message | Behaviour |
| --- | --- |
| Покажи дешевле | With known EUR prices in one payment unit, set a cent-aligned ceiling strictly below the lowest displayed price and no greater than the existing ceiling. If prices are unknown, mixed or results empty, request a numeric budget. A price below zero is never requested. |
| Только онлайн | Change format; omit the cached offline city/country from the backend request. Keep them in conversational state for a later offline switch. No address question. |
| До 40 € | Replace budget only; inherit the previous payment unit or clarify it. |
| Хочу женщину-тренера | The production coach schema has no gender field. State the limitation and keep it pending until explicitly removed or a new search begins. Never infer gender. |
| Покажи франкоязычных | Replace language with `fr`; preserve other conditions. |
| Убери ограничение по цене | Remove both budget and payment-unit filter, then repeat search. |

Unsupported criteria are not silently dropped. Backend failures preserve the requested conditions and allow a retry. Actual searches and comparisons call the same backend again; the assistant never edits a percentage itself.

## Comparison

The three requested phrases compare the first and second IDs of the last actual result set. A new backend search refreshes public visibility, strict filters and MATCH. If a selected ID no longer belongs to the current top three, show current results and request a new selection; never substitute a profile silently. Fewer than two results receive an honest explanation.

The comparison uses backend percent, earned/total points and the same criterion statuses (`matched`, `mismatch`, `unknown`). Public price, mode, experience and trustworthy reviewed rating can be stated; different payment units are not compared directly. A MATCH tie is stated as a tie. The shared `fitgoin-match-core.mjs` weights and sorting are unchanged.

Snapshots additionally retain bounded, validated criterion proof and public language/location fields. Their existing schema version and 16 KB SQL limit remain unchanged. No SQL migration, RLS policy, ACL, coach field or backend search formula is added.

## Changes

- `fitgoin-ai-coaches.mjs`: persisted conversation context, refinements, provenance, reset/retry and controlled comparison.
- `supabase/functions/fitgoin-ai/index.mjs`: read owner-scoped coach metadata; distinguish coach-search cancellation from program cancellation.
- `fitgoin-coach-card-core.mjs`: public bounded MATCH proof and language/location snapshots.
- `fitgoin-ai.js`: keep the full comparison explanation above result cards.
- `scripts/ai-coach-context.test.mjs`: 36 new production-handler/renderer scenarios with controlled network boundaries.
- `scripts/ai-coaches.test.mjs`: existing completion fixture now persists coach metadata like the database.
- `package.json`, `scripts/safe-deploy.mjs`: include the new suite in checks and the existing safe deployment.

## Validation and limits

`npm run check`: 352 passed (216 existing AI/site tests, 100 existing coach-search/MATCH/card tests and 36 new 4F tests). `npm run deploy:dry`: production asset build and Wrangler dry run passed. Isolated real Postgres completion/RLS regression: 10 passed. Chromium/actual mounted chat regression: 20 passed, including mobile comparison text, cards, photographs, callbacks, history, empty state and existing anonymous production profile routes. Browser DB/session/provider boundaries are fixtures; no messages were sent to coaches. Live anonymous public catalogue read plus production-code replay with Auth/DB boundaries stubbed: 10 passed.

The production catalogue has two public coaches in different sports, both without price. Strict budget searches correctly exclude them; a positive two-coach comparison in one sport is tested with explicit test fixtures, not claimed as a live catalogue result. A full paid authenticated AI conversation is not tested with an actual customer account. Old 4E result snapshots without search parameters cannot safely supply a 4F comparison; start a new search. Context is bounded to 40 recent messages. Natural-language parsing is controlled for the supported search phrases and filters, not arbitrary unrestricted model-generated queries.

The frontend live release checked during this stage is still `cba770dacf11ffe85ca7a554133e17993eb12f34` (4D). The existing Cloudflare deployment computer is offline. Publishing source or the Supabase function does not mean cards/comparison rendering are published to the website. Complete the pending frontend release only through a clean current `main` and `npm.cmd run deploy` using the established `fitgoin-production` deployment; do not publish through the legacy Worker or direct Wrangler.
