# Game runner demo view

Project-owned custom view loaded from the demo filesystem mount.

`demo/gams.json` registers `view-game-runner` with:

- `url: "demo/game-runner/view-game-runner.js"` — the view module itself is loaded through `/util/require.js`, so it is read by the GAMS `fs` plugin.
- `config.glBridge` — path to `gl-bridge.js`; the view loads this glue with `require(config.glBridge)`, also through GAMS `fs`.
- `config.wasm` — game WASM path read with `runtime.call('fs', 'read', ...)` and instantiated directly on the main thread because the view owns the WebGL canvas.
- `config.assetSources` — static asset path mapping for the demo runner. No SQL table or migration is used.

Files:

- `view-game-runner.js` — custom element view and direct WASM/WebGL runner.
- `gl-bridge.js` — WebGL2 shim/bridge module used by the view.

Controls are intentionally local to the view for the demo: focus/click the canvas, then use WASD or arrow keys, plus J/K or Z/X for actions.
