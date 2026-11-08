# Self-hosted translator on Windows (development / temporary hosting)

This runbook records the *tested* path on a 64-bit Windows 11 machine with 16 GB
RAM and no Docker/WSL. For reliable production hosting prefer the Linux Docker
deployment in `README.md`; a desktop stops translating when it sleeps or
disconnects. Do not publish the translation service before Cloudflare DNS, TLS,
server authentication, Supabase secrets and two-user smoke tests are complete.

## Verified installation

- Install Python 3.11 in the user's profile.
- Create a dedicated virtual environment, install `libretranslate==1.9.6`
  and `msvc-runtime==14.44.35112` (no administrator rights needed).
- Windows' Microsoft Visual C++ DLLs are not always installed. A
  `sitecustomize.py` inside **this venv only** can call
  `import os,sys; vc_runtime_path=os.add_dll_directory(sys.prefix)` to make
  locally installed DLLs available. Keep the handle referenced for the process
  lifetime; do not alter the machine-wide Python or PATH.
- Install official Argos language packages through
  `argostranslate.package.get_available_packages()`, each
  `pkg.download()` and `package.install_from_path(filename)`. For nine
  languages, use both directions en↔fr, en↔ru, en↔uk, en↔de, en↔es, en↔it,
  en↔pt, en↔pl (16 installed packages). All translation uses local model
  inference, sometimes pivoting via English.
- Run bound to localhost **only** (example):
  `libretranslate --host 127.0.0.1 --port 5000 --load-only en,fr,ru,uk,de,es,it,pt,pl --api-keys --require-api-key-secret --req-limit 0 --char-limit 4000 --disable-web-ui --disable-files-translation --api-keys-db-path <PRIVATE_DB>`
- Generate one secret API key with the local `libretranslate.api_keys.Database`
  and store it only in a directory with restricted NTFS permissions. Neither
  the key nor OAuth credentials should be put into Git, CLI logs or chat.
- **Observed locally**: /languages listed all nine languages; POST /translate
  without an API key returned 429; authenticated FR→RU, RU→FR, EN→UK, DE→FR,
  ES→RU and FR→PL returned 200 with nonempty model translations.

## Connecting FitGoIn safely

- Authorize Cloudflare Tunnel with `cloudflared tunnel login` and select
  **fitgoin.com** in the browser. The account certificate is sensitive.
- Create a persistent **named** tunnel and public DNS hostname, e.g.
  `translate.fitgoin.com`, routing only to `http://127.0.0.1:5000`.
  Never expose port 5000 directly or use a temporary trycloudflare.com address
  as a production endpoint.
- In Supabase Edge Function Secrets create `FGI_TRANSLATE_URL` (HTTPS
  hostname) and `FGI_TRANSLATE_API_KEY` (private local key). Their values must
  remain server-only. Do not call OpenAI or Microsoft for chat translation.
- Deploy the draft `fitgoin-chat-translate` Edge Function **after** both
  secrets and HTTPS reachability are confirmed. Retain auth/RLS access checks
  and message cache. Then smoke-test two actual user accounts in both
  directions, including cached reads and service failure fallback.
- Windows can auto-start translator+tunnel at account logon, but it will still
  stop during sleep, shutdown or loss of internet. Do not claim 24/7 reliability.

## Current status

Installation and protected local inference tested. Cloudflare Tunnel login
requires the account owner's browser authorization. Production Supabase and
message database have not been switched to this draft.
