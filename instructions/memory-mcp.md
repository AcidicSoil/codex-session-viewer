# path: instructions/memory-mcp.md

---
description: Usage contract and core concepts for Knowledge Graph Memory MCP server
globs: **/*
alwaysApply: true
---

# Knowledge Graph Memory Server (alias: memory)

## Core Concepts

- **Entities:** unique name, entityType, observations[] (atomic facts).
- **Relations:** directed, active-voice `{from,to,relationType}`.
- **Observations:** attach/remove strings on entities independently.

## Tools (contract)

- create_entities
- create_relations
- add_observations
- delete_entities
- delete_observations
- delete_relations
- read_graph
- search_nodes
- open_nodes

## Usage

- On startup, upsert `project:${PROJECT_TAG}`, hydrate graph.
- Append observations for subtask starts/finishes; track `percent_complete`.
- On completion, update project/task/file entities and relations.
- All create/delete operations are idempotent or tolerant to misses.

## Setup

- Storage: `MEMORY_FILE_PATH` (default `memory.json`).
- Config via user `mcp.json` or workspace `.vscode/mcp.json`.
