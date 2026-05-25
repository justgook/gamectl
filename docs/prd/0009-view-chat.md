# View Chat Core View

## Status

Draft

## Source material

- User planning request on 2026-05-25 for `view-chat` as a simple chat API/tool runner.
- `docs/reference/gams-view-development-guide.md`
- `docs/prd/0002-runtime-plugin-manager.md`
- `docs/prd/0003-project-config.md`
- `docs/prd/0005-frontend-view-and-ui-service-bridge.md`
- Deleted prototype `views/view-ai.js` and its former demo config in `examples/demo/gams.json`.

## Problem

GAMS needs a small, non-agent chat surface for manually invoking configured project tools from the browser. Users type messages, and command messages such as `/tool:NAME arg1 arg2 argN` dispatch directly to configured runtime calls.

This gives the Project a lightweight operator console for plugin calls without committing to a full AI agent, tool schema negotiation, or provider-specific chat protocol.

## Goals

- Provide a first-party `view-chat` Core View.
- Support plain user messages in a transcript.
- Support `/tool:NAME arg1 arg2 argN` command messages.
- Declare available tools through `view-chat.config` in `gams.json`.
- Let each configured tool choose its runtime call shape.
- Render tool requests, successes, and failures in the transcript.
- Keep the Host thin by routing work through the existing GAMS Runtime APIs.
- Keep the view useful before the long-term typed/wRPC call model is settled.

## Non-goals

- No AI provider integration in v1.
- No autonomous tool selection in v1.
- No multi-user networking in v1.
- No durable chat history in v1.
- No companion backend in v1; backend-driven answering, tool use, transcript loading, and transcript saving are a later slice.
- No JSON Schema-driven form generation for tool arguments in v1.
- No new runtime API is introduced by this view in v1.

## Project Config

The initial `view-chat` config lives under the view's unit-owned `config` object. The current prototype host still reads legacy `ui.views`, but this config shape is intentionally compatible with Project Config v1 where view-specific behavior belongs under `views.<id>.config`.

```json
{
  "views": {
    "view-chat": {
      "url": "views/view-chat.js",
      "label": "Chat",
      "group": "Tools",
      "internal": false,
      "config": {
        "tools": {
          "read_text": {
            "description": "Read a UTF-8 text file.",
            "runtime": "invoke",
            "target": "fs/fs::read-text",
            "args": ["$1"]
          },
          "sql_exec": {
            "description": "Execute a SQL statement.",
            "runtime": "invoke",
            "target": "sql/readwrite::exec",
            "args": ["$*"]
          }
        }
      }
    }
  }
}
```

For the current demo app this may need to be mirrored under `ui.views.view-chat` until the host finishes migrating to top-level `views`.

## Tool command syntax

```text
/tool:NAME arg1 arg2 argN
```

- `NAME` must match a key in `config.tools`.
- Arguments are parsed as shell-like string tokens so quoted strings can contain spaces.
- JSON literals are not parsed specially in v1; structured arguments should wait for a later tool-argument design.
- `$1`, `$2`, `$N` in tool config map to positional command arguments.
- `$*` maps to the remaining arguments joined by spaces.
- Missing required positional arguments are errors and render as failed tool calls.
- A non-command message is appended to the in-memory transcript but does not call the runtime.

## Tool config shape

Each tool entry has:

- `description`: human-readable help text.
- `runtime`: the runtime dispatch mode.
- `target`: the runtime target string.
- `args`: an array describing how command arguments become runtime arguments.

Supported `runtime` values for v1:

- `invoke`: dispatches as `runtime.invoke(target, ...args)` for WASM/plugin exports routed through the backend runtime.
- `call`: dispatches as `runtime.call(target, ...args)` for main-thread UI Services and View Plugins registered with the browser runtime.

## View UI

`view-chat` should follow the GAMS View Development Guide:

- custom element root uses `display: contents`.
- exactly one main `article` containing a `pre[data-element="transcript"]` for the chat transcript.
- one `footer` containing a `form[data-element="composer"]`.
- the composer uses a text-like input or `textarea`/`code-editor` for command entry and a submit `button`.
- `output[data-element="status"]` reports ready/running/error state.

## Requirements

- `views/view-chat.js` registers a `view-chat` custom element.
- The view requires a config object with a `tools` object; missing or malformed config fails loudly.
- Transcript state is in-memory only for v1 and resets when the view instance is destroyed or reloaded.
- `/tool:` parsing is strict; malformed commands fail loudly into the transcript/status rather than silently doing nothing.
- Unknown tool names render a failed tool result and list available tool names.
- Tool invocation appends three transcript events: user command, tool call, tool result/error.
- Tool results render as readable text; object/array values render as pretty JSON.
- WIT `result`-shaped returns with `ok`/`err` are unwrapped for display, with `err` treated as a failed tool result.
- Runtime exceptions are shown as failed tool results.
- The view should not catch and hide internal invariant errors such as missing DOM elements or invalid required config.
- Demo config includes at least one filesystem-backed tool.

## Acceptance criteria

- A user can open `view-chat` from the demo UI.
- A configured command such as `/tool:read_text README.md` calls `runtime.invoke("fs/fs::read-text", "README.md")`.
- The transcript shows the entered command and the tool result.
- Unknown or malformed commands show clear errors.
- No AI-provider/session behavior is required for `view-chat`.

## Future direction

A later **companion backend** may interact with `view-chat` from the other side: answer messages, call configured tools, push messages into the transcript, and load/save transcript history. That backend-driven workflow is out of scope for v1.

## Idea cleanup

This PRD absorbs the current loose idea for a simple chat/tool API view. Future AI-agent behavior needs a separate PRD; `view-chat` is the manual tool-console slice.

## Open questions

- None for the current v1 slice.
