# Animation Tree transition conditions

## Status

Accepted

## Source material

- `docs/ideas/yoinking/2026-07-23-godot-animation-tree.md`
- `docs/contexts/project-composition/CONTEXT.md`
- `views/view-animation-tree.js`
- `packages/util/animation-tree.js`
- Godot AnimationTree advance conditions and expressions: https://docs.godotengine.org/en/stable/tutorials/animation/animation_tree.html#advance-condition-and-advance-expression

## Problem

Animation Tree State Machine transitions currently store only their switch mode. Authors cannot declare the integer inputs that control transitions or attach structured conditions to transitions, so the graph cannot describe when an ordinary transition is eligible.

## Goals

- Let an Animation Tree declare reusable integer Animation Parameters.
- Let ordinary State Machine transitions contain any number of structured integer comparison conditions.
- Keep the authored model deterministic, portable, and suitable for later persistence and specialized runtimes.
- Make conditional transitions visibly distinguishable on the graph.
- Preserve strict document validity through editing, copy/paste, and undo/redo.

## Non-goals

- Arbitrary advance expressions.
- Boolean, floating-point, string, or other parameter types.
- Previewing or evaluating a running Animation Tree.
- Defining how specialized runtimes receive parameter values.
- Choosing among multiple matching outgoing transitions.
- Conditions on Start entry edges.
- Importing or remapping missing parameters during cross-document paste.
- Animation Tree persistence.

## Requirements

### Animation Parameters

- The Animation Tree document declares an ordered `parameters` array at document level.
- Each Animation Parameter contains a stable generated ID, a name, and an authored signed 32-bit integer default value.
- Parameter names are trimmed at their start and end when editing loses focus.
- Trimmed names must be non-empty and case-sensitively unique within the document. Interior whitespace, punctuation, Unicode, and other characters are allowed.
- Parameter defaults must be signed 32-bit integers.
- New parameters receive a generated UUID, the first available `Parameter N` name, and default value `0`.
- Parameter references are resolved recursively across every embedded State Machine in the Animation Tree.
- A referenced parameter cannot be deleted. The editor reports its recursive condition-use count.
- Renaming a parameter does not rewrite conditions because conditions reference stable parameter IDs.

### Transition Conditions

- Every ordinary `transition` edge has a required `conditions` array. An empty array means the transition always matches.
- Start `entry` edges remain unconditional and omit conditions.
- Each condition contains only a parameter ID, one comparison operator, and a signed 32-bit integer value.
- Conditions have no independent IDs and preserve authored array order.
- Supported persisted operators are `eq`, `neq`, `lt`, `lte`, `gt`, and `gte`; the UI displays `=`, `!=`, `<`, `<=`, `>`, and `>=`.
- All conditions on one transition are implicitly ANDed.
- The same parameter may appear in multiple conditions on one transition.
- A new condition defaults to the first declared parameter, `gt`, and `0`.
- Adding a condition is unavailable when the document has no parameters, with an action that opens parameter management.

### Editing

- At the root Animation Node with no graph selection, the sidebar displays inline Animation Parameter management.
- A header `config-actions` Parameters action opens parameter management from any nested Animation Node.
- Popup parameter editing is transactional: Save applies the complete valid parameter list as one undoable edit, while Cancel discards local edits even when invalid.
- The ordinary transition inspector contains switch mode and a Conditions fieldset with Parameter, Operator, Value, and Delete controls plus Add condition.
- Empty transition conditions are presented as `Always`.
- Parameter and condition edits participate in the existing Animation Tree undo history.
- Invalid name or integer drafts remain visible, receive danger intent and a validation message, and lock other document mutations/navigation until corrected. Numeric drafts are validated when committed, not during partial typing. Popup Cancel remains available.

### Rendering

- Transition lines retain their existing styling.
- Unconditional and entry arrowheads use the configured `edgeSymbol` color.
- Ordinary transitions with one or more conditions use a required configured `edgeConditionSymbol` color.
- The demo theme uses its existing teal unconditional arrow and an amber/orange conditioned arrow.

### Validation and clipboard

- Document validation enforces parameter IDs, names, defaults, uniqueness, condition shape, known operators, signed 32-bit values, ordinary-transition condition arrays, unconditional entry edges, and document-wide parameter references.
- Copy/paste preserves conditions on copied edges.
- Paste is rejected when any pasted condition references an Animation Parameter absent from the target document.
- Parameter import/remapping is deferred.

## Acceptance criteria

- Authors can add, rename, edit, and delete unreferenced Animation Parameters inline and through the transactional popup.
- Authors can add, edit, and delete any number of conditions on an ordinary transition.
- Empty condition lists mean `Always`; Start entry edges cannot gain conditions.
- Invalid drafts visibly lock incompatible editor actions until fixed without corrupting the document.
- Referenced parameters cannot be deleted, including references in nested State Machines.
- Undo and redo restore parameter and condition edits and refresh both editor surfaces.
- Conditioned transition arrowheads use the configured condition color.
- Animation Tree model, graph renderer, editor contract, recursive references, and clipboard behavior have automated coverage.
- Existing focused Animation Tree tests pass.

## Open questions

- How specialized runtimes evaluate the authored JSON and obtain parameter values.
- How a runtime chooses among multiple matching outgoing transitions.
- Whether a later graph presentation should show condition counts or summaries beyond arrow color.
- Whether later cross-document paste imports or remaps Animation Parameters.

## Related ADRs

- None. The decisions in this slice are local model and editor behavior and do not warrant an ADR.
