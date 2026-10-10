# FitGoIn AI paid release candidate

Continues PR #14 and the existing marketplace. Monthly products: training €20, independent nutrition €10, bundle €30. No production frontend release or live billing activation is implied by this candidate.

## Configuration, kept on the server

- `OPENAI_API_KEY`: Supabase Edge Functions Secrets. Never enter it in chat, GitHub, frontend files or public environment variables. API billing is separate from ChatGPT.
- `OPENAI_MODEL`, `OPENAI_SEARCH_MODEL`: default `gpt-4.1`. Other models require operator-approved conservative cost rates in `FGI_AI_INPUT_USD_PER_MILLION` and `FGI_AI_OUTPUT_USD_PER_MILLION`; no automatic expensive-model substitution.
- `AI_BILLING_MODE`: `live` by default; explicitly `test` for sandbox acceptance only. AI and billing functions must use the same mode. Test subscriptions never unlock live requests.
- `FGI_AI_STRIPE_KEY`: restricted Stripe key for the matching mode; needs Customer, Price, Subscription, Invoice, Invoice Payment, Charge, Dispute, Checkout Session and Customer Portal access. This is separate from the marketplace's existing Stripe functions.
- `FGI_AI_PRICE_TRAINING`, `FGI_AI_PRICE_NUTRITION`, `FGI_AI_PRICE_BUNDLE`: verified recurring EUR monthly Prices with amounts 2000/1000/3000 and interval_count=1. Separate products.
- `FGI_AI_WEBHOOK_SECRET`: the signing secret for `https://ypbhcgcwkpiujcakvaji.supabase.co/functions/v1/fitgoin-ai-billing/webhook`.
- `FGI_AI_BILLING_ENABLED=true`: only after end-to-end testing. Live mode also requires `FGI_AI_COMMERCIAL_READY=true` after merchant identity, published subscription terms, consumer cancellation/refund handling and tax treatment are verified. With any required setting missing, checkout stays disabled. Adding only the OpenAI key does not enable collection.
- `FGI_AI_MONTHLY_SITE_USD`: default 20, application budget in USD, independent of Stripe revenue. User resource budgets are conservative internal cost allocations: training 5, nutrition 3, bundle 7, invited access 5. Paid plans are limited, not unlimited.

Do not enable Stripe automatic tax without verifying an active tax registration and the treatment of final EUR prices. Stripe Tax requires registrations; a flag alone does not establish tax collection. Real Stripe account availability is not established by a sandbox connection.

The Stage 3B `fitgoin-ai` bundle contains its entrypoint and root dependencies `fitgoin-ai-core.mjs`, `fitgoin-ai-paid.mjs`, `fitgoin-ai-memory.mjs`, `fitgoin-ai-program.mjs`, `fitgoin-ai-workout.mjs`, `fitgoin-ai-nutrition.mjs` and `fitgoin-ai-meals.mjs`. Deploy all eight together when changing AI behavior, after verifying the nutrition version migration. The separate billing function needs only its existing core/paid dependencies and is not redeployed for stages 2C/3A/3B. Both have gateway JWT verification disabled because the former authenticates every POST with Supabase Auth getUser and the latter combines independently authenticated customer actions with a signed Stripe webhook path. Public GET exposes only configuration status.

Stage 3B menus and single-food replacements use bounded portions and a server-owned basic composition catalogue. The current nutrition version is changed only by an explicit confirmation of an owner-private draft. See `docs/ai-nutrition-stage3b-20261010.md` for actual verification and outstanding production gates; this source bundle is not itself proof of publication.

## Access and billing lifecycle

Only verified, server-owned Customer mappings and paid invoice periods grant modules. Customer-editable metadata, client amounts/Price IDs, friend flags and success redirects never grant access. Portal actions use only the authenticated user's mapped Customer. Existing subscriptions block a second checkout. A server-owned pending session and stable nonce reuse Checkout across retries/tabs; a different pending plan is rejected until expiry. Webhooks verify signatures and fetch current resources; event processing is transactional and idempotent, protects newer states from older events, separates live/test and resolves refunds/disputes through Charge → PaymentIntent → Invoice Payment → Invoice → Subscription where required. Refund and dispute risks have independent IDs; resolving one does not clear another. Full refunds and fraud warnings require operator review before lifting the relevant risk block.

Friends receive explicit grants in `fgi_private.ai_friend_grants` from an authorized server/admin only. No grant is automatically assigned to all users, user metadata, presumed friends or guessed account owners. An expiry of NULL supports lifetime invited access; normal abuse/resource limits still apply.

## Privacy and resource limits

Module-specific conversation/plan context prevents nutrition answers from receiving training history and training answers from receiving diet/allergy fields. Search uses only the generic research topic, no saved profile/history, and rejects obvious personal measurements, contact details and the saved city. User text remains untrusted; no source or image can execute commands. Responses require strict schema/semantic validation. Photo estimates are ranges and cannot establish allergen safety. Technique analysis sees selected frames, not continuous motion or hidden loads.

Photos are locally re-encoded, stripping metadata. Up to six JPEG frames are extracted locally from a 1–45 second video up to 25 MB. Raw video/audio is not uploaded by the image pipeline; raw photos/frames are not persisted by FitGoIn. The user must consent per analysis; food is logged only after a separate editable confirmation. Text assessments remain in private AI history. Progress photos remain separate and are not sent to OpenAI. Explicit coach snapshots are unchanged.

The original 30 requests/user/UTC day, 3 searches/day, 5 requests/minute and 300 site requests/day gates remain. A serialized monthly ledger reserves a conservative maximum before the provider call and settles to provider usage after success. Failed/ambiguous calls retain reservations to prevent overspend by retries. Metering uses conservative rates (defaults 3/10 USD per million input/output tokens), not a promise of exact invoice pricing. A provider-side budget and monitoring remain necessary. No prompts, media, tokens or keys enter technical ledger/logs.

Data deletion removes AI profile, plans, messages, progress, shared summaries, food and feedback. It does not cancel a paid subscription or delete accounting/entitlement records; Portal cancellation is a separate user action. Minimal pseudonymous request counts and monthly technical cost entries survive deletion to prevent reset abuse. OpenAI `store:false` is not a zero-retention guarantee.

## Verification and release

Provider HTTP failures are classified as quota, authentication, permissions, temporary rate limit or unavailable. A quota failure does not instruct users to repeatedly retry. Operational logs contain only an allowlisted error code, HTTP status and a bounded provider request ID; raw error messages/body, keys and personal content are excluded. The October 4 real request check reached the provider but failed on quota/account limits; resolve API Billing/limits before acceptance or publication.

`npm run check`: syntax, existing voice tests and AI/paid tests. `npm run deploy:dry`: required non-publishing build check. On Windows use `npm.cmd`. Run both `scripts/ai-rls.test.sql` and `scripts/ai-paid-rls.test.sql` with administrator credentials; fixtures roll back. Mock tests and successful configuration booleans do not establish live AI quality, transcription/search, real payments or medical reliability.

Before live collection: verify actual provider responses, training plan/time/allergy checks, real search citations and voice transcription; Stripe sandbox Checkout → webhook → entitlement → renewal/failure/cancellation/refund/dispute → Portal; account switch/privacy and mobile controls. Complete merchant/tax/refund readiness, then save/merge the reviewed PR and deploy only through `npm.cmd run deploy` on clean main matching origin/main. Never bypass `scripts/safe-deploy.mjs` or publish a paid offer just because mock tests pass.

Calendar export creates a weekly local-time schedule (default 18:00) with a 15-minute calendar reminder; the user must import it. This is not background push/email automation. Video frames do not replace a human trainer. No claim of an ideal, medically validated or unlimited AI product is warranted.
