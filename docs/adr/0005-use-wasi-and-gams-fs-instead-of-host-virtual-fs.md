# Use WASI and gams:fs instead of a host-owned virtual filesystem

GAMS previously considered a byte-oriented host runtime with mandatory native filesystem router plugins and mount-driver plugins, but the current runtime direction is to keep real WASI available to components and expose normal frontend/app filesystem operations through the `gams:fs` proxy component. We will not rebuild the old host-owned virtual mount system for v1; Project Config and Project Units may later introduce storage configuration through explicit PRDs if a concrete need appears.
