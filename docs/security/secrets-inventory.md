# Secrets Inventory

**Scope:** backend (`api`) and CI. Mobile stores user provider keys in OS secure
storage (Phase 4), which is out of scope for this document.

## Handling rules

- Secrets are supplied via environment variables, never committed. `.env` is
  git-ignored; `.env.example` contains placeholders only.
- In production, secrets come from the hosting provider's secret manager
  (Render/Fly/Railway), injected at runtime as env vars.
- Logs redact credential-bearing fields (`logger.ts`) and access logs use a
  strict field allowlist (`requestLogger.ts`). Request bodies are never logged.
- `gitleaks` runs in CI on every push/PR; dependency and SAST scans run via
  `npm audit` and CodeQL.

## Inventory

| Secret | Env var | Used by | Sensitivity | Rotation |
|---|---|---|---|---|
| JWT signing secret | `JWT_SECRET` | Auth token issuance/verification (Phase 7) | High | Rotate on suspected compromise; invalidates sessions |
| Database credentials | `DATABASE_URL` | Prisma ↔ managed Postgres (Phase 7+) | High | Rotate via provider; update env + redeploy |
| Provider API key (per user) | `X-Provider-Key` header | `POST /v1/ai/generate`, `providers/test` | Critical | User-managed; **never** persisted or logged |
| Sentry DSN (planned) | `SENTRY_DSN` | Error reporting (Phase 10) | Medium | Rotate via Sentry |
| OTel exporter endpoint (planned) | `OTEL_EXPORTER_OTLP_ENDPOINT` | Tracing (Phase 10) | Low–Med | Provider-managed |
| CI runner token | `GITHUB_TOKEN` | Actions (auto-provided) | Medium | N/A (ephemeral) |

## Never in scope of logging/tracing

User text, provider API keys, auth tokens, cookies, and raw provider request or
response bodies. Verified by `tests/unit/requestLogger.test.ts` and the redaction
config in `api/src/config/logger.ts`.
