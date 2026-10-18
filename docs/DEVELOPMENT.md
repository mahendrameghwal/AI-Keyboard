# Development — AI Keyboard

## Prerequisites

| Tool                      | Version         | Needed for                              | Status on this host                                     |
| ------------------------- | --------------- | --------------------------------------- | ------------------------------------------------------- |
| Node.js                   | ≥ 22 (`.nvmrc`) | API + tooling                           | installed                                               |
| npm                       | ≥ 11            | workspaces                              | installed                                               |
| PostgreSQL                | 16              | API database                            | `docker compose up -d db`, or any reachable instance    |
| Expo SDK 58 + EAS CLI     | —               | mobile app, cloud builds                | Expo installed; **`eas-cli` needs `eas login` (owner)** |
| JDK 17 + Android SDK      | —               | **optional** — local Gradle builds only | absent (EAS builds instead)                             |
| Xcode + CocoaPods (macOS) | —               | **optional** — local iOS builds only    | absent (EAS builds instead; see plan D5.1)              |
| Physical Android device   | API 26+         | enabling and typing with the IME        | **required** — cannot be replaced by cloud builds       |

Per decision **D5** the mobile app is an Expo project built through **EAS Build**, so producing an APK/IPA
no longer needs a local JDK/Android SDK or Xcode. What the cloud cannot do is _run_ a keyboard: enabling an
IME and typing into another app needs a device (or an emulator provisioned in CI). The backend is fully
developable without any of it.

## Setup

```bash
npm install                          # root: api + mobile + shared-contracts workspaces
cp api/.env.example api/.env         # then edit DATABASE_URL and JWT_SECRET
cp mobile/.env.example mobile/.env   # EXPO_PUBLIC_API_BASE_URL for the bundler
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
| `npm run test -w shared-contracts`    | Contract schema + client tests        |

Within `api/`: `test:watch`, `prisma:generate`, `prisma:migrate`, `prisma:deploy`.

## Shared contracts

`shared-contracts/` is the single source of truth consumed by the future mobile app.

| Command                                 | Effect                                                             |
| --------------------------------------- | ------------------------------------------------------------------ |
| `npm run gen -w shared-contracts`       | Regenerate `src/types.ts` from `openapi.yaml` (openapi-typescript) |
| `npm run typecheck -w shared-contracts` | `tsc --noEmit`                                                     |
| `npm run test -w shared-contracts`      | Vitest: schema behaviour plus drift assertions against `api/src`   |

`src/schemas.ts` mirrors the API's Zod validators and `src/client.ts` is a framework-neutral typed
fetch client (works under Expo and bare React Native alike). Do not hand-edit `src/types.ts` — edit
`openapi.yaml` and re-run `gen`. The contract tests import `api/src/validators/*` and
`api/src/errors/codes.ts` directly, so a request body, limit, enum, or error code that changes on one
side only fails the suite; update the OpenAPI spec and the API validator together.

## Mobile (Expo + EAS)

`mobile/` is an Expo SDK 58 app (`com.aikeyboard`), not a hand-maintained bare RN project.

```bash
npm run start -w @ai-keyboard/mobile        # Metro dev server
npm run typecheck -w @ai-keyboard/mobile    # tsc --noEmit
npx expo install <package>                   # ALWAYS for native deps — npm add picks wrong versions
npm run prebuild -w @ai-keyboard/mobile      # regenerate android/ and ios/ from app.json
```

Rules that fall out of Continuous Native Generation:

- `android/` and `ios/` are **git-ignored and generated**. Never create or edit them by hand; native
  behavior goes through `app.json` and config plugins. The keyboard target is added as a plugin (plan T2.0).
- After adding a package with native code, Expo Go no longer suffices: build a dev client with EAS
  (`npx eas-cli@latest build --platform android --profile development`) and install the artifact over `adb`.
- EAS needs the owner's account once: `npx eas-cli@latest login` then `eas init` (writes the project id into
  `app.json`). `eas.json` profiles are already committed.
- Only `EXPO_PUBLIC_*` values reach the JS bundle, and they are **inlined at build time** — a provider key
  never goes in `.env`; it comes from secure storage at request time.

Mobile checks run locally with no device attached:

```bash
npm run lint --workspace mobile      # expo lint / ESLint 9 flat config
npm run test --workspace mobile      # jest with the jest-expo preset
```

Both work because the whole repo now shares **ESLint 9**: the api was migrated from `.eslintrc.cjs` to
[api/eslint.config.mjs](../api/eslint.config.mjs), which also lets `eslint-config-expo` resolve (it needs
the `eslint/config` export that ESLint 8 does not have). Mobile tests use the `jest-expo` preset with no
`transformIgnorePatterns` override — overriding it re-breaks `expo-modules-core`, whose build output is ESM.

### Navigation (Expo Router)

Screens are **file routes** in `mobile/src/app/`, not navigators you register by hand:

- `package.json#main` is `expo-router/entry`, and `expo-router` is listed in `app.json` `plugins` — both are
  required; removing either breaks startup.
- [src/app/_layout.tsx](../mobile/src/app/_layout.tsx) declares the root `<Stack>`; add a screen by adding a
  file (`src/app/provider.tsx` → `/provider`). `[param]` filenames are dynamic segments.
- Navigate with `<Link>` / `router.push()` from `expo-router`. `app.json#scheme` (`aikeyboard`) is what makes
  deep links resolve, so keep it set.
- `expo-router` wraps React Navigation (it depends on `react-native-screens` and
  `react-native-safe-area-context`), which is why the SRS §25 "React Navigation" line still holds — see the
  deviation note in [implementation-plan.md](../implementation-plan.md) §9.

### Device storage seam

Provider keys and app state cross one boundary each, so a screen can never accidentally put a key in
plain storage (or a draft in secure storage):

- [src/storage/secrets.ts](../mobile/src/storage/secrets.ts) — `SecretStore` interface, implemented by
  `expo-secure-store` (`setItemAsync`/`getItemAsync`/`deleteItemAsync`/`isAvailableAsync`; v58 renamed
  these, so check the SDK docs rather than memory). Android requires a device lock, and writing throws
  when secure storage is unavailable.
- [src/storage/kv.ts](../mobile/src/storage/kv.ts) — `JsonStore` over AsyncStorage for non-secret state
  only (the configured-provider index, the default provider/model, local preferences).
- [src/storage/providerKeys.ts](../mobile/src/storage/providerKeys.ts) — `ProviderKeyStore`: raw key
  material goes to `SecretStore` under `provider-key.<id>`; everything the UI can read back is masked
  (`••••` + last 4). `keyForRequest()` is what `ApiClient.getProviderKey` calls.
- [src/storage/preferences.ts](../mobile/src/storage/preferences.ts) — the five synced fields (plan D7),
  validated with the contract `PreferencesSchema`; corrupt data falls back to defaults.
- [src/services/deps.tsx](../mobile/src/services/deps.tsx) — `DepsProvider` injects `{ api, providerKeys,
preferences, clientWithKey }`. Screens use `useAppDeps()` and never import a native module, which is what
  makes them testable with fakes.

### Mobile test harness

`npm run test --workspace mobile` (4 suites, 22 tests). Two non-obvious requirements, both already wired:

- AsyncStorage's binding is null under Jest, so [mobile/jest.setup.js](../mobile/jest.setup.js) installs the
  package's own mock via `setupFiles`.
- `@testing-library/react-native` 14 has **async** `render` and `fireEvent`. Without `await render(...)`
  the `screen` object is still empty and assertions fail with "`render` function has not been called".

`mobile/test/helpers/` holds the memory `SecretStore`/`JsonStore` fakes and a fetch-level fake backend, so
screen tests drive the real shared-contracts `ApiClient`. Test helpers deliberately live outside
`__tests__/`: the `jest-expo` preset treats every file under `__tests__/` as a suite.

## Tests

```
api/tests/unit         provider adapters, prompts, model catalog, request logger, health
api/tests/integration  generate flow, CORS/log redaction, auth+sync, retention/deletion, rate tiers
api/tests/contract     OpenAPI inventory vs. routed Express app
shared-contracts       generated types + Zod mirrors vs. api validators/error codes (drift tests)
mobile/__tests__       storage seam, provider-settings logic, screen render, contract-in-expo
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

`.github/workflows/ci.yml` runs six jobs: API (typecheck, lint, test against a Postgres 16 service,
build), Mobile (typecheck, `expo lint`, jest-expo), Shared contracts (typecheck + drift tests), gitleaks
secret scan, dependency audit, and CodeQL. The workflow triggers on `main` **and** `master`. The repo is on
`main` and pushed to `origin`, so pushes do run it; confirm the first green run in the Actions tab (this
host has no `gh` CLI, so the result is not verifiable from the terminal).

The audit job is **scoped to the deployed backend**: `node scripts/audit-workspace.mjs --workspace api
--fail-on high` blocks, and a second non-blocking step prints the full production-tree report. Repo-wide
`npm audit --audit-level=high` is unusable as a gate because `expo` lists its Metro/dev-server toolchain as
a runtime dependency, so 14 high advisories can never be cleared from our side — they would drown out a real
backend regression. Measured with the same script: `api` = 0 high/critical, `mobile` = 14. The intersection
is by package name, so it errs toward over-reporting rather than missing anything that reaches the backend.

Dev-only advisories in the Vitest/Vite toolchain are the other reason audits stay production-scoped;
upgrading to Vitest 5 is tracked separately.
