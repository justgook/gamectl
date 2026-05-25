---
title: Migrate archived Biomes to new SQL integration pattern
description: Decide how to restore Biomes after project SQL storage and migration patterns are defined.
status: open
tags: [plugin]
---

The Biomes generator was moved out of active plugin paths during cleanup and preserved as reference material. It should not be restored as-is.

Biomes should return only after deeper project-level SQL work clarifies database storage patterns, migrations, and SQL-backed Project Unit integration.

## Reference material

- `issues/references/generation-experiments/plugins/biomes/`

## Decision needed

Decide whether Biomes should be deleted permanently, kept archived, or migrated into a future SQL-backed Project Unit.

## Scope

- Review the archived Biomes generator and tests.
- Identify the SQL database storage and migration prerequisites.
- Define the target Project Unit/API shape before restoring any active Biomes code.
- Keep the implementation separate from Assets Inventory inspiration until that direction is documented.

## Acceptance criteria

- [ ] SQL/storage/migration prerequisites are named or linked.
- [ ] Decision recorded: delete permanently, keep archived, or migrate into a SQL-backed Project Unit.
- [ ] No active Biomes code is restored before the SQL integration direction is documented.

## Comments
