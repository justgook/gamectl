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
  pure transform over request data.

This keeps `cmd/app` and future views thin: the host invokes typed WIT exports
and stores/transfers the returned document as ordinary data.

## Initial WIT status

Created: `plugins/layout3/wit/package.wit`

World: `gams:layout3/layout3-plugin@1.0.0`

Exported interface: `gams:layout3/layout@1.0.0`

Validation performed with:

```sh
wit-bindgen c plugins/layout3/wit --world gams:layout3/layout3-plugin@1.0.0 --out-dir /tmp/layout3-bindgen-check
```

## Open decisions

- Whether `content-id` should stay `s32` for the first port or become `string`
  / a typed view/plugin handle.
- Whether max panel/handle capacity should remain an implementation limit for
  compatibility or become configurable.
- Whether layout documents should eventually expose stable area/handle ids
  instead of list indices.
