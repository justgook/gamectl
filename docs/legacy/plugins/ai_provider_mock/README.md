# ai_provider_mock

Initial notes for a mock AI provider plugin for GAMS.

## Goal
Create a fake/test provider that plugs into `ai_agent` and returns scripted responses.

This should be used to:
- test the agent loop without paid APIs
- test tool calling flows
- test validation failures
- test retries and stop reasons
- test context assembly and session persistence

## Why this is useful early
Before implementing real providers like:
- `ai.provider.codex`
- `ai.provider.openrouter`

we want a deterministic provider for local development.

## Proposed behavior
The mock provider should accept scripted outputs such as:
- plain assistant text
- assistant text + tool call
- tool call only
- invalid tool arguments
- explicit stop/error cases

This lets us test `ai_agent` behavior independently from provider/network complexity.

## Proposed v1 API ideas
- `set_script(input)`
- `reset(input)`
- `chat(input)`

Where `chat(input)` accepts the normalized request shape produced by `ai_agent` and returns a normalized assistant response shape.

## External inspiration

### pi-mono `packages/ai` faux provider
Very good pattern for deterministic test providers.

Reference:
- https://github.com/badlogic/pi-mono/blob/efc58fed7044ff2be14903502a9b200f3c215286/packages/ai/src/providers/faux.ts#L391-L470

Useful points:
- queue scripted responses
- support repeated calls per session
- generate predictable streaming/final events
- keep model/provider details fake but structurally valid

### pi-mono `packages/agent`
Useful for deciding what the mock provider must help test.

References:
- https://github.com/badlogic/pi-mono/blob/efc58fed7044ff2be14903502a9b200f3c215286/packages/agent/README.md#L64-L109
- https://github.com/badlogic/pi-mono/blob/efc58fed7044ff2be14903502a9b200f3c215286/packages/agent/README.md#L142-L190

Useful points:
- tool loop event order
- before/after tool hooks
- parallel vs sequential execution cases
- retry/continue behavior

## Intended relationship to `ai_agent`
`ai_provider_mock` should not own:
- tool registry
- context registry
- session orchestration

Those belong in `ai_agent`.

`ai_provider_mock` should only:
- accept normalized request data
- emit normalized model response data

## Open questions
- whether mock provider should support streaming in v1 or only single final response
- whether scripted responses should be stored in-memory only
- whether mock provider should be session-aware or just call-order aware
