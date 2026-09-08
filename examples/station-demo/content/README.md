# Station showcase Director content

This directory owns the author-facing one-room puzzle rules and their fixed
Director-to-RSPK contract. The standalone game contract is
[`../game/CONTRACT.md`](../game/CONTRACT.md).

## Variants

- `power.director` is the initial walkthrough: interacting with `EXIT` unlocks
  it only after `PLAYER.powered` is set by `POWER_SWITCH`.
- `key.director` changes only that prerequisite to `PLAYER.carrying_key`.
- Both keep switch activation, idempotent key pickup/removal, and the
  `EXIT.-locked` effect in Director. The game has no power-versus-key branch.

The sources intentionally use the currently implemented IR only: entity/tag
matchers, conditions, entity removal, tag addition, and generic property
removal. Structured value paths are documented v1 work but are not implemented
by the current runtime/schema, so compiler placeholder `value_paths` and
`path_steps` arrays are explicitly excluded before packing.

## Developer compile -> bind -> pack proof

From the repository root:

```sh
direnv exec . make \
  build.nosync/plugins/director-compiler.comp.wasm \
  build.nosync/plugins/respack.comp.wasm
direnv exec . node examples/station-demo/content/build.mjs
```

`build.mjs` invokes the real singleton compiler and respack components through
the CLI runtime. It validates IR pool ranges, resolves every game-facing value
from compiler `symbols` metadata, removes metadata from runtime slot 0, and
writes both packs under `content/generated/`. No numeric compiler ID is authored
in source or build configuration.

Generated evidence per variant:

- `*.director.json` — implemented five-pool Director runtime IR;
- `*.bindings.json` — resolved `(kind, name, value)` records required by the game;
- `*.slots.json` — exact two-slot respack input;
- `*.rspk` — standalone RSPK v1 content;
- `decoder.odin` — raw checked-in decoder output generated from
  `director.rspk.json` for pipeline tests.

These are committed deterministic fixtures, not alternate authored sources.
After intentional source/schema/tool changes, regenerate and review them with:

```sh
direnv exec . node examples/station-demo/content/build.mjs --generate-decoder
```

CI-style verification is non-mutating and fails on any fixture drift, including
the generated decoder:

```sh
direnv exec . node examples/station-demo/content/build.mjs --check --generate-decoder
```

Decoder regeneration is a game-development/schema-change operation, not part of
the visitor workflow. The game decoder's generation/custom-validation boundary
is documented beside that source in `game/content/README.md`; the raw fixture
here is not copied over the hardened game decoder.

The content-only path calls `build.mjs` without that flag, or uses the Lua
presets in `../ng/presets/`. In particular,
`respack-content-save.lua` only packs/writes data and cannot regenerate game
source. The already compiled game decoder therefore remains stable across both
variants.

## Tests

```sh
# Deterministic real-component compile -> symbols -> pack test, plus diagnostics.
direnv exec . node examples/station-demo/tests/pipeline.e2e.mjs

# Both packs through one hardened game/content decoder and the same runtime code.
# Covers the 2 variants x 4 (neither/power/key/both) matrix, retries,
# repeated interactions, key idempotence, completion, and restart.
direnv exec . odin test examples/station-demo/tests

# Game worker's independent decoder/runtime tests.
direnv exec . make -C examples/station-demo/game test
```

To manually play a generated pack after the game web build, replace only the
bundle's content file; the game WASM is not rebuilt:

```sh
direnv exec . make -C examples/station-demo/game web
cp examples/station-demo/content/generated/power.rspk \
  examples/station-demo/game/build.nosync/web/station.rspk
# or copy key.rspk to the same destination
direnv exec . make -C examples/station-demo/game serve
```

Hash `game/build.nosync/web/station-demo.wasm` before and after swapping packs
to verify the prebuilt game is unchanged. The automated matrix instantiates the
same compiled Odin game/runtime path for both generated packs; browser input and
rendering remain a manual check.

## Schema and failure behavior

`director.rspk.json` has exactly two non-empty slots:

1. the implemented `director.Director_Data` field layout;
2. `station.Bindings`, a vector of named entity/word/rule bindings matching
   `game/CONTRACT.md`.

RSPK magic/version/slot count, enum values, all ranges/references, contiguous
entity IDs, duplicate bindings, and required bindings are validated by the game
loader. Missing compiler symbols, malformed source, malformed IR, or respack
errors abort generation; no fallback IDs or old-pack success is reported.

## Verification record

Verified 2026-09-07 with `direnv exec .`:

- `node examples/station-demo/tests/pipeline.e2e.mjs` passed, including two
  non-mutating checks of all nine generated fixtures, both variant bindings and
  packs, and the expected invalid-source diagnostic;
- `odin test examples/station-demo/tests` passed 2 tests across both packs;
- `make -C examples/station-demo/game test` passed 3 station tests and 5 content
  loader tests;
- `make -C examples/station-demo/game web` passed, and the bundled
  `station.rspk` matched `content/generated/power.rspk` byte-for-byte;
- fresh pinned dependency downloads passed both archive SHA-256 checks, and all
  12 altered `sokol-odin` files received the required modification marker.

No browser was launched; these command-line pipeline, Odin, dependency, and
WASM build results do not constitute browser verification.

## Remaining limitations

- `build.mjs` is developer evidence and uses repository Cargo/Nix tooling. The
  visitor workflow invokes the same compiler/respack Project Units from GAMS
  through the checked-in Node Graph and Lua presets; it does not run this Node
  script.
- Export assembly is exercised by the Project graph, but browser automation is
  not implemented. Serving and browser play remain explicit manual checks.
- The schema has no independent fingerprint field because the implemented RSPK
  format provides magic, version, and slot count only. Compatibility is enforced
  structurally and by required named bindings in the prebuilt game decoder.
