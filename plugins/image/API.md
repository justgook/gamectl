# Image Plugin API

Status: draft

Module name: `image`

API version: `image/v1`

This document defines the public API for the global image plugin that replaces
`image-process`. The design follows the existing plugin ABI already used by
GameCtl plugins through `pdk.h`:

- input: UTF-8 JSON bytes
- output: UTF-8 JSON bytes
- success: `returnCode = 0`
- failure: `returnCode != 0` and a JSON error object in output

The plugin uses immutable-style image operations. Transform functions never
modify the source image handle in place; they always return a new handle.

## Communication Model

There are two layers:

- caller to `image`: standard plugin call ABI
- `image` to host or other plugins: `pdk.h`

That means:

- host or JS views call `image` through the existing plugin manager
- C plugins call `image` through `pdk_call()` / `pdk_call_str()`
- the `image` plugin itself talks to `fs` and `host` through `pdk.h`

Example plugin-to-plugin call from C:

```c
pdk_call_result_t result = pdk_call_str("image", "info",
                                        (const uint8_t *)json, json_len);
```

## Goals

- keep the host contract small and stable
- avoid repeated decode/write cycles for multi-step image workflows
- make JSON payloads easy to parse in C with `jsmn`
- make mirroring a natural consequence of rectangle coordinates
- keep one canonical in-memory pixel format for v1

## PDK Dependencies

The `image` plugin should use the existing PDK helpers for all external calls.

Required modules available through the current runtime:

- `fs.read(path)` -> raw file bytes
- `fs.write(path + '\0' + data)` -> status
- `host.log(message)` -> status

The plugin does not read files directly. All filesystem access goes through the
host via `pdk`.

## Data Model

### Image Handles

- handles are positive integers
- handle `0` is invalid
- handles are local to the current plugin instance
- callers should release handles with `close`
- `close_all` may be used during teardown or tests

### Pixel Format

The canonical in-memory image format for `image/v1` is:

- `pixelFormat = "rgba8"`
- row-major order
- 4 bytes per pixel
- unpremultiplied alpha

All decoded images are converted into this format.

### Rectangles

Rectangles use edge coordinates, not width/height pairs:

```json
{"x0":4,"y0":8,"x1":20,"y1":24}
```

Rules:

- `width = abs(x1 - x0)`
- `height = abs(y1 - y0)`
- `x0 == x1` is invalid
- `y0 == y1` is invalid
- the rectangle is defined on pixel edges
- normal crop: `x1 > x0` and `y1 > y0`
- mirrored crop: `x1 < x0` and/or `y1 < y0`

Because the coordinates are edges, swapping `x0` and `x1` or `y0` and `y1`
mirrors the sampled pixels without changing output size.

Example:

- `{"x0":4,"x1":20}` samples source columns `4..19`
- `{"x0":20,"x1":4}` samples source columns `19..4`

## Error Model

On plugin-level failure, the output body should be:

```json
{"ok":false,"code":"bad_input","message":"x0 and x1 must differ"}
```

Recommended error codes:

- `bad_input`
- `not_found`
- `invalid_handle`
- `out_of_bounds`
- `decode_failed`
- `encode_failed`
- `io_failed`
- `unsupported_format`
- `not_implemented`
- `out_of_memory`
- `internal_error`

## Common Response Fields

Successful responses should include:

- `ok: true`
- `api: "image/v1"`

Image-returning responses should also include:

- `handle`
- `width`
- `height`
- `pixelFormat`

## Exported Functions

### `open`

Decode an image file from the host filesystem into a new in-memory image.

Request:

```json
{"path":"/assets/sprite.png"}
```

Response:

```json
{
  "ok": true,
  "api": "image/v1",
  "handle": 1,
  "width": 32,
  "height": 48,
  "pixelFormat": "rgba8",
  "sourceFormat": "png"
}
```

Notes:

- supported input formats for v1: `png`, `qoi`
- decoded output is always `rgba8`

### `create`

Create a new blank image.

Request:

```json
{"width":64,"height":64,"fill":[0,0,0,0]}
```

Response:

```json
{
  "ok": true,
  "api": "image/v1",
  "handle": 2,
  "width": 64,
  "height": 64,
  "pixelFormat": "rgba8"
}
```

Notes:

- `fill` is optional and defaults to transparent black
- `fill` is `[r, g, b, a]`

### `info`

Inspect an image by handle or by path.

Allowed requests:

```json
{"src":1}
```

```json
{"path":"/assets/sprite.qoi"}
```

Response:

```json
{
  "ok": true,
  "api": "image/v1",
  "width": 32,
  "height": 48,
  "pixelFormat": "rgba8",
  "sourceFormat": "qoi"
}
```

Notes:

- when using `src`, `sourceFormat` may be omitted if unknown
- when using `path`, the plugin may avoid full decode when possible

### `clone`

Duplicate an existing handle.

Request:

```json
{"src":1}
```

Response:

```json
{
  "ok": true,
  "api": "image/v1",
  "handle": 3,
  "width": 32,
  "height": 48,
  "pixelFormat": "rgba8"
}
```

### `transform`

Create a new image by applying Tiled-style transform bits to the whole source
image.

Request:

```json
{"src":1,"flip":6}
```

Response:

```json
{
  "ok": true,
  "api": "image/v1",
  "handle": 4,
  "width": 48,
  "height": 32,
  "pixelFormat": "rgba8",
  "flip": 6
}
```

Notes:

- `flip` uses the same 3-bit layout as Tiled and the animation editor
- bit `1` = horizontal flip
- bit `2` = vertical flip
- bit `4` = diagonal flip
- valid values are `0..7`
- when diagonal flip is set, output dimensions become `height x width`

### `crop`

Create a new image from a rectangular region of the source image.

Request:

```json
{"src":1,"x0":4,"y0":8,"x1":20,"y1":24}
```

Mirrored example:

```json
{"src":1,"x0":20,"y0":8,"x1":4,"y1":24}
```

Response:

```json
{
  "ok": true,
  "api": "image/v1",
  "handle": 4,
  "width": 16,
  "height": 16,
  "pixelFormat": "rgba8",
  "flipX": false,
  "flipY": false
}
```

Notes:

- output width/height are derived from edge distance
- `flipX` is true when `x1 < x0`
- `flipY` is true when `y1 < y0`
- out-of-bounds coordinates fail in v1; implicit clamping is not performed

### `resize`

Resize an image into a new handle.

Request:

```json
{"src":1,"width":128,"height":128,"filter":"triangle"}
```

If `filter` is omitted, v1 defaults to `triangle`.

Response:

```json
{
  "ok": true,
  "api": "image/v1",
  "handle": 5,
  "width": 128,
  "height": 128,
  "pixelFormat": "rgba8"
}
```

Recommended filters for v1:

- `nearest`
- `triangle`
- `catmullrom`

### `blit`

Composite a source image onto a destination image and return a new image.

Request:

```json
{"dst":1,"src":2,"x":10,"y":12}
```

Response:

```json
{
  "ok": true,
  "api": "image/v1",
  "handle": 6,
  "width": 128,
  "height": 128,
  "pixelFormat": "rgba8"
}
```

Notes:

- alpha compositing is source-over for v1
- `dst` remains unchanged; the result is a new image
- `x` and `y` may be negative
- source pixels outside destination bounds are clipped

### `read_pixels`

Read raw pixel bytes from a handle. This is the binary bridge for tools that
need direct access to pixel buffers.

Request:

```json
{"src":1}
```

Response:

```json
{
  "ok": true,
  "api": "image/v1",
  "width": 32,
  "height": 48,
  "pixelFormat": "rgba8",
  "byteLength": 6144,
  "encoding": "base64",
  "data": "..."
}
```

Notes:

- v1 returns pixel bytes inline as base64 in `data`

### `read_pixels_bin`

Read raw pixel bytes from a handle as direct binary output.

Request:

```json
{"src":1}
```

Response:

- raw `rgba8` bytes only
- response length is `width * height * 4`

Notes:

- intended for plugin-to-plugin communication where JSON base64 overhead is too high
- callers should obtain dimensions from `open` or `info`

### `write_pixels`

Create a new image from an existing handle with replaced pixel data.

Request:

```json
{
  "src": 1,
  "width": 32,
  "height": 48,
  "pixelFormat": "rgba8",
  "encoding": "base64",
  "data": "..."
}
```

Response:

```json
{
  "ok": true,
  "api": "image/v1",
  "handle": 7,
  "width": 32,
  "height": 48,
  "pixelFormat": "rgba8"
}
```

Notes:

- intended for tooling and testing, not the fastest path
- payload size can be large; prefer handle-based transforms when possible
- `pixelFormat` must be `rgba8`
- `encoding` must be `base64`
- decoded byte length must equal `width * height * 4`

### `encode`

Encode a handle and write it to the host filesystem.

Request:

```json
{"src":1,"path":"/tmp/out.qoi","format":"qoi"}
```

If `format` is omitted, v1 defaults to `qoi`.

Response:

```json
{
  "ok": true,
  "api": "image/v1",
  "path": "/tmp/out.qoi",
  "format": "qoi",
  "bytesWritten": 1234
}
```

Notes:

- supported output formats for v1: `png`, `qoi`

### `close`

Release one image handle.

Request:

```json
{"src":1}
```

Response:

```json
{"ok":true,"api":"image/v1","closed":1}
```

### `close_all`

Release all image handles owned by the current plugin instance.

Request:

```json
{}
```

Response:

```json
{"ok":true,"api":"image/v1","closed":12}
```

## Suggested Non-Goals For V1

- animated formats
- metadata editing
- colorspace conversion
- premultiplied-alpha variants
- direct font rendering
- atlas packing and sprite detection workflows

Those belong either in later versions or in higher-level plugins built on top of
`image`.

## Notes For The Future Header

The eventual public C header should mirror this file and document:

- exported function names
- request and response schemas
- rectangle semantics
- immutable ownership rules
- format support and error codes
- `pdk` call expectations for both callers and implementation
