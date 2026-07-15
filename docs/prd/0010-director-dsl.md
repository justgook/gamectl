# Director DSL

## Status

Accepted

## Source material

- `examples/demo/CYBERPUNK/director.director` — authored Director DSL example used by the demo graph.
- `examples/demo/CYBERPUNK/director.rspk.json` — current Director data schema and compiled JSON IR contract.
- [Elm Narrative Engine 6.0.3](https://package.elm-lang.org/packages/jschomay/elm-narrative-engine/latest/) — inspiration for the world model, matcher, change, and rule syntax.
- [Elm Narrative Engine entity parser](https://github.com/jschomay/elm-narrative-engine/blob/cc613b8b002a3eed794505f0cc37d080d75d6c8d/src/NarrativeEngine/Syntax/EntityParser.elm)
- [Elm Narrative Engine rule parser](https://github.com/jschomay/elm-narrative-engine/blob/cc613b8b002a3eed794505f0cc37d080d75d6c8d/src/NarrativeEngine/Syntax/RuleParser.elm)

## Problem

The Director's current JSON representation is a packed, numeric intermediate representation. It is suitable for data encoding and runtime loading, but not for people authoring Director entities, matchers, and rules directly.

GAMS needs a compact, readable Director source language that can be parsed and compiled into the existing Director IR.

## Goals

- Provide a human-readable source format for Director entities and rules.
- Preserve the expressive matcher and change syntax inspired by Elm Narrative Engine.
- Allow entities, matchers, and changes to use either single-line or multiline property chains.
- Make comments, blank lines, capitalization, and indentation convenient for authors.
- Define syntax independently from the eventual parser and compiler implementation.
- Compile named source constructs into the numeric entities, words, ranges, matchers, queries, changes, and rules of the Director IR.

## Non-goals

- Selecting the parser implementation language or parsing library in this document.
- Defining the parser's internal AST.
- Defining numeric ID allocation, word interning, or packed-range lowering yet.
- Redesigning the runtime Director IR beyond explicitly required additions such as generic property removal.
- Defining an editor or browser integration.
- Reproducing Elm Narrative Engine compatibility beyond the syntax explicitly specified here.

## Source model

A Director source document contains:

- **Entity declarations**, which define initial entity tags, integer stats, and entity links.
- **Rules**, which contain one trigger, optional conditions, and required world changes.
- **Matchers**, used by rule triggers and conditions to select or test entities.
- **Changes**, used by rule `DO` sections to mutate entities.

Entity declarations and rules may be interleaved. A column-1 entity declaration following a rule's `DO` section ends that rule and starts a new entity.

## Complete example

```text
# Initial entities
PLAYER.money = 10
  .mp = 124
.hp = 32

CAVE.location.dark
TORCH.item
    .illumination = 7
.current_location = PLAYER

# Match any line while chapter one is active.
ON: *.line
IF: PLAYER.chapter = 1
    BROADWAY_STREET.leaving_broadway_street_station_plot = 1
DO: BRIEFCASE.location = THIEF
    BROADWAY_STREET.leaving_broadway_street_station_plot = 2

# This is an entity declaration, not part of the preceding DO section.
SHRINE.magicProp = 10

# Matchers and changes can also use multiline property chains.
on: CAVE
    .dark
.!explored

if: PLAYER.current_location = (*.dark)
    .fear < 5

do: PLAYER.current_location = CAVE
    .fear + 2
    CAVE.explored

# Quoted text denotes a signal trigger rather than an entity matcher.
ON: "next-day"
DO: PLAYER.day + 1
```

## Lexical rules

### Case insensitivity

Keywords and semantic identifiers are case-insensitive. This applies to:

- `ON`, `IF`, and `DO`;
- entity identifiers;
- tag, stat, and link names;
- rule-related identifiers and signals.

For example, these spellings resolve to the same identifier:

```text
CAVE
cave
Cave
cAvE
```

Identifiers are ASCII-only in v1 and use ASCII lowercase as their canonical identity. The compiler emits canonical lowercase names in symbol metadata while retaining the author's original spelling and source span for diagnostics. Runtime IR contains only numeric word IDs. Unicode identifiers and Unicode case folding are not supported.

Case variants are therefore duplicates rather than distinct declarations:

```text
CAVE
cave # duplicate entity declaration
```

### Comments

`#` starts a line comment outside quoted strings. The comment extends to the end of the physical line.

```text
PLAYER.hp = 32 # initial health
ON: "chapter#next" # the # inside quotes belongs to the signal
```

Because `#` starts a comment, it is not allowed in an unquoted identifier.

### Whitespace

- Blank lines and comment-only lines are trivia and have no structural effect.
- Horizontal spaces and tabs are allowed around operators and separators.
- Spaces and tabs are not allowed inside an unquoted identifier or integer.
- Any mixture or amount of leading spaces and tabs is permitted where an indented rule-body expression or property continuation is allowed.
- Indentation depth is not significant and does not need to be consistent between lines.

### Identifiers and integers

An unquoted identifier starts with an ASCII letter and may contain ASCII letters, digits, `_`, `-`, `:`, or `+`. Property names may also begin with a digit. `#` is excluded because it introduces a comment.

Integers are base-ten signed integers.

Quoted signal triggers use double quotes and contain printable ASCII only. ASCII letters are canonicalized to lowercase. V1 supports only `\"` for a literal quote and `\\` for a literal backslash. `#` is literal inside quotes without escaping. Physical newlines, control characters, Unicode, and unknown escape sequences inside quoted signals are compile errors.

## Line structure

The language is line-oriented. After removing comments and ignoring blank lines, a physical line is classified using its first non-whitespace token and the current parser context.

### Top-level starts

The following begin at column 1, with no leading spaces or tabs:

- entity declarations;
- `ON:` rule sections;
- `IF:` rule sections;
- `DO:` rule sections.

`ON:`, `IF:`, and `DO:` are recognized case-insensitively.

### Property continuations

A line whose first non-whitespace token is `.` extends the most recently started entity, matcher, or change expression:

```text
PLAYER.money = 10
  .mp = 124
.hp = 32
```

This is equivalent to:

```text
PLAYER.money = 10.mp = 124.hp = 32
```

The continuation dot may be at column 1 or preceded by any mixture and amount of spaces and tabs. Blank lines and comments do not clear the expression being continued.

A property continuation without a compatible preceding expression is an error.

### Indented rule-body expressions

Within `IF` or `DO`, an indented non-trivia line that does not begin with `.` starts an additional matcher or change respectively:

```text
IF: PLAYER.chapter = 1
    STREET.plot = 1
	TORCH.current_location = PLAYER

DO: BRIEFCASE.location = THIEF
 CAVE.explored
```

Indentation is only a binary marker here: the line has leading whitespace or it does not. Its depth is not compared with any previous line.

An indented full expression outside an active `IF` or `DO` section is an error. Multiline property continuations remain valid outside those sections because they are identified by their leading `.` after optional whitespace.

## Expression forms

The grammar below specifies semantic forms rather than parser implementation. `ws` means optional horizontal whitespace. Newline handling follows the line-structure rules above.

```ebnf
identifier      = letter, { letter | digit | "_" | "-" | ":" | "+" } ;
property-name   = letter | digit | "_" | ":",
                  { letter | digit | "_" | ":" } ;
integer         = [ "-" ], digit, { digit } ;

entity-id       = identifier ;
property        = ".", ws, property-name ;
```

Identifiers are compared case-insensitively even though their source spelling is retained for diagnostics.

### Entity declarations

An entity declaration begins with an entity identifier followed by zero or more properties:

```ebnf
entity          = entity-id, { entity-property } ;
entity-property = property
                | property, ws, "=", ws, integer
                | property, ws, "=", ws, entity-id ;
```

The forms mean:

```text
CAVE.dark                    # add initial tag dark
PLAYER.money = 10            # set initial integer stat money
TORCH.current_location=CAVE  # set initial entity link current_location
```

The right-hand value distinguishes stats from links: an integer is a stat value and an entity identifier is a link target.

Each entity declaration creates a new entity. A later declaration with the same case-insensitive entity identifier is a duplicate declaration rather than an amendment. Exact duplicate-diagnostic policy remains part of compiler design.

### Matchers

A matcher selects a specific entity, any entity, or the entity that triggered the rule:

```ebnf
matcher-selector = entity-id | "*" | "$" ;
matcher          = matcher-selector, { query } ;
```

Supported query forms include:

```text
CAVE.dark                         # specific entity with tag
CAVE.!explored                    # entity without tag
*.enemy                           # any entity with tag
PLAYER.fear < 5                   # integer stat comparison
PLAYER.current_location = CAVE    # link to specific entity
PLAYER.current_location = (*.dark)# link to entity matching nested matcher
```

A `!` immediately after the property dot negates that query:

```text
*.!tag
*.!fear > 9
*.!current_location = CAVE
```

The comparison operators are `=`, `<`, and `>`. Parenthesized nested matchers constrain linked entities.

The following matcher:

```text
PLAYER.current_location = (*.dark).fear < 5
```

means that `PLAYER.current_location` links to any entity tagged `dark`, and that `PLAYER.fear` is less than `5`. The `.fear` segment follows the closing parenthesis and therefore belongs to the outer `PLAYER` matcher.

`$` denotes the entity that triggered the current rule where the IR operation supports trigger-relative matching.

The following Elm Narrative Engine interaction pattern is required v1 syntax:

```text
CLASSROOM_101.location
DESK.item.fixed.current_location = CLASSROOM_101
APPLE.item.current_location = CLASSROOM_101

ON: *.item.!fixed.!current_location = PLAYER
DO: $.current_location = PLAYER
```

When an entity triggers the rule, `ON` verifies that the triggering entity is an item, is not fixed, and is not already linked to `PLAYER` through `current_location`. `DO` then uses `$` to set that triggering entity's `current_location` link to `PLAYER`.

### Path comparisons and existential matcher projections

Conditions may compare values reached through entity paths and matcher result sets:

```text
IF: PLAYER.current_location.darkness < (*.item.current_location = PLAYER).light
```

The left side starts from `PLAYER`, follows its singular `current_location` link, and reads the linked entity's `darkness` stat.

The parenthesized expression on the right is a matcher-result root. It selects every entity tagged `item` whose `current_location` links to `PLAYER`, then `.light` projects the `light` stat from each result.

The example evaluates conceptually as:

```text
darkness = values(PLAYER.current_location.darkness)
items    = matches(*.item.current_location = PLAYER)
lights   = items.flatMap(item => values(item.light))
result   = any(left, right where left < right)
```

A missing link or terminal property contributes no value. Inventory items without `light` are skipped rather than contributing `0`. A comparison with an empty side is false.

Comparison uses existential Cartesian semantics: it succeeds when at least one pair of left and right values satisfies the operator. With one scalar value on the left and a matcher-produced value set on the right, this is equivalent to JavaScript `right.some(value => left < value)`.

The compiler lowers both sides into structured `Value_Path` records and lowers the condition into a `Compare_Any` query. A matcher-result path root references an auxiliary matcher in the packed IR. The explicit Elm Narrative Engine forms `(stat ENTITY.key)` and `(link ENTITY.key)` are not part of Director DSL v1; structured paths supersede them.

Initial path requirements are:

- root a path at a specific entity, the triggering entity, the current matched entity, or a parenthesized matcher result set;
- follow a singular named link;
- project a terminal integer stat from every entity currently in the path value set.

Native collection links and `PLAYER.items.*.light` syntax are deferred to v2. Additional terminal value kinds and comparison quantifiers are future syntax unless explicitly added later.

### Changes

A change expression targets one entity, the triggering entity, or all entities matching a matcher:

```text
PLAYER.current_location = CAVE # set link
PLAYER.fear = 5                # set stat
PLAYER.fear + 2                # increment stat
PLAYER.fear - 2                # decrement stat
CAVE.explored                  # add tag
CAVE.-explored                 # remove property named explored
$.explored                     # change triggering entity
(*.enemy).blinded              # change all matching enemies
```

Properties chained after one target are separate changes to that same target:

```text
PLAYER.current_location = CAVE.fear + 2
```

means:

1. set `PLAYER.current_location` to `CAVE`;
2. increment `PLAYER.fear` by `2`.

The same expression can be formatted across lines:

```text
PLAYER.current_location = CAVE
    .fear + 2
```

Within `DO`, an indented full expression starts another change target:

```text
DO: PLAYER.current_location = CAVE
    .fear + 2
    CAVE.explored
```

This contains one `PLAYER` update with two property changes and one `CAVE` update with one property change.

Director-specific entity lifecycle changes use prefix operators:

```text
DO: +COIN       # spawn specifically declared entity COIN
    -GOBLIN     # remove specific entity GOBLIN
    -$          # remove the triggering entity
    -(*.enemy)  # remove every matching entity
```

`+ENTITY` lowers to `Spawn_Entity`. Spawning `$` or a matcher is invalid. Any entity targeted by at least one spawn change is emitted with initial `removed: true`; it remains declared exactly once and may be spawned by multiple rules.

`-ENTITY`, `-$`, and `-(matcher)` lower to `Remove_Entity` with `Entity`, `Trigger`, and `All_Matching` targets respectively.

Property removal deliberately does not expose storage kind in the DSL:

```text
PLAYER.-current_location
$.-state
(*.enemy).-state
```

`.-key` means remove that key from the target's tags, stats, and links regardless of which property storage currently contains it. The Director IR will gain a generic `Remove_Property` change kind for this operation. This replaces the need for separate source syntax for `Remove_Tag`, `Remove_Link`, and the currently absent stat-removal operation.

## Rule grammar and state

A rule has strict section ordering:

```ebnf
rule = on-section, [ if-section ], do-section ;
```

### `ON`

- Required and first.
- Starts at column 1.
- Contains exactly one inline trigger.
- The trigger may be continued by property-continuation lines.
- An unquoted value is an entity matcher.
- A double-quoted value is a signal trigger.

```text
ON: *.location.dark
ON: "next-day"
```

### `IF`

- Optional.
- May occur only once, after `ON` and before `DO`.
- Starts at column 1.
- Contains at least one inline matcher.
- Additional matchers are indented full-expression lines.
- Each matcher may use property-continuation lines.
- All listed conditions must match.

### `DO`

- Required and last.
- May occur only once after `ON` and optional `IF`.
- Starts at column 1.
- Contains at least one inline change.
- Additional changes are indented full-expression lines.
- Each change may use property-continuation lines.

### Trivia between sections

Blank lines and comments may appear anywhere between `ON`, `IF`, and `DO`, or among their continuation lines. They do not terminate the current expression, section, or rule.

### Ending a rule

After `DO` has begun, the next non-trivia, non-property-continuation line at column 1 ends the rule:

- `ON:` starts another rule;
- an entity declaration starts a new entity;
- `IF:` or `DO:` is an invalid section transition.

Starting another `ON:` before the required `DO` is an error because the preceding rule is incomplete.

An `IF:` or `DO:` without an active preceding `ON:` is an error.

## Required diagnostics

The parser/compiler must reject at least:

- unknown or malformed syntax;
- an indented full expression outside `IF` or `DO`;
- a property continuation without a compatible previous expression;
- `IF` or `DO` without a preceding `ON`;
- a second `IF` or `DO` in one rule;
- `IF` after `DO`;
- a rule without `DO`;
- `ON`, `IF`, or `DO` without the required inline expression;
- an `ON` section containing more than one trigger;
- invalid section order;
- an unterminated quoted signal;
- identifiers containing comment syntax;
- references or constructs that cannot be represented by the target Director IR.

V1 uses these stable machine-readable diagnostic codes:

```text
lex-invalid-character
lex-invalid-escape
lex-invalid-signal-character
lex-unterminated-signal
lex-integer-out-of-range

parse-unexpected-token
parse-unexpected-indentation
parse-orphan-continuation
parse-missing-inline-expression
parse-missing-do
parse-invalid-rule-order
parse-duplicate-section
parse-invalid-negation

semantic-duplicate-entity
semantic-unknown-entity
semantic-invalid-trigger-reference
semantic-invalid-spawn-target
semantic-invalid-path
semantic-unrepresentable-ir

too-many-errors
```

Codes use lowercase kebab-case and retain stable meaning for machine consumers. Human-readable messages may improve without changing the code's meaning.

Diagnostics identify source locations through the WIT `source-span` record. The compiler accumulates independent lexical, syntax, and semantic errors, recovering at physical line boundaries and the next valid column-1 statement or rule section. Follow-on errors caused solely by an invalid AST node are suppressed, while semantic analysis continues across other valid declarations and rules.

If any diagnostic exists, compilation returns no JSON. Diagnostics are sorted by source span and then diagnostic code. At most 100 ordinary diagnostics are returned; reaching the cap appends a final `too-many-errors` diagnostic. Invalid user source is a structured compile result, while internal compiler invariant violations fail loudly rather than being converted into source diagnostics.

## Required IR and runtime changes

The DSL cannot be compiled faithfully into the current Director IR without the following explicit changes. These are implementation requirements, not optional parser conveniences.

### Generic property removal

- Add `Remove_Property` to `director.Change_Kind`.
- Lower every `.-key` source change to `Remove_Property`.
- At runtime, applying `Remove_Property` removes the key from the target entity's tags, stats, and links.
- Applying it when the key is absent is a valid no-op.
- Existing typed `Remove_Tag` and `Remove_Link` records may remain readable for compatibility, but the Director DSL does not emit them in v1.

### Structured value paths

Extend `director.Director_Data` with packed path data:

- `value_paths: vector<Value_Path>`;
- `path_steps: vector<Path_Step>`.

A `Value_Path` requires:

- a root kind supporting the current matched entity, a specific entity, the triggering entity, and a matcher result set;
- an entity ID when the root is specific;
- a matcher index when the root is a matcher result set;
- a contiguous range of path steps.

`Path_Step` requires at least:

- `Follow_Link(key)` for singular traversal;
- `Read_Stat(key)` for terminal integer projection.

The exact respack field layout may follow repository encoding constraints, but it must preserve these semantics and deterministic source order.

### Existential path comparison

Add these packed types:

```text
Value_Path_Root_Kind = Matched_Entity | Entity | Trigger | Matcher

Value_Path {
    root_kind: Value_Path_Root_Kind
    entity: Entity_Id
    matcher_index: u32
    steps: Range
}

Path_Step_Kind = Follow_Link | Read_Stat

Path_Step {
    kind: Path_Step_Kind
    key: Word_Id
}
```

Extend `director.Director_Data` with:

```text
value_paths: vector<Value_Path>
path_steps: vector<Path_Step>
```

Add `Compare_Any` to `director.Query_Kind`. Extend `director.Query` with `left_path` and `right_path` indices. `Compare_Any` reuses the existing `Query.op` comparison operator.
- Keep `Compare_Any` usable inside the existing matcher query range model so rule condition ranges do not require a second condition representation.
- Runtime evaluation collects both paths' current values and returns true when any Cartesian pair satisfies the comparison.
- Missing links, missing terminal stats, and matcher results without the requested property contribute no values.
- If either side produces no values, the comparison is false.

### Matcher-result path roots

- V1 models inventory-like relationships through ordinary entity links, following the Elm Narrative Engine pattern: each item links to its current owner/location.
- A parenthesized matcher used as a path root is lowered to an auxiliary matcher index.
- Evaluating that root produces every entity currently matched, in deterministic runtime entity order.
- Subsequent `Follow_Link` and `Read_Stat` steps are mapped over the current result set and flatten their produced values.
- No compiler-generated property-container entities or collection-valued links are introduced in v1.

### Runtime and schema integration

- Update `examples/demo/CYBERPUNK/director.rspk.json` or its eventual canonical schema source with all new enum variants, records, fields, and vectors.
- Update generated/handwritten Director decoder data types for the extended schema.
- Update Director query evaluation for path traversal and `Compare_Any`.
- Update Director change application for `Remove_Property`.
- Add runtime tests covering missing path segments, matcher results without the terminal stat, empty matcher results, multiple matching values, property removal from all three stores, and deterministic matcher-result traversal.
- Add compiler-to-runtime integration tests proving emitted JSON IR is accepted and behaves as specified.

## Acceptance criteria for the syntax specification

- Entity declarations support tags, integer stats, and entity links.
- Matchers support specific, any, and trigger-relative selectors plus tag, stat, link, nested, negated, and structured path-comparison queries.
- The `ON: *.item.!fixed.!current_location=PLAYER` / `DO: $.current_location=PLAYER` interaction pattern compiles and updates the triggering entity.
- Path comparisons support existential projection over matcher result sets, skip missing terminal properties, and return false for empty value sets.
- Changes support tags, integer stats, entity links, generic property removal, entity lifecycle operations, and multi-target `DO` sections.
- Rules enforce `ON`, optional `IF`, required `DO` ordering.
- `ON`, `IF`, and `DO` each require an inline expression.
- Property chains can continue on lines beginning with optional whitespace followed by `.`.
- Additional `IF` matchers and `DO` changes can use any nonzero amount or mixture of leading spaces and tabs.
- Indentation depth is otherwise insignificant.
- Blank lines and `#` comments have no structural effect.
- Keywords and semantic identifiers resolve case-insensitively.
- A column-1 entity after `DO` is parsed as a new entity declaration.
- The specification records unresolved parser and IR compiler decisions rather than silently choosing them.

## Parser and IR compiler decisions

### Compiler Project Unit

The parser and IR compiler will be a singleton WASM plugin Project Unit invoked through `pluginManager`. Browser, CLI, and other Hosts must use the same Project Unit rather than implementing host-specific Director compilation.

The Project Unit owns source parsing, validation, semantic analysis, and lowering into Director IR. Hosts remain responsible for orchestration such as obtaining source text and persisting requested output.

### Implementation language

The compiler Project Unit will be implemented in Odin, following the repository's existing Odin-to-WASM component build pattern used by `plugins/respack.comp`. Go will not be used for this Project Unit.

### Parser strategy

The Odin implementation will use a handwritten two-stage parser:

1. A lexer/scanner emits tokens with source offsets and line/column locations. It owns comments, quoted signals, identifiers, integers, operators, keyword recognition, and whitespace classification.
2. A recursive-descent/state parser consumes those tokens into source-level declarations and expressions. It owns rule-section ordering, physical-line context, property continuations, and entity/matcher/change grammar.

Indentation is retained only as the binary distinction required by the DSL—column 1 versus some leading horizontal whitespace—not as a nested indentation tree. A parser generator will not be introduced for v1.

### Rule identity and weight

Numeric rule IDs are assigned in `ON` source order, starting at `0`. Blank lines, comments, entity declarations, and property-continuation lines do not affect rule numbering.

Rule weight is computed automatically from matcher specificity; there is no source-level weight syntax in v1. The compiler uses the Elm Narrative Engine scoring model:

- a specific-entity `ON` contributes `100` plus its number of direct queries;
- an any-entity `ON` contributes its number of direct queries;
- a quoted signal `ON` contributes `0`;
- each specific-entity `IF` matcher contributes `10` plus its number of direct queries;
- each any-entity `IF` matcher contributes its number of direct queries.

The rule's IR weight is the sum of its trigger and condition contributions. Nested query complexity does not add weight beyond the direct query that contains it.

### Word identity and deterministic output

The compiler interns canonical lowercase property names and quoted signals by first semantic occurrence in source order. Entity identifiers do not allocate word IDs merely because they declare or reference entities. Repeated spellings and case variants reuse the existing word ID. Canonical names and their IDs are emitted in symbol metadata, not in runtime IR.

Word-ID allocation occurs from the validated semantic AST before IR flattening so lowering traversal details cannot change IDs. Given identical source and compiler version, compilation must produce byte-identical JSON output.

### Entity identity and references

Numeric entity IDs are assigned in entity declaration order, starting at `0`. Rules and references do not allocate entity IDs.

The compiler parses the complete document and builds the entity symbol table before resolving links, specific-entity matchers, and changes. Forward references are allowed, but every unresolved entity reference is a compile error during semantic analysis.

```text
PLAYER.current_location = CAVE # PLAYER is entity 0; forward reference is valid
CAVE.location                  # CAVE is entity 1
```

### Source AST and spans

The parser produces a semantic AST rather than a lossless concrete syntax tree. Comments and insignificant whitespace are discarded after they have served lexical and line-structure parsing.

Every declaration, rule section, expression, and property retains a source span containing byte offsets and line/column locations. The AST also retains original identifier spelling for diagnostics. Formatting and source rewriting are not v1 responsibilities.

### Source and output extensions

Authored Director DSL files use the `.director` extension. Generated JSON IR files use `.director.json`.

For example:

```text
chapter-one.director
chapter-one.director.json
```

### Negated queries

A source query with one `!` lowers to a direct `Query` record with `kind = Not`. Its `nested` field points to an appended query record containing the positive tag, stat, or link query. The nested record is outside every matcher's direct query range; only the `Not` record occupies the parent matcher's range.

```text
CAVE.!explored
```

therefore lowers conceptually to:

```text
matcher queries: [Not(nested = N)]
query N: Has_Tag explored
```

The same lowering applies to negated stat and link queries. Repeated negation such as `!!tag` is invalid in v1.

### Trigger-relative `$`

`$` is valid only in `IF` matchers and `DO` changes, where it refers to the entity that triggered the current rule. It is invalid in entity declarations and `ON` triggers because no prior triggering entity exists in those contexts.

The compiler lowers trigger-relative forms as follows:

- matcher selector `$` → `Selector.kind = Trigger`;
- a value path rooted at `$` → `Value_Path.root_kind = Trigger`;
- matcher query `link = $` → a specific auxiliary matcher whose selector kind is `Trigger`;
- change target `$` → `Change_Target.kind = Trigger`;
- change link target `= $` → `Link_Target.kind = Trigger`.

The explicit `(stat $.key)` and `(link $.key)` forms are superseded by trigger-rooted value paths.

### Deterministic IR flattening

The compiler lowers semantic trees into packed IR arrays in deterministic phases:

1. Emit rules in source order.
2. Reserve each rule's top-level trigger and condition matcher indices, keeping every rule's condition matcher range contiguous.
3. Reserve each rule's changes in source order, keeping every rule's change range contiguous.
4. Append auxiliary matchers used by nested link queries and all-matching change targets in source preorder.
5. Emit every matcher's direct queries as one contiguous range.
6. Append query nodes referenced through `Not.nested` after all direct matcher ranges.
7. Reserve `Value_Path` records for `Compare_Any` queries in source-query order and emit each path's steps as one contiguous range.
8. Resolve reserved matcher, query, path, and change references after their indices are assigned.

Nested structures must not disturb the source ordering or contiguity required by top-level rule ranges.

### Compiler output

The compiler returns Director IR encoded as JSON text using the contract defined by `examples/demo/CYBERPUNK/director.rspk.json`. The schema includes the explicitly specified generic property-removal facilities and remains the integration point for structured path comparison additions.

The compiler does not pack resource data. When packed output is needed, the JSON Director IR is passed to `respack.comp`; this keeps Director source compilation separate from generic resource packing.

The Project Unit exports this v1 WIT contract:

```wit
package gams:director-compiler@1.0.0;

interface director-compiler {
    record source-position {
        byte-offset: u32,
        line: u32,
        column: u32,
    }

    record source-span {
        start: source-position,
        end: source-position,
    }

    record diagnostic {
        code: string,
        message: string,
        span: source-span,
    }

    compile: func(source: string) -> result<string, list<diagnostic>>;
}

world director-compiler-plugin {
    export director-compiler;
}
```

Byte offsets are zero-based; lines and columns are one-based. Successful output is deterministic Director JSON. An error result contains one or more diagnostics. V1 diagnostics are errors only, with no warnings. The caller owns file-path context, so no path is passed to `compile`.

### Invocation and filesystem boundary

The compiler is a pure source-to-JSON operation and imports no filesystem interface. A caller such as a build Project Unit, View Plugin, or Host workflow owns orchestration:

```text
fs/fs::read-text
director-compiler/director-compiler::compile
fs/fs::write-text
```

The same `director-compiler/director-compiler::compile` target is used through `pluginManager` in every Host. The compiler does not receive paths, read Project Config, or persist output.

## Open questions

None for the accepted v1 scope.

## Related ADRs

None yet.

## Future capabilities (v2)

### Native collection links

V2 should first consider native collection-valued links so relationships can be stored directly on owner entities instead of being expressed only through reverse links and matcher projections.

Proposed declaration and mutation syntax:

```text
# Initial membership
PLAYER.items += APPLE
    .items += TORCH
    .items += ARMOR123

# Runtime mutation
DO: PLAYER.items += HEALPOTION123
    PLAYER.items -= APPLE
```

Proposed semantics:

- `=` sets a singular link;
- `+=` adds one target to a collection link;
- `-=` removes one target from a collection link;
- repeated members are stored under one collection relationship key;
- `PLAYER.items.*.light` traverses every collection member;
- members without `light` contribute no values;
- scalar-to-collection comparison retains v1 `Compare_Any` existential semantics.

This capability would require IR/runtime collection storage plus add-member and remove-member changes. It is explicitly outside v1.
