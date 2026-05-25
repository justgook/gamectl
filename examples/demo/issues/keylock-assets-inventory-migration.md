---
title: Migrate Keylock to Assets Inventory-backed progression generation
description: Refactor archived Keylock to the new Project Unit pattern using Assets Inventory data.
status: open
tags: [idea, plugin]
---

The Keylock generator was moved out of active plugin paths during cleanup and preserved as reference material. It should not be restored as a legacy plugin.

If restored, Keylock should be refactored to the current Project Unit/plugin pattern and feed from the same future Assets Inventory data model. Skills, keys, locks, and related progression metadata should be defined in Assets Inventory rather than hardcoded or owned by a standalone legacy generator.

## Reference material

- `issues/references/generation-experiments/plugins/keylock/`
- `issues/assets-inventory-yoinking.md`

## Decision needed

Decide how Keylock progression generation should depend on Assets Inventory and whether it should become a future Project Unit after Assets Inventory and progression pipeline direction are clearer.

## Scope

- Review archived Keylock generator logic.
- Identify the Assets Inventory entities needed for skills, keys, locks, and progression metadata.
- Define the new Project Unit/API shape before restoring active code.
- Avoid restoring host-callback or legacy plugin wiring.

## Acceptance criteria

- [ ] Assets Inventory data dependencies for skills/keys/locks are named or linked.
- [ ] Decision recorded: delete permanently, keep archived, or migrate into a future Project Unit.
- [ ] If migrated, target Project Unit/API shape is documented first.
- [ ] No active Keylock code is restored before the Assets Inventory dependency is documented.

## Comments
