
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
