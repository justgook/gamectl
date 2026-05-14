# layout3

`layout3` is the component-model replacement for `plugins/layout2`.

The first migration target is the protocol only: `wit/package.wit` defines a
stateless request → response API. Callers pass a `layout-document` into every
operation and receive a new `layout-document`; no caller reads component linear
memory and no hidden singleton state is required.

## Differences from layout2

- no `get_info_ptr` / shared-memory snapshot
- no PDK comma-separated arguments
- component WIT records/lists/results instead of byte buffers
- area/handle manipulation uses caller-visible string `content-id` values instead
  of exposed list indices
- panel and handle capacity is configurable through `layout-config`
- handle axis and scope metadata are part of the document so operations can be
  pure functions over input documents
- `try-corner` returns a document with `preview` populated instead of mutating a
  global preview slot

Implementation can initially port `plugins/layout2/core.c` algorithms, replacing
its global `LayoutInfo` plus parallel handle arrays with a `layout-document`
input/output conversion layer.
