# Station demo game foundation

Standalone Odin/WebGL one-room game for the public showcase slice. It owns only
game runtime code; see [`CONTRACT.md`](CONTRACT.md) for the content pipeline
boundary.

```sh
# From the repository root, always use the repository dev environment:
direnv exec . make -C examples/station-demo/game test
direnv exec . make -C examples/station-demo/game web
direnv exec . make -C examples/station-demo/game serve
```

Open <http://localhost:8814>. Move with WASD/arrows, interact with E/Space or the
button, and restart with R or the button.

The checked-in source has no dependency on `examples/demo/tmp`, symlinks, or the
demo's level/animation/bullet/UI packs. `make web` copies the real checked-in
`../content/generated/power.rspk` compiler/respack output into the bundle as
`station.rspk`; it never substitutes the handwritten Python fixture. Run the
content pipeline drift check before building when sources or tools change:

```sh
direnv exec . node examples/station-demo/tests/pipeline.e2e.mjs
```

`make fixture` retains the handwritten pack only at
`build.nosync/test-fixtures/station.rspk` for isolated test investigation. It is
not an input to `test`, `wasm`, `web`, or `serve`.

## Baseline recorded before implementation

On 2026-09-06 at repository commit
`a70157e8d6efa3e30ca3d19c811c6e7e3e5a1deb`, using `direnv exec .`:

- `make -C examples/demo/game web` passed.
- `make -C examples/demo/game test` ran 92 tests and failed 3 pre-existing
  platformer slope tests:
  `test_platformer_walks_from_flat_onto_uphill_without_falling`,
  `test_platformer_walks_left_uphill_without_falling`, and
  `test_platformer_walks_uphill_without_falling`.
- Director runtime tests in that run passed. The station game does not reuse the
  platformer world.

The content pipeline checks both generated variants, and the Odin tests exercise
them through the same gameplay/runtime code. Browser loading, input, and
rendering are manual verification steps; the commands above do not claim a
browser test.
