# FitGoIn — AI model and monetization decision (30 October 2026)

## User-selected product direction

- Continue the **existing** FitGoIn product and its AI Trainer & Assistant. Preserve existing user memory, workouts, nutrition, progress, coach search, and MATCH.
- Use **GPT-6 Luna** for routine AI conversation and high-volume lightweight answers.
- Use **GPT-6.1 Terra** for complex or structured training/nutrition plans, sensitive technical validations, exercise substitutions, and web research.
- Give the user a single seamless AI Trainer experience; routing happens securely on the backend.
- **Latest trial decision (30 October 2026): 7 days free, 1,000,000 total input+output tokens for the whole trial period per user** (including system instructions, memory and retransmitted conversation context). No daily token reset or daily token cap is requested: the shared weekly allowance decreases with each AI call and expires at the end of the 7-day trial. This replaces the 100,000 tokens/day and 10,000 tokens/day proposals. This remains a future server-side implementation requirement, **not yet enabled on production**. Count usage with server-confirmed OpenAI tokens, reserve expected tokens/cost before parallel calls, warn near exhaustion, and avoid any unbounded free trial API spending. Trial should primarily use Luna; allow Terra only for bounded complex tasks. At a 50/50 input/output split, 1,000,000 tokens across the week would cost about **$0.30 using Luna** or **$3.00 using Terra**, excluding web search and other tool costs. Real costs vary with token direction and per-model routing; a separate monetary safety cap must be validated before launch. Legacy request/day caps and paid access gates also need coordinated migration before claiming this trial is operational.
- **Owner-selected starting prices (30 October 2026): AI Pro €19.90/month and AI Premium €24.90/month** (includes internet search); these replace the earlier €24.90/€29.90 proposal. No unlimited-use promise; the prices are not yet activated in Stripe or production.
- Business requirement: a target **maximum of $10 in total OpenAI costs per paid user per month** (model tokens and web-search fees together), enforced server-side before usage can accrue. The existing shipped caps are different and should not be silently relabeled as $10.
- Proposed Premium web-search cap: **up to 100 searches/month**, provided the overall $10 cost budget permits them.
- Business strategy: commissions on trainer bookings plus AI subscriptions, with one French enterprise envisioned for FitGoIn and subsequent software projects.

## Suggested feature separation after owner discussion (30 October 2026)

**Owner requirement:** During the 7-day trial, do **not** generate personalized nutrition programs; all main training, nutrition, progress, and vetted-source internet research features must be available in AI Pro. Separate AI Premium only by additional advanced value, not by withholding essential trainer features from Pro.

**Recommended product design — pricing and feature boundaries pending full implementation:**

- **Trial (free, 7 days, 1,000,000 combined tokens across the week):** AI chat, general sport/technique and nutrition explanations, product guidance and profile onboarding. **No individualized training or nutrition program generation, no paid web research, no photo/video AI analysis.** Public marketplace coach search remains available independently of AI subscription.
- **AI Pro — €19.90/month:** All ordinary AI Trainer & Assistant features: personalized training plans, personalized nutrition plans, adaptation via chat, memory, workout/progress tracking, and reliable, cited scientific and public-health web research using the existing allowlist (WHO, NHS, PubMed, etc.). **Proposed fair-use research allowance: up to 30 searches per month.** The research count may correspond to more than one billable tool call per question; monitor actual costs.
- **AI Premium — €24.90/month:** Everything in Pro plus advanced food-photo assessment, exercise technique assessment from selected photos/video frames, deeper progress reports, and **proposed up to 100 verified research searches per month**. These advanced capabilities require real quality/privacy and cost checks before they can be advertised as fully functional.
- The overall maximum OpenAI spending target remains **$10 per paying user per month**, including both tokens and web-search calls. Consider a lower budget tier for Pro, but **do not silently change existing live spending caps**. There must be clear, non-misleading usage/expense thresholds rather than unlimited-access claims.
- **This is a planned offer, not published billing or a production entitlement change.** The currently deployed Stripe pricing, trial mechanics, and AI function gates are unchanged; verify consumer terms, cancellation, testing, tax and provider setup before enabling automatic charges.

## Implementation status

This branch proposes server-side Luna/Terra routing, request-specific metering, conservative price protection, and automated regression tests. **It is not a claim of deployment to production.**

The active paid-access database, trial/billing model, existing €20/€10/€30 product structure, $5–7 user budgets, $20 site default budget, and Stripe readiness gates remain unchanged. Before enabling new plans, implement/verify subscriptions, exact budget reservation and real OpenAI API calls, mobile onboarding, consent, cancellation and taxes.

## Safety and release requirements

- Validate OpenAI API availability for the account, correct JSON schema replies, program and nutrition semantic validation, web citations, reasoning output, cost accounting and rollback behavior.
- Confirm GitHub Actions tests pass, then follow the project's safe release process. The authorized desktop is currently offline and cannot run the full deployment gate.
- Never expose OpenAI keys or change Stripe's live billing without verified commercial readiness.
