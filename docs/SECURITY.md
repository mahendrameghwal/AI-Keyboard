# Security — AI Keyboard

Maps to SRS §16, plan Phase 8, and NFR-05/06. Mobile items are marked **planned** when they belong to the
native keyboard (plan Phase 2), which is not implemented yet; the Expo companion app in `mobile/` does exist
and its controls are described where they are implemented.

## Provider keys (BYOK)

- The user's provider key arrives per request in `X-Provider-Key`, is copied to `req.providerKey`, and
  lives only for that request. It is never written to the database, `usage_events`, analytics or cache.
- The backend forwards it to the provider in a header only: `Authorization` (OpenAI), `x-goog-api-key`
  (Gemini — never the `?key=` query form), `x-api-key` (Anthropic). A URL query key would land in
  upstream logs; `tests/unit/providers.test.ts` asserts the header form and that the URL has no `key=`.
- **The backend is not zero-knowledge.** User text and the key transit it. This is disclosed in-app and
  in the privacy policy (plan D1) — disclosure is required before any store submission.

## Logging

`api/src/middleware/requestLogger.ts` emits exactly one allowlisted line per request:
`requestId, method, path, status, durationMs, ip`. Bodies, headers and query strings are excluded by
construction; `req.path` rather than `req.originalUrl` prevents a key smuggled into a query string from
being logged. `pino-http`'s default serializers are deliberately not used. As defense in depth the
logger redacts `authorization`, `x-provider-key`, `set-cookie`, and any nested `password`, `apiKey`,
`api_key`, `providerKey` or `refreshToken` field.
Covered by `tests/unit/requestLogger.test.ts` and the `/v1/ai/*` assertions in
`tests/integration/security.test.ts`.

## Transport, surface and input hardening

- `helmet()` (HSTS, nosniff, frameguard) on every response.
- CORS denies all origins unless explicitly listed in `CORS_ORIGINS` — mobile-only clients.
- JSON body cap `MAX_REQUEST_BODY_BYTES` (64 KB) answered with `413 REQUEST_TOO_LARGE`, and malformed
  JSON with `400 VALIDATION_ERROR` rather than a 500 from the body parser; text caps 8 000 chars
  (12 000 for `summarize`); custom instructions ≤ 10 × 300 chars; strict Zod schemas reject unknown keys.
- `trust proxy` comes from `TRUST_PROXY` (default 1 hop). Behind Cloudflare in front of Render the
  deployment value is 2 — the rate limiter and logs key on `req.ip`, so one hop too few makes every
  visitor share the proxy's IP and one hop too many lets `X-Forwarded-For` be spoofed.
- No provider call from `/v1/health/ready`, so readiness cannot be used to probe keys.

## Credentials and sessions

- Passwords: Argon2id, m=19456 KiB / t=2 / p=1 (OWASP baseline), via `@node-rs/argon2`.
- Access: JWT, 15 min, HS256 (`jose`), validated against the session row so revocation is immediate.
- Refresh: opaque, rotated on every use, stored hashed; family reuse revokes the whole family, with a
  60 s grace window for concurrent refreshes. Reuse is asserted in
  `tests/integration/auth.test.ts`.
- `JWT_SECRET` has a development default, and `parseEnv` refuses to start the process with it (or with
  any secret under 32 characters) when `NODE_ENV=production`; see
  [docs/security/secrets-inventory.md](security/secrets-inventory.md) for the full inventory.
- `POST /v1/auth/login` verifies the password against a real hash or a boot-time dummy hash when the
  account does not exist, so a missing account costs the same Argon2 work as a wrong password.
- Tradeoff, accepted deliberately: `POST /v1/auth/register` answers `409 EMAIL_ALREADY_EXISTS`, which does
  let anyone test whether an address has an account. Login itself stays generic (`401 INVALID_CREDENTIALS`
  for both wrong email and wrong password). Accounts only hold preference-sync data, and the 5/minute
  register cap bounds bulk probing. If this ever matters, the fix is verification-before-creation, which
  needs email infrastructure the MVP does not have.

## Abuse control without accounts

Anonymous `generate` is allowed by design (plan D4) and governed by per-IP limits: 30/h anonymous,
120/h with a valid access token, 10/h for `providers/test`, 5/min auth attempts, and 60/min for
`refresh`/`logout` so token guessing is capped without throttling normal app traffic. Rejections are
`429 RATE_LIMITED` with `Retry-After`. Counter state is in-process — acceptable for one instance; move
to a shared store before horizontal scaling. IP reputation/attestation is the recorded escalation path
if limits prove insufficient.

## Sensitive-field rules (keyboard, **planned**)

AI must never fire automatically on secret entry, and no keystroke is ever transmitted — a request is
only built when the user explicitly picks an action on selected or committed text (SRS §16.2).

Detection before showing the AI toolbar:

| Platform          | Signal                                                                                                                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Android           | `EditorInfo.inputType` ∈ `TYPE_TEXT_VARIATION_PASSWORD`, `…_VISIBLE_PASSWORD`, `…_WEB_PASSWORD`, `TYPE_NUMBER_VARIATION_PASSWORD`; `IME_FLAG_NO_PERSONALIZED_LEARNING`; `PRIVATE_ACTION_SEND`/`AUTOFILL` hints; `FLAG_IMMUTABLE` OTP-style fields |
| iOS               | `textContentType` ∈ `.password`, `.oneTimeCode`, `.username`; `isSecureTextEntry`; autofill heuristics                                                                                                                                            |
| Heuristics (both) | field label/placeholder matches `pass(word)?                                                                                                                                                                                                      | otp | pin | cvv | card | security code | 2fa | token`; 4–8 digit numeric-only input after an "OTP"/"code" label |

Behaviour: matched fields disable the AI toolbar and grey out actions with the reason shown. An explicit
override exists (plan D9) that states the text will be sent to the user's own provider through the
backend, and must be confirmed each session rather than remembered permanently.

## Retention and deletion

- Sessions: hard-deleted once past `expiresAt` by the hourly pruning job.
- `usage_events`: deleted once past `USAGE_EVENT_RETENTION_DAYS` (90) by the same sweep, so metrics do
  not grow without bound on a free-tier database.
- Account deletion: `DELETE /v1/users/me` revokes all sessions immediately and schedules the purge
  +30 d. The worker removes the user row and cascades sessions, devices, preferences and the job row.
  `usage_events` survive with `userId` set to `NULL` (`ON DELETE SET NULL`) and never contained text.
- Verifications: `tests/integration/retention.test.ts` (cascade, idempotency, due-vs-future jobs,
  end-to-end schedule → purge) and the cross-user isolation cases in `auth.test.ts`.

## Outstanding before release

Mobile-side controls (secure storage, Full-Access disclosure, no-keystroke verification), device matrix
testing, dependency/SAST gating on a non-empty mobile tree, and the Phase 9 load/chaos suites.
