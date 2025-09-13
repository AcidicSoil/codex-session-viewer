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
