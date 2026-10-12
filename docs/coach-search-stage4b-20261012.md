# FitGoIn — Stage 4B: safe backend coach search

Continues main 077bdab0321a2b463f33d38063df8d84fb3ebbda and the Stage 4A audit. Adds an isolated search_coaches Edge Function; no UI or AI-chat integration. Existing MATCH, AI handler, memory, plans, nutrition, workouts and progress are unchanged.

## Changes
- supabase/functions/search_coaches/index.mjs: bounded POST endpoint, real Auth user verification, caller-scoped RLS reads, fixed table/column selection, strict filters, sanitized errors, deterministic pagination.
- supabase/functions/search_coaches/core.mjs: allowlisted input validation, exact real sport resolution, strict candidate predicates and public response projection.
- supabase/functions/search_coaches/README.md: request/response contract, security, deployment and limitations.
- scripts/coach-search.test.mjs: 26 filter/authorization/privacy/pagination tests.
- scripts/coach-search-rls.test.sql: transaction-only hidden-owner/other-user/public-profile checks against the real existing database.
- package.json: includes the new backend syntax/tests in npm run check.
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
Publication/readback/live acceptance pending at this source checkpoint. This section will be updated after backend deployment and disposal of isolated QA accounts. No production success is implied by the local tests.

## Limits
- Current published trainer data are sparse: prices, goals and availability are missing. Strict searches may legitimately return no results. No missing data are inferred.
- Goal/specialization require explicit existing goal tokens; city/country require normalized exact text. No semantic synonym, distance/geocoding or price-unit conversion.
- No existing trainer preparation-level compatibility field; supplied level filter is rejected with 422. Existing experience_years can be filtered separately.
- 1,000 candidate scans per request with explicit continuation; follow next_cursor until has_more=false. Default 3 results, max 20.
- No new MATCH or sorting by invented suitability. AI tool-calling and frontend changes are deferred.

