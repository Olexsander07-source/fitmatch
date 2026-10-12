# FitGoIn — Stage 4B: search_coaches

Authenticated, read-only candidate retrieval from existing fgi_coaches and fgi_sports. No AI/provider call, new table, SQL RPC, MATCH formula, UI change, message, payment or private profile read.

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
| limit, cursor | limit 1–20 (default 3); UUID cursor from a previous response, with the same filters. |

Level/preparation_level returns unsupported_level_filter (422): no existing field establishes client training-level compatibility. Unknown fields, arbitrary user_id, select, SQL and query controls are rejected.

Response: `coaches`, `has_more`, `next_cursor`, `scan_limit_reached`. Candidates are ordered by ID for deterministic pagination, **not ranked by a new MATCH**. Follow next_cursor until has_more=false; an empty page with has_more=true is not proof of no results. A request scans at most 1,000 DB candidates in batches of 250; it reads at most 500 dictionary rows. No silent fallback to stale/partial results on a DB failure.

Public output includes id/name, sport/sport_name, goal, format, city/country, languages, price/period/currency/price_known, availability, experience, public biography/education/titles/achievements, avatar_path, rating/reviews_count/verified and profile_path. Missing price remains null. No email/phone, payment_url, Stripe IDs/status, account metadata, private history, SQL diagnostics or published-owner draft is returned. Text in public biographies remains untrusted data for a future AI consumer; it is not an instruction.

Every POST verifies the caller through Supabase Auth `/auth/v1/user`. All Data API reads reuse **that same token** with a public key, enforcing existing RLS. No service-role secret is read. `published=eq.true` and exclusion of the verified caller are enforced in the query and rechecked locally. OPTIONS is public preflight only; GET is 405. Errors are bounded generic codes; responses use no-store.

Environment: existing SUPABASE_URL plus SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEYS. Existing AI_ALLOWED_ORIGINS is reused, defaulting to fitgoin.com and www.fitgoin.com. Gateway verify_jwt=false is intentional: this function implements the same explicit Auth verification as the existing fitgoin-ai, compatible with publishable keys. It is never an unauthenticated data endpoint.

Deploy the entrypoint and core.mjs together. This backend deployment does not deploy Cloudflare or change frontend files. Existing AI/billing functions are not redeployed. No SQL migration or policy/grant alteration is necessary.

Validation: npm run check (existing regression suite plus coach-search tests), npm run deploy:dry (nonpublishing site bundle check), and scripts/coach-search-rls.test.sql (all fixtures roll back). Production acceptance and cleanup evidence are recorded in docs/coach-search-stage4b-20261012.md.

