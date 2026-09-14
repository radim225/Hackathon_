# Security notes (P0)

These notes are for **Radim**. Rotate any credential that may have been exposed. Do **not** paste real key values into git, PRs, or chat.

## Immediate: revoke and rotate

Assume the following were exposed and **revoke/rotate them now** in each vendor console, then put the new values only in `.env.local` (never in source):

1. **Deepgram API key** — `GET /api/deepgram` previously returned `{ key: process.env.DEEPGRAM_API_KEY }` to any caller. Anyone who hit that route (or logs/proxies in front of it) has the key. Revoke it in the Deepgram console and create a new server-only key.
2. **Google Maps API key** — a Maps JavaScript API key was hardcoded in `src/components/GoogleMapsRouting.tsx`. It remains in git history on `main`. Restrict the replacement key by HTTP referrer in Google Cloud Console (and preferably also by API restriction to Maps JavaScript API only).
3. **OpenAI API key** — `next.config.mjs` rewrote `/api/:path*` to `https://api.openai.com/:path*`, creating an open path proxy to OpenAI. Rotate the OpenAI key if this app was deployed or the rewrite was reachable. Store the new key as `OPENAI_API_KEY` (server-only).
4. **Anthropic API key** (if one was configured for this app) — `/api/anthropic/chat` was unauthenticated. Rotate if it was ever set in a deployed environment.

After rotation, set:

- `API_SECRET` — long random string; required on LLM routes
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPGRAM_API_KEY` — server-only
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — browser Maps JS key, **referrer-restricted**

Copy `.env.example` to `.env.local`. `.gitignore` now blocks `.env*`.

## What changed in this fix

| Issue | Fix |
| --- | --- |
| Deepgram GET leaked the raw API key | GET is disabled (405). POST `/api/deepgram` transcribes **on the server** with `DEEPGRAM_API_KEY`. The browser never receives the key. |
| OpenAI rewrite proxy | `rewrites()` to `api.openai.com` removed from `next.config.mjs`. |
| Unauthenticated LLM routes | `/api/openai/chat`, `/api/openai/transcribe`, `/api/anthropic/chat` require `x-api-secret` or `Authorization: Bearer` matching `API_SECRET`. In-memory per-IP rate limit. User/assistant content is length-limited; client `system` roles are dropped. Errors do not echo upstream messages or secrets. |
| Hardcoded Maps key | Read from `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` only. |

## Calling the LLM routes

```http
POST /api/openai/chat
x-api-secret: <API_SECRET>
Content-Type: application/json

{"messages":[{"role":"user","content":"Hello"}]}
```

If `API_SECRET` is unset, these routes return **503** (fail closed).

## Residual risk

- Git history on `main` still contains the old Maps key string; rotation is required even after this PR merges.
- In-memory rate limits are per-process (not shared across serverless isolates). Use a shared limiter before production-scale traffic.
- `/api/replicate/generate-image` and `/api/save-trip` were out of scope for this P0 patch; treat them as unauthenticated until locked down.
