import { runtime } from "/core/runtime.js"
import { registerViewPlugin, unregisterViewPlugin } from "/util/view-plugin.js"
import "/widgets/code-editor.js"

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function assertPlainObject(value, message) {
  assert(value && typeof value === "object" && !Array.isArray(value), message)
}

function shellSplit(input) {
  const tokens = []
  let token = ""
  let quote = ""
  let escaping = false
  let tokenStarted = false

  for (const char of input) {
    if (escaping) {
      token += char
      escaping = false
      tokenStarted = true
      continue
    }

    if (char === "\\") {
      escaping = true
      tokenStarted = true
      continue
    }

    if (quote) {
      if (char === quote) {
        quote = ""
      } else {
        token += char
      }
      tokenStarted = true
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      tokenStarted = true
      continue
    }

    if (/\s/.test(char)) {
      if (tokenStarted) {
        tokens.push(token)
        token = ""
        tokenStarted = false
      }
      continue
    }

    token += char
    tokenStarted = true
  }

  if (escaping) throw new Error("Command ends with an unfinished escape")
  if (quote) throw new Error(`Command has an unterminated ${quote} quote`)
  if (tokenStarted) tokens.push(token)
  return tokens
}

function parseToolCommand(input) {
  if (!input.startsWith("/tool:")) return null

  const body = input.slice("/tool:".length)
  assert(body.length > 0, "Tool command name is required")

  const firstWhitespace = body.search(/\s/)
  const name = firstWhitespace === -1 ? body : body.slice(0, firstWhitespace)
  const argsText =
    firstWhitespace === -1 ? "" : body.slice(firstWhitespace + 1).trim()

  assert(name.length > 0, "Tool command name is required")
  assert(!/\s/.test(name), "Tool command name must not contain whitespace")

  return { name, argv: argsText ? shellSplit(argsText) : [] }
}

function maxExplicitPosition(argsTemplate) {
  let max = 0
  for (const entry of argsTemplate) {
    const match = entry.match(/^\$(\d+)$/)
    if (match) max = Math.max(max, Number(match[1]))
  }
  return max
}

function buildRuntimeArgs(argsTemplate, argv) {
  const restStart = maxExplicitPosition(argsTemplate)
  return argsTemplate.map((entry) => {
    const positional = entry.match(/^\$(\d+)$/)
    if (positional) {
      const index = Number(positional[1]) - 1
      if (index < 0)
        throw new Error(`Invalid positional argument placeholder '${entry}'`)
      if (index >= argv.length)
        throw new Error(`Missing command argument ${entry}`)
      return argv[index]
    }

    if (entry === "$*") return argv.slice(restStart).join(" ")
    return entry
  })
}

function unwrapResultForDisplay(value) {
  if (value && typeof value === "object" && Object.hasOwn(value, "ok"))
    return value.ok
  if (value && typeof value === "object" && Object.hasOwn(value, "err"))
    throw new Error(String(value.err))
  return value
}

function formatValue(value) {
  if (value === undefined) return "undefined"
  if (value === null) return "null"
  if (typeof value === "string") return value
  if (value instanceof Uint8Array) return `[${value.length} bytes]`
  if (Array.isArray(value) || typeof value === "object")
    return JSON.stringify(value, null, 2)
  return String(value)
}

function validateConfig(config) {
  assertPlainObject(config, "view-chat requires config object")
  assertPlainObject(config.tools, "view-chat config.tools must be an object")

  for (const [name, tool] of Object.entries(config.tools)) {
    assert(name.length > 0, "view-chat tool name must be non-empty")
    assertPlainObject(tool, `view-chat config.tools.${name} must be an object`)
    assert(
      typeof tool.description === "string",
      `view-chat config.tools.${name}.description must be a string`,
    )
    assert(
      tool.runtime === "invoke" || tool.runtime === "call",
      `view-chat config.tools.${name}.runtime must be "invoke" or "call"`,
    )
    assert(
      typeof tool.target === "string" && tool.target.length > 0,
      `view-chat config.tools.${name}.target must be a non-empty string`,
    )
    assert(
      Array.isArray(tool.args),
      `view-chat config.tools.${name}.args must be an array`,
    )
    for (const arg of tool.args)
      assert(
        typeof arg === "string",
        `view-chat config.tools.${name}.args entries must be strings`,
      )
  }
}

export class ViewChat extends HTMLElement {
  constructor() {
    super()
    this.messages = []
    this.transcriptElement = null
    this.formElement = null
    this.inputElement = null
    this.sendButton = null
    this.statusElement = null
    this.config = null
    this.tools = null
  }

  connectedCallback() {
    registerViewPlugin(this)
    if (this.dataset.ready) return
    this.dataset.ready = "1"

    validateConfig(this.config)
    this.tools = this.config.tools

    this.style.display = "contents"
    this.innerHTML = `
      <article>
        <pre data-element="transcript"></pre>
      </article>
      <footer>
        <form data-element="composer">
          <code-editor data-field="message" placeholder="Type a message or /tool:NAME arg1 arg2" rows="3"></code-editor>
          <button type="submit" class="accent">Send</button>
          <output data-element="status"></output>
        </form>
      </footer>
    `

    this.transcriptElement = this.querySelector('[data-element="transcript"]')
    this.formElement = this.querySelector('[data-element="composer"]')
    this.inputElement = this.querySelector('[data-field="message"]')
    this.sendButton = this.querySelector('button[type="submit"]')
    this.statusElement = this.querySelector('[data-element="status"]')

    assert(
      this.transcriptElement instanceof HTMLPreElement,
      "view-chat missing transcript element",
    )
    assert(
      this.formElement instanceof HTMLFormElement,
      "view-chat missing composer form",
    )
    assert(
      this.inputElement instanceof HTMLElement,
      "view-chat missing message input",
    )
    assert(
      this.sendButton instanceof HTMLButtonElement,
      "view-chat missing send button",
    )
    assert(
      this.statusElement instanceof HTMLOutputElement,
      "view-chat missing status element",
    )

    this.formElement.addEventListener("submit", async (event) => {
      event.preventDefault()
      await this.handleSubmit()
    })

    this.inputElement.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault()
        this.formElement.requestSubmit()
      }
    })

    this.appendMessage("system", this.readyText())
    this.setStatus("Ready", "success")
    queueMicrotask(() => this.inputElement.focus())
  }

  readyText() {
    const names = Object.keys(this.tools)
    if (names.length === 0) return "Chat ready. No tools configured."
    return `Chat ready. Tools: ${names.join(", ")}`
  }

  async handleSubmit() {
    const text = this.inputElement.value.trim()
    if (!text) return

    this.inputElement.value = ""
    this.appendMessage("user", text)

    let command = null
    try {
      command = parseToolCommand(text)
      if (!command) {
        this.setStatus("Message added", "success")
        return
      }

      this.setBusy(true)
      await this.invokeTool(command)
      this.setStatus("Tool finished", "success")
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.appendMessage("error", message)
      this.setStatus(`Error: ${message}`, "danger")
    } finally {
      if (command) this.setBusy(false)
    }
  }

  async invokeTool(command) {
    const tool = this.tools[command.name]
    if (!tool) {
      const names = Object.keys(this.tools)
      const suffix =
        names.length === 0
          ? "No tools are configured."
          : `Available tools: ${names.join(", ")}`
      throw new Error(`Unknown tool '${command.name}'. ${suffix}`)
    }

    const args = buildRuntimeArgs(tool.args, command.argv)
    this.appendMessage(
      "tool-call",
      `${command.name} -> ${tool.runtime}:${tool.target}(${args.map(formatValue).join(", ")})`,
    )

    const raw =
      tool.runtime === "invoke"
        ? await runtime.invoke(tool.target, ...args)
        : await runtime.call(tool.target, ...args)

    const result = unwrapResultForDisplay(raw)
    this.appendMessage("tool-result", formatValue(result))
  }

  appendMessage(kind, text) {
    const prefixes = {
      system: "System",
      user: "You",
      "tool-call": "Tool call",
      "tool-result": "Tool result",
      error: "Tool error",
    }

    const prefix = prefixes[kind]
    assert(
      typeof prefix === "string",
      `Unknown view-chat message kind '${kind}'`,
    )
    this.messages.push({ kind, text })
    this.renderTranscript()
  }

  renderTranscript() {
    this.transcriptElement.textContent = this.messages
      .map((message) => {
        const prefixes = {
          system: "System",
          user: "You",
          "tool-call": "Tool call",
          "tool-result": "Tool result",
          error: "Tool error",
        }
        return `${prefixes[message.kind]}: ${message.text}`
      })
      .join("\n\n")
    this.transcriptElement.scrollTop = this.transcriptElement.scrollHeight
  }

  setBusy(busy) {
    this.sendButton.disabled = busy
  }

  setStatus(text, tone = "") {
    this.statusElement.textContent = text
    this.statusElement.className = ""
    if (tone) this.statusElement.classList.add(tone)
  }

  disconnectedCallback() {
    void unregisterViewPlugin(this)
  }
}

if (!customElements.get("view-chat")) {
  customElements.define("view-chat", ViewChat)
}
