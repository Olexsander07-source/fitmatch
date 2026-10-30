# FitGoIn — AI model and monetization decision (30 October 2026)

## User-selected product direction

- Continue the **existing** FitGoIn product and its AI Trainer & Assistant. Preserve existing user memory, workouts, nutrition, progress, coach search, and MATCH.
- Use **GPT-6 Luna** for routine AI conversation and high-volume lightweight answers.
- Use **GPT-6.1 Terra** for complex or structured training/nutrition plans, sensitive technical validations, exercise substitutions, and web research.
- Give the user a single seamless AI Trainer experience; routing happens securely on the backend.
- **Updated trial decision (30 October 2026): 7 days free, 100,000 total input+output tokens per user per day** (system and repeated conversation context included); reset daily. This replaces the prior 10,000 tokens/day proposal. The limit remains a future server-side implementation requirement, not a live setting. Trial should use Luna for normal conversation; Terra only for complex tasks within separate cost guardrails. At a 50/50 input/output split, 100,000 tokens/day cost about **$0.03 with Luna** or **$0.30 with Terra**, $0.21/$2.10 over 7 days, excluding other tool costs.
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
