# path: GEMINI.md

## Instruction Loading Model (Extended)

* **Baseline:** This file (GEMINI.md) is the canonical baseline.
* **Two extension types:**

  1. **Behavior extensions**. Plain instruction files.

     * Locations: `instructions/**/*.md`, `instructions/**/*.txt`
     * Ignored: paths starting with `_`, or names containing `.archive.`
  2. **Rule-packs**. Files with YAML front matter:

     ```markdown
     ---
     description: <one-line purpose>
     globs: <glob or comma-list, e.g., **/* or src/**/*.ts,apps/**>
     alwaysApply: true|false
     ---
     <optional body>
     ```

     * Locations: `instructions/**/*.md`, `instructions/**/*.mdc`, `.cursor/rules/**/*.mdc`
     * Detection: file starts with `---` and declares `description`, `globs`, `alwaysApply`
* **Scope semantics:**

  * `globs` limits where the pack claims relevance. If empty or missing, scope is repo-wide.
  * A pack can be listed even if no current files match, but it is marked “out of scope”.
* **Order and precedence:**

  * Default load order: lexicographic by path.
  * User can reorder before apply. Later wins on conflict.
  * If `alwaysApply: true`, default selection is **on** and pinned to the **end** of the order unless the user moves it.

---

## Startup confirmation flow

1. **Discover**

   * Collect behavior extensions and rule-packs from the locations above.
   * Exclude `_` prefixed paths and `.archive.` files.
2. **Summarize**

   * Title = first `# H1` if present, else filename.
   * For rule-packs show `alwaysApply` and `globs`.
3. **Confirm**

   * Options: **Apply all**, **Apply none**, **Select subset and order**.
   * Default = **Apply none** for behavior extensions. **Apply** for rule-packs with `alwaysApply: true`.
4. **Record**

   * Write final order to `DocFetchReport.approved_instructions[]`.
   * Write approved rule-packs to `DocFetchReport.approved_rule_packs[]` with `{path, alwaysApply, globs}`.

---

## Conflict resolution

* **Specificity rule:** If both target the same scope, the later item in the final order wins.
* **Pack vs. extension:** No special case. Order controls outcome.
* **Out-of-scope packs:** Do not affect behavior. They remain listed as informational.

---

## Tagging Syntax (context only)

**Context tag — `@{file}` (no behavior change)**

* Purpose: include files for retrieval only.
* Syntax: `@{path/to/file.md}`. Globs allowed.
* Report under `DocFetchReport.context_files[]`.

---

## Resolution and loading

1. Baseline = GEMINI.md.
2. Load **approved behavior extensions** in final order.
3. Load **approved rule-packs** in final order. Packs with `alwaysApply: true` default to the end.
4. Apply later-wins on conflicts.
5. Record `DocFetchReport.status`.

---

## Validation

* Behavior extension: must be readable text.
* Rule-pack: must have front matter with `description` (string), `globs` (string), `alwaysApply` (bool).
* Invalid items are skipped and logged in `DocFetchReport.validation_errors[]`.

---

## Execution flow (docs integration)

* **Preflight must list:**

  * `DocFetchReport.context_files[]` from `@{...}`
  * `DocFetchReport.approved_instructions[]`
  * `DocFetchReport.approved_rule_packs[]`
* Compose in this order:

  1. Baseline
  2. Behavior extensions
  3. Rule-packs
* Proceed only when `DocFetchReport.status == "OK"`.

---

## Failure handling

* If any approved item cannot be loaded:

  * Do not finalize. Return a “Docs Missing” plan with missing paths and a fix.
* If any context file fails:

  * Continue. Add to `DocFetchReport.gaps.context_missing[]`. Suggest a fix in the plan.

---

## DocFetchReport Addendum

When discovery/confirmation is used, add:

```json
{  "DocFetchReport": {    "approved_instructions": [      {"path": "instructions/prd_generator.md", "loaded": true, "order": 1},      {"path": "instructions/security/guardrails.md", "loaded": true, "order": 2}    ],    "context_files": [      {"path": "docs/changelog.md", "loaded": true}    ],    "memory_ops": [      {"tool": "memory", "op": "create_entities|create_relations|add_observations|read_graph|search_nodes", "time_utc": "<ISO8601>", "scope": "project:${PROJECT_TAG}"}    ],    "proposed_mcp_servers": [      {"name": "<lib> Docs", "url": "https://gitmcp.io/{OWNER}/{REPO}", "source": "techstack-bootstrap", "status": "proposed"}    ],    "owner_repo_resolution": [      {"library": "<lib>", "candidates": ["owner1/repo1", "owner2/repo2"], "selected": "owner/repo", "confidence": 0.92, "method": "registry|package_index|docs_link|search"}    ],    "server_inventory": [      {"name": "fastapi_docs", "url": "https://gitmcp.io/tiangolo/fastapi", "source": "project-local|user|generated", "writable": true}    ],    "server_diff": {      "missing": ["fastapi_docs", "httpx_docs"],      "extra": ["legacy_docs_server"]    },    "server_actions": [      {"action": "add", "name": "httpx_docs", "target": "project-local", "accepted": true}    ]  }}
```

> Note: Omit any fields related to generating or writing `config/mcp_servers.generated.toml`. Use a separate instruction file such as `instructions/mcp_servers_generated_concise.md` if present.

---

## A) Preflight: Latest Docs Requirement (**MUST**, Blocking)

**Goal:** Ensure the assistant retrieves and considers the *latest relevant docs* before planning, acting, or finalizing.

**Primary/Fallback Order (consolidated):**

1. **sourcebot** (primary) **or** **docfork** (if configured for direct retrieval)
2. **contex7-mcp** (fallback if the primary fails)
3. **gitmcp** (last-resort fallback if both above fail)

**What to do:**

* For every task that could touch code, configuration, APIs, tooling, or libraries:

  * Call **sourcebot** **or** **docfork** to fetch the latest documentation or guides.
  * If the chosen primary call **fails**, immediately retry with the other primary (**docfork** ⇄ **sourcebot**); if that also **fails**, retry with **contex7-mcp**; if that also **fails**, retry with **gitmcp**.
* Each successful call **MUST** capture:

  * Tool name, query/topic, retrieval timestamp (UTC), and source refs/URLs (or repo refs/commits).
* Scope:

  * Fetch docs for each **area to be touched** (framework, library, CLI, infra, etc.).
  * Prefer focused topics (e.g., "exception handlers", "lifespan", "retry policy", "schema").

**Failure handling:**

* If **all** providers fail for a required area, **do not finalize**. Return a minimal plan that includes:

  * The attempted providers and errors
  * The specific topics/areas still uncovered
  * A safe, read-only analysis and suggested next checks (or user confirmation).

**Proof-of-Work Artifact (required):**

* Produce and attach a `DocFetchReport` (JSON) with `status`, `tools_called[]`, `sources[]`, `coverage`, `key_guidance[]`, `gaps`, and `informed_changes[]`.

**Override Path (explicit, logged):**

* Allowed only for outages/ambiguous scope/timeboxed spikes. Must include:

```json
{  "Override": {    "reason": "server_down|ambiguous_scope|timeboxed_spike",    "risk_mitigation": ["read-only analysis", "scoped PoC", "user confirmation required"],    "expires_after": "1 action or 30m",    "requested_by": "system|user"  }}
```

---

## A.1) Tech & Language Identification (Pre-Requirement)

* Before running Preflight (§A), the assistant must determine both:

  1. The **primary language(s)** used in the project (e.g., TypeScript, Python, Go, Rust, Java, Bash).
  2. The **current project’s tech stack** (frameworks, libraries, infra, tools).
* Sources to infer language/stack:

  * Project tags (`${PROJECT_TAG}`), memory checkpoints, prior completion records.
  * Files present in repo (e.g., manifests like `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, CI configs).
  * File extensions in repo (`.ts`, `.js`, `.py`, `.go`, `.rs`, `.java`, `.sh`, `.sql`, etc.).
  * User/task context (explicit mentions of frameworks, CLIs, infra).
* **Repo mapping requirement:** Resolve the **canonical GitHub OWNER/REPO** for each detected library/tool whenever feasible.

  * **Resolution order:**

    1. **Registry mapping** (maintained lookup table for common libs).
    2. **Package index metadata** (e.g., npm `repository.url`, PyPI `project_urls` → `Source`/`Homepage`).
    3. **Official docs → GitHub link** discovery.
    4. **Targeted search** (as a last resort) with guardrails below.
  * **Guardrails:** Prefer official orgs; require name similarity and recent activity; avoid forks and mirrors unless explicitly chosen.
  * Record outcomes in `DocFetchReport.owner_repo_resolution[]` with candidates, selected repo, method, and confidence score.
* Doc retrieval (§A) **must cover each identified language and stack element** that will be touched by the task.
* Record both in the `DocFetchReport`:

```json
"tech_stack": ["<stack1>", "<stack2>"],
"languages": ["<lang1>", "<lang2>"]
```

---

## B) Decision Gate: No Finalize Without Proof (**MUST**)

* The assistant **MUST NOT**: finalize, apply diffs, modify files, or deliver a definitive answer **unless** `DocFetchReport.status == "OK"`.
* The planner/executor must verify `ctx.docs_ready == true` (set when at least one successful docs call exists **per required area**).
* If `status != OK` or `ctx.docs_ready != true`:

  * Stop. Return a **Docs Missing** message that lists the exact MCP calls and topics to run.

---

## 0) Debugging

* **Use consolidated docs-first flow** before touching any files or finalizing:

  * Try **sourcebot** → **docfork** (if configured) → **contex7-mcp** → **gitmcp**.
  * Record results in `DocFetchReport`.

## 1) Startup memory bootstrap (memory)

* On chat/session start: initialize **memory**.
* Retrieve (project-scoped):

  * **memory** → latest `memory_checkpoints` and recent task completions.
  * **memory** → ensure a graph namespace exists for this project and load prior nodes/edges.

    * **Server alias**: `memory` (e.g., Smithery "Memory Server" such as `@modelcontextprotocol/server-memory`).
    * **Bootstrap ops** (idempotent):

      * `create_entities` (or `upsert_entities`) for: `project:${PROJECT_TAG}`.
      * `create_relations` to link existing tasks/files if present.
      * `read_graph` / `search_nodes` to hydrate working context.
* Read/write rules:

  * Prefer **memory** for free-form notes and checkpoints.
  * Prefer **memory** for **structured** facts/relations (entities, edges, observations).
  * If memory is unavailable, record `memory_unavailable: true` in the session preamble.

## 2) On task completion (status → done)

* Write a concise completion to memory including:

  * `task_id`, `title`, `status`, `next step`
  * Files touched
  * Commit/PR link (if applicable)
  * Test results (if applicable)
* **Update the Knowledge Graph (memory)**:

  * Ensure base entity `project:${PROJECT_TAG}` exists.
  * Upsert `task:${task_id}` and any `file:<path>` entities touched.
  * Create/refresh relations:

    * `project:${PROJECT_TAG}` —\[owns]→ `task:${task_id}`
    * `task:${task_id}` —\[touches]→ `file:<path>`
    * `task:${task_id}` —\[status]→ `<status>`
    * Optional: `task:${task_id}` —\[depends\_on]→ `<entity>`
  * Attach `observations` capturing key outcomes (e.g., perf metrics, regressions, decisions).
* **Documentation maintenance (auto)** — when a task **changes user-facing behavior**, **APIs**, **setup**, **CLI**, or **examples**:

  * **README.md** — keep **Install**, **Quickstart**, and **Usage/CLI** sections current. Add/adjust new flags, env vars, endpoints, and examples introduced by the task.
  * **docs/CHANGELOG.md** — append an entry with **UTC date**, `task_id`, short summary, **breaking changes**, and **migration steps**. Create the file if missing.
  * **docs/** pages — update or add topic pages. If present, refresh **`index.md`**/**`SUMMARY.md`**/**MkDocs/Sphinx nav** to include new pages (alphabetical within section unless a numbered order exists).
  * **Build check** — run the project’s docs build if available (e.g., `npm run docs:build` | `mkdocs build` | `sphinx-build`). Record the result under `DocFetchReport.observations.docs_build`.
  * **Sync scripts** — run `docs:sync`/`docs-sync` if defined; otherwise propose a TODO in the completion note.
  * **Commit style** — use commit prefix `[docs] <scope>: <summary>` and link PR/issue.
  * **Scope guard** — never edit `GEMINI.md` as part of docs maintenance.
* Seed/Update the knowledge graph **before** exiting the task so subsequent sessions can leverage it.
* Do **NOT** write to `GEMINI.md` beyond these standing instructions.

## 3) Status management

* Use Task Master MCP to set task status (e.g., set to "in-progress" when starting).

## 4) Tagging for retrieval

* Use tags: `${PROJECT_TAG}`, `project:${PROJECT_TAG}`, `memory_checkpoint`, `completion`, `agents`, `routine`, `instructions`, plus task-specific tags.
* For memory entities/relations, mirror tags on observations (e.g., `graph`, `entity:task:${task_id}`, `file:<path>`), to ease cross-referencing with memory.

## 5) Handling user requests for code or docs

* When a task or a user requires **code**, **setup/config**, or **library/API documentation**:

  * **MUST** run the **Preflight** (§A) using the consolidated order (**sourcebot | docfork → contex7-mcp → gitmcp**).
  * Only proceed to produce diffs or create files after `DocFetchReport.status == "OK"`.

## 6) Project tech stack specifics (generic)

* Apply §A Preflight for the **current** stack and language(s).
* Prefer official documentation and repositories resolved in §A.1.
* If coverage is weak after **sourcebot → docfork → contex7-mcp → gitmcp**, fall back to targeted web search and record gaps.

## 7) Library docs retrieval (topic-focused)

* Use **sourcebot** first to fetch current docs before code changes. If configured and suitable for your workflow, **docfork** may be used to assemble or snapshot the retrieved docs.
* UI components: call shadcn-ui-mcp-server to retrieve component recipes and scaffolds before writing code; then generate. Log under DocFetchReport.tools\_called\[].
* If the primary retrieval tool fails, use **contex7-mcp**.
* If **contex7-mcp** also fails, use **gitmcp** (repo docs/source) to retrieve equivalents.
* Summarize
