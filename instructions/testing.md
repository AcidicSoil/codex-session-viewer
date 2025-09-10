# path: instructions/testing\_rule\_pack.md

---

description: Default testing principles and practices
globs: "\*\*/\*"
alwaysApply: true
-----------------

# Testing Rule Pack

## Principles

- Favor fast, deterministic tests. Minimize I/O. Mock at boundaries only.
- Test behavior, not implementation. Public APIs and UI flows only.
- Maintain the pyramid: \~70% unit, \~20% integration/contract, \~10% e2e.
- Make tests hermetic. Control time, randomness, network, and data.
- One assertion cluster per test. Clear Given/When/Then.

## Types and Scope

- **Unit:** pure functions, hooks, services. No network/filesystem.
- **Integration:** module seams (DB ↔ repo, HTTP client ↔ API), SSR/routers, Redux/query caches.
- **Contract:** provider ↔ consumer using OpenAPI/GraphQL schemas or Pact.
- **E2E:** user-critical journeys only. Happy path + one guardrail per flow.
- **Non-functional:** a11y, performance, security lint, i18n, visual diffs (limited).

## Data Strategy

- Use factories/builders, not fixtures. Randomize with seeded RNG.
- Spin ephemeral DB per suite (Docker, Testcontainers). Run migrations on start.
- Snapshot only stable, serialized outputs. Avoid DOM snapshots.
- Create test users/tenants via API seeds, then reuse tokens.

## Frontend

- Test components with real DOM (jsdom ok) and a11y queries.
- Avoid mocking fetch in integration; use MSW.
- Assign `data-testid` only when a11y queries are unsafe.
- Cover routing, auth guards, caching, and error states.

## Backend

- Unit test domain/services. Integration test repos against real DB.
- Stub external services at HTTP layer (WireMock/MSW/node-http-mocks).
- Validate request/response with runtime schemas (zod/yup).

## Contracts

- Source of truth = schema. Generate clients/servers from OpenAPI/GraphQL.
- Add contract tests to CI. Breaks block merges. Version with backward-compat rules.

## E2E

- Keep <10 flows: sign-in, core entity CRUD, permissions, payments, exports.
- Run on prod-like env with seeded data. Record videos/traces.
- Parallelize by shard. Retry once on known flake tags only.

## Tooling Defaults

- **Unit/Int:** Vitest/Jest + Testing Library, MSW, Testcontainers.
- **E2E:** Playwright.
- **Contracts:** Pact or Dredd; OpenAPI/GraphQL codegen.
- **A11y:** axe-core/Playwright scans.
- **Perf:** Lighthouse CI or Playwright traces.
- **Security:** dependency audit + basic SAST/IAST.

## CI/CD Gates

- PR: lint, typecheck, unit+int, contract, a11y quick scan, changed-files selection.
- Nightly: full e2e, Lighthouse, cross-browser, mutation testing on hot modules.
- Merge to main: build, migrations dry-run, smoke e2e staging, canary release.

## Speed & Stability

- Run in parallel. Isolate temp dirs/ports. Cache dependencies/build artifacts.
- Fake timers, seed RNG, freeze dates, control timezone.
- Quarantine recurring flakes; SLA to fix or delete.

## Observability

- Assert logs/metrics where meaningful. Fail on unexpected errors.
- Capture traces, console, network for failures. Keep 7–14 days.

## Structure Example

```
/tests
  /unit
  /integration
  /contract
  /e2e
/src
  /__tests__
/testUtils
```

## Minimal Configs

- **MSW:** start in setup; route external hosts; per-test handlers override.
- **Playwright:** browser matrix; `storageState` per role; `trace: on-first-retry`.
- **Testcontainers:** reuse in CI job; new DB/schema per test file.

## Coverage Targets

- Lines: 80% overall. Critical modules: 95% branches.
- E2E covers top tasks, not lines.
