# ai.agent TODO

This file captures the next migration steps for `ai.agent` and the provider side around a unified `ai.provider` plugin, with the goal of supporting a real Codex-backed provider.

## Current Direction

`ai.agent` should remain the session/loop/history/tool/persistence owner.

It should **not** own provider selection logic or provider-specific behavior.

Instead, browser2/bootstrap config should load exactly one first-party provider implementation under the stable plugin id:

- `ai.provider`

That provider can internally be backed by:

- mock provider during development
- OpenAI/Codex provider later
- another first-party provider in future

The important part is that `ai.agent` talks only to:

- `ai.provider`

and does not know or care which concrete provider implementation is mounted there.

## Why move to unified `ai.provider`

### 1. keep `ai.agent` simple
`ai.agent` should only manage:
- open/close handles
- transcript/history
- context
- tool execution
- persistence
- internal agent loop

It should not manage:
- provider registry logic
- provider switching policy
- provider-specific request/response mapping
- auth/login flows

### 2. provider choice belongs to bootstrap/config
The active provider should be selected by app/bootstrap configuration, not by per-session agent internals.

That means changing provider becomes:
- update app settings / bootstrap
- load a different implementation as `ai.provider`

not:
- change `ai.agent` logic
- keep multiple provider ids in session state

### 3. Codex login is provider-specific
Codex/OpenAI auth is not generic agent logic.

It belongs in a dedicated provider plugin because it needs provider-specific behavior such as:
- login flow
- token storage/refresh
- request transport
- model mapping
- tool-call/schema mapping
- provider-specific error handling

So Codex support should live in a dedicated plugin implementation that is mounted as:
- `ai.provider`

not inside `ai.agent`.

## Important architecture rule

There should be a **dedicated provider implementation** for Codex/OpenAI that is used through the unified plugin id:

- concrete implementation example: `ai_provider_codex`
- mounted runtime id: `ai.provider`

So:
- implementation can vary
- public runtime contract stays stable

`ai.agent` should depend on:
- `ai.provider`

and never on provider-specific ids like:
- `ai.provider.mock`
- `ai.provider.codex`

Those concrete names may still exist as source/build artifact names, but the runtime-facing dependency for the agent should be the single stable id:
- `ai.provider`

## Current blockers

## 1. tool target input adaptation is incomplete
Current tool definitions use JSON Schema for validated argument objects.

That is correct for agent/provider/model-facing tool calls.

However, some target plugins do **not** accept JSON object payloads. They expect a raw string input instead.

Examples:
- `fs.list` expects `"/"`, not `{"path":"/"}`
- `fs.read` expects a raw path string
- `sql.query` may expect a raw SQL string

This is why direct debug calls like:

```text
/tool:fs_list {"path":"/"}
```

currently validate correctly but fail at execution time.

### Needed fix
Add explicit target input adaptation in tool definitions, so validated tool args can be transformed into the concrete plugin call input.

Example direction:

```json
{
  "name": "fs_list",
  "description": "List files",
  "parameters": {
    "type": "object",
    "properties": {
      "path": { "type": "string" }
    },
    "required": ["path"],
    "additionalProperties": false
  },
  "target": {
    "plugin": "fs",
    "method": "list",
    "input": { "kind": "field", "name": "path" }
  }
}
```

Then `ai.agent` should:
- validate `{ path: "/" }`
- adapt target input to `"/"`
- call `fs.list("/")`

This same execution path should be shared by:
- normal model-requested tool calls
- manual `/tool:...` debug calls

## 2. browser2 JS plugin runtime is effectively sync-oriented today
A real network provider like Codex/OpenAI is async by nature.

It needs:
- `fetch()`
- async auth/login
- token refresh
- async transport handling
- possibly streaming or polling

Current browser2 JS plugin calling behavior forced `ai.agent` back to sync-style calls for JS plugin methods.

That is workable for:
- local tool execution
- mock provider

but it is the wrong shape for a real provider.

### Needed fix
The browser2 JS runtime path should support async JS plugin methods on normal `call(...)` paths.

Specifically:
- `call()` should be allowed to await Promise-returning JS plugin methods
- `callSync()` should remain only for truly sync cases

This is **not** event-bus orchestration.
It is just direct calls with correct async semantics.

That keeps the architecture deterministic:
- plugins load in dependency order
- calls happen directly
- async behavior is explicit where real IO requires it

## Target provider shape

## Unified runtime id
The active provider loaded into browser2 should be:
- `ai.provider`

## Concrete implementation for Codex
Implement Codex/OpenAI support in a dedicated provider plugin source, for example:
- `plugins/ai_provider_codex/`

but register/load it at runtime as:
- `ai.provider`

The dedicated provider should own:
- login/auth flow
- provider configuration
- model selection/mapping
- request payload formatting
- tool schema mapping
- assistant/tool-call response normalization

## Why dedicated Codex provider
Codex login/auth should not be generalized into `ai.agent` or spread across bootstrap/view code.

It should be isolated in one provider implementation because:
- it is provider-specific
- it will evolve independently
- it needs custom auth behavior
- it should still present a single stable contract to `ai.agent`

## Suggested migration plan

### Step 1: fix tool target adapters
Add target input adaptation so tool execution works for both:
- model tool calls
- `/tool:NAME {...}` debug calls

This should make commands like:

```text
/tool:fs_list {"path":"/"}
```

work correctly.

### Step 2: switch `ai.agent` to unified provider id
Change `ai.agent` to depend on:
- `ai.provider`

instead of provider-specific ids.

Remove provider-selection responsibility from agent/session config.

Session open config should focus on:
- model
- context
- tools
- persistence
- agent settings like max steps

### Step 3: keep mock implementation but mount it as `ai.provider`
During transition, the existing mock provider can remain the concrete implementation, but it should be loaded as:
- `ai.provider`

That lets the contract stabilize before the real provider lands.

### Step 4: make browser2 JS calls async-capable
Update runtime JS plugin calling so the provider can perform real async network work.

Needed outcome:
- `ai.provider.chat(...)` can be async
- `ai.agent.send(...)` can become async again if needed
- network-backed providers are first-class instead of forced through sync hacks

### Step 5: implement dedicated Codex provider plugin
Create a dedicated provider implementation for Codex/OpenAI login and chat behavior.

Expected responsibilities:
- auth/login flow
- token persistence or token handoff strategy
- request/response mapping
- tool-call normalization into the `ai.agent` expected message shape
- support for JSON Schema tool definitions

### Step 6: register Codex provider as unified `ai.provider`
When ready, bootstrap should load the Codex implementation under the stable runtime id:
- `ai.provider`

Then `ai.agent` continues to work unchanged.

## Tool/schema direction to keep

These parts are the right direction and should stay:
- plain JSON Schema tool `parameters`
- centralized validation in `ai.agent`
- one shared execution path for tool calls
- manual `/tool:...` support for debugging and context injection

The missing piece is only the target input adapter layer.

## Desired end state

### `ai.agent`
Owns:
- sessions
- persistence
- transcript/history
- context storage
- tool execution loop
- manual tool invocation

Does **not** own:
- provider switching
- provider auth/login
- provider-specific payload mapping

### `ai.provider`
Owns:
- provider auth/login
- remote API communication
- tool-call/schema translation
- provider-specific message mapping

### bootstrap / app config
Owns:
- which concrete provider implementation is mounted as `ai.provider`
- which model/tools/context/persist settings are passed to `ai.agent.open(...)`

## Short summary

To migrate cleanly toward Codex support:

1. fix tool target input adaptation
2. standardize on one runtime provider id: `ai.provider`
3. move provider selection fully to bootstrap/config
4. make JS plugin calls properly async for real network providers
5. implement Codex as a dedicated provider plugin mounted as unified `ai.provider`
