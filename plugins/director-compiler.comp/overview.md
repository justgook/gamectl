# Director language overview

Director is a small, line-oriented language for describing an initial game world and the rules that change it. A Director source file declares entities, matches events and world state, and applies changes when rules fire.

This document is a tour of the accepted Director language rather than a compiler implementation specification. The normative v1 design is recorded in [`docs/prd/0010-director-dsl.md`](../../docs/prd/0010-director-dsl.md).

> **Implementation status**
>
> The v1 language design is accepted, but its compiler is still being completed. Features marked **In progress** below are part of v1 even though `director-compiler.comp` does not compile them yet. The [implementation status](#implementation-status) section collects the current gaps in one place.

## A complete example

```director
# Declare the initial world.
PLAYER.money = 10
  .hp = 32
  .fear = 4

CAVE.location.dark
TORCH.item
    .illumination = 7
    .current_location = PLAYER

# Fire when any unexplored dark location triggers the rule.
ON: *.location.dark.!explored
IF: PLAYER.current_location = (*.dark)
    PLAYER.fear < 5
DO: $.explored
    PLAYER.fear + 2

# Signals can trigger rules without an entity.
ON: "next-day"
DO: PLAYER.day + 1
```

A source document contains two kinds of top-level declaration:

- **entities**, which define the initial world;
- **rules**, which react to an entity or signal and change the world.

Director files conventionally use the `.director` extension. Compilation produces JSON Director IR, conventionally named `.director.json`.

## Entities and properties

An entity declaration begins with its name. Properties following the name define its initial tags, integer stats, and links to other entities. Prefix the name with `-` to declare an entity that exists in authored data but is initially unavailable to matching.

```director
PLAYER
CAVE.location.dark
PLAYER.money = 10
TORCH.current_location = CAVE
-BOSS.hp = 400.weapon = SUPERPUPER_GUN
```

The value determines the property's kind:

| Source | Meaning |
| --- | --- |
| `CAVE.dark` | Add the `dark` tag to `CAVE`. |
| `PLAYER.money = 10` | Set the integer stat `money` to `10`. |
| `TORCH.current_location = CAVE` | Link `TORCH` to `CAVE` through `current_location`. |

Properties may be chained on one line:

```director
PLAYER.character.hp = 32.money = 10
```

They may also continue on later lines. Indentation depth does not matter, and a continuation dot may even begin at column 1:

```director
PLAYER.character
  .hp = 32
.money = 10
```

Each entity name may be declared only once. A later declaration is not an amendment:

```director
CAVE.dark
cave.location # Error: CAVE and cave are the same entity.
```

References may point forward to an entity declared later in the document:

```director
PLAYER.current_location = CAVE
CAVE.location
```

Entity declarations and rules may be interleaved. A column-1 entity declaration after a rule's `DO` section ends that rule and begins the entity.

> **In progress:** the current compiler requires all entity declarations to appear before the first rule. Interleaving and forward references across that boundary are accepted v1 behavior but are not implemented yet.

## Rules

A rule has one required `ON` section, an optional `IF` section, and one required `DO` section, in that order:

```director
ON: *.enemy
IF: PLAYER.hp > 0
DO: PLAYER.hp - 1
```

- `ON` defines the trigger.
- `IF` lists additional conditions. Every condition must match.
- `DO` lists the changes to apply.

Each section requires an expression on the same line as its keyword. Keywords are case-insensitive, so `on:`, `On:`, and `ON:` are equivalent.

Blank lines and comments do not end a rule. A new `ON` starts the next rule. A column-1 entity declaration following `DO` also starts a new top-level declaration.

### Entity triggers

An unquoted `ON` expression is a matcher. It can name one entity or use `*` to match any entity:

```director
ON: CAVE.dark
DO: CAVE.explored

ON: *.item.!fixed
DO: $.available
```

When an entity matcher triggers a rule, `$` refers to that triggering entity. It is valid in `IF` matchers, value paths, and `DO` changes, but not in `ON` itself because there is no prior trigger there.

### Signal triggers

A quoted value is a signal trigger:

```director
ON: "next-day"
DO: PLAYER.day + 1
```

Signals contain printable ASCII and are case-insensitive. They support two escapes:

```director
ON: "chapter-\"one\"" # A literal quote
ON: "path\\next"      # A literal backslash
```

`#` is ordinary text inside a quoted signal:

```director
ON: "chapter#next" # This comment begins after the closing quote.
DO: PLAYER.ready
```

A signal rule has no triggering entity, so `$` is invalid anywhere in that rule.

## Matchers

Matchers select or test entities. Their selector is followed by zero or more queries:

```director
CAVE.dark
*.enemy.hp > 0
$.current_location = CAVE
```

There are three selectors:

| Selector | Meaning |
| --- | --- |
| `CAVE` | The specific declared entity `CAVE`. |
| `*` | Any entity. |
| `$` | The entity that triggered the current rule. |

### Tag queries

A bare property requires a tag to be present:

```director
*.enemy
CAVE.dark
```

Put `!` immediately after the dot to negate a query:

```director
*.!fixed
CAVE.!explored
```

Negation also works with stat and link queries:

```director
*.!hp > 9
*.!current_location = CAVE
```

Only one `!` is allowed in v1.

### Stat queries

Compare an integer stat using `=`, `<`, or `>`:

```director
PLAYER.chapter = 1
PLAYER.fear < 5
PLAYER.money > 100
```

### Link queries

Compare an entity link with a specific entity:

```director
TORCH.current_location = CAVE
```

A parenthesized matcher can constrain the linked entity instead:

```director
PLAYER.current_location = (*.location.dark)
```

This asks whether `PLAYER.current_location` links to any entity that has both `location` and `dark` tags.

The triggering entity can also be used as the expected link target:

```director
IF: KEY.current_location = $
```

> **In progress:** nested matcher link values and `$` link values in matchers are accepted v1 syntax but are not implemented by the current compiler.

### Multiple conditions

`IF` begins with one inline matcher. Indented full expressions add conditions, and all of them must match:

```director
ON: *.line
IF: PLAYER.chapter = 1
    STREET.plot = 1
	PLAYER.fear < 5
DO: STREET.plot = 2
```

Indentation is binary: a line is either at column 1 or has some leading horizontal whitespace. Its exact depth and the use of spaces versus tabs do not matter.

A matcher property chain can also continue on lines beginning with a dot:

```director
IF: PLAYER
    .chapter = 1
    .fear < 5
```

A continuation extends the preceding matcher; an indented line without a leading dot starts another matcher.

> **In progress:** matcher continuations in `ON` and `IF` are accepted v1 formatting but are not implemented by the current compiler.

## Changes

The `DO` section changes entities. It can add tags, set stats and links, adjust stats, remove properties, or change whether authored entities are available to matching.

### Tags, stats, and links

```director
DO: CAVE.explored                  # Add a tag.
    PLAYER.fear = 5                # Set an integer stat.
    PLAYER.fear + 2                # Increment a stat.
    PLAYER.fear - 2                # Decrement a stat.
    PLAYER.current_location = CAVE # Set an entity link.
```

When an entity matcher triggered the rule, changes may target or link to `$`:

```director
ON: *.item.!fixed
DO: $.current_location = PLAYER
    PLAYER.last_item = $
```

### Chained changes

Properties chained after one target are separate changes to that target:

```director
DO: PLAYER.current_location = CAVE.fear + 2
```

This sets `PLAYER.current_location` and increments `PLAYER.fear`. The same chain can span lines:

```director
DO: PLAYER.current_location = CAVE
    .fear + 2
```

An indented full expression without a leading dot starts a different target:

```director
DO: PLAYER.current_location = CAVE
    .fear + 2
    CAVE.explored
```

This updates `PLAYER` twice and `CAVE` once.

### Property removal

Prefix a property name with `-` to remove it:

```director
DO: PLAYER.-current_location
    $.-state
    (*.enemy).-state
```

Director properties can move between tag, stat, and link storage over time. Therefore `.-key` removes that key from all three stores. Removing an absent property is a valid no-op.

### Matching many entities

A parenthesized matcher is a multi-entity change target:

```director
DO: (*.enemy).blinded
    (*.item.!fixed).available
```

The change is applied to every matching entity.

### Entity availability

Every entity has a stable compiled ID. An available entity participates in matchers and may trigger entity rules; a removed entity retains its current properties and ID but is excluded from all matching.

Prefix a declaration with `-` to make its initial state removed:

```director
-BOSS.hp = 400.weapon = SUPERPUPER_GUN
```

Prefix a specifically declared entity with `+` in `DO` to add a removed entity back to matching:

```director
ON: BOSS_ROOM
DO: +BOSS
    BOSS.spawn
```

Adding preserves the entity's current runtime properties. If `BOSS` was removed with `hp = 100`, adding it back restores availability with `hp = 100`; it does not reset the authored `hp = 400` value. Adding an already available entity is a valid no-op. `+$` and `+(*.item)` are invalid because adding requires one stable authored entity ID.

Prefix a target with `-` to remove it from matching:

```director
DO: BOSS.-spawn
    -BOSS
    -$
    -(*.enemy)
```

Removal can target one declared entity, the triggering entity, or every currently matching entity. Removing an already removed entity is a valid no-op. Removal does not alter tags, stats, or links.

Entity availability is independent from game-runtime projection. In the example, `+BOSS` adds the Director entity to matching and `BOSS.spawn` emits an ordinary tag mutation that the demo game interprets as a request to create an ECS projection. The two operations remain separate and ordered.

## Value paths and projected comparisons

> **In progress:** this entire section is accepted v1 syntax but is not implemented by the current compiler.

A condition can compare values reached by following links and projecting stats. A parenthesized matcher can also be the root of a path:

```director
IF: PLAYER.current_location.darkness < (*.item.current_location = PLAYER).light
```

The left side starts at `PLAYER`, follows its singular `current_location` link, and reads the linked entity's `darkness` stat. The right side:

1. finds every entity tagged `item` whose `current_location` links to `PLAYER`;
2. reads `light` from each matching entity;
3. compares the left value with all produced right values.

Comparison has **existential Cartesian semantics**: it succeeds when at least one pair of values satisfies the operator. Conceptually:

```text
left_values  = values(PLAYER.current_location.darkness)
right_values = matches(*.item.current_location = PLAYER)
                 .flatMap(item => values(item.light))
result       = any(left, right where left < right)
```

Missing links and missing terminal stats produce no value. An item without `light` is skipped rather than treated as having `0`. If either side is empty, the comparison is false.

V1 paths support roots at:

- a specific entity;
- `$`, the triggering entity;
- the current matched entity;
- a parenthesized matcher result set.

They can follow singular named links and finish by reading an integer stat. Native collection links and syntax such as `PLAYER.items.*.light` are deferred beyond v1.

## Source text rules

### Case-insensitive names

Keywords, entity names, property names, and signals are case-insensitive:

```director
CAVE.dark

on: cave.dark
Do: Cave.explored
```

All three spellings of `CAVE` refer to the same entity. The compiler canonicalizes semantic names to ASCII lowercase in symbol metadata.

Identifiers are ASCII-only in v1. Entity identifiers begin with a letter and may contain letters, digits, `_`, `-`, `:`, or `+`. Property names may also begin with a digit, but do not contain `-` or `+` because those characters are property operators.

### Integers

Integers are signed base-ten 32-bit values:

```director
PLAYER.balance = -100
PLAYER.score = 2147483647
```

Values outside `-2147483648` through `2147483647` are errors.

### Comments

`#` begins a comment outside a quoted signal:

```director
PLAYER.hp = 32 # Initial health
# A whole-line comment
```

Blank lines and comment-only lines are trivia. They do not terminate a rule or clear an expression that can be continued.

### Whitespace and line structure

Horizontal spaces and tabs are allowed around operators and separators. They are not allowed inside an unquoted identifier or integer.

Top-level declarations and `ON:`, `IF:`, and `DO:` begin at column 1. Leading whitespace has two special meanings:

- a line beginning with `.` after optional whitespace continues the previous compatible expression;
- inside `IF` or `DO`, any other indented expression adds another matcher or change.

An indented full expression anywhere else is an error. Indentation depth is never used to build a nested block structure.

## Compilation

`director-compiler.comp` is a singleton WASM Project Unit. It performs a pure source-to-JSON operation and does not read or write files.

Its public operation is:

```wit
compile: func(source: string) -> result<string, list<diagnostic>>;
```

A Host or another Project Unit supplies the source and decides what to do with the generated JSON:

```text
fs/fs::read-text
    -> director-compiler/director-compiler::compile
    -> fs/fs::write-text
```

The output is deterministic: identical source compiled by the same compiler version produces byte-identical JSON. The JSON is Director IR, not packed resource data. Pass it separately to `respack.comp` when packed output is required.

Numeric entity IDs follow entity declaration order. Numeric rule IDs follow `ON` source order. Property and signal words are interned by first semantic occurrence after ASCII lowercase canonicalization.

### Rule weight

Rule weight is computed automatically; there is no weight syntax in v1.

- A specific-entity `ON` contributes `100` plus its direct query count.
- An any-entity `ON` contributes its direct query count.
- A signal `ON` contributes `0`.
- A specific-entity `IF` contributes `10` plus its direct query count.
- An any-entity `IF` contributes its direct query count.

The contributions of the trigger and all conditions are added together. Nested query complexity does not add weight beyond the direct query containing it.

## Diagnostics

Invalid source returns structured diagnostics and no JSON. Each diagnostic has:

- a stable machine-readable code;
- a human-readable message;
- a source span with zero-based byte offsets and one-based line and column numbers.

Examples of stable codes include:

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
semantic-invalid-add-target
semantic-invalid-path
semantic-unrepresentable-ir
too-many-errors
```

The accepted v1 behavior accumulates independent lexical, syntax, and semantic errors, sorts them by source span and code, and returns at most 100 ordinary diagnostics followed by `too-many-errors` when necessary.

> **In progress:** lexical diagnostics can currently accumulate, but parsing and semantic analysis generally stop at the first error. Full recovery, sorting, and the `too-many-errors` sentinel remain to be implemented.

## Compact syntax reference

```text
# Entities
ENTITY
-ENTITY       # initially removed from matching
ENTITY.tag
ENTITY.stat = INTEGER
ENTITY.link = ENTITY

# Rules
ON: MATCHER | "signal"
IF: MATCHER
    MATCHER
DO: CHANGE
    CHANGE

# Matcher selectors
ENTITY      # specific entity
*           # any entity
$           # triggering entity, where valid

# Matcher queries
.selector.tag
.selector.!tag
.selector.stat = INTEGER
.selector.stat < INTEGER
.selector.stat > INTEGER
.selector.link = ENTITY
.selector.link = (MATCHER)

# Changes
ENTITY.tag
ENTITY.stat = INTEGER
ENTITY.stat + INTEGER
ENTITY.stat - INTEGER
ENTITY.link = ENTITY
ENTITY.-property
$.property
(MATCHER).property
+ENTITY
-ENTITY
-$
-(MATCHER)

# Accepted v1 path comparison; implementation in progress
ENTITY.link.stat < (MATCHER).stat
```

## Implementation status

The current compiler implements the core tracer bullet used by the demo:

- entity tags, integer stats, and links;
- direct specific/any/trigger-relative matchers;
- direct tag, stat, link, and negated queries;
- signal and entity rules with multiple `IF` and `DO` expressions;
- tag, stat, link, property-removal, and entity-availability changes;
- all-matching change targets;
- entity and `DO` property continuations;
- case-insensitive names, comments, quoted signals, deterministic JSON, and structured diagnostics.

Accepted v1 work still in progress:

- structured value paths and existential `Compare_Any` queries;
- parenthesized matcher values in link queries;
- trigger-relative `$` as a matcher link value;
- property continuation lines for `ON` and `IF` matchers;
- interleaved entity declarations and rules, including references to entities declared after rules begin;
- complete diagnostic recovery, sorting, capping, and all required diagnostic-code distinctions.

This list describes implementation progress, not optional language features. When a feature lands, its marker should be removed from this overview and the list updated in the same change.
