# FitGoIn AI

Adds a free, authenticated assistant to the existing FitGoIn site. Public files are `fitgoin-ai.js`, `fitgoin-ai-core.mjs` and `fitgoin-ai.css`. Backend code and SQL are never copied into `.deploy`.

## Server configuration

Use the existing Supabase project `ypbhcgcwkpiujcakvaji`. Add `OPENAI_API_KEY` in Supabase Dashboard → Edge Functions → Secrets. Enter it there, never in chat, frontend source, GitHub or a public environment file. The account needs an active API balance/billing and access to Responses, web search and Whisper transcription. Users of FitGoIn are not charged.

Optional secrets: `OPENAI_MODEL` and `OPENAI_SEARCH_MODEL` (default `gpt-4.1`), `AI_ALLOWED_ORIGINS` (default `https://fitgoin.com,https://www.fitgoin.com`). Supabase supplies its URL and server/public credentials. Legacy environment names and new key maps are supported.

Apply the recorded migrations `20261003091539_create_fitgoin_ai.sql` and `20261003093815_index_ai_messages_and_merge_share_read_policy.sql` from `supabase/migrations/`. Deploy `supabase/functions/fitgoin-ai/index.mjs` with the root `fitgoin-ai-core.mjs` as a relative dependency. The CLI working directory is the repository root. Gateway JWT verification is disabled because every POST is independently verified against Supabase Auth `/auth/v1/user`; the only unauthenticated action is GET readiness, exposing a configuration boolean and limits. Never remove this Auth check.

## Privacy and budgets

New tables and the `fgi-ai` photo bucket have owner RLS. Assistant messages and plans can only be written by the authenticated server flow. Immutable, explicit coach snapshots expire after 14 days in the UI (database maximum 30 days); coaches cannot read the source profile/history/photos. Source material and user fields are untrusted data. Search citations come from actual response annotations and require a completed web-search call.

The SQL budget gate serializes allocation: 30 requests/user/UTC day, three searches/user/day, five requests/minute and 300 requests/site/day. Automatic uncertainty-triggered search uses a separate generic query without profile/history, and atomically consumes a search allowance. Output tokens, audio length and input context are bounded. These controls bound use; they are not a currency spending cap. Set an appropriate provider project budget/alerts and monitor actual API costs before expanding capacity. There is no AI checkout or premium gate.

Deleting AI data does not delete the main FitGoIn account or regular trainer messages. Private photos are removed before database cleanup. Request text/results/hashes are removed; technical request IDs, owner ID and counts remain for quota enforcement until the next request prunes records older than 24h. If there are no subsequent requests, those technical records remain longer. OpenAI `store:false` does not guarantee zero provider retention. Private images are not sent to OpenAI. Short voice audio is used only for transcription and is not stored by FitGoIn.

## Verify and publish

Run `scripts/ai-rls.test.sql` as a database administrator to verify owner isolation, private photo policies, explicit/expired coach snapshots, browser write denial, quotas, idempotency and deletion. It uses temporary fixtures and rolls back all writes.

Run `npm.cmd run check` and `npm.cmd run deploy:dry` on Windows (use `npm run` on Linux). Publish the static site only through the repository's existing `npm.cmd run deploy` on clean, reviewed `main`. Do not use a direct production Wrangler deployment.

After a key is configured, test with a real signed-in, consenting test user: initial intake, weekly workout, shortening to 25 minutes, set logging/rest/resume, nutrition totals and allergies, explicit research search with visible links, an uncertain chat automatically switching to research, published coach matches, explicit snapshot consent/revocation, microphone transcription/review, export/deletion and sign-out clearing private content. GET configured=true only proves secrets exist; it does not prove the provider key, billing, model output or live search work. Mock tests do not replace this live acceptance test.

The first release intentionally does not advertise food-photo calorie recognition, video technique analysis, background listening, automatic push notifications or a medical capability. These require separate product work and validation.
