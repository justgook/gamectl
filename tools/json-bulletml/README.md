# bulletml-json

`bulletml-json` converts BulletML 0.21 XML into normalized JSON BulletML.

The output format is documented in:

- `json-bulletml-reference.md`
- `json-bulletml.schema.json`

## Format role

BulletML XML is treated as the import/interchange format. JSON BulletML is a cleaned, label-free JSON representation with:

- top-level `bullets`, `actions`, and `fires` arrays;
- zero-based references;
- inline bullets, actions, and fires hoisted into those arrays;
- numeric values emitted inline as JSON numbers when possible, or expression strings otherwise.

## Entrypoint convention

The runtime starts at `actions[0]`.

If the source XML has one top-level `<action>`, that action becomes `actions[0]`.

If the source XML has multiple top-level `<action>` elements, the compiler creates a synthetic wrapper action at `actions[0]` that calls each top-level action in source order.

If the source XML has zero top-level actions, compilation fails.

## Usage

Single input:

```sh
go run . -o out.bulletml.json input.xml
```

Multiple inputs:

```sh
go run . -o out-dir examples/*.xml
```

Multiple-input output names use:

```text
foo.xml -> foo.bulletml.json
```

## Tests

```sh
go test ./...
```

The tests include small golden fixtures and compile the copied BulletML example corpus under `examples/*.xml` and `examples/mini/*.xml`.
