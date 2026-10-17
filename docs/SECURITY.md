# Security — AI Keyboard

Maps to SRS §16, plan Phase 8, and NFR-05/06. Where an item is mobile-side it is marked **planned** —
the `mobile/` workspace does not exist yet, so those controls are specified here and implemented in
Phases 2/4/6.

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
being logged. `pino-http`'s default serializers are deliberately not used.
Covered by `tests/unit/requestLogger.test.ts` and the `/v1/ai/*` assertions in
`tests/integration/security.test.ts`.

## Transport, surface and input hardening

- `helmet()` (HSTS, nosniff, frameguard) on every response.
- CORS denies all origins unless explicitly listed in `CORS_ORIGINS` — mobile-only clients.
- JSON body cap `MAX_REQUEST_BODY_BYTES` (64 KB); text caps 8 000 chars (12 000 for `summarize`);
  custom instructions ≤ 10 × 300 chars; strict Zod schemas reject unknown keys.
- `trust proxy` is set to one hop; rate-limit identity therefore depends on running behind the HTTPS
  ingress only, with no untrusted proxies in front.
- No provider call from `/v1/health/ready`, so readiness cannot be used to probe keys.

## Credentials and sessions

- Passwords: Argon2id, m=19456 KiB / t=2 / p=1 (OWASP baseline), via `@node-rs/argon2`.
- Access: JWT, 15 min, HS256 (`jose`), validated against the session row so revocation is immediate.
- Refresh: opaque, rotated on every use, stored hashed; family reuse revokes the whole family, with a
  60 s grace window for concurrent refreshes. Reuse is asserted in
  `tests/integration/auth.test.ts`.
- `JWT_SECRET` has a development default and **must** be replaced per environment; see
  [docs/security/secrets-inventory.md](security/secrets-inventory.md) for the full inventory.

## Abuse control without accounts

Anonymous `generate` is allowed by design (plan D4) and governed by per-IP limits: 30/h anonymous,
120/h with a valid access token, 10/h for `providers/test`, 5/min auth attempts. Rejections are
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
- Account deletion: `DELETE /v1/users/me` revokes all sessions immediately and schedules the purge
  +30 d. The worker removes the user row and cascades sessions, devices, preferences and the job row.
  `usage_events` survive with `userId` set to `NULL` (`ON DELETE SET NULL`) and never contained text.
- Verifications: `tests/integration/retention.test.ts` (cascade, idempotency, due-vs-future jobs,
  end-to-end schedule → purge) and the cross-user isolation cases in `auth.test.ts`.

## Outstanding before release

Mobile-side controls (secure storage, Full-Access disclosure, no-keystroke verification), device matrix
testing, dependency/SAST gating on a non-empty mobile tree, and the Phase 9 load/chaos suites.
