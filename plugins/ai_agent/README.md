# ai_agent

Initial notes for a GAMS `ai.agent` plugin.

## Goal
Create a JS service plugin that owns:
- agent sessions
- context assembly
- tool registration
- provider selection
- tool execution loop

This should stay provider-agnostic. Provider-specific API details should live behind `ai_provider_*` plugins.

## Current direction

### Responsibilities
`ai_agent` should own:
- normalized conversation state
- registered tools
- registered context entries
- session config
- execution loop
- tool-call validation before dispatch

`ai_agent` should **not** own:
- OpenAI/OpenRouter/Codex-specific payload quirks
- auth specifics for each provider
- host-specific UI behavior

## GAMS-specific shape
Tools should be real GAMS tools, not fake UI helpers.

Examples:
- `sql.query`
- `fs.read`
- `fs.list`
- `fs.write`
- future plugin methods like `ng.*`, `image.*`, `layout.*`

Context should include:
- bootstrap/project guidance (`AGENTS.md`-style)
- current runtime/view state
- current selection / active document / active asset

Important: runtime/editor state should usually be passed as **context**, not exploded into many tiny helper tools.

## Proposed v1 API ideas
- `create_session(input)`
- `set_provider(input)`
- `register_tool(input)`
- `set_tools(input)`
- `set_context(input)`
- `add_context(input)`
- `send(input)`
- `run_step(input)`

## External inspiration

### Amp article
Thorsten Ball, "How to Build an Agent"
- core idea: LLM + tools + loop + enough tokens
- useful for the minimal agent execution model

Reference:
- https://ampcode.com/notes/how-to-build-an-agent

### pi-mono `packages/agent`
Most directly useful for `ai_agent` shape.

Useful ideas to borrow:
- stateful agent core
- evented execution loop
- `transformContext` step before LLM calls
- `beforeToolCall` / `afterToolCall` hooks
- configurable parallel vs sequential tool execution

References:
- https://github.com/badlogic/pi-mono/blob/efc58fed7044ff2be14903502a9b200f3c215286/packages/agent/README.md#L38-L56
- https://github.com/badlogic/pi-mono/blob/efc58fed7044ff2be14903502a9b200f3c215286/packages/agent/README.md#L64-L109
- https://github.com/badlogic/pi-mono/blob/efc58fed7044ff2be14903502a9b200f3c215286/packages/agent/README.md#L142-L190

### pi-mono `packages/ai`
Useful ideas to borrow:
- normalized `Context`, `Tool`, and `ToolResult` shapes
- provider-specific translation hidden behind adapters
- schema validation before tool execution
- serializable context/session state
- cross-provider handoff patterns
- mock/faux provider for deterministic tests

References:
- https://github.com/badlogic/pi-mono/blob/efc58fed7044ff2be14903502a9b200f3c215286/packages/ai/src/types.ts#L159-L227
- https://github.com/badlogic/pi-mono/blob/efc58fed7044ff2be14903502a9b200f3c215286/packages/ai/src/utils/validation.ts#L42-L93
- https://github.com/badlogic/pi-mono/blob/efc58fed7044ff2be14903502a9b200f3c215286/packages/ai/src/providers/transform-messages.ts#L1-L172
- https://github.com/badlogic/pi-mono/blob/efc58fed7044ff2be14903502a9b200f3c215286/packages/ai/README.md#L898-L981
- https://github.com/badlogic/pi-mono/blob/efc58fed7044ff2be14903502a9b200f3c215286/packages/ai/src/providers/faux.ts#L391-L470

### pi-mono `packages/mom`
Very useful for context/memory design.

Useful ideas to borrow:
- separate full history from active LLM context
- bootstrap memory files + session-specific memory
- compaction when context grows too large
- searchable history beyond the prompt window

References:
- https://github.com/badlogic/pi-mono/blob/efc58fed7044ff2be14903502a9b200f3c215286/packages/mom/README.md#L119-L206

### pi-mono `packages/coding-agent`
Useful idea to borrow:
- dynamic provider registration / unregistration pattern

References:
- https://github.com/badlogic/pi-mono/blob/efc58fed7044ff2be14903502a9b200f3c215286/packages/coding-agent/docs/custom-provider.md#L1-L168
- https://github.com/badlogic/pi-mono/blob/efc58fed7044ff2be14903502a9b200f3c215286/packages/coding-agent/src/core/model-registry.ts#L682-L780

### pi-mono `packages/web-ui`
Less relevant for v1 core logic, but useful later for a `view-agent` browser UI.

Useful ideas to borrow later:
- UI bound to agent state/events instead of provider APIs directly
- storage separated from UI
- tool injection at UI composition boundary

Reference:
- https://github.com/badlogic/pi-mono/blob/efc58fed7044ff2be14903502a9b200f3c215286/packages/web-ui/README.md#L67-L95

## Current design takeaway
Best sources of inspiration:
- `packages/agent` -> shape of `ai_agent`
- `packages/ai` -> shape of `ai_provider.*`
- `packages/mom` -> shape of context/memory handling

## Open questions
- exact plugin runtime for `ai_agent` in browser2: worker JS plugin vs main-thread JS plugin
- how context should be collected from current GAMS runtime state
- how tool registration metadata should be shaped in GAMS
- whether tool execution should always go through plugin calls or allow local adapters too
- how session persistence should be stored in GAMS
- whether v1 needs event streaming or only step-based execution
