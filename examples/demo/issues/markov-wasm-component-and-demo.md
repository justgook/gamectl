---
title: Refactor Markov into WASM component and demo workflow
description: Replace archived Markov prototype with an Odin-backed WASM component, 2D/3D demo UI, and nodegraph integration.
status: open
tags: [idea, plugin, view]
---

The Markov generator stack was moved out of active plugin/view paths during cleanup and preserved as reference material. It should not be restored as-is.

The future direction is a total refactor: the backend should become a WASM component, preferably Odin-based, and the frontend should become a demo workflow rather than legacy production UI. The demo should support both 2D and 3D examples. Nodegraph should expose a node that can run Markov chain models as part of a broader generation process.

## Reference material

- `issues/references/generation-experiments/plugins/markov/`
- `issues/references/generation-experiments/views/view-markov.js`
- `issues/references/generation-experiments/examples/demo/res-markov/`

## Decision needed

Define the target Markov component, demo view, and nodegraph integration shape before restoring any active Markov code.

## Scope

- Review archived Markov generator logic and model resources.
- Design an Odin-backed WASM component interface for running Markov chain models.
- Define how 2D and 3D example models are loaded and displayed in the demo frontend.
- Define a nodegraph node/preset that runs Markov chain models in generation graphs.
- Keep production/runtime code separate from demo-only visualization concerns.

## Acceptance criteria

- [ ] Target WASM component/API shape is documented before implementation.
- [ ] Decision recorded for Odin backend scope and model/resource format.
- [ ] Demo requirements cover both 2D and 3D examples.
- [ ] Nodegraph integration requirements describe inputs, outputs, and how it participates in generation graphs.
- [ ] No archived Markov code is restored directly without refactor.

## Comments
