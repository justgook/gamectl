# Station game content loader

`decoder.odin` is the runtime boundary for station RSPK data. The pipeline and
game tests must call `content.read`; importing `content/generated/decoder.odin`
directly bypasses the validation and ownership contract.

## Generated-decoder boundary and regeneration

The wire decoder began as the deterministic output for
`../../content/director.rspk.json`. The handwritten portion adds the public
`Decoded`/`read`/`destroy` ownership API plus semantic validation and hardens the
wire reader against malformed untrusted counts, offsets, enum values, and
partial-decode leaks. Decoded strings and byte slices borrow the input pack, so
the caller must keep its byte buffer alive until after `destroy`.

The content-generation worker owns regeneration. After an intentional schema or
respack generator change, from the repository root:

```sh
direnv exec . node examples/station-demo/content/build.mjs --generate-decoder
```

Then reconcile `examples/station-demo/content/generated/decoder.odin` into
`game/content/decoder.odin` rather than copying it blindly:

1. retain package `content` and the `../director` / `../station` imports;
2. update generated field-decoding routines to match the new schema;
3. retain unsigned remaining-length checks before every slice operation;
4. retain minimum encoded-size checks before every vector allocation;
5. retain raw enum-range checks before narrowing to enum backing types;
6. retain the single cleanup guard in `read`, `destroy`, and handwritten
   validation (including indirect `Not` cycle rejection and bindings checks);
7. update malformed-pack tests for any changed wire offsets, then run all commands
   below.

A future generator may emit those wire-safety checks directly. Until then, the
raw generated fixture is evidence for schema drift, not the game loader.

## Validation policy

Validation checks only invariants needed for safe Director runtime use. Inactive
payload fields in tagged IR records are not reference-validated: for example, a
`Has_Tag` query does not require meaningful stat/link references, and a
non-`Set_Link` change does not require a meaningful link target. All serialized
enum discriminants still have to be in range. Entity IDs are contiguous because
the runtime indexes entities by ID; pool ranges, active references, required and
duplicate bindings, and direct or indirect `Not` cycles are rejected.

## Verification record

Run from the repository root with direnv:

```sh
direnv exec . make -C examples/station-demo/game test
direnv exec . odin test examples/station-demo/tests -file
```

Verified 2026-09-07:

- game test: 8 tests passed (3 station + 5 content); Odin memory tracking
  reported no leaks;
- pipeline test: 2 tests passed, exercising both `power.rspk` and `key.rspk`
  through `game/content.read` and the game runtime.

Malformed-pack coverage includes overflowing slot bounds, vector/string counts
checked before allocation, raw enum values, direct and indirect `Not` cycles,
and invalid/missing/duplicate bindings. A malformed bindings slot fails after
slot 0 allocations, so Odin's test tracking allocator also covers cleanup of a
partially decoded result.
