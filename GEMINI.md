1. Role

- *Docs/Tooling Architect* — lifecycle: *Tooling → Build/CI → Security → Maintenance*.
- Scope: Make your instruction-loading system adapt cleanly to new roles without editing `AGENTS.md` by adding a role registry, auto-discovery rule-pack, a role-pack template, and a lightweight project-level role profile.
- Primary tech/tooling: Markdown rule-packs (`.md`/`.mdc`), YAML configs, existing `DocFetchReport` pipeline.

2. Task

- Introduce a **Role Registry** (YAML) with lifecycle mapping, defaults, and globs per role.
- Add an **always-on Role Discovery rule-pack** that infers roles from signals (repo files, language hints, `ROLE_PROFILE.yaml`, memory) and records selections in `DocFetchReport.roles[]`.
- Provide a **role-pack template** to standardize new role additions, including front matter and deliverable expectations.
- Add a **behavior extension for role tagging & governance** (`@role{...}`) and `DocFetchReport` fields (roles, selection reasons, confidence).
- Support an optional **project-level `ROLE_PROFILE.yaml`** to override/extend role data without touching `AGENTS.md`.
- Define **validation rules** (schema hints) so invalid role packs are skipped and logged.

3. Context

- **Standards & policies:** Keep `AGENTS.md` immutable (per its guard). Use existing discovery/confirmation flow and `DocFetchReport` addendum pattern.
- **Tech stack & environment:** Markdown/YAML only; no XML. Files live under `instructions/**` and `.cursor/rules/**`, matching your loader.
- **Constraints & NFRs:** Zero edits to `AGENTS.md`; changes must be additive; deterministic discovery; human-auditable selection with confidence score.
- **Interfaces & dependencies:** Consumes repo signals (e.g., `package.json`, `pyproject.toml`), optional `ROLE_PROFILE.yaml`; writes into `DocFetchReport.roles[]`.
- **Data & compliance:** No PII required; configs are repo-local.
- **Assumptions:** New roles should map to one or more lifecycle stages; defaults are acceptable until overridden in `ROLE_PROFILE.yaml`.
- **Out of scope:** Changing baseline load order; adding new external tools; runtime code execution.

4. Reasoning

- **Evaluation rubric:**

  - Balanced specificity vs. readability of role files.
  - Cost (maintenance) vs. scalability (adding many roles).
  - Reliability (deterministic selection) vs. delivery speed (fast onboarding of new roles).
  - Simplicity (few files) vs. flexibility (per-project overrides).
  - Portability (plain Markdown/YAML) vs. platform leverage (your existing `.mdc` rule-pack system).

5. Output format

- **Role Registry** — central catalog new roles plug into

```yaml
# /instructions/roles/role_registry.yaml
version: 1
roles:
  - id: frontend_engineer
    title: Frontend Engineer
    description: Owns user-facing components and flows.
    lifecycle: [UI/UX, Frontend, Build/CI]
    primary_tech:
      languages: [TypeScript]
      frameworks: [Next.js, Tailwind]
      tools: [ESLint, Prettier, Vitest]
    default_globs: ["app/**", "src/components/**", "src/app/**", "pages/**"]
    deliverables:
      - "Route/Component maps with states"
      - "Accessibility checklist (WCAG 2.2 AA)"
      - "Perf budgets (Core Web Vitals)"
  - id: backend_engineer
    title: Backend Engineer
    description: Provides stable data and action contracts.
    lifecycle: [Backend, Data/DB, Security]
    primary_tech:
      languages: [TypeScript, Python]
      frameworks: [Fastify, FastAPI]
      tools: [OpenAPI, Pytest, Jest]
    default_globs: ["src/server/**", "services/**", "api/**"]
    deliverables:
      - "OpenAPI contract + handler skeletons"
      - "Error model + pagination strategy"
  - id: data_engineer
    title: Data Engineer
    description: Models schemas, pipelines, and data contracts.
    lifecycle: [Data/DB, Observability, Security]
    primary_tech:
      languages: [Python, SQL]
      frameworks: [dbt]
      tools: [Alembic, Great Expectations]
    default_globs: ["db/**", "migrations/**", "models/**"]
    deliverables:
      - "DDL/migrations, retention, index plan"
  - id: devops_engineer
    title: DevOps/Platform Engineer
    description: Ships safely and reversibly.
    lifecycle: [Tooling, Build/CI, Infra/Cloud, Security, Observability]
    primary_tech:
      languages: [HCL, YAML]
      frameworks: [Terraform, GitHub Actions]
      tools: [Docker, OpenTelemetry, Prometheus, Grafana]
    default_globs: [".github/workflows/**", "infra/**", "ops/**"]
    deliverables:
      - "CI matrix, cache strategy"
      - "Release plan and rollback"
  - id: sre
    title: Site Reliability Engineer
    description: Ensures reliability and rapid diagnosis.
    lifecycle: [Observability, Security, Maintenance]
    primary_tech:
      languages: [YAML, JSON]
      frameworks: []
      tools: [Prometheus, Grafana, OpenTelemetry]
    default_globs: ["observability/**", "dashboards/**", "alerts/**"]
    deliverables:
      - "SLO doc, alert rules, runbook"
  - id: security_engineer
    title: Security Engineer
    description: Protects assets and identities.
    lifecycle: [Security]
    primary_tech:
      languages: [TypeScript, Python]
      frameworks: [OPA/Rego]
      tools: [OWASP ASVS, OIDC/OAuth2]
    default_globs: ["security/**", "policies/**"]
    deliverables:
      - "Threat model, RBAC matrix, auth notes"
  - id: mobile_engineer
    title: Mobile Engineer
    description: Ships iOS/Android features and UI flows.
    lifecycle: [UI/UX, Frontend, Build/CI]
    primary_tech:
      languages: [Swift, Kotlin, TypeScript]
      frameworks: [SwiftUI, Jetpack, React Native]
      tools: ["Xcode", "Gradle", "Metro"]
    default_globs: ["ios/**", "android/**", "mobile/**", "app/**"]
    deliverables:
      - "Navigation map, accessibility, perf budgets"
  - id: ml_engineer
    title: ML Engineer
    description: Trains/serves models; sets contracts and monitoring.
    lifecycle: [Data/DB, Backend, Observability, Security]
    primary_tech:
      languages: [Python]
      frameworks: [PyTorch, TensorFlow, FastAPI]
      tools: [Model Card, OpenTelemetry]
    default_globs: ["ml/**", "models/**", "serving/**"]
    deliverables:
      - "Model card, inference API, drift alerts"
```

- **Always-on Role Discovery rule-pack** — infers and records roles (no `AGENTS.md` edits)

````markdown
<!-- /.cursor/rules/role_discovery.mdc -->
---
description: Auto-discover project roles and map to lifecycle, stacks, and outputs; record to DocFetchReport.roles[].
globs: "**/*"
alwaysApply: true
---

# Role Discovery & Selection (Always-On)

**Purpose:** Before planning/acting, infer applicable roles and add a `roles[]` section to `DocFetchReport`.
**Inputs (highest to lowest precedence):**
1) `ROLE_PROFILE.yaml` at repo root (if present).
2) Explicit user request in current task (e.g., “frontend”).
3) Memory: prior tasks, stack hints.
4) Repo signals: manifests (`package.json`, `pyproject.toml`, `go.mod`), key paths (see registry `default_globs`).
5) Language/file mix: `.ts/.tsx` → frontend/backend; `.py` + `db/migrations` → data.

**Algorithm (deterministic):**
- Load `/instructions/roles/role_registry.yaml`.
- Gather signals; score each role:
  - +0.5 if profile includes role.
  - +0.3 if manifest/tools match `primary_tech`.
  - +0.2 if `default_globs` match existing files.
  - +0.1 if memory references the role in last N tasks.
- Normalize to [0,1]; select all roles with score ≥ 0.4 (cap 4). Mark the top scorer as `selected: true`.

**DocFetchReport additions (append-only):**
```json
{
  "roles": [
    {
      "role_id": "frontend_engineer",
      "title": "Frontend Engineer",
      "confidence": 0.82,
      "sources": ["ROLE_PROFILE.yaml", "package.json", "src/components/**"],
      "lifecycle": ["UI/UX","Frontend","Build/CI"],
      "primary_tech": {"languages":["TypeScript"],"frameworks":["Next.js","Tailwind"]},
      "globs": ["app/**","src/components/**"],
      "selected": true
    }
  ],
  "gaps_roles": [],
  "key_guidance_roles": [
    "Prefer server components; client only for interactivity (per registry).",
    "WCAG 2.2 AA; Core Web Vitals budget required."
  ]
}
````

**Failure handling:**

- If registry missing or unreadable → add entry to `DocFetchReport.validation_errors[]` and proceed with generic `software_engineer` fallback.
- If no role scores ≥ 0.4 → include the top role with `selected: true`, `confidence` noted, and set `DocFetchReport.gaps_roles` explaining low confidence.

**Integration:**

- Run **before** §A Preflight doc retrieval so docs fetch can target role stacks.
- No changes to `AGENTS.md` required; this pack only **adds** fields to `DocFetchReport`.

````

- **Role-pack template** — standardizes adding new roles quickly

```markdown
<!-- /instructions/templates/role-pack-template.md -->
---
description: "<ROLE> guidance and outputs"
globs: "<glob patterns for relevance, e.g., src/**, api/**>"
alwaysApply: false
---

# <ROLE> — Layered Execution Guide

## Scope
- Lifecycle: <choose relevant layers>
- Responsibilities: <2–3 bullets>

## Standards
- List key standards (e.g., WCAG/OWASP/PEP8) relevant to this role.

## Deliverables (pick relevant only)
- Artifacts to produce (contracts, configs, dashboards, runbooks, etc.).

## Output Blocks
- Use the six-section format (Role, Task, Context, Reasoning, Output format, Stop conditions).
- Include role-specific defaults (e.g., TS strict config, OpenAPI snippet shape).

## Validation
- Provide quick checks (lint/typecheck/schema snippet) that are **stateless**.

> How to use:
> 1) Add entry to `/instructions/roles/role_registry.yaml`.
> 2) Copy this template to `/instructions/roles/<role_id>.md` and fill sections.
> 3) Optionally add a rule-pack at `.cursor/rules/<role_id>.mdc` for auto-scoping.
````

- **Role tagging & governance (behavior extension)** — non-invasive tagging + rules

```markdown
<!-- /instructions/roles/adapter.md -->
# Role Tagging & Governance (Behavior Extension)

## Role Context Tags
- `@role{<role_id or title>}` — Elevate guidance and retrieval for a given role.
  - Examples: `@role{frontend_engineer}`, `@role{Backend Engineer}`.
- `@roles{<comma-separated>}` — Multi-role sessions (max 3).

These tags **do not** alter behavior unless coupled with a matching role pack; they primarily:
- Add selected roles into `DocFetchReport.roles[]` (with `source:"tag"`).
- Bias discovery scoring by +0.15 for the tagged roles.

## DocFetchReport Additions (role-aware)
- Allow the following append-only fields:
  - `roles[]` (see role_discovery.mdc).
  - `gaps_roles[]`: unmet signals or missing templates.
  - `informed_changes[].roles`: per-change role alignment.

## Governance
- **Do not** modify `AGENTS.md`.
- New roles require: registry entry + role doc (this folder) + optional rule-pack.
- Invalid role packs: skip and log to `DocFetchReport.validation_errors[]`.
```

- **Optional per-repo role profile** — lets a project declare its roles/overrides

```yaml
# /ROLE_PROFILE.yaml
version: 1
project_roles:
  - id: frontend_engineer
  - id: devops_engineer
default_role: frontend_engineer
overrides:
  frontend_engineer:
    default_globs: ["app/**", "src/components/**", "src/app/**", "ui/**"]
    deliverables:
      - "Route/Component map with states"
      - "A11y checklist (WCAG 2.2 AA)"
      - "Perf budgets (LCP<2.5s, CLS<0.1)"
notes: "Prefer Next.js App Router; shadcn/ui allowed."
```

- **Usage/validation:**

  - Add/adjust roles in `/instructions/roles/role_registry.yaml`.
  - For a new role, copy `/instructions/templates/role-pack-template.md` → `/instructions/roles/<role_id>.md`.
  - (Optional) Create `.cursor/rules/<role_id>.mdc` to auto-scope to paths and add role-specific prechecks.
  - If this repo needs fixed roles, include `/ROLE_PROFILE.yaml`. Discovery will pick it up automatically and log to `DocFetchReport.roles[]`.

6. Stop conditions

- “Role Discovery rule-pack present and `DocFetchReport.roles[]` populated with at least one `selected: true` entry and non-empty `sources`.”
- “Role Registry YAML validates and includes all current roles used by the repo.”
- “At least one new role doc created from the template or an existing one updated; validation rules log zero errors.”
