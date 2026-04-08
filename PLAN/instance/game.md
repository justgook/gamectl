# game

- kind: `instance`
- status: `legacy`
- source: `cmd/browser/views/view-game-runner.js`

## Description
Loaded via pluginManager.load() inside view-game-runner; runtime instance managed by a view.

## Todo
- [ ] confirm whether this instance usage is still required
- [ ] identify the target replacement (`singleton` or `view`)
- [ ] define migration path away from direct `pluginManager.load(...)`
- [ ] requires clarification
