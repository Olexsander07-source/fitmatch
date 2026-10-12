# FitGoIn — Stage 4B: search_coaches

Authenticated, read-only candidate retrieval from existing fgi_coaches and fgi_sports. Uses the existing MATCH formula from one shared module. No AI/provider call, new table, SQL RPC, AI-interface change, message, payment or private profile read.

POST `/functions/v1/search_coaches` with `Authorization: Bearer <Supabase user access token>` and `Content-Type: application/json`. The body is a flat allowlisted JSON object:

```json
{"sport":"Бодибилдинг","format":"Онлайн","language":"ru","limit":3}
```

| Field | Meaning |
|---|---|
| sport | Existing fgi_sports UUID or exact name (trimmed, case insensitive); optional. Unknown or ambiguous name is 422. |
| goal, specialization | Both compare against explicit comma/semicolon/newline separated tokens in existing goal. AND when both specified. No inferred expertise or semantic synonyms. |
| format | Онлайн or Офлайн. Either accepts a trainer with Онлайн и офлайн. |
| budget, period | budget is a JSON number from 0 to 100 EUR; requires period занятие, месяц or программа. Unknown price or different period never satisfies budget. period alone is also strict. |
| language | Language code, e.g. ru, uk, fr. Must occur in actual languages. |
| city, country | Exact normalized text for offline-capable trainers. No geocoding or distances. Optional for online; explicitly supplied location is honored for online too. Without an explicit online mode, a location query searches offline-capable trainers. |
| availability | Existing morning/day/evening/weekend value; must be present. |
| min_experience_years | Existing integer experience_years, 0–80. Unknown experience does not pass. |
| soft_fields | Optional array of goal, specialization, availability treated as preferences. Other filters cannot be softened. Without this option all supplied filters remain strict, preserving 4B. |
| limit, cursor | limit 1–20 (default 3); last returned coach UUID from the ranked list, with the same filters. |

Level/preparation_level returns unsupported_level_filter (422): no existing field establishes client training-level compatibility. Unknown fields, arbitrary user_id, select, SQL and query controls are rejected.

Response: `coaches`, `has_more`, `next_cursor`, `scan_limit_reached=false`. Each coach includes a `match` with percent, earned/total weights, structured criterion records, explanations and version. The endpoint ranks the complete eligible set, then pages it: MATCH descending, rating descending only with a positive review count, server-owned profile points descending, ID ascending. A missing/different sport yields 0; a supplied mismatched sport is filtered before ranking. The original selected-weight formula and weights are documented in docs/coach-match-stage4c-20261012.md.

Requests scan up to 1,000 DB candidates in batches of 250 plus one completion probe. If the query exceeds that bound, return `search_too_broad` (422) and no pretend top-three; narrow the filters. Cursor pagination takes place after global ranking, not by skipping source IDs before ranking. A cursor that no longer belongs to the eligible set is 422. No silent fallback to stale/partial results on a DB failure.

Public output includes id/name, sport/sport_name, goal, format, city/country, languages, price/period/currency/price_known, availability, experience, public biography/education/titles/achievements, avatar_path, rating/reviews_count/verified, public profile score and profile_path. Missing price remains null. No email/phone, payment_url, Stripe IDs/status, account metadata, private history, SQL diagnostics or published-owner draft is returned. Text in public biographies remains untrusted data for a future AI consumer; it is not an instruction.

Every POST verifies the caller through Supabase Auth `/auth/v1/user`. All Data API reads reuse **that same token** with a public key, enforcing existing RLS. No service-role secret is read. `published=eq.true` and exclusion of the verified caller are enforced in the query and rechecked locally. OPTIONS is public preflight only; GET is 405. Errors are bounded generic codes; responses use no-store.

Environment: existing SUPABASE_URL plus SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEYS. Existing AI_ALLOWED_ORIGINS is reused, defaulting to fitgoin.com and www.fitgoin.com. Gateway verify_jwt=false is intentional: this function implements the same explicit Auth verification as the existing fitgoin-ai, compatible with publishable keys. It is never an unauthenticated data endpoint.

Deploy the entrypoint, core.mjs and root fitgoin-match-core.mjs together, preserving relative paths. This backend deployment does not deploy Cloudflare. Stage 4C ordinary frontend search imports the same root module; publish it only through the existing safe site workflow. Existing AI/billing functions are not redeployed. No SQL migration or policy/grant alteration is necessary.

Validation: npm run check (existing regression suite plus coach-search tests), npm run deploy:dry (nonpublishing site bundle check), and scripts/coach-search-rls.test.sql (all fixtures roll back). Stage 4B evidence is in docs/coach-search-stage4b-20261012.md; Stage 4C checks and publication limits are in docs/coach-match-stage4c-20261012.md.

