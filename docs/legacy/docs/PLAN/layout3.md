# layout3 plan

`plugins/layout3` is the WASM component-model replacement for `plugins/layout2`.

## layout2 findings

`plugins/layout2` currently has two layers:

- `core.c` / `layout.h`: a headless rectangular panel layout engine using global
  static state (`LayoutInfo g_info`) plus parallel hidden handle metadata arrays.
- `main.c` / `pdk.h`: legacy PDK exports that parse comma-separated integer
  inputs, call the core functions, and return either numeric error codes or a
  raw memory snapshot.

Public layout2 operations:

- `init_screen(w, h, handle_size, min_panel_size)` resets global state to one
  full-screen area.
- `resize_screen(w, h, handle_size)` proportionally rescales the global layout.
- `move_handle(handle_index, x, y)` moves a split boundary and updates affected
  areas/handles.
- `move_corner(area_index, corner_index, x, y)` splits an area or attempts a
  simple merge with a target area.
- `try_corner(area_index, corner_index, x, y)` computes a preview rectangle in
  global state.
- `set_area_content(area_index, content_id)` and
  `set_handle_content(handle_index, content_id)` assign opaque integer tags.
- `snapshot()` returns raw bytes of the in-memory `LayoutInfo` struct.

The main migration blocker is not the geometry algorithm; it is the ABI shape:
callers must understand C struct layout in wasm memory, while some required
calculation state (`g_handle_axis`, `g_handle_col_x0/x1`, `g_handle_row_y0/y1`)
is not in the public snapshot at all.

## layout3 direction

`plugins/layout3/wit/package.wit` defines a stateless request → response
component protocol:

- every operation accepts a typed request record;
- mutating operations include the previous `layout-document`;
- every successful operation returns a `layout-response` with the next
  `layout-document`;
- errors are WIT `result` errors, not integer return codes plus side effects;
- there is no exported pointer and no shared-memory snapshot contract;
- handle axis/scope metadata is part of the document so implementation can be a
  pure transform over request data;
- `content-id` is a unique string and is the public identity for areas/handles;
- public operations select areas/handles by `content-id`, not by list index;
- list indices are implementation/iteration details only;
- maximum area/handle counts live in `layout-config` instead of hardcoded public
  constants.

This keeps `cmd/app` and future views thin: the host invokes typed WIT exports
and stores/transfers the returned document as ordinary data.

## Current implementation status

Created:

- `plugins/layout3/wit/package.wit`
- `plugins/layout3/component.c`
- `plugins/layout3/plugin.mk`

World: `gams:layout3/layout3-plugin@1.0.0`

Exported interface: `gams:layout3/layout@1.0.0`

Implemented operations:

- `init-screen`
- `resize-screen`
- `move-handle`
- `move-corner`
- `try-corner`
- `rename-area-content`
- `rename-handle-content`

Validation performed with:

```sh
nix-shell --run 'make build.nosync/plugins/layout3.wasm'
nix-shell --run 'cd cmd/app/src-tauri && cargo test runtime::tests::layout3_splits_by_content_id -- --nocapture'
```

## Decisions

- `content-id` is a string, not the `s32` inherited from layout2.
- `content-id` is the public identity for layout manipulation. The backend may
  use transient indices internally, but indices are not exposed in the contract.
- `content-id` values must be unique within a layout document.
- When a split creates a new area/handle and the caller does not provide ids,
  layout3 derives ids by appending suffixes such as `_1`, repeating until the
  id is unique. Example: `main` -> `main_1` -> `main_1_1` if the caller never
  renames generated ids.
- Max panel/handle capacity is configurable via `layout-config`.

## Open decisions

- Whether area and handle `content-id` values share one global namespace or two
  independent namespaces. The current WIT says unique within the document.
- Exact generated handle id convention when a split creates a handle and the
  caller does not provide `new-handle-content-id`.
