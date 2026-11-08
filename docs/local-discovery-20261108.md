# FitGoIn: 15 km local discovery — guarded integration (2026-11-08)

## Scope

- Authenticated and opt-in local lookup for gyms, sporting goods stores, and supermarkets.
- City name, not street address or GPS, is sent to Google Geocoding API only after an explicit form submission.
- Google Places API (New) returns locations within a 15 km straight-line radius of the city centre. The backend independently recalculates distance and validates the returned entries.
- No gym fees, merchant prices, product stock, nutrition costs, or subscriptions are guessed. Those require separate verified price data feeds; existing local-pricing module remains calculation-only.
- The local UI tab is hidden until the endpoint GET readiness reports configured: true.

## Secure setup (Google Cloud billing required)

1. Create/select a Google Cloud project, link billing, enable Geocoding API and Places API (New).
2. Create a server API key restricted to these two APIs and appropriately constrained for server usage. Never put it into web JS, repository or chat.
3. Save GOOGLE_MAPS_SERVER_API_KEY in Supabase Edge Function secrets (server side).
4. Only after quota/billing limits and a live staging check, set FGI_LOCAL_GEO_ENABLED=true in Supabase secrets. No paid outbound calls occur while the flag is absent.
5. Deploy the separate fitgoin-local-discovery Edge Function. Its verify_jwt:false mode uses Auth /user verification in code, consistent with the existing FitGoIn AI gateway; all POST requests still require an actual signed-in user.

## Cost / privacy safeguards

- Optional per-search consent; no background geolocation, GPS or user diet, injuries, name, email or chat shared with Google.
- Existing FitGoIn AI entitlement is checked server-side before location spending; no paid AI access means no geocoding calls.
- SQL RPC: 4 lookups/user/UTC day and 100 total site-wide/UTC month; function executable by service_role only. Users have no SELECT on quota table.
- One city geocode and one category Nearby Search per authorized request (up to 20 results). No retries on disabled config, failed Auth or exhausted quota.
- Only verified locations and independently distance-filtered results are displayed; prices and stock deliberately absent.
- Google Maps attribution accompanies results. Check current Google Maps Platform terms and EEA rules.

## Tests and launch

Run npm run check and npm run build. Unit tests cover categories, consent, city validation, Auth, subscription entitlement, quota, radius, disabled startup, and non-fabricated prices.
Do not enable the API until an actual key, Google Cloud API usage quotas, and billing alerts are configured. Run a live authenticated test, inspect logs, and check charges before wider release.
