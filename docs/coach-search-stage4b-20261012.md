# FitGoIn — Stage 4B: safe backend coach search

Continues main 077bdab0321a2b463f33d38063df8d84fb3ebbda and the Stage 4A audit. Adds an isolated search_coaches Edge Function; no UI or AI-chat integration. Existing MATCH, AI handler, memory, plans, nutrition, workouts and progress are unchanged.

## Changes
- supabase/functions/search_coaches/index.mjs: bounded POST endpoint, real Auth user verification, caller-scoped RLS reads, fixed table/column selection, strict filters, sanitized errors, deterministic pagination.
- supabase/functions/search_coaches/core.mjs: allowlisted input validation, exact real sport resolution, strict candidate predicates and public response projection.
- supabase/functions/search_coaches/README.md: request/response contract, security, deployment and limitations.
- scripts/coach-search.test.mjs: 26 filter/authorization/privacy/pagination tests.
- scripts/coach-search-rls.test.sql: transaction-only hidden-owner/other-user/public-profile checks against the real existing database.
- package.json: includes the new backend syntax/tests in npm run check.
- scripts/coach-search-readonly-live.mjs and docs/qa/coach-search-stage4b-20261012.json: reproducible read-only live transport checks.
- This report.

## SQL and existing architecture
No migration, new table, RPC, GRANT, policy or schema change. The only production tables read by the endpoint are public.fgi_coaches and public.fgi_sports. It verifies Auth using the existing application's method; never reads service-role/OpenAI/payment keys. Database requests use the verified user's access token, so existing RLS remains active. Publication and caller exclusion are also checked before projecting results.

## Validation before publication
- npm run check: 216 existing regressions plus 26 new checks passed (242 total).
- npm run deploy:dry: passed, including existing build and nonpublishing Wrangler dry run; no Cloudflare deployment.
- Real PostgreSQL transactional suite: stage4b_existing_rls_passed, all fixture rows rolled back.
- Security Advisors: existing INFO notices for intentionally private billing tables and existing leaked-password-protection WARN; no schema changes made. References: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.
- Source change boundary: no frontend file or existing Edge Function changed. Windows device was offline; checks were performed in the Linux checkout using equivalent npm commands.

## Production acceptance
GitHub push was rejected by automatic approval review: the user authorized Stage 4B implementation but the review requires explicit permission for external publication of source/documentation to the remote. No alternate push or connector write was attempted. Remote main remains 077bdab0321a2b463f33d38063df8d84fb3ebbda; the Stage 4B branch does not exist remotely. The new endpoint has NOT been deployed. A separate Cloudflare deployment is neither performed nor needed.

Eight read-only checks against the actual public Supabase Data API and Auth passed: catalogue 2 profiles; sport filtering 1; online 2; offline 1; Russian 2; strict 40 EUR/lesson budget 0 (both actual prices unknown); public projection strips private/payment fields; the local handler rejects an invalid token through actual Supabase Auth with 401. These are not successful authenticated acceptance of a deployed endpoint.

Real RLS fixtures fully rolled back: zero remaining fixture users/coaches; original two published profiles remain. No live QA account was committed; unused generated test credentials were discarded. After publication is approved, deploy/read back this isolated endpoint and complete authenticated endpoint acceptance with controlled QA and verified cleanup.

## Limits
- Current published trainer data are sparse: prices, goals and availability are missing. Strict searches may legitimately return no results. No missing data are inferred.
- Goal/specialization require explicit existing goal tokens; city/country require normalized exact text. No semantic synonym, distance/geocoding or price-unit conversion.
- No existing trainer preparation-level compatibility field; supplied level filter is rejected with 422. Existing experience_years can be filtered separately.
- 1,000 candidate scans per request with explicit continuation; follow next_cursor until has_more=false. Default 3 results, max 20.
- No new MATCH or sorting by invented suitability. AI tool-calling and frontend changes are deferred.

