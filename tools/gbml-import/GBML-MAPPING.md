# BulletML XML to GBML JSON mapping

This document describes the target mapping from the full BulletML 0.21 authoring/interchange format into GAMS BulletML JSON (`gbml.json`).

Related source reference:

- `tools/gbml-import/SPEC-BulletML-0.21.md`
- Upstream: <https://www.asahi-net.or.jp/~cs8k-cyu/bulletml/bulletml_ref_e.html>

## Format roles

BulletML XML is an import/export format. GAMS should not use XML as the internal runtime or view format.

GBML JSON is the canonical GAMS bullet-pattern runtime format:

```text
BulletML XML
  ↓ tools/gbml-import
GBML JSON
  ↓ JSON Schema validation
  ↓ semantic/program validation
view-bullet preview runner / respack packing / game runner
```

Structural validation for GBML JSON belongs in:

```text
packages/schemas/gbml.schema.json
```

Shape/type/version validation should be JSON Schema driven. Importer, view, and runner code may still perform semantic validation for cross-references, bytecode control flow, expression-stack correctness, compatibility profiles, and execution invariants.

## GBML JSON design intent

GBML JSON is compiled, normalized bytecode in JSON form. It is not a direct XML AST and is not a graph-editor format.

Goals:

- preserve BulletML 0.21 behavior;
- remove XML structure from GAMS runtime paths;
- make preview and game consume the same program shape;
- be easy to pack with `respack.comp`;
- keep debug/source mapping optional;
- allow deterministic golden tests across JS and game runners.

Non-goals for v1:

- full GAMS node graph editing;
- game-specific presentation metadata;
- XML parsing inside `view-bullet.js`;
- XML parsing inside the game;
- general-purpose scripting.

## Top-level GBML shape

Conceptual v1 shape:

```json
{
  "format": "gams.gbml",
  "version": 1,
  "source": {
    "language": "bulletml-0.21",
    "orientation": "vertical"
  },
  "compatibility": {
    "semantics": "gams-corrected-v1"
  },
  "entrypoints": [],
  "actions": [],
  "bullets": [],
  "fireSpecs": [],
  "instructions": [],
  "expressions": [],
  "constants": [],
  "debug": {}
}
```

The final schema should prefer respack-friendly arrays/structs and numeric enums where practical. Human-facing tools may render enum names in disassembly or diagnostics.

## BulletML element mapping

### `<bulletml>`

BulletML:

```text
attribute: type = none | vertical | horizontal
contents: (bullet | action | fire)*
```

GBML:

- `source.language = "bulletml-0.21"`
- `source.orientation = "none" | "vertical" | "horizontal"`
- top-level labeled `action`, `bullet`, and `fire` definitions become GBML definition tables.

### `<action>`

BulletML action bodies become instruction streams.

Top-level labeled actions become `actions[]` entries and may become `entrypoints[]` when selected by importer policy or explicit CLI flag.

Nested anonymous actions are flattened into instruction ranges or inlined, depending on compiler policy.

Supported body children map as:

| BulletML child | GBML result |
| --- | --- |
| `repeat` | loop instructions |
| `fire` | fire spec + `FIRE` instruction |
| `fireRef` | resolved fire spec or call-like fire expansion |
| `changeSpeed` | `CHANGE_SPEED` instruction |
| `changeDirection` | `CHANGE_DIRECTION` instruction |
| `accel` | `ACCEL` instruction |
| `wait` | `WAIT` instruction |
| `vanish` | `VANISH` instruction |
| nested `action` | flattened/inlined action body |
| `actionRef` | `CALL` instruction or inlined action body |

### `<bullet>`

BulletML bullet definitions become `bullets[]` entries.

Bullet initial `direction` and `speed` become bullet initialization fields or dedicated fire/bullet specs. Bullet actions become linked action ids or instruction ranges.

A bullet fired by `<fire>` references a compiled bullet id.

### `<fire>`

BulletML fire definitions become `fireSpecs[]` entries plus `FIRE` instructions.

A fire spec contains:

- direction mode;
- direction expression id;
- speed mode;
- speed expression id;
- bullet id.

Top-level labeled `fire` elements can be referenced by `fireRef`.

### `<repeat>`

BulletML:

```text
times, (action | actionRef)
```

GBML:

```text
LOOP_BEGIN timesExpr
  compiled action body
LOOP_END targetPc
```

`times` is compiled as an expression id. The runner evaluates it when entering the loop.

### `<wait>`

GBML:

```text
WAIT framesExpr
```

The runner interprets waits in frames. BulletML defines one frame as 1/60 seconds.

### `<vanish>`

GBML:

```text
VANISH
```

The runner marks the bullet/entity dead and calls the host destroy behavior as needed.

### `<changeDirection>`

BulletML:

```text
direction, term
```

GBML:

```text
CHANGE_DIRECTION directionMode directionExpr termExpr
```

Direction modes preserve BulletML semantics:

| BulletML type | Meaning |
| --- | --- |
| `aim` | relative to target direction |
| `absolute` | absolute angle, 12 o'clock is 0, clockwise |
| `relative` | relative to current bullet direction |
| `sequence` | relative to previous fire direction |

### `<changeSpeed>`

BulletML:

```text
speed, term
```

GBML:

```text
CHANGE_SPEED speedMode speedExpr termExpr
```

Speed modes preserve BulletML semantics:

| BulletML type | Meaning |
| --- | --- |
| `absolute` | absolute speed |
| `relative` | relative to current bullet speed in `changeSpeed`; relative to firing bullet speed otherwise |
| `sequence` | successive speed change in `changeSpeed`; relative to previous fire speed otherwise |

### `<accel>`

BulletML:

```text
horizontal?, vertical?, term
```

GBML:

```text
ACCEL horizontalMode horizontalExpr verticalMode verticalExpr termExpr
```

Missing horizontal or vertical acceleration should compile to an explicit no-op/default for that axis, not an omitted runtime field.

### `<direction>`

Maps to a mode enum plus expression id.

Modes:

```text
aim
absolute
relative
sequence
```

Default BulletML behavior for omitted `type` should be resolved by the importer and written explicitly into GBML.

### `<speed>`, `<horizontal>`, `<vertical>`

Each maps to a mode enum plus expression id.

Modes:

```text
absolute
relative
sequence
```

Default BulletML behavior for omitted `type` should be resolved by the importer and written explicitly into GBML.

### `<term>`, `<times>`, `<param>`

Each maps to an expression id.

### `<bulletRef>`, `<actionRef>`, `<fireRef>`

References are resolved by the importer/compiler:

- label existence is checked;
- duplicate labels are rejected;
- supplied `param` expressions become a parameter list;
- `$1`, `$2`, ... in the referenced definition resolve against supplied parameters;
- recursive call policy is enforced by semantic validation.

GBML should not require runtime label lookup for standard BulletML refs. Runtime should operate on numeric ids.

## Expression mapping

BulletML `NUMBER` values are expressions.

Required syntax from BulletML 0.21:

- numeric literals;
- `+`, `-`, `*`, `/`, `%`;
- parentheses;
- `$1`, `$2`, ... parameters;
- `$rand`;
- `$rank`.

GBML expressions should compile to expression bytecode or another compact expression table, for example postfix ops:

```text
CONST 330
RAND
CONST 25
MUL
ADD
```

Constant expressions should be folded where possible.

Dynamic expressions remain evaluated by the runner at instruction execution time because `$rand`, `$rank`, target aiming, sequence modes, and parameters depend on runtime context.

## Instruction model

Conceptual opcode set for complete BulletML 0.21 support:

```text
WAIT
FIRE
VANISH
CHANGE_DIRECTION
CHANGE_SPEED
ACCEL
CALL
RETURN
LOOP_BEGIN
LOOP_END
```

Possible extension opcodes should be versioned and outside the strict BulletML compatibility profile.

## Runtime state implied by BulletML semantics

GBML runners need enough state to preserve BulletML behavior:

- position;
- direction;
- speed;
- velocity;
- current program counter;
- wait state;
- direction/speed/accel tweens over terms;
- call stack;
- loop stack;
- last fire direction;
- last fire speed;
- parameters;
- deterministic RNG state;
- alive/dead state.

`sequence` direction and speed modes require previous-fire state and should not be derived indirectly.

## Compatibility and quirks

GBML files should declare a semantics profile, initially:

```json
{
  "compatibility": {
    "semantics": "gams-corrected-v1"
  }
}
```

The importer may later support additional profiles for reference quirks or compatibility with existing libraries.

## Importer outputs

`tools/gbml-import` should output one `.gbml.json` file per input pattern.

Example CLI shape, subject to future implementation:

```sh
gbml-import input.xml -o output.gbml.json
```

Potential flags:

```text
--entrypoint top
--semantics gams-corrected-v1
--pretty
--strict
```

## Test fixture role

Demo and fixture GBML files belong under:

```text
examples/demo/bulletML/
```

Those fixtures should be reusable by:

- `view-bullet.js` preview;
- importer golden tests;
- respack packing tests;
- game-runner semantic tests.
