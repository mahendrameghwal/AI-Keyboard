# AI Keyboard

AI-powered writing assistant delivered as a cross-platform system keyboard.

- **`mobile/`** — React Native (bare, TypeScript) companion app + native Android (`InputMethodService`, Kotlin) and iOS (`UIInputViewController`, Swift) keyboards.
- **`api/`** — Node.js + Express + TypeScript backend. Proxies AI provider requests, validates input, normalizes errors, and provides optional accounts + preference sync (Prisma + PostgreSQL).
- **`shared-contracts/`** — Canonical OpenAPI 3.1 specification and JSON schemas shared between mobile and API.
- **`docs/`** — Architecture, API, security, and development documentation.
- **`implementation-plan.md`** — Phase-by-phase delivery plan (source of truth for execution).
- **`AI Keyboard.md`** — Full Software Requirements Specification (SRS).

## Prerequisites

| Tool | Version | Needed for |
|------|---------|-----------|
| Node.js | 22+ (see `.nvmrc`) | API + tooling |
| npm | 11+ | Workspaces |
| PostgreSQL | 16 (or Docker) | API database |
| JDK 17 + Android SDK | — | Android build |
| Xcode + CocoaPods | — | iOS build (macOS only) |

## Getting started (backend)

```bash
npm install
cp api/.env.example api/.env
docker compose up -d db      # or point DATABASE_URL at your own Postgres
npm run api:dev              # http://localhost:3000
```

Health checks:

- `GET /health` — liveness
- `GET /v1/health/ready` — dependency readiness

## Monorepo scripts

```bash
npm run lint          # lint all workspaces
npm run typecheck     # typecheck all workspaces
npm test              # test all workspaces
npm run format        # prettier
```

## Key architecture decisions

- AI provider calls go **through the backend proxy**; the user's provider key is sent per-request in the `X-Provider-Key` header and is **never logged or persisted**.
- The native keyboards perform their core operations **without** the React Native companion app running; AI preview/insertion UI is rendered **natively** inside the keyboard.
- Streaming is not supported in the MVP (`stream:true` is rejected).
- Cloud sync is limited to non-sensitive defaults; API keys and message history never sync.

See `implementation-plan.md` for locked decisions and the full phase plan.
