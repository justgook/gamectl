# Core Runtime

Core Runtime covers the GAMS Runtime, hosts, Plugin Manager, plugin registration/loading, call routing, and WIT interface compatibility.

## Language

**Host**:
A runtime shell such as the browser UI or CLI that loads a project-defined GAMS composition and provides environment-specific integration.
_Avoid_: app, frontend, backend when the runtime shell boundary is what matters.

**GAMS Runtime**:
The small orchestration layer responsible for plugin management and host integration, not for owning project-specific behavior.
_Avoid_: application when referring to the reusable runtime.

**Plugin**:
A callable unit of behavior that exposes functions and can be loaded by a host or called by another plugin.
_Avoid_: module, extension, package when specifically referring to GAMS runtime units.

**Plugin Manager**:
The umbrella runtime service responsible for plugin registration/loading and plugin-to-plugin call routing.
_Avoid_: loader, registry, or router when referring to the full responsibility set.

**Plugin Registration/Loading**:
The Plugin Manager responsibility that discovers, validates, orders, and instantiates plugins for a host.
_Avoid_: call routing.

**Call Routing**:
The Plugin Manager responsibility that dispatches calls from hosts or plugins to registered plugin exports.
_Avoid_: loading.

**Singleton Plugin**:
A plugin with one logical runtime per host environment and the preferred model for new work.
_Avoid_: global plugin.

**Instance Plugin**:
A plugin runtime created by another plugin or view; a legacy migration pattern.
_Avoid_: child plugin unless describing ownership only.

**View Plugin**:
A browser-rendered plugin registered and routed through the plugin manager.
_Avoid_: special-case view, host callback view.

**WIT Interface Family**:
The package/interface/major-version identity used by the Plugin Manager to detect duplicate providers and resolve compatible imports.
_Avoid_: full interface name when namespace or patch provenance matters.

**Serve Host Mode**:
A future CLI/app Host mode that adapts native HTTP requests to a Project Unit exporting a WASI HTTP handler interface.
_Avoid_: dev-only server when describing the long-term capability.

**HTTP Handler Project Unit**:
A Project Unit WASM component that exports a WASI HTTP handler interface and can be run by Serve Host Mode.
_Avoid_: standalone server plugin.

## Relationships

- A **Host** uses the **GAMS Runtime** to run a Project.
- A **Host** uses **Plugin Registration/Loading** through the **Plugin Manager**.
- A **Plugin** may use **Call Routing** through the **Plugin Manager** to call another **Plugin**.
- A **View Plugin** is a **Plugin** that renders browser UI.
- A **Singleton Plugin** is the preferred target model for new **Plugins**.
- An **Instance Plugin** is legacy/migration-only unless explicitly clarified.
- A **WIT Interface Family** ignores namespace and patch version for compatibility, while full WIT names remain visible for diagnostics and Wasmtime wiring.
- **Serve Host Mode** requires exactly one active **HTTP Handler Project Unit** unless future Project Config adds explicit disambiguation.

## Example dialogue

> **Dev:** "Should this browser view call back into the host directly?"
> **Domain expert:** "No. If it is first-party GAMS behavior, model it as a **View Plugin** and route plugin-to-plugin calls through the **Plugin Manager** unless a plan explicitly says otherwise."

## Flagged ambiguities

- **Plugin Manager** is the umbrella term. Use **Plugin Registration/Loading** and **Call Routing** for its two responsibilities.
