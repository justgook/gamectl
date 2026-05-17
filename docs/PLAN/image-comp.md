# image.comp Plan

Status: **phase 1 scaffold implemented; initial `cmd/app` JSON resource bridge implemented**.

## Direction

`plugins/image.comp` is the component-model migration target for legacy `plugins/image`.

Decisions:

- Expose a typed `gams:image/image@1.0.0` WIT interface.
- Use `resource image`, not integer handles, as the public image identity.
- Do not import `gams:runtime/runtime`; image is a typed component and should only use known imports such as WASI filesystem when needed.
- Dynamic JSON bridges represent image resources as opaque refs:

  ```json
  { "$resource": "gams:image/image", "id": "res_..." }
  ```

- Keep operations immutable: functions that modify pixels return a new `image` resource.
- Later implementation may use deferred/lazy evaluation internally. An `image` resource may represent materialized RGBA8 pixels or an operation DAG node.

## Phase 1 Scope

Implemented initial component scaffold:

- `plugins/image.comp/wit/package.wit`
- `plugins/image.comp/plugin.mk`
- `plugins/image.comp/component.c`

Initial WIT exports:

- `open`
- `create`
- `info`
- `clone`
- `crop`
- `resize`
- `transform`
- `blit`
- `write-pixel`
- `write-pixels`
- `read-pixel`
- `read-pixels`
- `%export`
- `save`

The phase 1 C implementation is intentionally materialized RGBA8-only. It exists to validate WIT shape, resource generation, immutable operation semantics, and build integration before porting codec/filesystem code from legacy `plugins/image`.

Implemented behavior:

- `create`
- `info`
- `clone`
- `crop`
- `resize` using `stb_image_resize2` filters
- `transform` using WIT `flags transform-flags`
- `blit` with source-over alpha
- `write-pixel`
- `write-pixels`
- `read-pixel`
- `read-pixels`
- `open` for PNG/QOI via reused legacy codec headers and direct `wasi:filesystem`
- `%export` for PNG/QOI bytes
- `save` for PNG/QOI files via direct `wasi:filesystem`
- resource destructor

Not implemented yet:

- lazy/deferred operation DAG

## Runtime JSON Resource Bridge

Implemented initial `cmd/app` frontend/runtime bridge behavior:

- WIT resources returned from `runtime.invoke` or component-side `gams:runtime/runtime.call` become `{ "$resource": "gams:image/image", "id": "res_..." }`.
- JSON refs passed back to `runtime.invoke` / `runtime.call` are resolved to the stored Wasmtime resource.
- The bridge validates resource ids and JSON `$resource` strings.
- `runtime.releaseResource(ref)` / `runtime_release_resource` drops a JSON-boundary resource and removes its host ref.
- Diagnostics include `jsonResourceRefs`.
- Added a Rust runtime smoke test covering `create` -> resource ref -> `info` / `read-pixel` -> release -> unknown-ref failure.

Current limitation: the resource type string is derived from the resolved invocation interface, e.g. `gams:image/image@1.0.0::create` becomes `gams:image/image`. This is correct for `resource image` in the `image` interface, but should be generalized if interfaces export multiple resources.

## Next Logical Step

Next, harden file-path behavior and start the lazy/deferred operation DAG design. Codec smoke coverage now includes PNG open, PNG/QOI export signatures, PNG/QOI save, and PNG/QOI reopen. File IO is intentionally direct `wasi:filesystem`; `plugins/fs.comp` is for frontend usage and should not be imported by `image.comp`. Remaining file hardening targets: richer errors and more path/preopen coverage.
