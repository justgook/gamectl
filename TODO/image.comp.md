# TODO: image.comp

## Now working

- WIT component: `plugins/image.comp`
- Public resource: `resource image`
- JSON ref bridge: `{ "$resource": "gams:image/image", "id": "res_..." }`
- `runtime.releaseResource(ref)` drops JSON-boundary resource
- Direct `wasi:filesystem` for `open` / `save`
- PNG/QOI open/export/save
- Eager RGBA8 ops: create/info/clone/crop/resize/transform/blit/write-pixel/write-pixels/read-pixel/read-pixels

## TODO

### 1. Lazy image DAG

Current: every op materializes pixels.

Do: store op nodes:

```text
Open(path)
Pixels(rgba8)
Crop(src, rect)
Resize(src, w, h, filter)
Transform(src, flags)
Blit(dst, src, at)
WritePixel(src, at, color)
```

Sinks force eval:

- `read-pixel`
- `read-pixels`
- `%export`
- `save`

Optimize before eval:

- crop + read-pixel -> map coordinate, read source pixel
- transform + read-pixel -> inverse map coordinate
- write-pixel + read same point -> direct color
- blit + read-pixel -> check src bounds/alpha else dst

Open questions:

- Keep DAG in C, or move image impl to Rust later?
- Max DAG depth? Need cycle impossible by resource ownership, but depth can grow.
- When to auto-materialize/cache node result?

### 2. Path/preopen hardening

Current: direct `wasi:filesystem`, simple resolver.

Do tests:

- relative file under `.` preopen
- absolute path under `/` preopen
- nested path
- missing file
- directory path
- save into nested existing dir
- invalid empty path

Do not import `plugins/fs.comp`. It is frontend proxy only.

Open questions:

- Should `image.comp` support multiple preopens beyond `.` and `/`?
- Should absolute paths be accepted, or only project-relative paths?

### 3. Error quality

Current: `result<_, string>` with short strings.

Do:

- normalize error prefixes
- include path on file errors where safe
- distinguish decode vs unsupported format
- keep WIT error type as `string` for now

Open questions:

- Later define typed `variant image-error`?
- Need stable error codes for UI?

### 4. Resource type bridge generalization

Current: `$resource` type string derived from invocation interface.

Works for:

```text
gams:image/image::create -> gams:image/image
```

Problem: one interface may export multiple resource types later.

Do:

- inspect WIT `Type::Own/Borrow` resource identity if Wasmtime exposes enough info
- store exact resource type name per returned resource
- reject wrong type on arg lower

Open questions:

- Can Wasmtime dynamic API expose resource name, or only runtime `ResourceType`?
- Need host-side registry from WIT metadata?

### 5. JS lifecycle helpers

Current: manual:

```js
await runtime.releaseResource(ref)
```

Do:

```js
await runtime.withResource(ref, async (image) => { ... })
```

or:

```js
try { ... } finally { await runtime.releaseResource(ref) }
```

Open questions:

- Auto-release returned temp resources in view helpers?
- Need leak diagnostics in UI?

### 6. Operation tests

Add tests:

- crop normal
- crop mirrored x/y
- transform horizontal/vertical/diagonal flags
- blit alpha
- write-pixel/read-pixel
- resize nearest/triangle/catmullrom smoke
- read-pixels byte length/content

Open questions:

- Golden image fixtures or pixel-level asserts?
- Need tolerance for resize filters?

## Next best slice

Do path/preopen tests first. Small, locks file contract.

Then operation tests. Then lazy DAG design doc before impl.
