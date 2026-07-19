# director-compiler.comp

`director-compiler.comp` is the singleton WASM Project Unit that compiles human-authored Director DSL source into deterministic JSON Director IR.

Start with the **[Director language overview](./overview.md)** for a single-page tour of the language, examples, compiler behavior, diagnostics, and current implementation status.

The accepted v1 language design and compiler requirements are recorded in [`docs/prd/0010-director-dsl.md`](../../docs/prd/0010-director-dsl.md).

## Boundary

The compiler is intentionally pure:

- input is Director source text;
- output is Director JSON IR or structured source diagnostics;
- no filesystem interface is imported;
- no Project Config or path is passed to the compiler;
- no resource packing is performed.

Callers own orchestration:

```text
fs/fs::read-text
    -> director-compiler/director-compiler::compile
    -> fs/fs::write-text
```

Pass the generated JSON to `respack.comp` separately when packed resource data is needed.

## Public API

See [`wit/package.wit`](./wit/package.wit) for the canonical WIT contract.

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
```

Successful compilation returns JSON text. Invalid user source returns diagnostics and no JSON. Internal invariant failures are not converted into source diagnostics.

## Files

- `overview.md` — durable, human-oriented Director language documentation.
- `wit/package.wit` — public component contract.
- `component.c` — generated-component ABI bridge.
- `core.odin` — exported Odin compiler entry point.
- `lexer.odin` — lexical validation and diagnostic spans.
- `compiler.odin` — entity parsing, symbols, and shared source helpers.
- `rules.odin` — rule, matcher, query, and change parsing/lowering.
- `json_writer.odin` — deterministic Director IR JSON emission.
- `test/e2e.mjs` — component-level compilation and diagnostic tests.

## Build

From the GAMS repository root with the root Nix/direnv environment loaded:

```sh
direnv allow
make build.nosync/plugins/director-compiler.comp.wasm
```

Without direnv:

```sh
nix develop --command make build.nosync/plugins/director-compiler.comp.wasm
```

## Test

```sh
make director-compiler.comp-test
```

The end-to-end test builds the component, invokes it through the GAMS CLI runtime, checks emitted JSON IR, validates diagnostics, compiles the CYBERPUNK example, and verifies demo Project registration.

## Invoke from the CLI

After building the component, invoke its exported operation through GAMS:

```sh
cargo run \
  --manifest-path cmd/app/src-tauri/Cargo.toml \
  -- run \
  --plug build.nosync/plugins/director-compiler.comp.wasm \
  director-compiler/director-compiler::compile \
  '["PLAYER.hp = 32"]'
```

The CLI prints the WIT result as JSON. In normal Project execution, register the component with `pluginManager` and call the same `director-compiler/director-compiler::compile` target from any Host or Project Unit.

## Example source

The demo source is [`examples/demo/CYBERPUNK/director.director`](../../examples/demo/CYBERPUNK/director.director). Its graph preset invokes this compiler and forwards the JSON IR to the next stage.

## Entity availability

Director entities have stable compiled IDs and an availability state. Prefix declarations with `-` to author them as initially removed, use `+ENTITY` to add them to matching, and use `-TARGET` to remove them from matching. Removal preserves current tags, stats, and links for a later re-add. This is separate from ordinary tags such as the demo's `.spawn`, which the game interprets as ECS projection state. See [`overview.md`](./overview.md#entity-availability).

## Implementation status

The accepted v1 language is broader than the current compiler tracer bullet. In-progress syntax is marked in [`overview.md`](./overview.md#implementation-status), including structured value paths, nested matcher link values, matcher continuations, declaration/rule interleaving, and complete diagnostic recovery.

Those markers describe implementation progress only; the marked features remain part of accepted v1.
