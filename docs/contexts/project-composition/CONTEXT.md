# Project Composition

Project Composition covers Projects, Project Config, Project Units, distribution packages, config schemas, themes, views, UI Services, presets, and scripts.

## Language

**Project**:
A configured GAMS workspace that declares its moving parts through Project Config and can be run by different Hosts.
_Avoid_: app, GAMS instance, GAMS application.

**Project Config**:
The project-owned JSON `gams.json` declaration of Project Units and their configuration that make a Project run as a specific tool.
_Avoid_: host config when the declaration belongs to the Project; standalone scripts/presets as top-level Project Config categories; YAML/TOML for v1.

**Project Unit**:
A theme, plugin, view, or UI Service that can be referenced by Project Config and may provide its own configuration schema.
_Avoid_: component because WASM components already use that term; asset because GAMS manages game assets.

**UI Service**:
A singleton GUI-host service that provides UI-facing behavior such as key bindings, actions, scripts, context menus, layout helpers, toast notifications, or popup services.
_Avoid_: UI plugin, frontend plugin, view service.

**Core View**:
A View provided and supported by the official GAMS development team, expected to follow the GAMS View Development Guide so themes can style Core Views consistently.
_Avoid_: builtin view when the important distinction is official support and UI vocabulary compliance.

**World Object Renderer**:
A browser-only, project-configured extension used by the World Editor to draw matching World Objects without changing their authored data.
_Avoid_: View Plugin, because it extends one View rather than providing an independently mounted view; runtime renderer, because it depends on browser rendering APIs.

**Minimap Component**:
The current minimap Project Unit, named `minimap.comp`, that converts tree-shaped room structure input into tilemap-shaped minimap output.
_Avoid_: minimap2 when referring to the current Project Unit.

**Animation Tree**:
An authored animation-composition document containing one root Animation Node; composite Animation Nodes may recursively contain embedded child Animation Nodes.
_Avoid_: using Animation Tree to mean only its State Machine Graph editor.

**Animation Node**:
A compositional unit within an Animation Tree. An Animation Node may select an animation or contain a Blend Tree, Blend Space, or State Machine.
_Avoid_: graph node when the node's animation-composition role matters.

**Animation Parameter**:
A named signed 32-bit integer input declared once by an Animation Tree, with stable document identity and an authored default value. Names are case-sensitive and unique within the Animation Tree.
_Avoid_: condition variable when referring to the declaration rather than its use in one condition.

**State Machine Transition Condition**:
A structured signed 32-bit integer comparison between one Animation Parameter and one authored value. Every condition on a transition must match for that transition to advance; an ordinary transition without conditions always matches. Start entry edges are unconditional.
_Avoid_: advance expression, because conditions are structured comparisons rather than arbitrary expressions.

**Node Graph**:
A directed graph whose nodes expose explicit input and output ports and whose edges connect compatible output ports to input ports. Blend Trees are authored as Node Graphs; other domains may reuse the same graph vocabulary.
_Avoid_: State Machine Graph, whose edges represent transitions between states rather than port connections.

**Group Node**:
A Node Graph node that owns an embedded child Node Graph and exposes that child graph's Graph Inputs and Graph Outputs as its own ports.
_Avoid_: Import Node for an inline child graph; import describes a storage action rather than the node's compositional role.

**For Each Node**:
A Node Graph node that owns an inline child Node Graph and executes it repeatedly over one or more input arrays. Each iteration can inspect the current item, current index, and complete input array; collected outputs may contain fewer items than the inputs when iterations skip or break.
_Avoid_: Map Node, because For Each execution does not guarantee one output for every input item; Group Node, because a Group executes its child graph only once.

**For Each Input**:
A For Each child-graph boundary node representing one parent array input. It exposes fixed Item, Index, and Array outputs for the current item, its one-based index, and the complete original array.
_Avoid_: Graph Input, which exposes one parent value inside a Group Node rather than iteration context.

**Shared Input**:
A For Each child-graph boundary node representing one parent value that remains unchanged across all iterations. It exposes one fixed Value output and does not participate in determining iteration count.
_Avoid_: Singleton, which describes plugin lifecycle in GAMS; For Each Input, which requires an array and exposes per-iteration Item, Index, and Array outputs.

**Iteration Control**:
An optional For Each child-graph boundary node with global skip and break inputs. Skip omits the current iteration from every collected output; break omits the current iteration and stops the sequence.
_Avoid_: Graph Output, because Iteration Control governs execution rather than exposing collected data to the parent Node Graph.

**Graph Input**:
A child-graph boundary node with one output. It exposes a Group Node input to the parent Node Graph.
_Avoid_: Value Node, because its value comes from the parent graph rather than authored literal data.

**Graph Output**:
A child-graph boundary node with one input. It exposes a Group Node output to the parent Node Graph.
_Avoid_: Goal Node, because it returns data to the parent graph rather than defining a root graph result.

**Inline Group Storage**:
A Group Node storage mode in which the child Node Graph is embedded in its parent graph document.
_Avoid_: imported graph when no separate graph file remains authoritative.

**Linked Group Storage**:
A Group Node storage mode in which a separate Node Graph file remains authoritative for the child graph. Group Nodes linked to the same file share one live working graph, so unsaved edits through one occurrence are visible through the others.
_Avoid_: imported graph when edits continue to save to the external source; embedded cache, because the linked file has one authoritative graph.

**Director**:
The narrative world model and rule runtime whose authored DSL is compiled by the Director Compiler Project Unit.
_Avoid_: ECS or game world when referring specifically to Director state.

**Director Entity Availability**:
Whether an authored Director entity participates in matching and entity-triggered rules. Removed entities retain identity and properties but are unavailable to matching; availability is independent from ECS projection.
_Avoid_: spawned when the entity may exist in Director without a game-world projection.

**Director Applied Change**:
A concrete, resolved mutation produced by an applied Director rule, identifying the affected entity and property or availability transition.
_Avoid_: effect, because Hosts decide which applied changes have external consequences.

**Project Unit Styleguide**:
A protected reference guide that defines supported development patterns for an official GAMS Project Unit family.
_Avoid_: suggestion or example when the guide is normative for first-party code.

**GAMS Distribution Package**:
A separately distributed Project Unit or related asset/config schema that can be referenced by Project Config.
_Avoid_: package when ambiguity with language package managers matters; top-level scripts/presets.

## Relationships

- A **Project Config** references **Project Units**, **GAMS Distribution Packages**, and local project configuration.
- **Project Config** uses top-level Project Unit sections and object maps keyed by Project-local ids so Project Unit schemas can validate stable paths in the same `gams.json`.
- The default **Project Config** file is `gams.json` in the **Project** root; alternate config paths are a future host/runtime launch feature.
- `theme` is a single active theme object in **Project Config** v1.
- `theme.config` may be extended and validated by Project Units by schema only; v1 does not require ownership declarations for theme subtrees.
- Presets belong to view configuration, not top-level **Project Config**.
- Scripts belong to UI Service key/action configuration, not top-level **Project Config**.
- View `label`, `group`, and `internal` are host-facing metadata; view `defaultSource` belongs to view-specific configuration.
- Plugin Project Config entries use only `url` and `config` in v1; dependencies come from WASM component imports/exports.
- A **Project** can be run by different Hosts when those Hosts support the Project Units it declares.
- A **Core View** is a first-party **Project Unit** and should follow the GAMS View Development Guide.
- **World Object Renderers** are configured within the World Editor's view-specific configuration rather than as a top-level Project Unit category.
- A **Minimap Component** may participate in example generation compositions, but those compositions are not mandatory global Project architecture.
- An **Animation Tree** owns exactly one root **Animation Node**, and composite Animation Nodes own their child Animation Nodes within the same document.
- An **Animation Tree** declares its **Animation Parameters** once at document level; State Machine Transition Conditions reference those declarations by name.
- A State Machine transition advances only when all of its **State Machine Transition Conditions** match; a transition without conditions always matches.
- A **Node Graph** edge connects one output port to one input port; connection capacity and compatibility belong to the participating ports.
- A **Group Node** owns a child **Node Graph**; node identities are unique within each authoritative graph document and its embedded inline child graphs.
- Repeated occurrences of one linked graph share authored node identity by source and node id, but each occurrence has a distinct execution identity through its Group path.
- Each **Graph Input** becomes one input port on its owning **Group Node**, and each **Graph Output** becomes one output port.
- A **For Each Node** uses inline child-graph storage only. Reusable or separately stored iteration behavior can place the For Each Node inside a **Group Node** using Linked Group Storage.
- For Each Nodes and Group Nodes may nest within one another, including nested For Each Nodes.
- For Each iterations execute sequentially in input order. Collected outputs preserve retained iteration order, and each iteration's side effects complete before the next begins. Any child-node failure aborts the graph run without returning partial outputs.
- A **For Each Node** may reduce output cardinality through global skip or break behavior and therefore is not a Map Node. Skip omits the entire current iteration from every collected output; break stops the entire iteration sequence.
- Each **For Each Input** becomes one required array input port on its owning **For Each Node**. Its fixed Item, Index, and Array outputs cannot be added, removed, or renamed; renaming the boundary node renames the parent input.
- Each **Shared Input** becomes one required value input port on its owning **For Each Node**. Its fixed Value output cannot be added, removed, or renamed; renaming the boundary node renames the parent input. The connected value must be active and is exposed unchanged in every iteration.
- For Each Inputs must be connected, active dense arrays of equal length at execution time. Scalars, objects, sparse arrays, nil values, inactive inputs, and unequal input lengths fail execution. Shared Inputs are excluded from this array and equal-length validation. Empty arrays are valid; when every For Each Input is empty, the body executes zero times and each collected output is an empty array.
- **Graph Outputs** inside a For Each child graph collect iteration values into array outputs on the owning For Each Node. Every retained iteration must produce one active, non-nil value for every Graph Output; otherwise execution fails.
- A multi-input **For Each Node** behaves like a strict zip over its input arrays. Current indexes are one-based, and every For Each Input exposes an active Item and Index on every iteration.
- A For Each child graph may contain zero Graph Outputs for side-effect-only execution. A zero-output For Each Node is a graph run target, like a zero-output Code Node.
- A For Each child graph may contain at most one **Iteration Control**. If both control inputs are true, break takes precedence over skip; absent or unconnected control inputs are false.
- **Inline Group Storage** embeds the child graph in its parent graph document.
- **Linked Group Storage** stores a Project-root-relative source path without an embedded child-graph cache.
- Group Nodes linked to the same source share unsaved edits through one live working graph.
- The Director Compiler is a **Project Unit** that compiles authored Director DSL into Director runtime data.
- **Director Entity Availability** controls Director matching independently from any Host's ECS projection.
- Hosts may react to selected **Director Applied Changes** without embedding Host behavior into Director rules.
- A **Project Unit Styleguide** is normative for official GAMS Project Units it covers and should only change with explicit approval.

## Example dialogue

> **Dev:** "Is this preset a top-level Project Config section?"
> **Domain expert:** "No. Presets belong to the specific view configuration, for example `view-ng`, and may be distributed separately from the main GAMS distribution."

## Flagged ambiguities

- "moving parts" is resolved as **Project Units**.
- "ui-plugin" is resolved as **UI Service**; old code/paths may still use `ui-plugins` during migration.
- Use **Project**, not "GAMS instance", for the configured tool/workspace.
