# Station game content contract

This file is the coordination boundary between the standalone Odin game and the
Project-owned content pipeline. The game fails at startup when this contract is
not met; it does not guess ids or fall back to embedded puzzle rules.

## File

The browser bundle must contain `station.rspk` beside `station-demo.wasm`.
It is an RSPK v1 file (`RSPK`, little-endian `u16` version `1`) with exactly two
non-empty slots. The standard RSPK header/table layout is reused: magic and
version, `u16` slot count, then one `(u32 offset, u32 length)` pair per slot.
Offsets and lengths are byte ranges in the complete file.

## Slot 0: `director.Director_Data`

Slot 0 uses the existing respack serialization of the Odin Director runtime's
`director.Director_Data` type. It is the same field order and primitive encoding
used by `examples/demo/game/data_director/decoder.odin`:

1. `[]Entity_Def`
2. `[]Rule`
3. `[]Matcher`
4. `[]Query`
5. `[]Change`

Slices start with a little-endian `u32` count. Enum and distinct-id values are
little-endian `u32`; `i32` uses its little-endian two's-complement bits; `bool`
is one byte. Struct fields are serialized in Odin declaration order. Strings,
used in slot 1, are a `u32` UTF-8 byte length followed by bytes.

The game validates enum values, contiguous entity ids, every range/index, and
all referenced entity ids before initializing Director.

## Slot 1: game-facing symbol bindings

Slot 1 deliberately resolves compiler-assigned ids by name so source edits may
renumber symbols without rebuilding the game. Its schema is:

```odin
Binding_Kind :: enum u32 { Entity, Word, Rule }
Binding :: struct {
    kind:  Binding_Kind,
    name:  string,
    value: u32,
}
Bindings :: []Binding
```

The packed representation is a `u32` binding count followed by each binding's
`kind`, UTF-8 `name`, and `value`. Names are case-sensitive authored/compiler
symbol names. Duplicate `(kind, name)` entries are invalid. Unknown additional
bindings are allowed, which keeps this game-side decoder compatible with richer
compiler metadata.

Required bindings for the one-room game are:

| Kind | Name | Purpose |
| --- | --- | --- |
| Entity | `PLAYER` | inventory/status owner |
| Entity | `POWER_SWITCH` | interaction target |
| Entity | `ACCESS_KEY` | interaction target |
| Entity | `EXIT` | interaction/collision target |
| Word | `powered` | power status tag on `PLAYER` |
| Word | `carrying_key` | key status tag on `PLAYER` |
| Word | `locked` | closed-door tag on `EXIT` |

The power switch, key, and exit interactions are sent to Director as entity
triggers using these resolved entity bindings. Director rules must apply all
puzzle state mutations. In particular, the game contains no power-versus-key
unlock test: whether an exit trigger removes `EXIT.locked` is entirely defined
by slot 0. A trigger with no matching rule is an ordinary locked interaction.

The initial showcase source should make power activate `PLAYER.powered`, key
pickup activate `PLAYER.carrying_key` and remove the key entity, and exit
interaction remove `EXIT.locked` only when the authored prerequisite matches.
The guided variant changes that prerequisite while preserving this schema and
these bindings.

## Runtime projection

Movement, proximity, room/door collision, placeholder rendering, completion,
and input belong to the game. Rendered switch/key/door status is queried from
Director state through the bindings above. Restart destroys and reinitializes
Director from the same decoded immutable `Director_Data` and restores the
player transform/status message.

## Generated pack policy

The browser build's default input is the checked-in real pipeline output
`../content/generated/power.rspk`. Files under `content/generated/` are
reviewable deterministic fixtures: authored `.director` and schema inputs plus
the pinned compiler/respack components remain the source of truth, and
`tests/pipeline.e2e.mjs` fails if regenerating either variant or the raw generated
decoder would change a checked-in fixture.

`tools/make_fixture.py` is retained only for isolated tests and writes to
`build.nosync/test-fixtures/` through `make fixture`. It is not an input to the
game's `test`, `wasm`, `web`, or `serve` targets and is not the showcase
authoring pipeline.
