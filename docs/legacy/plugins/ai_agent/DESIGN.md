# ai_agent design

## Purpose
`ai_agent` is the GAMS service plugin that turns LLM tool-calling into GAMS plugin-calling.

It should own:
- sessions
- handles
- normalized messages
- tool bootstrap/registry
- context bootstrap/registry
- provider selection
- persistence
- internal agent loop
- paged history access

It should not own:
- provider-specific HTTP/API quirks
- browser UI
- ad-hoc host callbacks for individual tools

## Placement
Target shape:
- browser JS service plugin
- callable through runtime/plugin manager like other services

Related UI:
- `cmd/browser/view/view-ai.js` is only one interface
- `view-ai` should open a handle and then read/send via `ai_agent`
- other views or actions should also be able to talk to `ai_agent`

## Handle model
Sessions are opened like other GAMS resources.

### Open
```json
{
  "profile": "browser-default",
  "persist": {
    "driver": "fs",
    "format": "jsonl",
    "path": "/ai/sessions/default.jsonl"
  }
}
```

returns:
```json
{ "handle": 1 }
```

### Then all further calls use `handle`
- `send({ handle, message })`
- `get_history_page({ handle, cursor, limit })`
- `get_summary({ handle })`
- `close({ handle })`

This allows one UI to keep one handle now, while the service supports multiple sessions from the start.

If `persist` is set and the file already exists, `open()` should load the session from that file and return a new live handle bound to that loaded session.

## Core idea
The internal loop is:
1. caller sends message to `ai_agent`
2. `ai_agent` appends user message to the session
3. `ai_agent` assembles context and tool definitions
4. `ai_agent` calls current `ai_provider.*`
5. provider returns normalized assistant output
6. if tool calls exist, `ai_agent` validates and executes them through GAMS plugin calls
7. tool results are appended to session
8. loop continues internally until no tool calls remain or policy/budget stops execution
9. updated session is persisted

Important: the tool loop is internal to `ai_agent`. UI should not drive step-by-step execution.

## Main split

### `ai_agent`
Owns:
- `Session`
- `handle -> session` mapping
- default tools
- default context
- policies
- persistence hooks
- loop state

### `ai_provider.*`
Owns:
- provider request formatting
- provider response parsing
- provider auth/config quirks
- provider-specific tool schema conversion

Examples:
- `ai_provider_mock`
- future `ai_provider_codex`
- future `ai_provider_openrouter`

## GAMS-specific principles

### Tools are real GAMS tools
The agent should call real GAMS/plugin functions, for example:
- `fs.read`
- `fs.list`
- `fs.write`
- `sql.query`
- later `ng.*`, `image.*`, `layout.*`

### Context carries runtime/editor state
Context should describe current work, for example:
- active view
- selected area/node/asset
- active document
- current project/workspace
- bootstrap instructions from project files

This lets the agent call a real tool like `regenerate_area("lava_cave")` while the underlying GAMS tool/runtime already knows the active target scope.

### Keep host thin
The browser host should not grow special AI-specific logic.
The agent should stay behind plugin contracts.

## Normalized internal data model

### Session
```json
{
  "handle": 1,
  "provider": "ai.provider.mock",
  "model": "mock-default",
  "messages": [],
  "tools": [],
  "context": [],
  "status": "idle"
}
```

Suggested fields:
- `handle`
- `provider`
- `model`
- `messages`
- `tools`
- `context`
- `status`
- `maxSteps`
- `stepCount`
- `lastError`
- `createdAt`
- `updatedAt`

### Message
Internal normalized shape should be provider-neutral.

User:
```json
{ "role": "user", "content": "hello" }
```

Assistant:
```json
{
  "role": "assistant",
  "content": [
    { "type": "text", "text": "hi" }
  ]
}
```

Tool result:
```json
{
  "role": "tool",
  "content": [
    {
      "type": "tool_result",
      "toolCallId": "call-1",
      "name": "sql_query",
      "isError": false,
      "content": [{ "type": "text", "text": "[]" }]
    }
  ]
}
```

### Tool registration
```json
{
  "name": "sql_query",
  "description": "Execute a SQL query against the current database.",
  "inputSchema": {},
  "target": {
    "plugin": "sql",
    "method": "query"
  }
}
```

### Context entry
```json
{
  "kind": "runtime",
  "source": "view-ai",
  "label": "Current selection",
  "content": {
    "activeView": "view-tilemap",
    "selectedArea": "lava_cave"
  }
}
```

## Context layering
Context passed to the provider should be assembled from layers:

1. system/bootstrap
2. project/runtime context
3. session transcript
4. current user message

This should be assembled by `ai_agent`, not by the view.

## Public API direction

### Lifecycle
- `open(input) -> { handle }`
- `close(input)`
- `list_open()`

### Query session state
- `get_summary(input)`
- `get_history_page(input)`

### Interaction
- `send(input)`

### Optional configuration
- `set_provider(input)`
- `set_context(input)`
- `add_context(input)`

Note: low-level `run_step`/`run` are internal concepts, not preferred UI-facing APIs.

## Suggested request shapes

### `open`
```json
{
  "profile": "browser-default"
}
```

### `send`
```json
{
  "handle": 1,
  "message": "what tables do I have?"
}
```

### `get_summary`
```json
{
  "handle": 1
}
```

### `get_history_page`
```json
{
  "handle": 1,
  "cursor": null,
  "limit": 50
}
```

returns:
```json
{
  "items": [],
  "nextCursor": 120,
  "hasMore": true
}
```

## Execution policy
V1 should stay simple.

Suggested defaults:
- read-only tools: auto-run
- max step count per send
- stop when provider returns no tool calls

## Validation
Before dispatching a tool:
1. find tool by registered name
2. validate arguments against `inputSchema`
3. if invalid, create error tool result and continue loop
4. if valid, call target plugin/method through runtime

## Runtime call model
`ai_agent` should execute tools by plugin call target, not by custom host code.

Dispatch shape:
- lookup tool by name
- call `runtime.call(target.plugin, target.method, serializedInput)`
- normalize result into `tool_result`

## Persistence
Desired shape:
- history is owned by `ai_agent`
- paging comes from `ai_agent`
- storage backend is configured at `open()` time
- the view does not own persistence

V1 persistence config:

```json
{
  "persist": {
    "driver": "fs",
    "format": "jsonl",
    "path": "/ai/sessions/default.jsonl"
  }
}
```

Rules:
- only `driver: "fs"` is supported in v1
- only `format: "jsonl"` is supported in v1
- if path exists, load session from file
- if path does not exist, create a new persisted session
- if `persist` is omitted, session stays memory-only

Implementation note:
- v1 may rewrite the whole JSONL file on each update
- file access should still go through the real GAMS `fs` plugin

## View integration
`view-ai` should remain thin.

It should only:
- call `open()` and store one handle
- request summary/history pages
- send user prompts
- render a partial window into history

It should not:
- register default tools
- bootstrap context
- know provider payload formats
- execute tools directly
- own canonical transcript state

## V1 implementation order
1. `ai_provider_mock`
2. handle-based `ai_agent` with in-memory sessions
3. default browser profile/tool bootstrap in `ai_agent.open()`
4. thin `view-ai` using one handle
5. persistence backend support
6. real provider plugins

## Open questions
- worker-side JS plugin vs main-thread JS plugin for `ai_agent`
- exact persistence wrapper shape
- whether provider registration should also be dynamic at runtime
- how browser runtime context providers should feed `ai_agent`
