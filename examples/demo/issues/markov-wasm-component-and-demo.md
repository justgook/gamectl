---
title: Finish Markov Junior demo workflow integration
description: Polish the active Markov Junior WASM component, demo view, and generation workflow integration.
status: open
tags: [idea, plugin, view]
---

The old archived Markov prototype code has been deleted. Do not restore legacy Go plugin/view code.

Current Markov work lives in the active Odin-backed WASM component, XML-to-MJIR compiler, demo resources, and browser view. Future work should improve those active paths rather than reviving archived code.

## Decision needed

Define the remaining Markov demo workflow and nodegraph/preset integration shape now that the WASM component exists.

## Scope

- Review the active Markov Junior component and compiler docs before changing behavior.
- Define how 2D and 3D example models are loaded and displayed in the demo frontend.
- Define a nodegraph node/preset that runs Markov chain models in generation graphs.
- Keep production/runtime code separate from demo-only visualization concerns.
- Clean up demo models such as `connect-exits.xml` when their control-flow intent is unclear.

## Acceptance criteria

- [ ] Remaining Markov demo workflow requirements are documented.
- [ ] Nodegraph/preset integration requirements describe inputs, outputs, and how Markov participates in generation graphs.
- [ ] Active component/view/compiler paths are used for all future Markov work.
- [ ] No archived Markov code is restored.

## Comments
