# AI Keyboard

AI-powered writing assistant delivered as a cross-platform system keyboard.

- **`mobile/`** — Expo (SDK 58, TypeScript) companion app: screens, auth, provider settings and sync, as Expo Router file routes in `mobile/src/app/`. Builds run on EAS, so no local Android SDK or Xcode is required. **The native keyboards are not implemented yet** — there is no `InputMethodService` (Android) or `UIInputViewController` (iOS) code in this repo, so nothing appears in the system keyboard settings; that is plan Phase 2 (`mobile/` task T2.x).
- **`api/`** — Node.js + Express + TypeScript backend. Proxies AI provider requests, validates input, normalizes errors, and provides optional accounts + preference sync (Prisma + PostgreSQL).
- **`shared-contracts/`** — Canonical OpenAPI 3.1 specification and JSON schemas shared between mobile and API, plus generated TypeScript types, Zod schemas and a typed `ApiClient`.

## Prerequisites

| Tool                            | Version            | Needed for                                                                |
| ------------------------------- | ------------------ | ------------------------------------------------------------------------- |
| Node.js                         | 22+ (see `.nvmrc`) | API + tooling                                                             |
| npm                             | 11+                | Workspaces                                                                |
| PostgreSQL                      | 16 (or Docker)     | API database                                                              |
| EAS CLI + Expo account          | —                  | Cloud builds for `mobile/` (replaces local JDK/Android SDK/Xcode)         |
| Physical Android device + `adb` | API 26+            | Enabling and typing with the keyboard — cloud builds cannot verify an IME |

## Getting started

```bash
npm install
cp api/.env.example api/.env
cp mobile/.env.example mobile/.env
docker compose up -d db      # or point DATABASE_URL at your own Postgres
npm run api:dev              # http://localhost:3000
```

Health checks:

- `GET /health` — liveness
- `GET /v1/health/ready` — dependency readiness

Mobile: see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#mobile-expo--eas) — `npm run mobile:dev` for Metro,
`npx eas-cli@latest build --profile development` for a device install, and `expo prebuild` never by hand.
Screens are Expo Router file routes in [mobile/src/app](mobile/src/app); the entry point is
`expo-router/entry` and the deep-link scheme is `aikeyboard`.

## Monorepo scripts

```bash
npm run lint          # lint all workspaces
npm run typecheck     # typecheck all workspaces
npm test              # test all workspaces
npm run format        # prettier
npm run format:check  # prettier, as CI runs it
npm run gen           # regenerate shared-contracts/src/types.ts from openapi.yaml
npm run gen:check     # fail if the generated types are stale
```

## Key architecture decisions

- AI provider calls go **through the backend proxy**; the user's provider key is sent per-request in the `X-Provider-Key` header and is **never logged or persisted**.
- The native keyboards are designed to perform their core operations **without** the React Native companion app running, rendering AI preview/insertion UI **natively** inside the keyboard. This is a target, not current behaviour — see the `mobile/` note above.
- Streaming is not supported in the MVP (`stream:true` is rejected).
- Cloud sync is limited to non-sensitive defaults; API keys and message history never sync.

See `implementation-plan.md` for locked decisions and the full phase plan.
