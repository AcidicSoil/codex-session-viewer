Goal
----
Deliver a polished session viewer with modern UI components and richer file insights.

User Story
----------

- As a code reviewer, I need visually rich timelines to assess agent sessions quickly.
- As a team lead, I need consistent filters to compare sessions without reconfiguration.

Milestones
----------

1. Component inventory and design alignment (Owner: Maya, Target: 2025-09-26)
   Exit: component map approved and shared style guide ready.
2. Timeline and filtering overhaul (Owner: Alex, Target: 2025-10-10)
   Exit: new timeline behind feature flag with tags input migration complete.
3. Diff insights and docs polish (Owner: Priya, Target: 2025-10-24)
   Exit: version linking plus docs updates merged and release candidate ready.

Tasks
-----

- [ ] Map legacy UI to new libraries (Owner: Maya, Est: 3d)
      Criteria: deliver mapping doc, identify gaps, flag blocking issues.
      Files: docs/ui-migration.md, src/components/
- [ ] Prototype Aceternity timeline (Owner: Alex, Est: 5d)
      Criteria: render events with images, keyboard nav, fallback storybook route.
      Files: src/components/timeline/, src/routes/session/
- [ ] Ship tags-input filtering (Owner: Sam, Est: 3d)
      Criteria: tags input filters sessions and syncs URL hash state.
      Files: src/components/filters/, src/state/session-store.ts
- [ ] Implement file version carousel (Owner: Priya, Est: 4d)
      Criteria: carousel per file, diff previews, selection persistence.
      Files: src/components/diff/, src/utils/session-db.ts
- [ ] Update docs and release checks (Owner: Lee, Est: 2d)
      Criteria: README plus docs refreshed with CHANGELOG entry, smoke test log server.
      Files: README.md, docs/, tools/log-server.mjs

Won't do
--------

- Live session streaming or real-time collaboration features.
- ML-based session insight generation.

Ideas for later
---------------

- AI-assisted summaries for bookmarked timelines.
- Workspace diff overlay comparing session vs. current repo state.

Validation
----------

- Run `npm run typecheck`, `npm run test`, `npm run build`.
- Manual session import regression on large sample logs.
- Verify IndexedDB migrations through browser devtools.

Risks
-----

- Component library bundle size or tree shaking gaps increasing load time.
- Timeline virtualization regressions once components swap in.
- IndexedDB schema changes causing data loss; mitigate with backups.
