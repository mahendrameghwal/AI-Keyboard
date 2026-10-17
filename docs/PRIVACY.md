# Privacy — AI Keyboard

Applies to SRS §16 and plan decisions D1–D11. Mobile disclosure screens are **planned** (Phase 6/8);
the backend behaviour described here is what is implemented today.

## What the service is

BYOK: the user supplies their own AI provider key. The backend is a proxy that validates the request,
builds the prompt and forwards the text plus the key to the chosen provider.

**The backend is not zero-knowledge.** User text and the provider key pass through our servers. This is
a deliberate trade-off of D1 (hides provider APIs from the keyboard process, allows uniform validation
and error handling, keeps abuse control server-side) and it **must be disclosed in-app and in the store
listings before beta**.

## What is stored

Only what an optional account needs:

| Stored                                                                                           | Purpose                                                              |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| email (lowercased), password hash (Argon2id), status, timestamps                                 | authentication                                                       |
| session rows: hashed refresh token, family id, expiry, `lastUsedAt`                              | rotation + revocation                                                |
| device rows: platform, optional name, `lastSeenAt`                                               | the sessions list the user manages                                   |
| preferences: `writingStyle`, `toneStrength`, `formality`, `defaultLength`, `language`, `version` | cross-device sync (D7)                                               |
| account deletion jobs: status, requested/scheduled times, attempts                               | the purge queue                                                      |
| `usage_events`: action, provider, model, token counts, latency                                   | schema exists, **unused** while `USAGE_TRACKING_ENABLED=false` (D11) |

## What is never stored

- **Message text.** Not in any table, not in logs, not in analytics. `usage_events` has no text column
  and never will.
- **Provider API keys.** Request-scoped only: `X-Provider-Key` → memory → provider header → discarded.
  Not persisted, not cached, not echoed in a response or error body.
- **Keystrokes.** Nothing leaves the device until the user explicitly requests an action; typing is
  entirely local and works offline (Phase 2).
- **Query strings, headers and bodies in logs.** The access logger emits only
  `requestId, method, path, status, durationMs, ip`.
- Custom instructions stay on the device (D7) — they are never synced, so a second device does not see
  them.
- No analytics SDK and no advertising identifiers in the MVP.

## Retention

- Access tokens: 15 minutes. Refresh tokens: 7 days idle / 30 days absolute per family.
- Session rows are hard-deleted once past `expiresAt` by the pruning job (hourly by default).
- Preferences live as long as the account.
- Account deletion: `DELETE /v1/users/me` revokes every session immediately and purges the user, their
  sessions, devices, preferences and deletion jobs after the 30-day grace window. Any usage events keep
  no user link (`userId` set to `NULL`) and contain no text. Reuse of an account-deleted email is
  allowed; the old data is unrecoverable.

## Sync

Five preference fields only, versioned for conflict detection. API keys, message history, custom
instructions, and any drafted text are out of scope by design — a device compromise or a server breach
cannot leak them because they were never uploaded.

## Disclosures required in the app (**planned**)

1. BYOK and the non-zero-knowledge proxy: text and key transit our servers, then go to the chosen
   provider under the user's own account and billing.
2. iOS Full Access: needed for the keyboard to reach the network; base typing works without it and the
   AI toolbar stays disabled if it is declined (D2).
3. Provider billing: the user's own provider account is charged per request.
4. Sensitive-field override: when the user confirms sending text from a password/OTP/card-like field,
   restate exactly where that text goes (D9).
5. Analytics: none collected in the MVP.

Store privacy labels, the Play data-safety section and the published privacy policy must match the
tables above; Phase 10 owns that submission work.
