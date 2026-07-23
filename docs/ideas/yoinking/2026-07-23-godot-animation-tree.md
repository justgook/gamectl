# Yoinking: Godot AnimationTree

Status: discussed
Date: 2026-07-23
Source: https://docs.godotengine.org/en/stable/tutorials/animation/animation_tree.html

## Source summary

Godot AnimationTree is a visual animation composition and transition system layered over animations stored by AnimationPlayer. It supports state machines, transition conditions, blend trees, blend spaces, one-shots, time scaling, nested graphs, and runtime playback control.

## What we like

- A visual state graph makes animation selection and transitions easier to author and inspect.
- States can reference existing animations rather than owning animation frames.
- Directed edges expose the valid transitions between states.
- Transition switch modes—Immediate, Sync, and At End—capture useful timing intent without arbitrary scripting.
- Animation, BlendSpace1D, BlendSpace2D, BlendTree, and nested State Machine nodes provide a recognizable path from simple clips to richer composition.
- Parameters supplied by gameplay/runtime state can drive deterministic transitions.
- Previewing states and active transitions in the editor shortens the authoring loop.

## What we dislike / should avoid

- The AnimationTree name is recognizable but does not clearly describe a state graph.
- Godot's full blend-tree and nested-node feature set is too broad for the initial GAMS need.
- Arbitrary expressions coupled directly to game objects would make authored graphs harder to move between hosts and runtimes.
- 3D skeletal animation, bone filters, shortest-path travel, and complex blend-space behavior are out of scope for the initial investigation.

## GAMS adaptation hypotheses

- A smaller 2D animation state graph could reference animations stored in Aseprite files.
- The initial editor can preserve Godot's three transition switch-mode names while deferring their runtime semantics.
- Blend and nested graph node types can begin as explicit mock node kinds so editor composition can be tested before implementing evaluation.
- Named states are primarily an authoring and preview affordance.
- Typed parameters and transition operations could later compile into deterministic runtime data.
- A shared canvas node renderer could give graph-shaped Core Views a common styling surface.
- The editor should be validated before choosing a persisted DSL, generated format, or hardcoded runtime representation.

## Possible use in GAMS

- Game authors could arrange and preview animation states before integrating them with gameplay state.
- A Core View could own graph editing while calling the Aseprite Plugin for animation metadata and previews in a later slice.
- A later compiler/generator Project Unit could lower the authored graph to runtime operations.
- The demo platformer animation controller is a candidate consumer after the editor and data model are validated.

## Risks / mismatches

- A visual graph can become harder to read than an ordered rule list when many transitions overlap.
- Building a generic graph framework too early could expand the editor slice into a rewrite of existing Tree and Nodegraph Views.
- Choosing persistence or runtime IR before exercising the editor may freeze the wrong model.
- Transition priority and conflicts will need explicit semantics before runtime conversion.

## Open questions for grilling

- What should the capability be named in GAMS?
- Should animation assignments reference one Aseprite file plus tags, or allow each state to reference a different file?
- Which parameter types and comparison operations belong in the first executable editor slice?
- How should multiple valid outgoing transitions be ordered?
- Which parts of the shared node renderer should Tree and Nodegraph adopt after the layout is validated?

## Conversion outcome

- Not yet converted. The initial editor bootstrap is being used to validate layout and interaction before a focused PRD defines persistence, DSL, or runtime behavior.
