# FitGoIn own translation service

FitGoIn client ↔ coach messages can be translated **without OpenAI, Microsoft
Translator, Google Translate or public translation mirrors**. This is
LibreTranslate v1.9.6 using local Argos models. The software has no monthly
character quota; server resources and reasonable anti-abuse limits still apply.

**Status:** Code and deployment recipe only. The service is **not running in
production** until an always-on host, DNS, TLS, API key and tests are ready.
Do not switch the production Supabase function until then. Keep the original
messages available even when translation is down.

## Where to run it

Use an always-on Linux server or an authorized always-on computer with Docker.
The site is Cloudflare Workers and the backend is Supabase Edge Functions;
neither is suitable for running this Python/ML inference server continuously
within their standard function limits. Server hosting/networking may cost money.

## Deployment

1. Provide Linux Docker Engine + Docker Compose, sufficient RAM/disk for the
   selected language packages, open TCP 80/443 for Caddy and a DNS A/AAAA
   record for a dedicated hostname e.g. `translate.fitgoin.com`.
2. Copy `compose.yaml` and `Caddyfile` into a secure directory on that host;
   create a local untracked `.env` containing only
   `TRANSLATE_HOSTNAME=translate.fitgoin.com`.
3. Run `docker compose up -d`, inspect `docker compose logs --tail=60`, and
   wait for model downloads and `docker compose ps` health status.
   Never publish the internal port 5000; Caddy terminates HTTPS on 443.
4. Generate a private API key **inside the server container**:
   `docker compose exec libretranslate ltmanage keys add 120`.
   The key is a secret; do not paste it into GitHub, messages, screenshots,
   browser code or logs. Configure an appropriate per-key request rate.
5. Confirm `https://translate.fitgoin.com/health` returns success. From a
   trusted terminal, test **POST** `https://translate.fitgoin.com/translate`
   with a short French → Russian example and the private key (for instance
   via an interactive REST client that doesn't save credentials to shell history).
   Verify language detection and RU/FR/EN/UK conversions; review quality.
6. In **Supabase Edge Function Secrets** set exactly:
   `FGI_TRANSLATE_URL=https://translate.fitgoin.com`
   and `FGI_TRANSLATE_API_KEY=<key from step 4>`.
   Never put these into the frontend. This replaces the old chat-specific
   OpenAI translation dependency (AI Trainer keeps its own API credentials).
7. Deploy `supabase/functions/fitgoin-chat-translate/index.mjs` together
   with `fitgoin-chat-translation-core.mjs` as dependencies. Keep
   `verify_jwt=false` because the function explicitly validates the user's
   JWT against `/auth/v1/user` and checks chat message RLS before translation.
8. Verify as **two actual authenticated users**: one sends a French message,
   the other sees a Russian translation; reversing language works. Confirm
   originals can be viewed, saved translations are cached and no secret/API
   requests occur in the browser; check Supabase logs and quotas. Only then
   consider the feature launched.

## Security and cost

- Caddy restricts public routing to `POST /translate` and `GET /health`.
- The LibreTranslate service requires its **private API key**. `LT_REQ_LIMIT=0`
  intentionally rejects unauthenticated requests; `ltmanage keys add 120`
  creates a controlled-rate key. Keep the key confined to the Supabase server.
- Cloudflare/Supabase transmit private messages only to this FitGoIn-controlled
  instance over HTTPS after a participant-visibility check; messages remain
  in Supabase, not in LibreTranslate. Monitor and disable access/logging that
  could accidentally store request bodies.
- No external per-character billing and no monthly 2M-character quota.
  Existing user anti-abuse safety limit (120 newly translated messages per
  UTC day) still applies, separate from the old Microsoft quota.
- Translations already saved in `fgi_message_translations` are reused; no
  rerun on each page load.
- The URL is a server secret and must use HTTPS. A missing or unreachable
  translator fails closed with original text preserved; it never falls back
  to OpenAI, Microsoft or public mirrors.
- Start with `en,fr,ru,uk,de,es,it,pt,pl`; more languages need installed
  Argos model packages, capacity checks and actual translation tests.

Official reference: https://docs.libretranslate.com/guides/installation/
API: https://docs.libretranslate.com/guides/api_usage/
