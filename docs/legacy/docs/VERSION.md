# GAMS WIT Interface Version Matching

This document defines how `cmd/app` resolves WIT interface imports to providers when loading WASM components.

## Scope

This version matching applies to **WIT interface wiring** in the app runtime, especially `runtime.addPlugins(paths)` dependency resolution and topological loading.

It does not change the exact names Wasmtime requires at instantiation time. The runtime may match providers loosely, but it must still expose/alias the provider under the exact import name requested by the consuming component.

## Full Interface ID

A WIT interface is identified by its full WIT name:

```text
namespace:package/interface@major.minor.patch
```

Example:

```text
gams:runtime/runtime@1.0.0
```

Parts:

```text
namespace = gams
package   = runtime
interface = runtime
version   = 1.0.0
```

## Compatibility Identity

For compatibility, GAMS ignores the namespace and keeps package + interface + version:

```text
package/interface@major.minor.patch
```

So these two full ids are considered the same compatibility identity family:

```text
gams:runtime/runtime@1.0.0
kkgams:runtime/runtime@1.2.0
```

because both normalize to:

```text
runtime/runtime@1.x.y
```

The namespace is provenance, not compatibility identity.

## Interface Family

Duplicate-provider checks use the interface family:

```text
package/interface@major
```

Examples:

```text
runtime/runtime@1
fs/fs@1
ui/dialog@1
```

Only one provider for a given interface family may exist in the app runtime.

This is forbidden:

```text
gams:runtime/runtime@1.0.0
kkgams:runtime/runtime@1.2.0
```

because both provide:

```text
runtime/runtime@1
```

This is allowed:

```text
gams:ui/dialog@1.0.0
gams:ui/notifications@1.0.0
```

because they provide different interface families:

```text
ui/dialog@1
ui/notifications@1
```

## Version Semantics

GAMS uses Elm-like public API version semantics:

```text
major = breaking public API changes
minor = backwards-compatible public API additions
patch = internal changes only; no public API changes
```

A provider satisfies an import if:

```text
provider.package == import.package
provider.interface == import.interface
provider.major == import.major
provider.minor >= import.minor
```

Patch is ignored for wiring compatibility.

Examples:

```text
import runtime/runtime@1.0.0, provider runtime/runtime@1.0.0 -> OK
import runtime/runtime@1.0.0, provider runtime/runtime@1.2.0 -> OK
import runtime/runtime@1.2.0, provider runtime/runtime@1.1.9 -> ERROR
import runtime/runtime@1.2.9, provider runtime/runtime@1.2.0 -> OK
import runtime/runtime@1.0.0, provider runtime/runtime@2.0.0 -> ERROR
```

## Invocation Names

Frontend/runtime invocation must use a stable namespace-less, version-less target:

```text
package/interface::function
```

Example:

```text
fs/fs::read-text
```

Do **not** call full provider names from frontend/app code:

```text
gams:fs/fs::read-text      # disallowed
kkgams:fs/fs::read-text    # disallowed
```

Do **not** include versions in frontend/app invocation targets:

```text
fs/fs@1.0.0::read-text     # disallowed
```

Rationale: frontend/app call sites should not need updates when an implementation moves between namespaces or when a compatible component version changes. Namespaces and versions are provider/wiring concerns, not app-call concerns.

The runtime resolves invocation by matching `package/interface::function` against registered providers. If multiple providers match, invocation fails as ambiguous. Normal duplicate-provider-family checks should prevent ambiguity for a single major version.

Diagnostics should still prefer full provider names when possible.

## Matching vs Wiring

Matching may ignore namespace, but Wasmtime linking still needs the exact import name.

Example:

```text
consumer imports: gams:runtime/runtime@1.0.0
provider exports:  kkgams:runtime/runtime@1.2.0
```

The runtime may decide the provider is compatible, but it must wire an alias under the consumer's exact import name:

```text
gams:runtime/runtime@1.0.0
  -> forwards to
kkgams:runtime/runtime@1.2.0
```

Diagnostics should preserve full names so ambiguity and provenance remain visible.

## Unversioned Interfaces

Some existing components still use unversioned interface names, for example:

```text
docs:adder/add
```

For now, unversioned interfaces match only by normalized package/interface family without a major version:

```text
adder/add
```

New stable interfaces should prefer explicit versions.

## `runtime.addPlugins(paths)` Dependency Resolution

When loading components, the app runtime:

1. Reads all requested component imports/exports without instantiating.
2. Builds a provider table from already-loaded components, native providers, and newly requested components.
3. Rejects duplicate providers for the same `package/interface@major` family.
4. Resolves each import to a compatible provider.
5. Builds dependency edges among newly requested components.
6. Topologically sorts components so providers instantiate before consumers.
7. Registers aliases when a compatible provider's full interface id differs from the consumer's exact import id.
8. Returns component handles in caller request order, not instantiation order.
