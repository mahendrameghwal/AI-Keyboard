# AI Keyboard — Implementation Plan

**Source of truth:** `AI Keyboard.md` (AIK-SRS-001 v1.0, Oct 16 2026)
**Artifact:** single monorepo at `D:\AI Keybord`
**Status:** Baselined — decisions locked, contracts frozen, executable.

---

## 0. Locked Decisions (from project-owner Q&A)

| # | Area | Decision |
|---|------|----------|
| D1 | AI request path | **Backend proxy.** Mobile sends provider key + payload to backend; backend forwards to provider. Key travels in the `X-Provider-Key` header, per-request, never logged or persisted. Backend is explicitly **not** zero-knowledge (§16.1); this is disclosed in-app. |
| D2 | iOS Full Access | **Required for AI.** Base typing works without it; AI toolbar disabled and onboarding explains why. |
| D3 | Email verification / password reset | **Out of scope for MVP.** Registration trusts the email as-is; recovery is support-only. FR-17/§15.1 amended. |
| D4 | Non-account usage | **No backend auth for BYOK.** `POST /v1/ai/generate` is callable with just a provider key; abuse controlled by IP-based rate limiting. Accounts are optional and only needed for sync. |
| D5 | RN setup | **Bare React Native CLI + TypeScript.** |
| D6 | Result UI | **Native preview panel inside the keyboard** (Kotlin/Swift). No RN runtime inside the extension/IME. |
| D7 | Sync scope | **Defaults only:** `writingStyle`, `toneStrength`, `formality`, `defaultLength`, `language`. Custom instructions are **local-only**. API keys / message history never sync. |
| D8 | Streaming | **Not in MVP.** Server rejects `options.stream:true` with `STREAM_NOT_SUPPORTED`. |
| D9 | Sensitive fields | **Block set + confirm-override:** OS password fields, OTP/2FA, card, PIN via InputType/secure-entry + heuristics; explicit override with warning. |
| D10 | OS targets | **Android 8 (API 26)+ / iOS 15+.** |
| D11 | Usage tracking | **Off by default.** `GET /v1/ai/usage` returns a feature-disabled response. |
| D12 | Repo layout | **Single monorepo** at `D:\AI Keybord` (deliberate deviation from §20.1/§25). |

## 0.1 Assumed Defaults (veto before the owning phase)

| Area | Default | Notes |
|---|---|---|
| Access token | JWT, 15 min TTL | `jti` + DB check for immediate logout |
| Refresh token | Opaque, rotating, 7 d idle / 30 d absolute, token **families**, 60 s concurrency grace window | reuse → revoke family |
| Rate limits | auth 5/min/IP; `providers/test` 10/h/IP; generate 30/h/IP (guest), 120/h/IP authed | `X-RateLimit-*` + `Retry-After` |
| Argon2id | m=19456 KiB, t=2, p=1 (OWASP baseline) | tune in Phase 8 |
| RN state | TanStack Query (server) + Zustand (local UI) | SRS lists only TanStack Query |
| Secure storage | custom native module (Keystore / Keychain + App Group) | cross-process needs, not `react-native-keychain` |
| Autocorrect / offline dict | none in v1 — system default behavior only | FR-02 only requires offline typing |
| i18n | UI English-only; `language` affects prompt language only | |
| Tablet | phone-first; tablet only if free | |
| Analytics | none in MVP | privacy-first |
| CORS | deny all (mobile-only) | |
| Hosting / DB | container host (Render/Fly/Railway) + managed Postgres (Neon/RDS) | confirm vendor in Phase 10 |
| Monitoring | Sentry + OpenTelemetry traces/metrics | redaction verified |
| Beta channels | TestFlight + Play internal testing | |
| A11y target | TalkBack/VoiceOver + WCAG 2.2 AA equivalent | NFR-09 |

---

## 1. Spec Amendments Required (gap closure before coding)

1. **Enums (§13.6)** — `action` = `fix | rewrite | shorten | expand | summarize | explain | continue | email | reply`. `tone` = professional, casual, polite, funny, friendly, romantic, confident, empathetic, neutral. `toneStrength` = soft, balanced, hard. `formality` = formal, neutral, informal. `length` = very_short, short, normal, detailed, elaborate. `language` = BCP-47, default `en-IN` (initial support `en`, `en-IN`).
2. **Email output shape (FR-11)** — `email` action returns `{ subject, body }`, separately insertable/copyable.
3. **Error taxonomy (§13.7)** — add `RATE_LIMITED` (429, distinct from `PROVIDER_RATE_LIMITED`), `PREFERENCES_VERSION_CONFLICT` (409), `NOT_FOUND` (404), `PROVIDER_TIMEOUT` (504), `SESSION_EXPIRED` / `REFRESH_TOKEN_REUSED` / `SESSION_REVOKED` (401), `UNSUPPORTED_MODEL` / `MODEL_DEPRECATED` (422), `PROVIDER_CONTENT_BLOCKED` (422), `EMPTY_RESPONSE` (502), `STREAM_NOT_SUPPORTED` (400).
4. **Validation limits (§13.6)** — `text` ≤ 8,000 chars (summarize ≤ 12,000); custom instructions ≤ 10 items × 300 chars; request body ≤ 64 KB; server-capped `maxOutputTokens` per length (≈ 256/512/1024/2048/4096); strict Zod (reject unknown keys); empty input rejected.
5. **Guest credentials (§13.3)** — removed. No guest-token endpoint; IP rate limits govern anonymous use (D4).
6. **Streaming (§13.4)** — `stream:true` → `STREAM_NOT_SUPPORTED`.
7. **Provider model catalog (§13.4/FR-15)** — `GET /v1/ai/providers` returns a **server-maintained registry** (provider, modelId, capabilities, status active/deprecated, default model), refreshed on a schedule; clients never ship static model lists.
8. **Sync conflict (§15.2)** — `GET` returns `version`; `PUT` requires expected version; mismatch → `409 PREFERENCES_VERSION_CONFLICT` with server state. Drop redundant `sync_versions`; use `user_preferences.version`.
9. **Auth (accounts only)** — access (JWT 15 min) + rotating opaque refresh (7 d idle / 30 d absolute) with token families; reuse → revoke family; logout revokes session; add `GET /v1/users/me/sessions` + `DELETE /v1/users/me/sessions/:id` (FR-17).
10. **Retention (§14.7)** — sessions pruned after expiry; `usage_events` schema present but unused while tracking off; account deletion = async job with defined purge scope (sessions, prefs, devices, usage events anonymized).

## 1.1 Endpoint Inventory (amended §13.3)

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | none | Liveness |
| GET | `/v1/health/ready` | none | Dependency readiness (DB only; never calls providers) |
| POST | `/v1/ai/generate` | none (key header) | Text generation/transform |
| GET | `/v1/ai/providers` | none | Providers + model catalog |
| POST | `/v1/ai/providers/test` | none (key header) | Validate provider key |
| GET | `/v1/ai/usage` | optional | Feature-disabled response in MVP |
| POST | `/v1/auth/register` | none | Register |
| POST | `/v1/auth/login` | none | Authenticate |
| POST | `/v1/auth/refresh` | refresh token | Rotate session |
| POST | `/v1/auth/logout` | access token | Revoke session |
| GET | `/v1/users/me` | access token | Profile |
| DELETE | `/v1/users/me` | access token | Request account deletion |
| GET | `/v1/users/me/sessions` | access token | List sessions/devices |
| DELETE | `/v1/users/me/sessions/:id` | access token | Revoke a session |
| GET | `/v1/sync/preferences` | access token | Read synced preferences |
| PUT | `/v1/sync/preferences` | access token | Update (optimistic concurrency) |

**Removed vs original:** `/v1/auth/verify-email`, `/resend-verification`, `/forgot-password`, `/reset-password` (D3), guest-token issuance (§13.3).

## 1.2 Data Model (Prisma, amended §14)

- `users` — `id`, `email` (citext, UNIQUE), `passwordHash`, `status`, `createdAt`, `updatedAt`, `deletedAt`.
- `sessions` — `id`, `userId` (FK cascade), `tokenFamilyId`, `tokenHash` (UNIQUE), `deviceId` (FK), `expiresAt`, `revokedAt`, `createdAt`, `lastUsedAt`.
- `devices` — `id`, `userId` (FK cascade), `platform`, `name`, `lastSeenAt`, `createdAt`.
- `user_preferences` — `userId` (PK), `writingStyle`, `toneStrength`, `formality`, `defaultLength`, `language`, `version` (int), `updatedAt`.
- `account_deletion_jobs` — `id`, `userId`, `status`, `requestedAt`, `scheduledFor`, `attempts`, `completedAt`, `error`.
- `usage_events` — schema present, feature-flagged off: `id`, `userId?`, `action`, `provider`, `model`, `inputTokens?`, `outputTokens?`, `latencyMs`, `status`, `createdAt`; index `(userId, createdAt)`. Never stores text.
- ~~`sync_versions`~~ — dropped (redundant with `user_preferences.version`).

---

## 2. Monorepo Layout (D12)

```
D:\AI Keybord\
├── mobile/                    # RN bare app + native keyboards
│   ├── src/                   # app/ screens/ features/ components/ services/ storage/ hooks/ types/ utils/
│   ├── android/app/src/main/java/com/aikeyboard/{keyboard,bridge}/
│   ├── ios/{AIKeyboardApp,AIKeyboardExtension,Shared}/
│   └── __tests__/
├── api/                       # Express + TS backend
│   ├── src/{routes,controllers,middleware,validators,repositories,services/{ai,auth,sync,usage},prompts,errors,config}/
│   ├── prisma/{schema.prisma,migrations}/
│   └── tests/{unit,integration,contract}/
├── shared-contracts/openapi.yaml + schemas/*.json
├── docs/{ARCHITECTURE,API,SECURITY,DEVELOPMENT,PRIVACY}.md
├── .github/workflows/
├── package.json (workspaces) · .gitignore · .env.example · README.md
├── AI Keyboard.md
└── implementation-plan.md
```

Backend owns the canonical OpenAPI spec; `shared-contracts/` is a workspace package consumed by mobile (resolves the §9.2/§10.2 split).

---

## 3. Phases

Each phase: **Goal → Tasks → Deliverables → Dependencies → Acceptance Criteria (AC)**.

### Phase 0 — Contract & Spec Freeze
**Goal:** Eliminate ambiguity before code.
**Tasks**
- **T0.1** Finalize enums + validation-limit table (§1 items 1–4).
- **T0.2** Author complete `openapi.yaml` (endpoints, schemas, error envelope, headers `X-Provider-Key`, `X-Request-Id`, `X-RateLimit-*`, `Retry-After`).
- **T0.3** Author `schema.prisma` draft — models, PKs/FKs (`ON DELETE CASCADE`), uniques (`users.email`, `sessions.tokenHash`), enums, indexes.
- **T0.4** Sensitive-field block/override rules doc (Android `EditorInfo` flags, iOS secure-entry, heuristics).
- **T0.5** Prompt policy + per-action prompt template outline (system/user separation; no client `systemPrompt` on the wire).
- **T0.6** Auth/session design (token families, reuse, grace window, revocation).
- **T0.7** Provider adapter contract + model-catalog design (capabilities, status, refresh TTL, default/fallback, kill switch).
- **T0.8** Amend SRS sections and record deviations.

**Deliverables:** Amended spec; OpenAPI draft; schema draft; limits table; prompt/sensitive-field/token design docs.
**Dependencies:** owner Q&A (complete).
**AC:** Every FR maps to an endpoint + schema; zero "TBD"; P0 review gaps closed.

---

### Phase 1 — Monorepo & Foundation
**Goal:** Reproducible builds, green CI.
**Tasks**
- **T1.1** `git init`, `.gitignore`, `.editorconfig`, `README.md`, commit convention.
- **T1.2** Root `package.json` with npm workspaces (`mobile`, `api`, `shared-contracts`).
- **T1.3** Bare RN + TS app (`com.aikeyboard`); Android/iOS projects generated.
- **T1.4** Express + TS scaffold matching §10.2 layout; strict `tsconfig`; `config/env.ts`; redaction-ready logger.
- **T1.5** `docker-compose.yml` (Postgres 16) + `.env.example`.
- **T1.6** Prisma init + first migration (minimal `users`/`sessions`).
- **T1.7** `shared-contracts` package (OpenAPI + generated TS types).
- **T1.8** Linters: ESLint/Prettier (TS), ktlint/detekt (Kotlin), SwiftLint (Swift).
- **T1.9** Test harnesses: Vitest + Supertest (api); Jest + RN Testing Library (mobile).
- **T1.10** GitHub Actions: lint, typecheck, test, build, `gitleaks` secret scan.

**Deliverables:** Both apps build/run; backend health OK; CI green.
**Dependencies:** Phase 0.
**AC:** `npm run` targets work for both; migration applies cleanly; CI passes on a trivial PR; no secrets committed.

---

### Phase 2 — Native Keyboards (typing only)
**Goal:** Functional IMEs without AI.
**Tasks — Android**
- **T2.1** `AIKeyboardService : InputMethodService`, `keyboard_method.xml`, manifest declarations.
- **T2.2** `KeyboardView` + layout XML (alphabetic, numeric/symbol pages), shift/caps.
- **T2.3** `KeyboardController` key handling; space/enter/backspace.
- **T2.4** `InputConnectionManager`: cursor-aware insert, selection replace with fallback.
- **T2.5** Lifecycle (`onStartInput`/`onFinishInput`), orientation, layout adaptation.
- **T2.6** Sensitive-field detection stub (`EditorInfo` flags) for Phase 4.
- **T2.7** `KeyboardPreferences` local storage scaffolding.

**Tasks — iOS**
- **T2.8** Keyboard extension target + bundle id + Info.plist (`NSExtension`).
- **T2.9** App Group capability (`group.<bundle>`) + shared UserDefaults.
- **T2.10** `KeyboardViewController : UIInputViewController`, `KeyboardView`, layout.
- **T2.11** `TextDocumentProxyAdapter`: insert, delete, selection replace.
- **T2.12** Full-Access detection + lifecycle handling.

**Tasks — Both**
- **T2.13** Native unit/instrumentation tests (typing, deletion, insertion).
- **T2.14** Verify offline typing and no-draft-loss on failure.

**Deliverables:** Installable keyboards; offline typing.
**Dependencies:** Phase 1; Apple Developer account + App Group capability; Android signing.
**AC:** Keyboard enables/selects on both OS; typing works offline; backspace/space/enter/shift; insertion at cursor; orientation/lifecycle handled; no crash on OEM skins; draft never lost.

---

### Phase 3 — Backend AI Core
**Goal:** Working `generate` API with adapters.
**Tasks**
- **T3.1** `AIProvider` interface + `ProviderRegistry`.
- **T3.2** Adapters: OpenAI, Gemini (**header `x-goog-api-key`, never URL**), Anthropic — request/response mapping, usage extraction, timeouts.
- **T3.3** `POST /v1/ai/generate`: Zod validation, per-action prompt construction, provider routing, response normalization, error mapping.
- **T3.4** Layered timeouts + `AbortController` on client disconnect; no auto-retry; reject streaming.
- **T3.5** `GET /v1/ai/providers` (server-maintained catalog) + `POST /v1/ai/providers/test`.
- **T3.6** `X-Provider-Key` intake, redaction, zero persistence.
- **T3.7** IP rate limiting with `X-RateLimit-*` + `Retry-After`.
- **T3.8** Prompt templates in `prompts/*.prompt.ts`.
- **T3.9** Provider contract tests (mock-first) + optional live nightly.

**Deliverables:** All actions callable via curl; keys provably absent from logs.
**Dependencies:** Phase 1; provider test keys.
**AC:** Each action returns §13.5 shape (email nested); invalid input → `VALIDATION_ERROR`; bad key → `INVALID_PROVIDER_KEY`; rate limit → `RATE_LIMITED`+`Retry-After`; disconnect aborts upstream; no key in logs/traces (tested).

---

### Phase 4 — Keyboard AI Integration
**Goal:** AI usable from both keyboards.
**Tasks**
- **T4.1** Cross-process secure storage — Android: Keystore/EncryptedSharedPreferences reachable by the IME (same UID); iOS: Keychain with App Group access group.
- **T4.2** Native HTTP client (Kotlin/Swift) calling `/v1/ai/generate` with `X-Provider-Key`.
- **T4.3** Native preview panel: loading/cancel, error+retry, regenerate, insert, replace-selection, copy, tone tweak.
- **T4.4** Draft preservation; focus-loss handling; cancel in-flight on dismissal.
- **T4.5** Sensitive-field blocking (D9) with confirm-override.
- **T4.6** Offline detection + disabled AI state.
- **T4.7** Full-Access onboarding copy.

**Deliverables:** End-to-end AI from keyboard.
**Dependencies:** Phases 2–3.
**AC:** Action → generate → preview → insert/replace works on both OS; failures/cancel preserve draft; sensitive fields blocked with override warning; AI disabled offline; key read from keyboard process works (tested per OS).

---

### Phase 5 — Writing Features
**Goal:** Full FR-03…FR-13 coverage.
**Tasks**
- **T5.1** Wire all actions: fix, rewrite, shorten, expand, summarize, explain, continue, email, reply.
- **T5.2** Tone/style/formality/length/language controls in the native keyboard + prompt mappings.
- **T5.3** Email subject/body separate insert (FR-11).
- **T5.4** Smart replies with N options from user-supplied context only (FR-12).
- **T5.5** Custom instructions (local-only) + validation (FR-13).

**Deliverables:** All writing actions functional on both platforms.
**Dependencies:** Phase 4.
**AC:** Each action meets its FR examples; shortening preserves facts, expansion invents none; email outputs separate subject/body; replies never assume unsupplied context; instructions applied and capped.

---

### Phase 6 — Companion RN App
**Goal:** Full settings/onboarding experience.
**Tasks**
- **T6.1** Screens: Welcome, Keyboard Setup, Home, Provider Settings, Writing Assistant, Result Preview, Email Generator, Smart Replies, Account, Sync, Privacy, Usage (disabled) (§6.1).
- **T6.2** React Navigation; TanStack Query; AsyncStorage prefs; secure-storage native module.
- **T6.3** Provider config: add/test/replace/delete, masked key, model picker, connection status.
- **T6.4** Activation-status check (Android real; iOS guidance-only) — never falsely claim enabled (FR-01).
- **T6.5** Accessibility (NFR-09) + dark mode.

**Deliverables:** Navigable app matching §6.1.
**Dependencies:** Phases 3–5.
**AC:** Onboarding enables keyboard without false claims; provider CRUD + test connection work; API-key billing disclosure shown; a11y labels present; no navigation crashes.

---

### Phase 7 — Accounts & Sync
**Goal:** Optional accounts + preference sync.
**Tasks**
- **T7.1** Register/login/logout (Argon2id); access + rotating refresh tokens with family reuse detection.
- **T7.2** Sessions/devices tables; `/sessions` list + revoke; auth rate limiting.
- **T7.3** `GET/PUT /v1/sync/preferences` with optimistic concurrency + 409.
- **T7.4** Device-side offline queue (prefs only, capped/TTL).
- **T7.5** Account deletion async job (`account_deletion_jobs`) with purge scope.

**Deliverables:** Cross-device sync of the 5 default fields.
**Dependencies:** Phase 3; Phase 6 UI.
**AC:** App fully usable without an account; login/refresh/logout/reuse-revocation tested; version conflict → 409 + server state; offline edits queue and reconcile; deletion revokes sessions and purges synced data.

---

### Phase 8 — Security & Privacy Hardening
**Goal:** Meet §16 and NFR-05/06.
**Tasks**
- **T8.1** Log-field allowlist + `X-Request-Id` propagation + no body logging on `/v1/ai/*`.
- **T8.2** Helmet/HSTS/body-size limits/CORS deny.
- **T8.3** Secrets inventory + manager.
- **T8.4** Retention + deletion purge verification.
- **T8.5** BYOK/non-zero-knowledge + Full-Access disclosure copy + privacy policy.
- **T8.6** No-keystroke-transmission verification.
- **T8.7** Dependency scanning, SAST, secret scanning in CI.

**Deliverables:** Security checklist + automated tests.
**Dependencies:** Phases 3–7.
**AC:** §19.6 security tests pass: no keys in logs; cross-user isolation; sessions revocable; sensitive fields don't trigger AI; deletion removes data; invalid requests rejected.

---

### Phase 9 — Testing & QA
**Goal:** Verify all NFRs and acceptance criteria (§23).
**Tasks**
- **T9.1** Backend unit/integration/contract tests.
- **T9.2** RN component/navigation/a11y tests.
- **T9.3** Android IME instrumentation + iOS extension UI tests on the device matrix (Android 8+, iOS 15+).
- **T9.4** E2E (Maestro or Detox) across host apps (WhatsApp, Gmail, Messages, Chrome/Safari).
- **T9.5** Performance/load (k6) for NFR-03; keyboard cold-start latency profiling.
- **T9.6** Chaos/failure injection (network flap, 429/503 storm, timeout).
- **T9.7** Accessibility (TalkBack/VoiceOver).

**Deliverables:** Green suites + NFR evidence report.
**Dependencies:** Phases 2–8.
**AC:** All §19 suites run in CI; NFR-01…NFR-10 each have a measured pass/fail; E2E type→generate→preview→insert passes and preserves draft on failure.

---

### Phase 10 — Deployment & Release
**Goal:** Beta-ready.
**Tasks**
- **T10.1** Multi-stage Dockerfile (non-root, healthcheck); `prisma migrate deploy`.
- **T10.2** Staging + prod managed Postgres + hosting; HTTPS ingress + `trust proxy`.
- **T10.3** Monitoring/alerting (RED; backend vs provider latency split).
- **T10.4** Backups + restore test; rollback procedure.
- **T10.5** Release builds + signing.
- **T10.6** Store listings, privacy labels, Full-Access justification.
- **T10.7** Beta via TestFlight / Play internal testing.

**Deliverables:** Deployed backend + beta builds.
**Dependencies:** Phases 1–9.
**AC:** Reproducible prod build; `/health` + readiness wired; monitoring + backups live; rollback rehearsed; store disclosures approved; beta distributed.

---

## 4. Phase Sequencing

```
Phase 0 (freeze)
   └─> Phase 1 (monorepo + foundation)
          ├─> Phase 2 (native keyboards)
          │      └─> Phase 4 (keyboard AI) ──> Phase 5 (writing features)
          └─> Phase 3 (backend AI core) ─────┘        │
                                                      ├─> Phase 6 (RN app)
                                                      └─> Phase 7 (accounts+sync)
                                                             └─> Phase 8 (security)
                                                                    └─> Phase 9 (testing) ─> Phase 10 (release)
```
Phases 2 and 3 can proceed in parallel after Phase 1. Phase 6 depends on 3+5; Phase 7 on 3+6.

---

## 5. Requirements Traceability Matrix

| Requirement | Phase(s) | Deliverable / Endpoint |
|---|---|---|
| FR-01 install/activation | 2, 6 | IME + extension; onboarding + activation status |
| FR-02 standard typing | 2 | Native keyboards, offline typing |
| FR-03 grammar/spelling | 3, 5 | `fix` action |
| FR-04 rewriting | 3, 5 | `rewrite` + styles |
| FR-05 tone strength | 5 | `toneStrength` control |
| FR-06 length/detail | 5 | `length` control |
| FR-07 summarization | 3, 5 | `summarize` |
| FR-08 expansion | 3, 5 | `expand` |
| FR-09 explanation | 3, 5 | `explain` |
| FR-10 continue writing | 3, 5 | `continue` |
| FR-11 email generation | 3, 5 | `email` → `{subject, body}` |
| FR-12 smart replies | 3, 5 | `reply` (N options, supplied context) |
| FR-13 custom instructions | 5 | Local instruction store + validation |
| FR-14 result preview | 4 | Native preview panel + actions |
| FR-15 provider management | 3, 6 | Adapters + catalog + provider UI |
| FR-16 BYOK | 3, 4, 6 | Secure storage, `X-Provider-Key`, masked CRUD |
| FR-17 optional accounts | 7 | Auth endpoints + `/sessions` (verify/reset deferred) |
| FR-18 cloud synchronization | 7 | `/v1/sync/preferences` (5 fields) |
| FR-19 privacy controls | 6, 8 | Privacy screen, disclosures, deletion |
| NFR-01…NFR-10 | 9 | Measured evidence report |

---

## 6. Cross-Cutting Edge Cases (all must be handled)

Draft preserved on error/cancel/timeout/focus-loss · insertion into correct field only · selection-replace fallback per OS · sensitive-field block + override · offline typing + AI-disabled messaging · IP rate-limit 429 UX · provider timeout/quota/refusal mapping · empty/malformed provider output → `EMPTY_RESPONSE` · sync conflict reconciliation · token refresh race grace window · account-deletion purge completeness · no text in logs/analytics/usage · landscape/dark-mode/a11y in keyboard · OEM IME differences.

## 7. Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| iOS extension memory (~30–50 MB) | High | Native preview (D6); no RN in extension; lazy native UI; low-memory device tests |
| Full Access friction / App Store review | High | Clear onboarding + disclosure (D2); graceful degradation if denied |
| BYOK key transiting backend | High | Header-only, request-scoped, allowlist logging, no body logs, pen-test; disclose (§16.1) |
| IP-based abuse control (D4) | Med-High | Strict IP limits; extra limits on `providers/test`; monitor; escalate to attestation later |
| Provider/model churn | Med | Server catalog + deprecation status + fallback model + kill switch |
| Sync conflict / offline races | Med | Versioned PUT + 409; capped prefs-only queue |
| Timeline optimism (§21) | Med | Treat 8–9 wks as floor; native/store-review/compat extend; gate Phase 0 first |

## 8. MVP Definition of Done

All Phase 2–10 acceptance criteria met, plus §23: mobile runs both OS; keyboards enable/select; offline typing; failures preserve drafts; preview/insert; all writing actions; multiple adapters behind one interface; API validated; errors normalized; auth/authz tested; sync detects conflicts; cross-user isolation; keys never persisted/logged; secure local storage; sensitive contexts safe; privacy disclosures; deletion + revocation work; no auto AI on keystrokes; automated tests pass; reproducible builds; monitoring/backups configured.

## 9. Recorded Scope Deviations from the SRS

- Single monorepo (D12 vs §20.1/§25).
- No guest-token endpoint; IP rate limiting for anonymous generate (§13.3).
- Email verification & password reset deferred (FR-17/§15.1).
- Streaming rejected in MVP (§13.4).
- Usage tracking off by default (§14.2/§13.3).
- Custom instructions local-only, not synced (FR-18).

---

## 10. Execution Progress

_Updated as work proceeds. Verification = commands run in CI/local (lint, typecheck, tests, build)._

| Phase | Status | Evidence / notes |
|---|---|---|
| 0 — Contract & Spec Freeze | Done | `shared-contracts/openapi.yaml`, `schemas/*`, `api/prisma/schema.prisma`; deviations in §9. |
| 1 — Monorepo & Foundation | Done (partial) | npm workspaces `api` + `shared-contracts`; `.github/workflows/ci.yml` (now triggers on `main` **and** `master`); `api` scaffold; `/health` live; `docs/{ARCHITECTURE,API,SECURITY,DEVELOPMENT,PRIVACY}.md` + root `.env.example` authored. `mobile` workspace **deferred** — no JDK/Xcode. T1.7 TS-type generation still open (contracts ship spec + JSON schemas only). **Git has zero commits**, so T1.1's baseline and T1.10's "green CI on a trivial PR" are unproven until the first push. |
| 2 — Native Keyboards | Blocked | Requires JDK + Android SDK and macOS/Xcode — absent in this environment. |
| 3 — Backend AI Core | Done | Interface + registry + 3 adapters (Gemini key via header); `/v1/ai/{generate,providers,providers/test,usage}`; per-action prompts; `X-Provider-Key` intake; IP rate limiting + `Retry-After` (anon 30/h, **authenticated 120/h via `optionalAuthenticate`**, `providers/test` 10/h); streaming rejected. Model catalog is now a **server-maintained registry** (`services/ai/modelCatalog.ts`): built-in floor, `MODEL_CATALOG_PATH` JSON override, `MODEL_CATALOG_TTL_SECONDS` reload, `status: active\|deprecated`, `defaultModel`/`fallbackModel`, and `DISABLED_PROVIDERS` kill switch → `503 PROVIDER_UNAVAILABLE` (verified live: gemini hidden from `/v1/ai/providers`, its generate call returned 503). Adapters no longer declare models. Lint ✓ typecheck ✓ build ✓. |
| 4 — Keyboard AI Integration | Not started | Depends on Phase 2. |
| 5 — Writing Features | Not started | Depends on Phase 4. |
| 6 — Companion RN App | Not started | Depends on Phases 3+5; needs RN toolchain. |
| 7 — Accounts & Sync | Done (backend) | Auth (Argon2id), JWT access + rotating opaque refresh (family reuse + 60s grace), `/v1/auth/*` + `/v1/users/me/*` (sessions list/revoke), sync GET/PUT with `409`, auth limiter corrected to **5/min** (`RATE_LIMIT_AUTH_WINDOW_SECONDS`). Account deletion now actually executes: `workers/backgroundJobs.ts` runs hourly from `server.ts` — `pruneExpiredSessions()` (hard-delete past `expiresAt`) + `processDueJobs()` (purge, retry ≤5); the completed-status write was changed to `updateMany` because the job row cascades away with the user (P2025 crash otherwise). Migrations on hosted Prisma Postgres. Deferred: T7.4 device-side offline queue (mobile). |
| 8 — Security & Privacy Hardening | In progress (backend complete) | T8.1 allowlisted access logging, T8.2 CORS deny-all + helmet + 64 KB body cap, T8.3 secrets inventory, T8.4 retention/purge loop live **and covered by `tests/integration/retention.test.ts`** (cascade, idempotency, due-vs-future, schedule→purge), T8.5 disclosure copy specified in `docs/SECURITY.md`/`docs/PRIVACY.md` (in-app wording pending mobile), T8.6 key-redaction asserted in unit + integration tests, T8.7 CI audit + CodeQL + gitleaks. New `docs/`: ARCHITECTURE, API, SECURITY, DEVELOPMENT, PRIVACY + root `.env.example`. Remaining: in-app disclosure screens, T8.6 device-side no-keystroke verification. |
| 9 — Testing & QA | Partial (backend) | T9.1 backend suites now cover unit + integration + **contract** (`tests/contract/openapi.test.ts` pins the §1.1 inventory against the routed app, 16 ops both directions). 76 tests, 11 files: adapters, prompts, model catalog, request logger, health (mocked DB, no longer env-dependent), generate flow, CORS/redaction, auth+sync, retention/deletion, rate tiers. Remaining: T9.2–T9.7 (RN, IME instrumentation, iOS extension, E2E, k6 load, chaos, a11y) — all need the mobile toolchain. |
| 10 — Deployment & Release | Not started | — |

**Environment constraints:** Windows host; Node v22.14.0, npm 11.21.0, git 2.40.1. Docker, JDK/Android SDK, and Xcode are **absent**. `C:` is near-full; npm cache/temp redirected to `D:\npm-cache` and `D:\npm-temp` (set `npm_config_cache`, `TEMP`, `TMP` when running npm). Database: **hosted Prisma Postgres** (no local Postgres); connection string lives only in git-ignored `api/.env` — DB-backed suites load it themselves and skip when absent, and `vitest.config.ts` raises `testTimeout`/`hookTimeout` to 30 s for that latency. CI's `npm audit` gate is scoped to production deps (`--omit=dev`) since advisories are in dev-only Vitest/Vite tooling (upgrade to Vitest 5 tracked later).

**Single-instance constraints to clear before Phase 10:** rate-limit counters (`middleware/rateLimit.ts`) and the background-job loop (`workers/backgroundJobs.ts`) are both in-process. Running more than one replica would double-count limits and double-run purges — move counters to a shared store and jobs to a scheduled worker/queue, or keep exactly one replica.
