# FitGoIn — Stage 4C: one reproducible MATCH

Continues verified local Stage 4B commit 52d318926ba85ac921e6b8c988373172ce743694. Remote main remains 077bdab0321a2b463f33d38063df8d84fb3ebbda. Stage 4B is not deployed. This stage introduces no AI tool, prompt, chat action or new AI UI.

## Formula and data
The old selected-weight formula is preserved: `clamp(round(100 * earned / selected_total), 0, 100)`. Weights: sport 30, goal/specialization 20, mode 15, offline location 15, known price with the same billing period 10, language 5, time preference 5. Unselected optional criteria do not enter the denominator. Unknown selected data earns zero. The sport factor is always the base 30; missing/different/unknown sport returns 0 and cannot invent other matching factors. A specified different/unknown sport is excluded before ranking.

Goal and specialization share the existing goal column and one 20-point factor; both requested values must match existing tokens to earn it. Country disambiguates offline city within the existing 15-point location factor; no distance/geocoding. User level is not inferred from coach experience. Existing min_experience_years is a strict filter, not a new weighted factor. Rating only breaks a percent tie when valid (1–5) and backed by a positive reviews_count. No weight was invented for unverifiable expertise, level or trainer quality.

With only known sport requested, 100% still means one selected criterion matched, not that missing information or every conceivable need is satisfied. For admitted trainers with a required matched sport, normal percentages remain 30–100; the calculation itself has numeric 0/100 boundaries.

## One module and consumer wiring
fitgoin-match-core.mjs owns normalization, sport identity, strictCoachFits, calculateMatch, structured explanations, matchPercent, trustedRating, compareMatches and rankCoaches. Ordinary findMatch and the existing recommendations callback import this module. Backend search_coaches imports the same module; it returns each public coach with match.percent, match.earned/total, match.criteria, match.reasons and version. The former inline frontend algorithm and duplicate backend strict predicate are removed.

Reasons and structured status/earned/weight/requested/actual records are generated in the same pass that earns points. They distinguish matched, mismatch and unknown. They do not add fabricated coach characteristics. Future AI can explain them without calculating its own percentage; AI is not connected here.

## Strict filters and preferences
Sport, chosen format, budget/billing unit, language, explicit location and minimum experience cannot be overridden by high scores. No unknown price or cross-period conversion satisfies a budget.

The ordinary form retains its existing goal/time preference meaning; formMatchPreferences marks goal/specialization/availability as soft, converts number-input values, and applies the existing offline-only meaning of its city field. For online, the form's offline-city draft is ignored. In the backend API an explicitly supplied online city/country still remains strict, as in 4B. Canonical equivalent requests produce identical ranked results.

Backend defaults preserve 4B: every supplied filter is strict. Only goal/specialization/availability can be explicitly made preferences through soft_fields. Attempts to soften budget, mode, language or location are rejected. A preparation-level field does not exist; the existing backend rejects it rather than inventing compatibility.

## Ranking and bounded completeness
Sort: displayed rounded MATCH descending; valid rating with reviews descending; server-owned public profile score descending; ID ascending. Default three results, or fewer if fewer satisfy strict filters. Input order does not determine ties.

Backend now collects the complete eligible set before sorting and slicing. It scans at most 1,000 DB candidates (250/batch), plus a one-row completion probe. Exactly 1,000 complete candidates are accepted. More candidates produces search_too_broad (422), not a misleading partial top-three. Narrow the search. The UUID cursor refers to the last returned ranked coach; the same filters must be retained. Each page ranks the same complete set before finding the cursor, so a late source ID can be the first recommendation. A cursor outside the eligible set is 422.

## Files
- fitgoin-match-core.mjs: shared calculation, explanations, mandatory predicates and sort.
- fitmatch.js: ordinary search and existing callback use shared rankCoaches; UI markup/design unchanged.
- supabase/functions/search_coaches/core.mjs: shared predicates, public score for the documented tie, validated soft_fields.
- supabase/functions/search_coaches/index.mjs: global rank before pagination, explanatory response and completeness bound.
- supabase/functions/search_coaches/README.md: updated API/ranking contract and deployment dependencies.
- scripts/match.test.mjs: 26 calculation/compatibility/integration checks, including 128 differential legacy combinations.
- scripts/coach-search.test.mjs: 30 backend security/filter/ranking checks.
- scripts/coach-search-readonly-live.mjs: selectable evidence output path so 4B evidence stays unchanged.
- scripts/build.mjs: includes the new shared browser module.
- scripts/verify.mjs, scripts/safe-deploy.mjs, package.json: checks include the shared implementation and new tests.
- docs/qa/coach-search-stage4c-20261012.json and docs/qa/coach-match-stage4c-examples-20261012.json: actual read-only API results and local calculations on real published rows.
- This report.

No SQL migration, new table, policy or GRANT. Existing AI handler, OpenAI integration, authentication, memory, programs, nutrition, history, progress, payment code and AI interface are not rewritten or deployed.

## Validation
- Targeted suite: 26 MATCH + 30 backend checks pass; exact original percentages retained across 128 valid combinations.
- Full npm check: existing 216 regressions plus these 56 checks, total 272.
- npm run deploy:dry: nonpublishing check/build/34-file bundle/dry run. Shared frontend dependency graph verified (12 modules).
- Actual findMatch adapter executed with controlled FormData/DOM dependencies; budget-excluded and unpublished profiles do not render. Existing recommendation callback returns exactly shared results. These are controlled integration checks, not live browser acceptance.
- Eight read-only real Data API/Auth checks pass. Local calculations on both published trainers: sport only 100%; sport + soft goal Сила + online + ru = 50/70 = 71%, with goal unknown. Strict 40 EUR/lesson budget gives no candidates because both prices are NULL.
- Existing transactional RLS suite passes; fixtures roll back and zero test users/coaches remain.
- A real browser smoke attempt could not launch because Chromium was absent; the official download produced an invalid/empty archive. No visual/full browser pass is claimed. Windows and production browser acceptance remain unverified.

## Publication state
Only local code changes/checks. The prior automatic review rejection requires explicit authorization to publish source to GitHub; the current request did not answer that permission question. No alternate push route, remote branch/PR creation, migration, backend deployment or Cloudflare publication was attempted. Keep this verified local branch for approval and publication of 4B+4C together, then read back backend and safely verify live frontend before calling the production stage complete.

