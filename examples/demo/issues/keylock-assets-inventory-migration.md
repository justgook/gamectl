---
title: Decide Keylock progression generation direction
description: Decide whether Keylock should return as Assets Inventory-backed progression generation.
status: open
tags: [idea, plugin]
---

The old archived Keylock prototype code has been deleted. Do not restore it as a legacy plugin.

If restored, Keylock should be specified for the current Project Unit/plugin pattern and feed from the same future Assets Inventory data model. Skills, keys, locks, and related progression metadata should be defined in Assets Inventory rather than hardcoded or owned by a standalone legacy generator.

## Decision needed

Decide how Keylock progression generation should depend on Assets Inventory and whether it should become a future Project Unit after Assets Inventory and progression pipeline direction are clearer.

## Scope

- Identify the Assets Inventory entities needed for skills, keys, locks, and progression metadata.
- Define the new Project Unit/API shape before implementing new Keylock code.
- Avoid restoring host-callback or legacy plugin wiring.

## Acceptance criteria

- [ ] Assets Inventory data dependencies for skills/keys/locks are named or linked.
- [ ] Decision recorded: delete permanently as a concept or specify a future Project Unit.
- [ ] If migrated, target Project Unit/API shape is documented first.
- [ ] No legacy Keylock code is restored.

## Comments
