import { runtime } from '../core/runtime.js'

const decoder = new TextDecoder()

function decodeOutput(result) {
  return decoder.decode(result.output)
}

function parseOutput(result) {
  return JSON.parse(decodeOutput(result))
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function messageText(message) {
  if (typeof message.content === 'string') return message.content
  assert(Array.isArray(message.content), 'Expected message.content to be an array or string')

  return message.content.flatMap((block) => {
    if (block.type === 'text') return [block.text]
    if (block.type === 'tool_call') return [`Tool call: ${block.name} ${JSON.stringify(block.arguments)}`]
    if (block.type === 'tool_result') {
      assert(Array.isArray(block.content), 'Expected tool_result.content to be an array')
      const text = block.content.map((entry) => entry.text).join('\n')
      return [`${block.isError ? 'Tool error' : 'Tool result'}: ${block.name}${text ? `\n${text}` : ''}`]
    }
    throw new Error(`Unknown message block type '${block.type}'`)
  }).join('\n')
}

function parseToolCommand(prompt) {
  if (!prompt.startsWith('/tool:')) return null
  const spaceIndex = prompt.indexOf(' ')
  assert(spaceIndex > '/tool:'.length, 'Tool command must be /tool:NAME {json}')
  const name = prompt.slice('/tool:'.length, spaceIndex)
  const jsonText = prompt.slice(spaceIndex + 1)
  assert(name.length > 0, 'Tool command name is required')
  assert(jsonText.length > 0, 'Tool command JSON arguments are required')
  const argumentsValue = JSON.parse(jsonText)
  // assert(argumentsValue && typeof argumentsValue === 'object' && !Array.isArray(argumentsValue), 'Tool command arguments must be a JSON object')
  return { name, arguments: argumentsValue }
}

export class ViewAi extends HTMLElement {
  constructor() {
    super()
    this.openConfig = null
    this.handle = null
    this.cursor = null
    this.loadingHistory = false
    this.logElement = null
    this.formElement = null
    this.inputElement = null
    this.statusElement = null
    this.sendButton = null
  }

  connectedCallback() {
    if (this.dataset.ready) return
    this.dataset.ready = '1'

    this.style.display = 'contents'

    this.innerHTML = `
      <article>
        <pre data-element="log">Booting AI agent...</pre>
      </article>
      <footer>
        <form data-element="form">
          <code-editor data-field="prompt" placeholder="Ask the agent..." rows="4"></code-editor>
          <button type="submit" class="accent">Send</button>
          <output data-element="status">Booting...</output>
        </form>
      </footer>
    `

    this.logElement = this.querySelector('[data-element="log"]')
    this.formElement = this.querySelector('[data-element="form"]')
    this.inputElement = this.querySelector('[data-field="prompt"]')
    this.sendButton = this.querySelector('button[type="submit"]')
    this.statusElement = this.querySelector('[data-element="status"]')

    assert(this.logElement instanceof HTMLElement, 'view-ai missing log element')
    assert(this.formElement instanceof HTMLFormElement, 'view-ai missing form element')
    assert(this.inputElement, 'view-ai missing prompt editor')
    assert(this.sendButton instanceof HTMLButtonElement, 'view-ai missing send button')
    assert(this.statusElement instanceof HTMLOutputElement, 'view-ai missing status element')
    assert(this.openConfig && typeof this.openConfig === 'object', 'view-ai requires openConfig')

    this.formElement.addEventListener('submit', async (event) => {
      event.preventDefault()
      await this.handleSubmit()
    })

    this.logElement.addEventListener('scroll', async () => {
      if (this.loadingHistory || this.cursor == null) return
      if (this.logElement.scrollTop <= 0) {
        await this.loadOlder()
      }
    })

    this.bootstrap()
  }

  async bootstrap() {
    this.setBusy(true)
    this.setStatus('Opening session...', 'info')

    const opened = await runtime.call('ai.agent', 'open', JSON.stringify(this.openConfig))
    assert(opened.returnCode === 0, `ai.agent open failed: ${decodeOutput(opened)}`)

    const payload = parseOutput(opened)
    assert(Number.isInteger(payload.handle), 'ai.agent open did not return a numeric handle')
    this.handle = payload.handle
    this.cursor = null

    await this.reloadLatest()
    this.setStatus('Ready', 'success')
    this.setBusy(false)
    queueMicrotask(() => this.inputElement.focus())
  }

  async handleSubmit() {
    const prompt = this.inputElement.value.trim()
    if (!prompt) return
    assert(Number.isInteger(this.handle), 'view-ai has no session handle')

    this.setBusy(true)

    try {
      const toolCommand = parseToolCommand(prompt)
      if (toolCommand) {
        this.setStatus(`Running tool ${toolCommand.name}...`, 'info')
        const result = await runtime.call('ai.agent', 'invoke_tool', JSON.stringify({
          handle: this.handle,
          name: toolCommand.name,
          arguments: toolCommand.arguments,
        }))
        assert(result.returnCode === 0, `ai.agent invoke_tool failed: ${decodeOutput(result)}`)
      } else {
        this.setStatus('Running...', 'info')
        const result = await runtime.call('ai.agent', 'send', JSON.stringify({
          handle: this.handle,
          message: prompt,
        }))
        assert(result.returnCode === 0, `ai.agent send failed: ${decodeOutput(result)}`)
      }

      this.inputElement.value = ''
      await this.reloadLatest()
      this.setStatus('Done', 'success')
    } finally {
      this.setBusy(false)
    }
  }

  async reloadLatest() {
    assert(Number.isInteger(this.handle), 'view-ai has no session handle')
    const page = await runtime.call('ai.agent', 'get_history_page', JSON.stringify({
      handle: this.handle,
      cursor: null,
      limit: 50,
    }))
    assert(page.returnCode === 0, `ai.agent get_history_page failed: ${decodeOutput(page)}`)

    const payload = parseOutput(page)
    this.cursor = payload.nextCursor
    this.renderItems(payload.items)
    this.logElement.scrollTop = this.logElement.scrollHeight
  }

  async loadOlder() {
    assert(Number.isInteger(this.handle), 'view-ai has no session handle')
    assert(this.cursor != null, 'view-ai loadOlder called without cursor')
    this.loadingHistory = true

    try {
      const previousHeight = this.logElement.scrollHeight
      const page = await runtime.call('ai.agent', 'get_history_page', JSON.stringify({
        handle: this.handle,
        cursor: this.cursor,
        limit: 50,
      }))
      assert(page.returnCode === 0, `ai.agent get_history_page failed: ${decodeOutput(page)}`)

      const payload = parseOutput(page)
      this.cursor = payload.nextCursor
      this.prependItems(payload.items)
      const nextHeight = this.logElement.scrollHeight
      this.logElement.scrollTop = nextHeight - previousHeight
    } finally {
      this.loadingHistory = false
    }
  }

  renderItems(items) {
    this.logElement.textContent = this.formatItems(items)
  }

  prependItems(items) {
    if (items.length === 0) return
    const existing = this.logElement.textContent
    const prefix = this.formatItems(items)
    this.logElement.textContent = `${prefix}\n\n${existing}`
  }

  formatItems(items) {
    if (items.length === 0) return 'AI agent ready.'
    return items.map((message) => {
      if (message.role === 'user') return `You: ${messageText(message)}`
      if (message.role === 'assistant') return `Agent: ${messageText(message)}`
      if (message.role === 'tool') return messageText(message)
      throw new Error(`Unknown message role '${message.role}'`)
    }).join('\n\n')
  }

  setBusy(busy) {
    this.sendButton.disabled = busy
  }

  setStatus(text, tone = '') {
    this.statusElement.textContent = text
    this.statusElement.className = ''
    if (tone) this.statusElement.classList.add(tone)
  }
}

if (!customElements.get('view-ai')) {
  customElements.define('view-ai', ViewAi)
}
