# Architecture — AI Keyboard

Requirements source of truth: [`AI Keyboard.md`](../AI%20Keyboard.md) (AIK-SRS-001).
Delivery source of truth: [`implementation-plan.md`](../implementation-plan.md).

## Shape

Three parts, one repository (plan D12):

| Part                | Status        | What it does                                                                                                                                                                                                                                                                                                  |
| ------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api/`              | implemented   | Express + TypeScript + Prisma/Postgres. Proxies AI provider calls, validates input, normalizes errors, optional accounts + preference sync.                                                                                                                                                                   |
| `shared-contracts/` | implemented   | Canonical OpenAPI 3.1 spec and JSON schemas. Backend owns the spec; mobile consumes it.                                                                                                                                                                                                                       |
| `mobile/`           | Expo scaffold | Expo SDK 58 companion app (`com.aikeyboard`) plus the native keyboards it will carry (Kotlin `InputMethodService`, Swift `UIInputViewController`) as an Expo Module / generated native target. Builds go through EAS (plan D5), so no local JDK/Xcode is required; IME **verification** still needs a device. |

There is deliberately **no RN runtime inside the keyboard extension/IME**. The keyboards are native UI
that talk HTTP directly to the API and render results in a native preview panel (plan D6), which keeps
them inside the iOS extension memory budget (~30–50 MB).

The `shared-contracts` `ApiClient` is TypeScript, so it serves the Expo app only; the keyboards implement
the same OpenAPI contract in Kotlin and Swift. The contract is shared, the code is not.

## Request path (AI)

```
keyboard UI → native HTTP client → POST /v1/ai/generate (X-Provider-Key)
   → requestId → allowlisted access log → optionalAuthenticate (rate tier)
   → requireProviderKey → rateLimit → Zod validation
   → model catalog check → prompt construction (server-side)
   → provider adapter (OpenAI / Gemini / Anthropic) → response normalization
   → { result | email{subject,body} } → preview → insert / replace selection
```

The backend is **not** zero-knowledge: the user's provider key transits it per request (plan D1) and is
disclosed in-app. It is request-scoped — read into `req.providerKey`, never logged, never persisted,
never written to `usage_events`.

## Provider adapters

`AIProvider` (`api/src/services/ai/AIProvider.ts`) is the only interface the controllers know:

```ts
(providerId, displayName);
generate(request, apiKey); // model, systemPrompt, userText, temperature, maxOutputTokens, signal
validateCredentials(apiKey);
```

`ProviderRegistry` maps ids to adapters; model ids/status live in `modelCatalog.ts` instead, so adding
or deprecating a model is a config change rather than a client release. Every adapter:

- sends the key in a header (`Authorization`, `x-goog-api-key`, `x-api-key`) — never in a URL;
- is constructed with an injectable `fetch` so tests can assert mapping without network;
- maps upstream failures to canonical codes (`providerErrors.ts`) and honours an `AbortSignal`
  combining client disconnect and `PROVIDER_TIMEOUT_MS`. No automatic retry, no fallback provider.

## Auth and sessions

Accounts are optional and exist only for sync (plan D4). Tokens:

- **Access**: JWT (`jti`-equivalent `sid`), 15 min TTL, HS256 via `jose`. Verified against the session
  row so revocation takes effect immediately, not at expiry.
- **Refresh**: opaque, rotating, stored hashed. Idle TTL 7 d, absolute ceiling 30 d measured from
  `sessions.familyStartedAt`. Every refresh issues a new pair and revokes the old row.
- **Reuse detection**: presenting a revoked token revokes the whole `tokenFamilyId`. A 60 s grace
  window tolerates two concurrent refreshes from the same device before the family is burned.
- **Logout** revokes the session; `DELETE /v1/users/me/sessions/:id` revokes any single one.

`Argon2id` for passwords (m=19456 KiB, t=2, p=1 — OWASP baseline, revisited in Phase 8).

## Sync

Only five fields are server-side: `writingStyle`, `toneStrength`, `formality`, `defaultLength`,
`language` (plan D7), versioned in `user_preferences.version`. `PUT` requires the expected version;
on mismatch the API returns `409` with the server state and the client re-bases. Custom instructions,
API keys and message history never leave the device.

## Data

Prisma schema in `api/prisma/schema.prisma`, migrations in `api/prisma/migrations`.
`users` → `sessions` / `devices` / `user_preferences` / `account_deletion_jobs` / `usage_events`,
all `ON DELETE CASCADE` except `sessions.deviceId` (`SET NULL`). `usage_events` exists but is unused
while `USAGE_TRACKING_ENABLED=false`, and never stores message text.

## Background jobs

`api/src/workers/backgroundJobs.ts` runs an in-process loop every
`BACKGROUND_JOBS_INTERVAL_MINUTES` (default 60):

1. `pruneExpiredSessions()` — hard-deletes session rows past `expiresAt`. Revoked-but-unexpired rows
   stay, because the refresh grace window reads them.
2. `processDueJobs()` — claims `account_deletion_jobs` whose `scheduledFor` has passed, purges the user
   (cascade removes sessions, devices, preferences and the job row itself), retries up to 5 times.

Started from `server.ts` and stopped on `SIGTERM`/`SIGINT`. Single-instance assumption, like the
in-memory rate limiter: move both to a shared store or external scheduler before scaling out.

## Known single-instance constraints

- Rate-limit counters live in process memory.
- Background jobs would double-run under multiple replicas.
- `JWT_SECRET` default (`change-me-in-production`) must be overridden before any deployment.
