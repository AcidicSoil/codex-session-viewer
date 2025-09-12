# path: instructions/ui/preline-ui.mdc


---
description: Use preline-ui-mcp-server to fetch patterns and scaffold UI components
globs: apps/**, packages/**, src/components/**, ui/**/*
alwaysApply: true
---


- When a task involves UI components:
- Call `preline-ui-mcp-server` to **list components, variants, props, examples, and import paths** before generating code.
- Prefer server-provided scaffolds; adapt to project tokens, Tailwind config, and alias paths.
- Record all calls under `DocFetchReport.tools_called[]` and sources under `DocFetchReport.sources[]`.
