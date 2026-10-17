# API Reference — AI Keyboard backend

Canonical machine-readable contract: [`shared-contracts/openapi.yaml`](../shared-contracts/openapi.yaml).
The endpoint inventory below is enforced by `api/tests/contract/openapi.test.ts`, which fails if the
spec and the routed Express app drift apart.

## Conventions

- Base URL: `https://<host>` — all routes are absolute (`/v1/...`), no mount prefix.
- Content type: `application/json`. Request bodies are capped at `MAX_REQUEST_BODY_BYTES` (64 KB default).
- Every response carries `X-Request-Id` (echoed from the client when well-formed, otherwise generated).
- Strict Zod validation: unknown keys are rejected, empty input is rejected.
- Streaming is not part of the MVP: `options.stream: true` → `400 STREAM_NOT_SUPPORTED`.

## Endpoints

| Method | Path                        | Auth                                 | Notes                                                                                             |
| ------ | --------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| GET    | `/health`                   | none                                 | Liveness. Never touches dependencies.                                                             |
| GET    | `/v1/health/ready`          | none                                 | Readiness. Checks Postgres only, never a provider. `503` when degraded.                           |
| POST   | `/v1/ai/generate`           | `X-Provider-Key` (+ optional Bearer) | Text generation/transform. Rate tier depends on the access token.                                 |
| GET    | `/v1/ai/providers`          | none                                 | Server-maintained model catalog (see below).                                                      |
| POST   | `/v1/ai/providers/test`     | `X-Provider-Key`                     | Validates a provider key without generating. 10/h/IP.                                             |
| GET    | `/v1/ai/usage`              | optional                             | `{ enabled: false, events: [] }` while usage tracking is off (plan D11).                          |
| POST   | `/v1/auth/register`         | none                                 | Returns `user`, `accessToken`, `refreshToken`, `accessTokenExpiresIn`.                            |
| POST   | `/v1/auth/login`            | none                                 | Same payload as register.                                                                         |
| POST   | `/v1/auth/refresh`          | refresh token body                   | Rotates the pair; reuse revokes the whole token family.                                           |
| POST   | `/v1/auth/logout`           | Bearer                               | Revokes the current session.                                                                      |
| GET    | `/v1/users/me`              | Bearer                               | Profile.                                                                                          |
| DELETE | `/v1/users/me`              | Bearer                               | Schedules deletion (`scheduledFor` = +30 d) and revokes all sessions immediately.                 |
| GET    | `/v1/users/me/sessions`     | Bearer                               | Live sessions with device info.                                                                   |
| DELETE | `/v1/users/me/sessions/:id` | Bearer                               | Revokes one session.                                                                              |
| GET    | `/v1/sync/preferences`      | Bearer                               | Five synced fields + `version`.                                                                   |
| PUT    | `/v1/sync/preferences`      | Bearer                               | Requires the expected `version`; mismatch → `409 PREFERENCES_VERSION_CONFLICT` with server state. |

Removed from the original SRS scope: `verify-email`, `resend-verification`, `forgot-password`,
`reset-password`, and guest-token issuance.

## `POST /v1/ai/generate`

```jsonc
{
  "action": "rewrite", // fix | rewrite | shorten | expand | summarize | explain | continue | email | reply
  "text": "…", // ≤ 8000 chars (12000 for summarize)
  "provider": "openai", // openai | gemini | anthropic
  "model": "gpt-4o-mini", // must exist in the catalog and be active
  "settings": {
    "tone": "professional",
    "toneStrength": "balanced",
    "formality": "neutral",
    "length": "normal",
    "language": "en-IN",
    "stream": false,
  },
  "customInstructions": ["…"], // ≤ 10 items × 300 chars, local-only, never synced
}
```

Response: `{ requestId, success, provider, model, result | email, usage? }`. The `email` action
returns `email: { subject, body }` so the keyboard can insert them separately.

There is no `systemPrompt` field on the wire. Prompts are assembled server-side from the action, the
style/tone/formality/length/language settings and the caller's custom instructions.

## Error envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "…",
    "requestId": "…",
    "retryable": false,
    "details": {}
  }
}
```

| Code                                                                                                       | HTTP | Retryable            |
| ---------------------------------------------------------------------------------------------------------- | ---- | -------------------- |
| `VALIDATION_ERROR`                                                                                         | 400  | no                   |
| `STREAM_NOT_SUPPORTED`                                                                                     | 400  | no                   |
| `UNAUTHENTICATED` / `SESSION_EXPIRED` / `SESSION_REVOKED` / `REFRESH_TOKEN_REUSED` / `INVALID_CREDENTIALS` | 401  | no                   |
| `FORBIDDEN`                                                                                                | 403  | no                   |
| `NOT_FOUND`                                                                                                | 404  | no                   |
| `INVALID_PROVIDER_KEY` / `UNSUPPORTED_MODEL` / `MODEL_DEPRECATED` / `PROVIDER_CONTENT_BLOCKED`             | 422  | no                   |
| `PREFERENCES_VERSION_CONFLICT` / `EMAIL_ALREADY_EXISTS`                                                    | 409  | no                   |
| `REQUEST_TOO_LARGE`                                                                                        | 413  | no                   |
| `RATE_LIMITED` / `PROVIDER_RATE_LIMITED`                                                                   | 429  | yes (+`Retry-After`) |
| `EMPTY_RESPONSE`                                                                                           | 502  | yes                  |
| `PROVIDER_UNAVAILABLE`                                                                                     | 503  | yes                  |
| `PROVIDER_TIMEOUT`                                                                                         | 504  | yes                  |
| `INTERNAL_ERROR`                                                                                           | 500  | yes                  |

## Model catalog

`GET /v1/ai/providers` is the only source of model ids; clients must not embed lists
(plan §1.7). Each entry is `{ id, name, defaultModel, fallbackModel?, models[{id,status,capabilities}] }`.

- Built-in floor lives in `api/src/services/ai/modelCatalog.ts`.
- Set `MODEL_CATALOG_PATH` to a JSON file (`{ "providers": [...] }`) to replace it without a deploy;
  an invalid file is rejected and the last good catalog is kept.
- `MODEL_CATALOG_TTL_SECONDS` (default 3600) bounds how long a cached catalog is served before the
  source is re-read.
- `DISABLED_PROVIDERS=openai,gemini` hides a provider from the catalog and answers its generate and
  test calls with `503 PROVIDER_UNAVAILABLE` (kill switch).
- `defaultModelFor()` skips a deprecated default and uses `fallbackModel`.
- Requesting a model that is absent → `UNSUPPORTED_MODEL`; present but `deprecated` → `MODEL_DEPRECATED`.

## Rate limits

Per-IP fixed window, in-process (`api/src/middleware/rateLimit.ts`), which assumes a single backend
instance. All responses carry `X-RateLimit-Limit`, `-Remaining`, `-Reset`; rejections add `Retry-After`.

| Scope                          | Default    |
| ------------------------------ | ---------- |
| `generate`, anonymous          | 30 / hour  |
| `generate`, valid access token | 120 / hour |
| `providers/test`               | 10 / hour  |
| auth register/login            | 5 / minute |
