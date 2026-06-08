# gbml-import

`gbml-import` converts BulletML 0.21 XML into GAMS BulletML JSON (`gbml.json`).

GBML JSON is the GAMS-side format consumed by `view-bullet.js`, future respack packing, and the game runner. BulletML XML is an import/export format and should not be parsed by game/runtime code.

## Files

- `SPEC-BulletML-0.21.md` — local Markdown copy of the upstream BulletML reference.
- `GBML-MAPPING.md` — mapping notes from BulletML XML to GBML JSON.
- `bulletml.dtd` — local copy of the BulletML 0.21 DTD.
- `fixtures/*.xml` — small valid BulletML fixtures.
- `main.go` — first importer implementation.

## Validate XML fixtures against the DTD

```sh
for f in tools/gbml-import/fixtures/*.xml; do
  xmllint --noout --dtdvalid tools/gbml-import/bulletml.dtd "$f"
done
```

## Convert fixtures to demo GBML

```sh
cd tools/gbml-import
go run . -o ../../examples/demo/bulletML fixtures/*.xml
```

## Run importer tests

```sh
cd tools/gbml-import
go test ./...
```

The tests validate XML fixtures against `bulletml.dtd` when `xmllint` is available and compare generated GBML JSON against `examples/demo/bulletML/` golden outputs.

## Current importer scope

The first importer parses the full BulletML 0.21 element vocabulary from the DTD into a normalized GBML JSON document:

- top-level `bullet`, `action`, and `fire` definitions;
- `repeat`, `fire`, `fireRef`, `changeSpeed`, `changeDirection`, `accel`, `wait`, `vanish`, nested `action`, and `actionRef` operations;
- `bulletRef`, `actionRef`, and `fireRef` parameters;
- `direction`, `speed`, `horizontal`, `vertical`, `term`, `times`, and expression text.

It does not yet compile expressions to expression bytecode or resolve refs into numeric ids. Those are later compiler/semantic-validation steps.

## GBML schema

Generated GBML files are structurally described by:

```text
packages/schemas/gbml.schema.json
```

Schema validation owns shape/type/version checks. Importer/view/runner code may still perform semantic validation for labels, refs, bytecode correctness, expression parsing, and execution invariants.
