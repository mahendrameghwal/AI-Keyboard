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
| D5 | RN setup | **Expo (CNG / prebuild) + TypeScript**, builds produced by **EAS Build**; supersedes the earlier "bare React Native CLI" choice (owner decision, 2026-10-18). Scope of Expo: the companion app shell and build/credential pipeline. The keyboard is **not** RN — `InputMethodService`/`UIInputViewController` stay native Kotlin/Swift, shipped as an Expo Module / native target (see D6). Cloud builds remove the local JDK/Android-SDK/Xcode requirement for *producing* artifacts; they do **not** remove the need for a device or emulator to *enable and test* an IME, so a physical Android device + `adb` (platform-tools) is the remaining local prerequisite for Phase 2/4/9 verification. |
| D5.1 | iOS extension risk | Expo documents app extensions only as "add a target with your own config plugin" (`extra.eas.build.experimental.ios.appExtensions` is experimental and covers credentials, not keyboard templates). **Spike T2.0** must prove a custom-keyboard target survives `expo prebuild` + EAS before Phase 2 commits to iOS; fallback is a manually maintained Xcode project (requires macOS access) or deferring iOS. |
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
| RN state | TanStack Query (server) + Zustand (local UI) | SRS lists only TanStack Query; both are Expo-compatible |
| Navigation | **Expo Router** (file routes in `src/app/`) | Owner decision 2026-10-18. SRS §25 names React Navigation; `expo-router` is built on it (its bundle pulls `react-navigation`), so the SRS line still holds underneath |
| Secure storage | custom **Expo Module** (Keystore / Keychain + App Group) | cross-process needs, not `react-native-keychain`; same module is read by the IME/extension |
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
├── mobile/                    # Expo (CNG) app + native keyboards as an Expo Module / native target
│   ├── src/                   # app/ (Expo Router file routes) screens/ features/ components/ services/ storage/ hooks/ types/ utils/
│   ├── modules/keyboard/      # Expo Module wrapping the native IME / extension
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
- **T1.3** Expo app (`create-expo-app`, TypeScript, `com.aikeyboard`) + `eas.json` build profiles; native
  projects produced by `expo prebuild` and git-ignored. *(Amended from "bare RN CLI" per D5.)*
- **T1.4** Express + TS scaffold matching §10.2 layout; strict `tsconfig`; `config/env.ts`; redaction-ready logger.
- **T1.5** `docker-compose.yml` (Postgres 16) + `.env.example`.
- **T1.6** Prisma init + first migration (minimal `users`/`sessions`).
- **T1.7** `shared-contracts` package (OpenAPI + generated TS types).
- **T1.8** Linters: ESLint/Prettier (TS), ktlint/detekt (Kotlin), SwiftLint (Swift).
- **T1.9** Test harnesses: Vitest + Supertest (api); Jest (`jest-expo`) + RN Testing Library (mobile).
- **T1.10** GitHub Actions: lint, typecheck, test, build, `gitleaks` secret scan.

**Deliverables:** Both apps build/run; backend health OK; CI green.
**Dependencies:** Phase 0.
**AC:** `npm run` targets work for both; migration applies cleanly; CI passes on a trivial PR; no secrets committed.

---

### Phase 2 — Native Keyboards (typing only)
**Goal:** Functional IMEs without AI.
**Toolchain (D5):** the app shell is Expo; `android/` and `ios/` are generated by `expo prebuild` and the
keyboard is committed as native code inside them (plus an Expo Module bridge). **APK/IPA artifacts come
from EAS Build**, so no local JDK/Android SDK/Xcode is needed to produce them. Verification still needs a
**physical Android device + `adb`** (install, enable the IME in system settings, type) — EAS cannot run a
keyboard. iOS additionally depends on the T2.0 spike below.
**Tasks — Toolchain**
- **T2.0** Spike: prove a custom-keyboard iOS target survives `expo prebuild` + an EAS build (config
  plugin or `expo-apple-targets`), and that an Android IME builds/signs through EAS. Output = a go/no-go
  memo; if no-go, record the fallback (manual Xcode project on macOS, or defer iOS) before writing T2.8.
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
**Dependencies:** Phase 1 (mobile workspace created as an Expo app); EAS project + build credentials; one
physical Android device + `adb` for IME verification; Apple Developer account + App Group capability;
Android signing; T2.0 spike outcome for the iOS target.
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

### Phase 6 — Companion App (Expo)
**Goal:** Full settings/onboarding experience.
**Tasks**
- **T6.1** Screens: Welcome, Keyboard Setup, Home, Provider Settings, Writing Assistant, Result Preview, Email Generator, Smart Replies, Account, Sync, Privacy, Usage (disabled) (§6.1).
- **T6.2** Navigation + state: **Expo Router** file routes under `mobile/src/app/` (owner decision
  2026-10-18 — resolves the React Navigation vs Expo Router question in favour of Router, which is built on
  React Navigation, so SRS §25 still holds underneath), TanStack Query, AsyncStorage prefs, secure-storage
  Expo Module. The routes shell already exists (`_layout.tsx` + a placeholder index screen).
- **T6.3** Provider config: add/test/replace/delete, masked key, model picker, connection status.
- **T6.4** Activation-status check (Android real; iOS guidance-only) — never falsely claim enabled (FR-01).
- **T6.5** Accessibility (NFR-09) + dark mode.
- **T6.6** Network layer = `shared-contracts` `ApiClient` only (no hand-rolled fetch); base URL from app
  config (`EXPO_PUBLIC_API_BASE_URL`) so no environment-specific string is hardcoded; provider key injected
  per request via `getProviderKey()`.
- **T6.7** EAS dev build installed on the physical device (`eas build --profile development`) so native
  keyboard code runs without a local Android SDK; document `adb` install/enable steps in `docs/DEVELOPMENT.md`.

**Deliverables:** Navigable app matching §6.1.
**Dependencies:** Phases 3–5; EAS project (Phase 2 T2.0).
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
| iOS custom-keyboard target unsupported by Expo (D5/D5.1) | High | T2.0 spike before Phase 2 commits; fallback = manually maintained Xcode project (needs macOS) or defer iOS; never let `prebuild` silently drop the extension |
| EAS is a metered external dependency (build minutes, credentials, outage) | Med | Keep `expo prebuild` + local Gradle/Xcode as a documented fallback; pin EAS CLI + Expo SDK; verify each release build provenance |
| Verification coverage lost by removing the local emulator | Med | One physical Android device + `adb` is the Phase 2 baseline; GitHub Actions can provision JDK/Android SDK + emulator for CI-only checks |

## 8. MVP Definition of Done

All Phase 2–10 acceptance criteria met, plus §23: mobile runs both OS; keyboards enable/select; offline typing; failures preserve drafts; preview/insert; all writing actions; multiple adapters behind one interface; API validated; errors normalized; auth/authz tested; sync detects conflicts; cross-user isolation; keys never persisted/logged; secure local storage; sensitive contexts safe; privacy disclosures; deletion + revocation work; no auto AI on keystrokes; automated tests pass; reproducible builds; monitoring/backups configured.

## 9. Recorded Scope Deviations from the SRS

- Single monorepo (D12 vs §20.1/§25).
- No guest-token endpoint; IP rate limiting for anonymous generate (§13.3).
- Email verification & password reset deferred (FR-17/§15.1).
- Streaming rejected in MVP (§13.4).
- Usage tracking off by default (§14.2/§13.3).
- Custom instructions local-only, not synced (FR-18).
- **Mobile toolchain: Expo (CNG/prebuild) + EAS Build instead of bare React Native CLI** (D5, owner
  decision 2026-10-18). The SRS fixes only "React Native + TypeScript" (§25) and already allows native
  file locations to vary with the RN template (§11), so this supersedes the plan's own D5 wording rather
  than the SRS. Consequences: build artifacts are produced in the cloud (no local JDK/Android SDK/Xcode
  required to build), the keyboard ships as an Expo Module / native target rather than a hand-maintained
  bare project, and **T2.0** must prove the iOS custom-keyboard target survives `prebuild` + EAS before
  Phase 2 commits to iOS. Device/emulator testing of the IME is still local.
- **Navigation: Expo Router instead of React Navigation** (§25 line "Navigation | React Navigation", owner
  decision 2026-10-18). `expo-router` is a wrapper around React Navigation — it depends on it and its
  bundle pulls it in — so the SRS stack line remains true underneath while routes are declared as files in
  `mobile/src/app/` rather than imperatively in a navigator. This also satisfies `mobile/AGENTS.md`, the
  template-shipped rulebook for agents working in this workspace. Consequence: screens use `<Stack>` +
  `<Link>`/`router.push`, deep linking comes from `app.json#scheme` (`aikeyboard`), and any Phase 6
  screen code must be written as a file route.

---

## 10. Execution Progress

_Updated as work proceeds. Verification = commands run in CI/local (lint, typecheck, tests, build)._

| Phase | Status | Evidence / notes |
|---|---|---|
| 0 — Contract & Spec Freeze | Done | `shared-contracts/openapi.yaml`, `schemas/*`, `api/prisma/schema.prisma`; deviations in §9. |
| 1 — Monorepo & Foundation | Done (partial) | npm workspaces `api` + `shared-contracts`; `.github/workflows/ci.yml` (now triggers on `main` **and** `master`); `api` scaffold; `/health` live; `docs/{ARCHITECTURE,API,SECURITY,DEVELOPMENT,PRIVACY}.md` + root `.env.example` authored. T1.7 closed: `shared-contracts` now generates `src/types.ts` from `openapi.yaml` (`npm run gen -w shared-contracts`) and ships Zod request/response schemas + a framework-neutral typed `ApiClient`, with drift tests that import the API's own validators and error codes. T1.3 **closed 2026-10-18**: `mobile/` created with `create-expo-app` (blank-typescript, Expo SDK 58.0.14 / RN 0.88 / React 19.3), added to the root workspaces, `app.json` set to `com.aikeyboard` (iOS `bundleIdentifier` + Android `package`), `metro.config.js` wired for the monorepo (`watchFolders` = repo root + hoisted `nodeModulesPaths`), `eas.json` profiles committed, `mobile/.env.example` for `EXPO_PUBLIC_API_BASE_URL`, and `src/services/api.ts` instantiating the shared-contracts `ApiClient`. Verified: `npx expo-doctor` 20/20, root `npm run typecheck` clean across three workspaces, `npx expo export --platform android` bundles (628 modules, +13 when the typed client is imported — proves the TS-source workspace package transpiles through Metro), `npm run lint` + `npm run api:build` clean, **101 tests green** at that point (76 api + 23 contracts + 2 mobile; **121 now** — see the Phase 6 row). **Closed 2026-10-18 (T1.8/T1.9):** the api moved to ESLint 9 + flat config (`api/eslint.config.mjs`, `.eslintrc.cjs` deleted), which also unblocked `eslint-config-expo` for mobile; mobile now has `expo lint` (5 files, 0 problems) and a `jest-expo` suite (`__tests__/shared-contracts.test.ts`, 2 tests proving the typed `ApiClient` + Zod schemas run in the Expo runtime). Gotcha recorded in DEVELOPMENT.md: overriding `transformIgnorePatterns` breaks `expo-modules-core` ESM. **Git:** the owner created commits since the last audit — `main` now tracks `origin` (`github.com/mahendrameghwal/AI-Keyboard`) with two commits, and `api/.env` is **not** among the tracked files (verified with `git ls-files`). T1.10's "green CI on a trivial PR" is still unverified from this host: no `gh` CLI here, so the Actions run has to be read in the browser. **Navigation resolved 2026-10-18:** `expo-router` (~58.0.23) installed with `react-native-screens` / `react-native-safe-area-context` / `expo-linking` / `expo-constants`, `package.json#main` = `expo-router/entry`, `app.json` given `scheme: aikeyboard` + the `expo-router` plugin, and the entry screen moved to file routes (`src/app/_layout.tsx` `<Stack>` + `src/app/index.tsx`; `App.tsx`/`index.ts` deleted). Re-verified after the swap: `expo-doctor` 20/20, lint + typecheck clean, 101 tests green, `expo export --platform android` emits a 2.6 MB `entry-*.hbc`. |
| 2 — Native Keyboards | Not started (unblocked, 2026-10-18) | No longer blocked on JDK/Android SDK/Xcode: builds move to EAS (D5). Remaining gates: the **T2.0** iOS-target spike, an **EAS project** (`eas init`/`eas login` — needs the owner's credentials), and **one physical Android device + `adb`** for IME enable/type verification, which cannot happen in the cloud. |
| 3 — Backend AI Core | Done | Interface + registry + 3 adapters (Gemini key via header); `/v1/ai/{generate,providers,providers/test,usage}`; per-action prompts; `X-Provider-Key` intake; IP rate limiting + `Retry-After` (anon 30/h, **authenticated 120/h via `optionalAuthenticate`**, `providers/test` 10/h); streaming rejected. Model catalog is now a **server-maintained registry** (`services/ai/modelCatalog.ts`): built-in floor, `MODEL_CATALOG_PATH` JSON override, `MODEL_CATALOG_TTL_SECONDS` reload, `status: active\|deprecated`, `defaultModel`/`fallbackModel`, and `DISABLED_PROVIDERS` kill switch → `503 PROVIDER_UNAVAILABLE` (verified live: gemini hidden from `/v1/ai/providers`, its generate call returned 503). Adapters no longer declare models. Lint ✓ typecheck ✓ build ✓. |
| 4 — Keyboard AI Integration | Not started | Depends on Phase 2. |
| 5 — Writing Features | Not started | Depends on Phase 4. |
| 6 — Companion App (Expo) | Started (device-free slice, 2026-10-18) | Deps installed per T6.2: `expo-router` file routes + `@tanstack/react-query` + `@react-native-async-storage/async-storage` + `expo-secure-store`. Storage seam exists (`src/storage/`): `SecretStore` (expo-secure-store) never shares a layer with `JsonStore` (AsyncStorage), `ProviderKeyStore` keeps only provider ids + the default selection in JSON and returns **masked** summaries (`••••` + last 4), `PreferencesRepository` round-trips the five synced fields through the contract `PreferencesSchema` and falls back to defaults on corrupt data. `src/app/` now has Welcome (with the T8.5 disclosure copy from `src/features/disclosure/copy.ts`), `providers` (catalog from `GET /v1/ai/providers`, test-before-save via a client that signs with the typed key, save+select, remove), `keyboard-setup` (instructions only — it deliberately claims no activation status, FR-01; the real check is T6.4) and `privacy`. Screens read injected deps through `DepsProvider`, so no screen imports the native modules. Still ahead: Account/Sync/Writing screens (they need Phases 4–5 features) and any visual/device confirmation, which needs the EAS dev build (T6.7). |
| 7 — Accounts & Sync | Done (backend) | Auth (Argon2id), JWT access + rotating opaque refresh (family reuse + 60s grace), `/v1/auth/*` + `/v1/users/me/*` (sessions list/revoke), sync GET/PUT with `409`, auth limiter corrected to **5/min** (`RATE_LIMIT_AUTH_WINDOW_SECONDS`). Account deletion now actually executes: `workers/backgroundJobs.ts` runs hourly from `server.ts` — `pruneExpiredSessions()` (hard-delete past `expiresAt`) + `processDueJobs()` (purge, retry ≤5); the completed-status write was changed to `updateMany` because the job row cascades away with the user (P2025 crash otherwise). Migrations on hosted Prisma Postgres. Deferred: T7.4 device-side offline queue (mobile). |
| 8 — Security & Privacy Hardening | In progress (backend complete) | T8.1 allowlisted access logging, T8.2 CORS deny-all + helmet + 64 KB body cap, T8.3 secrets inventory, T8.4 retention/purge loop live **and covered by `tests/integration/retention.test.ts`** (cascade, idempotency, due-vs-future, schedule→purge), T8.5 disclosure copy specified in `docs/SECURITY.md`/`docs/PRIVACY.md` (in-app wording pending mobile), T8.6 key-redaction asserted in unit + integration tests, T8.7 CI audit + CodeQL + gitleaks. New `docs/`: ARCHITECTURE, API, SECURITY, DEVELOPMENT, PRIVACY + root `.env.example`. Remaining: in-app disclosure screens, T8.6 device-side no-keystroke verification. **Resolved 2026-10-18 (owner chose "scope to backend"):** adding the Expo workspace made the old blocking step `npm audit --omit=dev --audit-level=high` fail — 14 high advisories, all reachable only through `expo`/`react-native` toolchain packages (`@expo/cli`, `@expo/metro`, `metro`, `braces`, `node-forge`), 0 critical. CI now runs `scripts/audit-workspace.mjs --workspace api --fail-on high` as the gate (0 high/critical in the backend production tree, verified) plus a non-blocking full-tree report. Verified with `npm ls --omit=dev -w api --all --json` intersected against the advisory set. |
| 9 — Testing & QA | Partial (backend) | T9.1 backend suites now cover unit + integration + **contract** (`tests/contract/openapi.test.ts` pins the §1.1 inventory against the routed app, 16 ops both directions). 76 tests, 11 files: adapters, prompts, model catalog, request logger, health (mocked DB, no longer env-dependent), generate flow, CORS/redaction, auth+sync, retention/deletion, rate tiers. Remaining: T9.2 RN tests (**advanced 2026-10-18**: `jest-expo` now runs 22 mobile tests — 2 contract-integration, 8 storage-seam, 6 provider-settings logic, 5 screen render incl. a masked-key leak guard; `mobile/test/helpers/` supplies memory `SecretStore`/`JsonStore` fakes and a fetch-level fake backend so screens exercise the real `ApiClient`; harness gotchas in DEVELOPMENT.md: AsyncStorage needs its official mock in `setupFiles`, and testing-library 14 `render`/`fireEvent` are **async**), T9.3–T9.7 (IME instrumentation, iOS extension, E2E, k6 load, chaos, a11y) — all need an EAS-built artifact plus a device/emulator (an emulator can be provisioned in GitHub Actions if no device is available). |
| 10 — Deployment & Release | Not started | — |

**Environment constraints:** Windows host; Node v22.14.0, npm 11.21.0, git 2.40.1. Docker, JDK/Android SDK, and Xcode are **absent**, but under D5 they are no longer needed to *build* the mobile app (EAS Build is remote). Still required and not available here: an **EAS account/project credential** (owner action) and a **physical Android device** for IME verification; iOS additionally needs macOS/Xcode if the T2.0 spike shows Expo cannot carry the extension target. `C:` is near-full; npm cache/temp redirected to `D:\npm-cache` and `D:\npm-temp` (set `npm_config_cache`, `TEMP`, `TMP` when running npm). Database: **hosted Prisma Postgres** (no local Postgres); connection string lives only in git-ignored `api/.env` — DB-backed suites load it themselves and skip when absent, and `vitest.config.ts` raises `testTimeout`/`hookTimeout` to 30 s for that latency. CI's audit gate is scoped to the **api workspace's** production tree (`scripts/audit-workspace.mjs`) because `expo` carries Metro/dev-server advisories that we cannot clear; advisories elsewhere print as a non-blocking report. Dev-only advisories are a second reason audits stay production-scoped (upgrade to Vitest 5 tracked later).

**Single-instance constraints to clear before Phase 10:** rate-limit counters (`middleware/rateLimit.ts`) and the background-job loop (`workers/backgroundJobs.ts`) are both in-process. Running more than one replica would double-count limits and double-run purges — move counters to a shared store and jobs to a scheduled worker/queue, or keep exactly one replica.
