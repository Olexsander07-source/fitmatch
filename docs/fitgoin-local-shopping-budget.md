# FitGoIn — local fitness, equipment & food budget (15 km)

## User requirement

If a customer explicitly supplies a city, offer nearby gyms, stores selling fitness equipment and supermarkets within 15 km of an agreed city center or customer-selected pin (not a precise inferred home address). Compare the cost of a realistic training and nutrition plan, with source links, dates, and separate totals.

## Design and correctness contract

1. Keep the city optional in the profile; never require an address or geolocation permission. Only send the city to external providers after a user requests or opts in to local discovery. Never send private health facts or complete profiles to place or retail search providers.
2. Resolve and disambiguate the city to coordinates through a geocoder. Use the chosen city center or pin as the center of the 15 km circle. Query a real place service for gyms, grocery stores and sports stores; validate every venue's coordinates and filter it again by Haversine distance. The 15 km radius means straight-line distance, not driving time.
3. Gym comparison: verified monthly subscriptions, joining fees and terms. If reliable prices are missing, say "price unavailable"; never invent them.
4. Equipment comparison: link identifiable products to prices, package quantities, merchant URLs and timestamps. Recommend a comparable bodyweight or existing-equipment alternative whenever suitable, explaining training differences. Do not require a purchase before generating a program.
5. Nutrition: transform the 7-day menu into a deduplicated shopping list with grams, units, portions, dietary and allergy constraints. Compare local supermarkets by package sizes and real prices. Show itemized totals, unknown items, collection/delivery fees when applicable and observation dates. Never fabricate unknown final basket totals.
6. Show weekly food total, estimated monthly food (52/12 weeks), monthly gym membership and one-off equipment separately. Prevent counting both a gym membership and equipment as mandatory when they are alternative paths.
7. Verify product stock and sale expiration separately from finding a shop. Do not treat an undated AI summary as a checkout price.
8. Present prices in shopping-region currency and content in FR/EN/RU; warn if merchant price sources are inaccessible or incomplete.
9. Use server-side provider keys, limits, short-lived caching, attribution and license compliance. Do not activate paid mapping or retail providers without accounting for usage and spending caps.

## Status of implementation

- fitgoin-ai-local-budget.mjs is a pure calculator for verified coordinates, priced-vs-unpriced goods, and recurring vs one-time costs. It does not call providers or return actual prices by itself.
- scripts/ai-local-budget.test.mjs covers coordinates, incomplete catalogs and arithmetic.
- FitGoIn's current AI web search is restricted to sports research domains. It cannot currently discover verified store/product prices within 15 km. The remaining work is city resolution, geo provider integration, merchant product price feeds, user-facing UI, tests and launch configuration.

## Acceptance tests before release

- User chooses a city; venue search uses the specified center and excludes all unverified or out-of-radius points.
- If a location, product price or inventory value is missing, the system never invents one.
- The generated 7-day menu yields consistent normalized units and an itemized shopping basket; partial results have no fake total.
- Gym, home and bodyweight programs remain functional even without shopping features.
- Gym monthly and equipment purchase costs remain separate; merchant prices are time-stamped and linked.
- User city and diet context are not leaked through queries without the required opt-in.
