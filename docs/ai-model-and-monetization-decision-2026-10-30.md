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

## Implementation status

This branch proposes server-side Luna/Terra routing, request-specific metering, conservative price protection, and automated regression tests. **It is not a claim of deployment to production.**

The active paid-access database, trial/billing model, existing €20/€10/€30 product structure, $5–7 user budgets, $20 site default budget, and Stripe readiness gates remain unchanged. Before enabling new plans, implement/verify subscriptions, exact budget reservation and real OpenAI API calls, mobile onboarding, consent, cancellation and taxes.

## Safety and release requirements

- Validate OpenAI API availability for the account, correct JSON schema replies, program and nutrition semantic validation, web citations, reasoning output, cost accounting and rollback behavior.
- Confirm GitHub Actions tests pass, then follow the project's safe release process. The authorized desktop is currently offline and cannot run the full deployment gate.
- Never expose OpenAI keys or change Stripe's live billing without verified commercial readiness.
