# stbte

- kind: `instance`
- status: `legacy`
- source: `cmd/browser/views/view-stb-editor.js`

## Description
Loaded via pluginManager.load() inside view-stb-editor; legacy instance plugin pattern tied to a browser view.

## Todo
- [ ] confirm whether this instance usage is still required
- [ ] identify the target replacement (`singleton` or `view`)
- [ ] define migration path away from direct `pluginManager.load(...)`
- [ ] requires clarification
