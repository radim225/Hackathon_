# Security notes

These notes are for **Radim**. Rotate any credential that may have been exposed. Do **not** paste real key values into git, PRs, or chat.

## Immediate: revoke and rotate

Assume the following were exposed. **Revoke/rotate them now** in each vendor console, then put the new values only in `.env.local` (never in source):

1. **Deepgram API key** — `GET /api/deepgram` previously returned `{ key: process.env.DEEPGRAM_API_KEY }` to any caller. Anyone who hit that route (or logs/proxies in front of it) has the key. Revoke it in the Deepgram console and create a new **server-only** key.
2. **Google Maps API key** — a Maps JavaScript API key was hardcoded in `src/components/GoogleMapsRouting.tsx`. It remains in git history on `main`. Create a new key, restrict it by **HTTP referrer** in Google Cloud Console (and preferably also by API restriction to Maps JavaScript API only), and set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
3. **OpenAI API key** — `next.config.mjs` rewrote `/api/:path*` to `https://api.openai.com/:path*`, creating an open path proxy to OpenAI. `/api/openai/chat` and `/api/openai/transcribe` were also unauthenticated. Rotate `OPENAI_API_KEY` if this app was deployed or those paths were reachable. Store the new key as server-only `OPENAI_API_KEY`.
4. **Anthropic API key** (if one was configured) — `/api/anthropic/chat` was unauthenticated. Rotate if it was ever set in a deployed environment.
5. **Replicate API token** (if one was configured) — `/api/replicate/generate-image` was unauthenticated. Rotate if it was ever set in a deployed environment.
6. **`API_ROUTE_SECRET`** — set a new high-entropy server-only secret for protected `/api/*` routes. Do **not** prefix it with `NEXT_PUBLIC_`.

After rotation, copy `.env.example` → `.env.local` and set:

- `API_ROUTE_SECRET` — long random string; required on paid API routes (or use a signed-in Firebase ID token)
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPGRAM_API_KEY`, `REPLICATE_API_TOKEN` — server-only
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — browser Maps JS key, **referrer-restricted**

`.gitignore` blocks `.env*`. Never commit `.env.local`.

## What changed in this fix

| Issue | Fix |
| --- | --- |
| Deepgram GET leaked the raw API key | GET is disabled (405). Authenticated `POST /api/deepgram` mints a **30-second** Deepgram JWT via `/v1/auth/grant`. The master `DEEPGRAM_API_KEY` never leaves the server. Middleware still requires auth. |
| OpenAI rewrite proxy | `rewrites()` to `api.openai.com` removed from `next.config.mjs`. |
| Unauthenticated LLM / image routes | `/api/openai/chat`, `/api/openai/transcribe`, `/api/anthropic/chat`, `/api/replicate/generate-image`, and `/api/deepgram` require `x-api-secret` or `Authorization: Bearer` matching `API_ROUTE_SECRET`, or a valid Firebase ID token. In-memory per-IP rate limit. Client `system` / `tool` roles are dropped; only `user` and `assistant` are forwarded. |
| Hardcoded Maps key | Read from `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` only. |

## Calling protected routes

```http
POST /api/openai/chat
x-api-secret: <API_ROUTE_SECRET>
Content-Type: application/json

{"messages":[{"role":"user","content":"Hello"}]}
```

If neither `API_ROUTE_SECRET` nor Firebase project ID is configured, these routes return **503** (fail closed). Unauthenticated calls return **401**. `GET /api/deepgram` must never include a `key` field.

## Residual risk

- Git history on `main` still contains the old Maps key string; rotation is required even after this PR merges.
- In-memory rate limits are per-process (not shared across serverless isolates). Use a shared limiter before production-scale traffic.
- `/api/save-trip` remains unauthenticated for the hackathon demo (rate-limited only).
