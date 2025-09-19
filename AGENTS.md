## Instruction Loading Model (Extended)

- **Baseline:** This file (AGENTS.md) is the canonical baseline.

- **Two extension types:**

  1. **Behavior extensions**. Plain instruction files.

     - Locations: `instructions/**/*.md`, `instructions/**/*.txt`
     - Ignored: paths starting with `_`, or names containing `.archive.`
  2. **Rule-packs**. Files with YAML front matter:

     ```markdown
     ---
     description: <one-line purpose>
     globs: <glob or comma-list, e.g., **/* or src/**/*.ts,apps/**>
     alwaysApply: true|false
     ---
     <optional body>
     ```

     - Locations: `instructions/**/*.md`, `instructions/**/*.mdc`, `.cursor/rules/**/*.mdc`
     - Detection: file starts with `---` and declares `description`, `globs`, `alwaysApply`

- **Scope semantics:**

  - `globs` limits where the pack claims relevance. If empty or missing, scope is repo-wide.
  - A pack can be listed even if no current files match, but it is marked “out of scope”.

- **Order and precedence:**

  - Default load order: lexicographic by path.
  - User can reorder before apply. Later wins on conflict.
  - If `alwaysApply: true`, default selection is **on** and pinned to the **end** of the order unless the user moves it.

---

## Startup confirmation flow

1. **Discover**

   - Collect behavior extensions and rule-packs from the locations above.
   - Exclude `_` prefixed paths and `.archive.` files.
2. **Summarize**

   - Title = first `# H1` if present, else filename.
   - For rule-packs show `alwaysApply` and `globs`.
3. **Confirm**

   - Options: **Apply all**, **Apply none**, **Select subset and order**.
   - Default = **Apply none** for behavior extensions. **Apply** for rule-packs with `alwaysApply: true`.
4. **Record**

   - Write final order to `DocFetchReport.approved_instructions[]`.
   - Write approved rule-packs to `DocFetchReport.approved_rule_packs[]` with `{path, alwaysApply, globs}`.

---

## Conflict resolution

- **Specificity rule:** If both target the same scope, the later item in the final order wins.
- **Pack vs. extension:** No special case. Order controls outcome.
- **Out-of-scope packs:** Do not affect behavior. They remain listed as informational.

---

## Tagging Syntax (context only)

**Context tag — `@{file}` (no behavior change)**

- Purpose: include files for retrieval only.
- Syntax: `@{path/to/file.md}`. Globs allowed.
- Report under `DocFetchReport.context_files[]`.

---

## Resolution and loading

1. Baseline = AGENTS.md.
2. Load **approved behavior extensions** in final order.
3. Load **approved rule-packs** in final order. Packs with `alwaysApply: true` default to the end.
4. Apply later-wins on conflicts.
5. Record `DocFetchReport.status`.

---

## Validation

- Behavior extension: must be readable text.
- Rule-pack: must have front matter with `description` (string), `globs` (string), `alwaysApply` (bool).
- Invalid items are skipped and logged in `DocFetchReport.validation_errors[]`.

---

## Execution flow (docs integration)

- **Preflight must list:**

  - `DocFetchReport.context_files[]` from `@{...}`
  - `DocFetchReport.approved_instructions[]`
  - `DocFetchReport.approved_rule_packs[]`
- Compose in this order:

  1. Baseline
  2. Behavior extensions
  3. Rule-packs
- Proceed only when `DocFetchReport.status == "OK"`.

---

## Failure handling

- If any approved item cannot be loaded:

  - Do not finalize. Return a “Docs Missing” plan with missing paths and a fix.
- If any context file fails:

  - Continue. Add to `DocFetchReport.gaps.context_missing[]`. Suggest a fix in the plan.

---

## DocFetchReport Addendum

When discovery/confirmation is used, add:

```json
{
  "DocFetchReport": {
    "approved_instructions": [
      {"path": "instructions/prd_generator.md", "loaded": true, "order": 1},
      {"path": "instructions/security/guardrails.md", "loaded": true, "order": 2}
    ],
    "context_files": [
      {"path": "docs/changelog.md", "loaded": true}
    ],
    "memory_ops": [
      {"tool": "memory", "op": "create_entities|create_relations|add_observations|read_graph|search_nodes", "time_utc": "<ISO8601>", "scope": "project:${PROJECT_TAG}"}
    ],
    "proposed_mcp_servers": [
      {"name": "<lib> Docs", "url": "https://gitmcp.io/{OWNER}/{REPO}", "source": "techstack-bootstrap", "status": "proposed"}
    ],
    "owner_repo_resolution": [
      {"library": "<lib>", "candidates": ["owner1/repo1", "owner2/repo2"], "selected": "owner/repo", "confidence": 0.92, "method": "registry|package_index|docs_link|search"}
    ],
    "server_inventory": [
      {"name": "fastapi_docs", "url": "https://gitmcp.io/tiangolo/fastapi", "source": "project-local|user|generated", "writable": true}
    ],
    "server_diff": {
      "missing": ["fastapi_docs", "httpx_docs"],
      "extra": ["legacy_docs_server"]
    },
    "server_actions": [
      {"action": "add", "name": "httpx_docs", "target": "project-local", "accepted": true}
    ]
  }
}
```

> Note: Omit any fields related to generating or writing `config/mcp_servers.generated.toml`. Use a separate instruction file such as `instructions/mcp_servers_generated_concise.md` if present.

---

## A) Preflight: Latest Docs Requirement (**MUST**, Blocking)

**Goal:** Ensure the assistant retrieves and considers the *latest relevant docs* before planning, acting, or finalizing.

**Primary/Fallback Order (consolidated):**

1. **contex7-mcp** (primary)
2. **gitmcp** (fallback)

**What to do:**

- For every task that could touch code, configuration, APIs, tooling, or libraries:

  - Call **contex7-mcp** to fetch the latest documentation or guides.
  - If the **primary** call **fails**, retry with **gitmcp**.
- Each successful call **MUST** capture:

  - Tool name, query/topic, retrieval timestamp (UTC), and source refs/URLs (or repo refs/commits).
- Scope:

  - Fetch docs for each **area to be touched** (framework, library, CLI, infra, etc.).
  - Prefer focused topics (e.g., "exception handlers", "lifespan", "retry policy", "schema").

**Failure handling:**

- If **all** providers fail for a required area, **do not finalize**. Return a minimal plan that includes:

  - The attempted providers and errors
  - The specific topics/areas still uncovered
  - A safe, read-only analysis and suggested next checks (or user confirmation).

**Proof-of-Work Artifact (required):**

- Produce and attach a `DocFetchReport` (JSON) with `status`, `tools_called[]`, `sources[]`, `coverage`, `key_guidance[]`, `gaps`, and `informed_changes[]`.

**Override Path (explicit, logged):**

Allowed only for outages/ambiguous scope/timeboxed spikes. Must include:

```json
{
  "Override": {
    "reason": "server_down|ambiguous_scope|timeboxed_spike",
    "risk_mitigation": ["read-only analysis", "scoped PoC", "user confirmation required"],
    "expires_after": "1 action or 30m",
    "requested_by": "system|user"
  }
}
```

---

## A.1) Tech & Language Identification (Pre-Requirement)

- Before running Preflight (§A), the assistant must determine both:

  1. The **primary language(s)** used in the project (e.g., TypeScript, Python, Go, Rust, Java, Bash).
  2. The **current project’s tech stack** (frameworks, libraries, infra, tools).

- Sources to infer language/stack:

  - Project tags (`${PROJECT_TAG}`), memory checkpoints, prior completion records.
  - Files present in repo (e.g., manifests like `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, CI configs).
  - File extensions in repo (`.ts`, `.js`, `.py`, `.go`, `.rs`, `.java`, `.sh`, `.sql`, etc.).
  - User/task context (explicit mentions of frameworks, CLIs, infra).

- **Repo mapping requirement:** Resolve the **canonical GitHub OWNER/REPO** for each detected library/tool whenever feasible.

  - **Resolution order:**

    1. **Registry mapping** (maintained lookup table for common libs).
    2. **Package index metadata** (e.g., npm `repository.url`, PyPI `project_urls` → `Source`/`Homepage`).
    3. **Official docs → GitHub link** discovery.
    4. **Targeted search** (as a last resort) with guardrails below.
  - **Guardrails:** Prefer official orgs; require name similarity and recent activity; avoid forks and mirrors unless explicitly chosen.
  - Record outcomes in `DocFetchReport.owner_repo_resolution[]` with candidates, selected repo, method, and confidence score.

- Doc retrieval (§A) **must cover each identified language and stack element** that will be touched by the task.

- Record both in the `DocFetchReport`:

```json
"tech_stack": ["<stack1>", "<stack2>"],
"languages": ["<lang1>", "<lang2>"]
```

---

## B) Decision Gate: No Finalize Without Proof (**MUST**)

- The assistant **MUST NOT**: finalize, apply diffs, modify files, or deliver a definitive answer **unless** `DocFetchReport.status == "OK"`.
- The planner/executor must verify `ctx.docs_ready == true` (set when at least one successful docs call exists **per required area**).
- If `status != OK` or `ctx.docs_ready != true`:

  - Stop. Return a **Docs Missing** message that lists the exact MCP calls and topics to run.

---

## 0) Debugging

- **Use consolidated docs-first flow** before touching any files or finalizing:

  - Try **contex7-mcp** → **gitmcp**.
  - Record results in `DocFetchReport`.

## 1) Startup memory bootstrap (memory)

- On chat/session start: initialize **memory**.

- Retrieve (project-scoped):

  - **memory** → latest `memory_checkpoints` and recent task completions.
  - **memory** → ensure a graph namespace exists for this project and load prior nodes/edges.

    - **Server alias**: `memory` (e.g., Smithery "Memory Server" such as `@modelcontextprotocol/server-memory`).
    - **Bootstrap ops** (idempotent):

      - `create_entities` (or `upsert_entities`) for: `project:${PROJECT_TAG}`.
      - `create_relations` to link existing tasks/files if present.
      - `read_graph` / `search_nodes` to hydrate working context.

- Read/write rules:

  - Prefer **memory** for free-form notes and checkpoints.
  - Prefer **memory** for **structured** facts/relations (entities, edges, observations).
  - If memory is unavailable, record `memory_unavailable: true` in the session preamble.

### 1.0) Memory MCP Server Usage Contract (**NEW**)

- **Alias:** `memory`.
- **Required tools:** `create_entities`, `create_relations`, `add_observations`, `delete_entities`, `delete_observations`, `delete_relations`, `read_graph`, `search_nodes`, `open_nodes`.
- **Concept rules:**

  - **Entities** carry `name`, `entityType`, `observations[]`. Names are unique. Observations are atomic facts.
  - **Relations** are directed and written in **active voice**: `{from, to, relationType}`.
  - **Observations** are strings attached to entities; add/remove independently.
- **Operational guarantees:**

  - Treat `create_*` as **idempotent upserts**. Skip duplicates silently.
  - `delete_*` calls are **tolerant** to missing targets. No errors on non-existent items.
  - `open_nodes` returns only requested entities and their inter-relations; silently skips misses.
- **Usage patterns:**

  - On startup, ensure `project:${PROJECT_TAG}` exists; seed task and file nodes as needed.
  - During execution, append observations for subtask starts/finishes; keep `percent_complete` on `task:${task_id}`.
  - On completion, upsert entities and relations for `project`, `task`, and `file:<path>` per §2.
- **Setup pointers (non-blocking):**

  - Storage file via `MEMORY_FILE_PATH` env; default `memory.json`.
  - Configure server in **user** MCP config or workspace `.vscode/mcp.json`. Do not embed install steps here.
- **Prompting note:**

  - If a separate chat-personalization prompt is used, it must not override gates (§A, §B) nor status flow (§3). Treat it as guidance for memory creation frequency and categories.

### 1.1) Subtask plan and finish-in-one-go contract (**NEW**)

- **Before starting execution**, derive a **subtask plan** with clear **Definition of Done (DoD)** per subtask.
- **Finish-in-one-go policy:** Once execution starts, work the subtask list to completion within the session unless a blocking gate occurs (§A, §B, or external dependency). If blocked, record the block and propose an unblock plan; do not leave partial work without a recorded reason.
- **Recording:** Persist the subtask plan to **memory** under `task:${task_id}` as `observations.plan` with timestamps.

### 1.2) Execution logging to memory (**NEW**)

- For each subtask: on **start** and **finish**, append an observation to `task:${task_id}` including `subtask_id`, `action`, `files_touched[]`, and short result.
- Keep a running `percent_complete` on the task node. Update after each subtask.
- Mirror links: `task:${task_id}` —\[touches]→ `file:<path>` as work proceeds, not only at the end.

## 2) On task completion (status → done)

- Write a concise completion to memory including:

  - `task_id`, `title`, `status`, `next step`
  - Files touched
  - Commit/PR link (if applicable)
  - Test results (if applicable)

- **Completion criteria (explicit):**

  - All subtasks from §1.1 are marked **done** and their DoD satisfied.
  - Required gates passed (§A, §B).
  - Post-completion checks executed or proposed (§2.1).

- **Update the Knowledge Graph (memory)**:

  - Ensure base entity `project:${PROJECT_TAG}` exists.
  - Upsert `task:${task_id}` and any `file:<path>` entities touched.
  - Create/refresh relations:

    - `project:${PROJECT_TAG}` —\[owns]→ `task:${task_id}`
    - `task:${task_id}` —\[touches]→ `file:<path>`
    - `task:${task_id}` —\[status]→ `<status>`
    - Optional: `task:${task_id}` —\[depends\_on]→ `<entity>`
  - Attach `observations` capturing key outcomes (e.g., perf metrics, regressions, decisions).

- **Documentation maintenance (auto)** — when a task **changes user-facing behavior**, **APIs**, **setup**, **CLI**, or **examples**:

  - **README.md** — keep **Install**, **Quickstart**, and **Usage/CLI** sections current. Add/adjust new flags, env vars, endpoints, and examples introduced by the task.
  - **docs/CHANGELOG.md** — append an entry with **UTC date**, `task_id`, short summary, **breaking changes**, and **migration steps**. Create the file if missing.
  - **docs/** pages — update or add topic pages. If present, refresh **`index.md`**/**`SUMMARY.md`**/**MkDocs/Sphinx nav** to include new pages (alphabetical within section unless a numbered order exists).
  - **Build check** — run the project’s docs build if available (e.g., `npm run docs:build` | `mkdocs build` | `sphinx-build`). Record the result under `DocFetchReport.observations.docs_build`.
  - **Sync scripts** — run `docs:sync`/`docs-sync` if defined; otherwise propose a TODO in the completion note.
  - **Commit style** — use commit prefix `[docs] <scope>: <summary>` and link PR/issue.
  - **Scope guard** — never edit `AGENTS.md` as part of docs maintenance.

- Seed/Update the knowledge graph **before** exiting the task so subsequent sessions can leverage it.

- Do **NOT** write to `AGENTS.md` beyond these standing instructions.

### 2.1) Post-completion checks and tests (**REVISED — Run-then-verify**)

- **Order of operations:**
  a) Append subtask completion logs to **memory** (§1.2).
  b) Set task status to **`verify`** (new intermediate state).
  c) Evaluate the **Safety Gate** per **§8 Environment & Testing Policy**.
  d) If **safe**, run **stateless checks automatically** (see §8 Allowed Automatic Checks).
  e) If **unsafe**, **defer** execution and emit a **Local Test Instructions** block for the user.

- **Recording:** Write outcomes to `task:${task_id}.observations.test_results` and also set:

  - `tests_deferred: true|false`
  - `tests_deferred_reason: <string|null>`
  - `test_log_path: artifacts/test/<UTC-timestamp>.log` when any checks are executed.

- **Status transitions:**

  - On all checks passing → set status **`done`**.
  - On failures → set status **`blocked`** and record an unblock plan.
  - On deferral → set status **`needs-local-tests`** and include the instructions block.

- **Local Test Instructions (example, Proposed — not executed):**

```bash
# Proposed Local Test Instructions — copy/paste locally
# Reason: Safety Gate triggered deferral (e.g., venv detected, risk of global mutation, or OS mismatch)

# TypeScript/Node (stateless checks)
npm run typecheck --silent || exit 1
npm run lint --silent || exit 1
npm run -s build --dry-run || exit 1

# Python (use uv; do NOT activate any existing venv)
# Pure unit tests only; no network, no DB, no writes outside ./artifacts
uv run -q python -c "import sys; sys.exit(0)" || exit 1
uv run -q ruff check . || exit 1
uv run -q pyright || exit 1
uv run -q pytest -q tests/unit -k "not integration" || exit 1

# Expected: exit code 0 on success; non-zero indicates failures to review.
```

---

## 3) Status management (**REVISED**)

- Use Task Master MCP to set task status:

  - **`in-progress`** on start of execution after §A and §1.1 planning.
  - **`verify`** automatically after memory updates and before tests (§2.1).
  - **Auto-set `done`** when all subtasks are done, gates passed, and §2.1 checks succeed.
  - **`needs-local-tests`** when §2.1 defers execution via the Safety Gate.
  - **`blocked`** when a check fails or a gate prevents progress; include block reason and an unblock plan in memory.

- **Transition rules:**
  `in-progress → verify → done` on success.
  `verify → blocked` on check failure.
  `verify → needs-local-tests` on deferral.

---

## 4) Tagging for retrieval

- Use tags: `${PROJECT_TAG}`, `project:${PROJECT_TAG}`, `memory_checkpoint`, `completion`, `agents`, `routine`, `instructions`, plus task-specific tags.
- For memory entities/relations, mirror tags on observations (e.g., `graph`, `entity:task:${task_id}`, `file:<path>`), to ease cross-referencing with memory.

---

## 5) Handling user requests for code or docs

- When a task or a user requires **code**, **setup/config**, or **library/API documentation**:

  - **MUST** run the **Preflight** (§A) using the consolidated order (**contex7-mcp → gitmcp**).
  - Only proceed to produce diffs or create files after `DocFetchReport.status == "OK"`.

---

## 6) Project tech stack specifics (generic)

- Apply §A Preflight for the **current** stack and language(s).
- Prefer official documentation and repositories resolved in §A.1.
- If coverage is weak after **contex7-mcp → gitmcp**, fall back to targeted web search and record gaps.

---

## 6.1) Layered Execution Guides (**NEW**)

Each layer defines role, task, context, reasoning, output format, and stop conditions. Use these blocks when planning and reviewing work in that layer.

### Client/UI Layer — Frontend Engineer, UI Engineer, UX Designer

1. **Role**

   - Own user-facing components and flows.
2. **Task**

   - Draft routes and components. Specify Tailwind classes and responsive breakpoints. Define accessibility and keyboard flows. List loading, empty, and error states. Map data needs to hooks. Set performance budgets.
3. **Context**

   - Next.js app router. Tailwind. shadcn/ui allowed. Target Core Web Vitals good. WCAG 2.2 AA.
4. **Reasoning**

   - Prefer server components for data. Client components only for interactivity. Avoid prop drilling. Use context only for shared UI state. Minimize re-renders. Defer non-critical JS.
5. **Output format**

   - Markdown table: Route | Component | Type (server|client) | States | Data source | Notes.
6. **Stop conditions**

   - Any route lacks explicit states. Missing keyboard flow. CLS or LCP budget undefined. Unmapped data dependency.

### Build & Tooling Layer — Frontend Build Engineer, Tooling Engineer, DevOps Engineer

1. **Role**

   - Maintain fast, reproducible builds and CI.
2. **Task**

   - Define bundler settings, lint, format, typecheck, unit test, and build steps. Configure CI matrix and caching. Enforce pre-commit hooks.
3. **Context**

   - Turbopack or Vite. ESLint. Prettier. Vitest. Node LTS.
4. **Reasoning**

   - Fail fast. Cache effectively. Keep steps isolated and deterministic. No network during tests unless mocked.
5. **Output format**

   - Checklist with commands, CI job matrix, cache keys, and expected durations.
6. **Stop conditions**

   - Non-deterministic builds. Unpinned tool versions. CI steps mutate global state. Missing cache strategy.

### Language & Type Layer — Software Engineer, TypeScript/JavaScript Specialist

1. **Role**

   - Enforce language rules and type safety.
2. **Task**

   - Set `tsconfig` targets. Define strict compiler flags. Establish type patterns and utilities. Require JSDoc where types are complex.
3. **Context**

   - TypeScript strict mode. ESM. Node and browser targets as needed.
4. **Reasoning**

   - Prefer explicit types. Use generics judiciously. Model nullability. Narrow unions at boundaries.
5. **Output format**

   - `tsconfig` fragment, lint rules list, and target type coverage goals by package.
6. **Stop conditions**

   - `any` or `unknown` leaks to public APIs. Implicit `any` enabled. Type coverage goals undefined.

### State & Data Layer — Frontend Engineer, State Management Specialist, Full-Stack Engineer

1. **Role**

   - Control state lifecycles and data fetching.
2. **Task**

   - Choose client vs server state. Define stores, selectors, and cache policy. Specify invalidation and suspense boundaries.
3. **Context**

   - React state, context, or a store. Fetch via RSC or client hooks. Cache with SWR or equivalent.
4. **Reasoning**

   - Server fetch by default. Co-locate state with consumers. Keep derived state computed. Normalize entities.
5. **Output format**

   - State inventory table: State | Scope | Source | Lifetime | Invalidation | Consumers.
6. **Stop conditions**

   - Duplicate sources of truth. Unbounded caches. Missing invalidation plan. Server-client mismatch.

### API/Backend Layer — Backend Engineer, API Developer, Full-Stack Engineer

1. **Role**

   - Provide stable contracts for data and actions.
2. **Task**

   - Define endpoints or schema. Specify auth, pagination, filtering, errors, and idempotency. Version contracts.
3. **Context**

   - REST or GraphQL. JSON. OpenAPI or SDL.
4. **Reasoning**

   - Design for evolution. Prefer standard status codes. Use cursor pagination. Return problem details.
5. **Output format**

   - OpenAPI snippet or GraphQL SDL. Error model table and example requests.
6. **Stop conditions**

   - Breaking change without versioning. Inconsistent pagination. Ambiguous error semantics. Missing auth notes.

### Database & Persistence Layer — Database Engineer, Data Engineer, Backend Engineer

1. **Role**

   - Safeguard data correctness and performance.
2. **Task**

   - Model schema. Choose indexes. Define migrations and retention. Set transaction boundaries.
3. **Context**

   - SQL or NoSQL. Managed service or local. Migration tool required.
4. **Reasoning**

   - Normalize until it hurts then denormalize where measured. Prefer declarative migrations. Use constraints.
5. **Output format**

   - Schema diagram or DDL. Migration plan with up and down steps. Index plan with rationale.
6. **Stop conditions**

   - Missing primary keys. Unsafe destructive migration. No rollback path. Unbounded growth.

### Deployment & Hosting Layer — DevOps Engineer, Cloud Engineer, Platform Engineer

1. **Role**

   - Ship safely and reversibly.
2. **Task**

   - Define environments, build artifacts, release gates, and rollout strategy. Set rollback procedures.
3. **Context**

   - IaC preferred. Blue/green or canary. Artifact registry. Secrets manager.
4. **Reasoning**

   - Immutable artifacts. Promote by provenance. Automate checks before traffic shift.
5. **Output format**

   - Release plan: envs, gates, rollout, rollback steps, and metrics to watch.
6. **Stop conditions**

   - Manual pet deployments. No rollback tested. Secrets in env without manager. Drift from IaC.

### Observability & Ops Layer — Site Reliability Engineer, DevOps Engineer, Monitoring Specialist

1. **Role**

   - Ensure reliability and rapid diagnosis.
2. **Task**

   - Define logs, metrics, traces, dashboards, SLOs, and alerts. Set runbooks.
3. **Context**

   - Centralized logging. Metrics store. Tracing. On-call rotation.
4. **Reasoning**

   - Measure user impact first. Alert on symptoms not causes. Keep noise low.
5. **Output format**

   - SLO doc. Alert rules list. Dashboard inventory with owners.
6. **Stop conditions**

   - No SLOs. Alerts without ownership. Missing runbooks. High alert noise.

### Security & Auth Layer — Security Engineer, Identity and Access Management Engineer, DevOps with Security Focus

1. **Role**

   - Protect assets and identities.
2. **Task**

   - Define authN and authZ flows. Manage secrets. Apply threat modeling and controls.
3. **Context**

   - OAuth or OIDC. Role based access. Secret store.
4. **Reasoning**

   - Least privilege. Rotate secrets. Validate all inputs. Log security events.
5. **Output format**

   - Auth flow diagram. Permission matrix. Threat model checklist.
6. **Stop conditions**

   - Hardcoded secrets. Missing MFA for admin. Broad tokens. Unvalidated input at boundaries.

---

## 7) Library docs retrieval (topic-focused)

- Use **contex7-mcp** first to fetch current docs before code changes.
- UI components: call shadcn-ui-mcp-server to retrieve component recipes and scaffolds before writing code; then generate. Log under DocFetchReport.tools\_called\[].
- If **contex7-mcp** fails, use **gitmcp** (repo docs/source) to retrieve equivalents.
- Summarize key guidance inline in `DocFetchReport.key_guidance` and map each planned change to a guidance line.
- Always note in the task preamble that docs were fetched and which topics/IDs were used.

---

## 8) Environment & Testing Policy (**REVISED: Safety Gate for automatic stateless checks**)

**Objective:** Allow **automatic stateless checks** post-completion when safe, while preventing environment drift or global mutations. Keep heavier or stateful tests **opt-in**.

**Safety Gate checklist (used by §2.1 step c):**

1. **Execution scope** is read-only or hermetic.
2. **No environment activation** of existing shells or venvs.
3. **No network** access unless explicitly approved.
4. **No global writes** or package installs; all outputs limited to `./artifacts/`.
5. **Command review** shows only stateless operations.

**Allowed Automatic Checks (when Safety Gate passes):**

- Typecheck, lint, and format-check.
- Build **dry-run** only.
- Docs build if it does not write outside `./artifacts`.
- Unit tests limited to **pure** functions with no I/O, no network, and no writes beyond `./artifacts`.

**Deferral conditions** (any true ⇒ **defer** and emit Local Test Instructions):

- Active Python venv detected (`VIRTUAL_ENV` set) or `.venv/` present in repo.
- Managed envs or shims detected (e.g., `conda`, `poetry env`, Nix shells).
- Commands imply global mutations, installs, migrations, DB writes, or network calls without explicit approval.
- OS or shell mismatch risk in user context.

**Python rule:** If Python commands are needed and considered safe, use **`uv`** exclusively (`uv run`, `uvx`). **Do not** activate existing venvs.

**Pre-run Test Plan (required for any automatic run):**

- Exact commands, working directory, environment variables, and expected exit codes.
- A short **Risk table** explaining why each command is safe under the Safety Gate.

**Execution protocol (automatic checks):**

- Run the approved commands exactly.
- Capture stdout/stderr to `artifacts/test/<UTC-timestamp>.log`.
- Do not modify other files.

**Post-run recording:**

- Add outcomes to the completion note and `DocFetchReport`.
- Update `task:${task_id}.observations.test_results` and `test_log_path`.

**Deferral protocol:**

- Emit a **Local Test Instructions** block (see §2.1 example) with copy-paste commands, rationale, and expected exit codes.
- Record `tests_deferred_reason` and set status to **`needs-local-tests`**.

---

### System-prompt scaffold (enforcement)

```markdown
SYSTEM: You operate under a blocking docs-first policy.
1) Preflight (§A):
   - Call contex7-mcp → gitmcp as needed.
   - Build DocFetchReport (status must be OK).
2) Planning:
   - Map each planned change to key_guidance items in DocFetchReport.
   - Build a subtask plan with DoD (§1.1) and record to memory.
3) Decision Gate (§B):
   - If DocFetchReport.status != OK → STOP and return "Docs Missing" with exact MCP calls.
4) Execution:
   - Proceed only if ctx.docs_ready == true.
   - Log subtask progress to memory (§1.2). Finish-in-one-go unless blocked.
5) Completion:
   - After memory updates, set status to **verify** and evaluate §8 Safety Gate.
   - Run allowed automatic checks or defer with Local Test Instructions (§2.1, §8).
   - Verify all subtasks done, then set status **done** on success; otherwise **blocked** or **needs-local-tests**.
   - Attach DocFetchReport and write completion memory (§2).
```

---

## Prompt Registry & Precedence

- **Baseline:** AGENTS.md is always authoritative. Prompts in `~/.codex/prompts` are available but inert until manually invoked.
- **Engagement:** Prompts run only when the user explicitly types the slash command or pastes the body. The assistant must not auto-run them.
- **Precedence:** Behavior extensions and rule-packs follow later-wins. Prompts never override baseline unless pasted inline.
- **Recording:** When invoked, the assistant must echo which prompt was used and log it in `DocFetchReport.approved_instructions[]` as `{source: "~/.codex/prompts", command: "/<name>"}`.

---

## Prompt Discovery & Namespacing

- **Discovery:** `/foo` resolves to `~/.codex/prompts/foo.md`. No auto-run.
- **Reserved namespace:** `/vibe-*` for YC-style playbooks and planning flows.
- **Default shortlist:** Recommended safe manual commands:

  - `/planning-process`, `/scope-control`, `/integration-test`, `/regression-guard`, `/review`, `/release-notes`, `/reset-strategy`, `/compare-outputs`.
  - Newly available and supported: `/scaffold-fullstack`, `/api-contract`, `/openapi-generate`, `/db-bootstrap`, `/migration-plan`, `/auth-scaffold`, `/e2e-runner-setup`, `/env-setup`, `/secrets-manager-setup`, `/iac-bootstrap`, `/monitoring-setup`, `/slo-setup`, `/feature-flags`.

---

## Prompt→Gate Router

-
- **Scope Gate:** `/scope-control`, `/plan`, `/planning-process`
- **Test Gate:** `/integration-test`, `/regression-guard`, `/coverage-guide`
- **Review Gate:** `/review`, `/review-branch`, `/pr-desc`, `/owners`
- **Release Gate:** `/release-notes`, `/version-proposal`
- **Reset path:** `/reset-strategy`
- **Model tactics:** `/compare-outputs`, `/switch-model`, `/model-strengths`

---

## Prompt Safety & Proof Hooks

-
- Prompts cannot bypass Preflight (§A) or Decision Gate (§B).
- If a prompt suggests stateful changes, require Safety Gate review first.
- Before acting on prompt output, confirm `DocFetchReport.status == "OK"`.
- Append invoked prompts to `DocFetchReport.tools_called[]` as `{tool: "prompt", name: "/<cmd>", path: "~/.codex/prompts/<file>.md", time_utc}`.

---

## Prompt Non-Goals

-
- No auto-invocation of prompts.
- Prompts must not redefine baseline gates, safety policies, or precedence.
- If a command is unrecognized, check `~/.codex/prompts/<name>.md` and restart Codex if missing.

---

## Install & Availability Note

-
- Place your prompt catalog at `~/.codex/prompts` so slash commands like `/foo` resolve to `~/.codex/prompts/foo.md`.
- Restart your Codex client if new prompts are not discovered. Hot‑reload is not guaranteed.
- File naming must match the command exactly, use `.md` extension, and avoid hidden files or directories prefixed with `_`.
- On Windows + WSL2, store prompts in the Linux home directory and, if needed, symlink from Windows paths to keep a single source of truth.

---

## Gemini→Codex Mapper (optional)

If you maintain mapper templates, you may expose a manual command like `/gemini-map <template>` that maps Gemini‑style request blocks into Codex‑style tasks. Group mapper templates under Architecture, Debug, Review, and Quality. Treat all mapper runs as manual accelerators that never bypass gates (§A, §B).

---

## Troubleshooting

-
- **Slash not recognized:** Verify `~/.codex/prompts/<name>.md` exists and the filename matches the command. Restart the client.
- **Prompt not applied:** Prompts are inert until manually invoked. Ensure you typed the slash command or pasted the prompt body.
- **Discovery issues:** Avoid directories starting with `_` or filenames containing `.archive.` which are ignored by design.

---

## Version Pinning (optional)

For reproducibility, pin the prompt catalog to a specific commit SHA. Record the SHA in project docs or a local dotfile so teams share the same prompt semantics across runs.

---

## Workflow Expansion Example

To demonstrate prompts in practice, a full-stack app workflow includes:

1. **Preflight Docs** → ensure latest docs. Block if `status != OK`.
2. **Planning** → `/planning-process`, `/scope-control`, `/stack-evaluation`.
3. **Scaffold** → `/scaffold-fullstack`, `/api-contract`, `/openapi-generate`.
4. **Data/Auth** → `/db-bootstrap`, `/migration-plan`, `/auth-scaffold`.
5. **Frontend** → `/modular-architecture`, `/ui-screenshots`, `/design-assets`.
6. **Testing** → `/e2e-runner-setup`, `/integration-test`, `/coverage-guide`, `/regression-guard`.
7. **CI/CD** → `/version-control-guide`, `/devops-automation`, `/env-setup`, `/secrets-manager-setup`, `/iac-bootstrap`.
8. **Release** → `/owners`, `/review`, `/review-branch`, `/pr-desc`, `/release-notes`, `/version-proposal`.
9. **Ops** → `/monitoring-setup`, `/slo-setup`, `/logging-strategy`, `/audit`.
10. **Post-release** → `/error-analysis`, `/fix`, `/refactor-suggestions`, `/file-modularity`, `/dead-code-scan`, `/cleanup-branches`, `/feature-flags`.
11. **Model tactics** → `/model-strengths`, `/model-evaluation`, `/compare-outputs`, `/switch-model`.

**Prompt catalog status:** All prompts referenced in this workflow are present in `~/.codex/prompts` and can be invoked as shown. To verify, run a discovery pass and confirm the resolver paths match the command names.

- Discovery check: ensure files exist at `~/.codex/prompts/<name>.md` for every command listed above.
- If any command is not recognized, restart the client and re-check filename casing and extension.

---

*End of file.*
