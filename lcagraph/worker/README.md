# lcagraph-beta Worker

The only server-side piece of LCA Graph: a Cloudflare Worker that holds the OpenRouter key,
checks beta access codes, caps daily usage and forwards prompts. The site itself stays on
GitHub Pages.

## One-time setup

```
cd lcagraph/worker
npx wrangler login                          # opens a browser
npx wrangler kv namespace create BETA       # paste the printed id into wrangler.jsonc
npx wrangler secret put OPENROUTER_API_KEY  # prompts for the key
npx wrangler secret put BETA_MASTER_CODE    # a long random string you keep for yourself
npx wrangler deploy
```

`wrangler deploy` prints the `*.workers.dev` URL. Put it in `lcagraph/app/beta.html` as `WORKER_URL`.

## Beta codes

One code per person, stored in KV, so each can be capped and revoked:

```
npx wrangler kv key put --binding BETA "code:<random-code>" '{"name":"Jane Doe","expires":"2026-12-31","dailyCap":40}' --remote
npx wrangler kv key list --binding BETA --prefix "code:" --remote      # who has access
npx wrangler kv key list --binding BETA --prefix "use:" --remote       # usage today and yesterday
npx wrangler kv key delete --binding BETA "code:<random-code>" --remote  # revoke
```

Generate a code with `node -e "console.log(require('crypto').randomBytes(12).toString('base64url'))"`.

## Local development

```
cp .dev.vars.example .dev.vars   # fill in the key and a master code
npx wrangler dev                 # http://127.0.0.1:8787, local KV simulation
curl -X POST http://127.0.0.1:8787/verify -H "Content-Type: application/json" -d "{\"code\":\"<master code>\"}"
```

## Guards, in order

1. CORS: only origins listed in `ALLOWED_ORIGINS` can call it from a browser.
2. Access code: `X-Beta-Code` header (or `code` in the `/verify` body) must match a KV row or the master secret.
3. Daily caps: per code (`DAILY_CAP_PER_CODE` or the row's `dailyCap`) and global (`DAILY_CAP_GLOBAL`).
4. Prompt size: `MAX_PROMPT_CHARS`.
5. OpenRouter's own spending limit on the key.
