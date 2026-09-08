# Station demo startup regression results

Command: `direnv exec . node examples/station-demo/tests/startup.e2e.mjs`

- Before config fix: **FAIL**. The real runtime loaded all three plugins listed in `gams.json`, then reported `no exported function found for \`layout/layout::init-screen\``.
- Fix probe: **PASS**. The same CLI/runtime invocation and payload succeeded when `plugins/layout.comp.wasm` was added to the loaded set; the returned document was `1280x720` with root content id `46`.
- After config fix: **PASS**. The regression derives every `--plug` argument from the real config and does not inject layout itself. This verifies the reported runtime routing failure; full interactive desktop startup remains a separate manual check.
