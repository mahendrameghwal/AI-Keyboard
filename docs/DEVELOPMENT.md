# Development — AI Keyboard

## Prerequisites

| Tool                      | Version         | Needed for             | Status on this host                                  |
| ------------------------- | --------------- | ---------------------- | ---------------------------------------------------- |
| Node.js                   | ≥ 22 (`.nvmrc`) | API + tooling          | installed                                            |
| npm                       | ≥ 11            | workspaces             | installed                                            |
| PostgreSQL                | 16              | API database           | `docker compose up -d db`, or any reachable instance |
| JDK 17 + Android SDK      | —               | Android keyboard + app | **absent**                                           |
| Xcode + CocoaPods (macOS) | —               | iOS keyboard extension | **absent**                                           |

The backend is fully developable without a phone toolchain. Phases 2, 4, 5, 6 and the mobile half of 7/8
cannot start until JDK/Android SDK and macOS/Xcode are available.

## Setup

```bash
npm install                          # root, installs api + shared-contracts workspaces
cp api/.env.example api/.env         # then edit DATABASE_URL and JWT_SECRET
docker compose up -d db
npm run api:dev                      # http://localhost:3000 — GET /health
```

First database schema: `npx prisma migrate dev` from `api/` (migrations are checked into
`api/prisma/migrations`). After pulling someone else's migration, use `npm run prisma:deploy -w api`.

## Scripts (run from the repository root)

| Command                               | Effect                                |
| ------------------------------------- | ------------------------------------- |
| `npm run api:dev`                     | `tsx watch` dev server                |
| `npm run api:build`                   | `tsc` → `api/dist` (git-ignored)      |
| `npm run api:typecheck`               | `tsc --noEmit`                        |
| `npm run api:lint`                    | ESLint over `api/src` and `api/tests` |
| `npm run api:test`                    | Vitest, one run                       |
| `npm run lint` / `typecheck` / `test` | all workspaces (`--if-present`)       |
| `npm run format` / `format:check`     | Prettier                              |

Within `api/`: `test:watch`, `prisma:generate`, `prisma:migrate`, `prisma:deploy`.

## Tests

```
api/tests/unit         provider adapters, prompts, model catalog, request logger, health
api/tests/integration  generate flow, CORS/log redaction, auth+sync, retention/deletion, rate tiers
api/tests/contract     OpenAPI inventory vs. routed Express app
```

- Unit suites need no database. The `database-backed` suites read `DATABASE_URL` from `api/.env`
  themselves and **skip entirely** when it is absent — a green run with no Postgres shows skips, which
  is expected locally but not in CI (CI provisions a Postgres service and must see them execute).
- DB-backed tests create rows prefixed with the run id and delete them in `afterAll`; the retention
  suite also purges users, so point `DATABASE_URL` at a disposable database, never production.
- `vitest.config.ts` raises `testTimeout`/`hookTimeout` to 30 s because the development database is
  hosted and each query pays network latency.
- Timeouts: `PROVIDER_TIMEOUT_MS` aborts upstream; client disconnect aborts via `AbortController`.

## Environment

Documented in [`api/.env.example`](../api/.env.example). Worth knowing:

- `DISABLED_PROVIDERS=openai,gemini` is the runtime kill switch; `MODEL_CATALOG_PATH` points at a JSON
  file that replaces the built-in model catalog without a redeploy.
- `BACKGROUND_JOBS_INTERVAL_MINUTES` controls expired-session pruning and account-deletion purging.
- `RATE_LIMIT_AUTH_WINDOW_SECONDS` (60) is separate from the hourly AI limits.
- `USAGE_TRACKING_ENABLED` and `STREAMING_ENABLED` stay `false` for the MVP.

## Conventions

- TypeScript strict; Zod at every boundary; no `any` in `api/src`.
- One responsibility per file: routes wire middleware, controllers orchestrate, services own data
  access, adapters own provider dialects.
- Errors leave the process as `AppError` with a canonical code from `api/src/errors/codes.ts`; new
  codes need an HTTP mapping, a retryability decision, an OpenAPI entry and a plan §1 note.
- Comments explain _why_ (a constraint, an invariant, a workaround), not _what_.
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`), imperative,
  scoped to one phase concern.

## CI

`.github/workflows/ci.yml` runs four jobs: API (typecheck, lint, test with a Postgres 16 service,
build), gitleaks secret scan, `npm audit --omit=dev --audit-level=high`, and CodeQL. The workflow
triggers on `main` **and** `master`; the repository is currently on `master` with no commits, so CI has
never actually run — T1.10's "green CI on a trivial PR" remains open until the first push.

Dev-only advisories in the Vitest/Vite toolchain are why the audit gate is scoped to production
dependencies; upgrading to Vitest 5 is tracked separately.
