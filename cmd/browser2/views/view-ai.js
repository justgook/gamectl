import { runtime } from '../core/runtime.js'

const decoder = new TextDecoder()

function decodeOutput(result) {
  return decoder.decode(result?.output || new Uint8Array())
}

function parseOutput(result, fallback = null) {
  const text = decodeOutput(result)
  if (!text) return fallback
  try {
    return JSON.parse(text)
  } catch {
    return fallback
  }
}

function messageText(message) {
  if (!message) return ''
  if (typeof message.content === 'string') return message.content
  if (!Array.isArray(message.content)) return ''

  return message.content.flatMap((block) => {
    if (block?.type === 'text') return [block.text || '']
    if (block?.type === 'tool_call') return [`Tool call: ${block.name} ${JSON.stringify(block.arguments || {})}`]
    if (block?.type === 'tool_result') {
      const text = Array.isArray(block.content)
        ? block.content.map((entry) => entry?.text || '').filter(Boolean).join('\n')
        : ''
      return [`${block.isError ? 'Tool error' : 'Tool result'}: ${block.name}${text ? `\n${text}` : ''}`]
    }
    return []
  }).filter(Boolean).join('\n')
}

export class ViewAi extends HTMLElement {
  constructor() {
    super()
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

    this.formElement?.addEventListener('submit', async (event) => {
      event.preventDefault()
      await this.handleSubmit()
    })

    this.logElement?.addEventListener('scroll', async () => {
      if (!this.logElement || this.loadingHistory || this.cursor == null) return
      if (this.logElement.scrollTop <= 0) {
        await this.loadOlder()
      }
    })

    this.bootstrap().catch((error) => {
      this.setStatus(`Bootstrap failed: ${error?.message || error}`, 'danger')
      this.appendLog(`error: ${error?.message || error}`)
    })
  }

  async bootstrap() {
    this.setBusy(true)
    this.setStatus('Opening session...', 'info')

    const opened = await runtime.call('ai.agent', 'open', JSON.stringify({
      profile: 'browser2-default',
      persist: {
        driver: 'fs',
        format: 'jsonl',
        path: '/ai/sessions/view-ai-default.jsonl',
      },
    }))
    const payload = parseOutput(opened, {})
    this.handle = payload.handle
    this.cursor = null

    await this.reloadLatest()
    this.setStatus('Ready', 'success')
    this.setBusy(false)
    queueMicrotask(() => this.inputElement?.focus())
  }

  async handleSubmit() {
    const prompt = this.inputElement?.value?.trim() || ''
    if (!prompt || this.handle == null) return

    this.setBusy(true)
    this.setStatus('Running...', 'info')

    try {
      const result = await runtime.call('ai.agent', 'send', JSON.stringify({
        handle: this.handle,
        message: prompt,
      }))

      if (result.returnCode !== 0) {
        throw new Error(decodeOutput(result) || 'ai.agent send failed')
      }

      if (this.inputElement) this.inputElement.value = ''
      await this.reloadLatest()
      this.setStatus('Done', 'success')
    } catch (error) {
      this.appendLog(`error: ${error?.message || error}`)
      this.setStatus(`Error: ${error?.message || error}`, 'danger')
      console.error('view-ai request failed:', error)
    } finally {
      this.setBusy(false)
    }
  }

  async reloadLatest() {
    if (this.handle == null) return
    const page = await runtime.call('ai.agent', 'get_history_page', JSON.stringify({
      handle: this.handle,
      cursor: null,
      limit: 50,
    }))
    const payload = parseOutput(page, { items: [], nextCursor: null })
    this.cursor = payload.nextCursor
    this.renderItems(payload.items || [])
    if (this.logElement) {
      this.logElement.scrollTop = this.logElement.scrollHeight
    }
  }

  async loadOlder() {
    if (this.handle == null || this.cursor == null) return
    this.loadingHistory = true

    try {
      const previousHeight = this.logElement?.scrollHeight || 0
      const page = await runtime.call('ai.agent', 'get_history_page', JSON.stringify({
        handle: this.handle,
        cursor: this.cursor,
        limit: 50,
      }))
      const payload = parseOutput(page, { items: [], nextCursor: null })
      this.cursor = payload.nextCursor
      this.prependItems(payload.items || [])
      if (this.logElement) {
        const nextHeight = this.logElement.scrollHeight
        this.logElement.scrollTop = nextHeight - previousHeight
      }
    } finally {
      this.loadingHistory = false
    }
  }

  renderItems(items) {
    if (!this.logElement) return
    this.logElement.textContent = this.formatItems(items)
  }

  prependItems(items) {
    if (!this.logElement || !items.length) return
    const existing = this.logElement.textContent || ''
    const prefix = this.formatItems(items)
    this.logElement.textContent = existing ? `${prefix}\n\n${existing}` : prefix
  }

  formatItems(items) {
    const lines = []
    for (const message of items) {
      if (message.role === 'user') lines.push(`You: ${messageText(message)}`)
      else if (message.role === 'assistant') lines.push(`Agent: ${messageText(message)}`)
      else if (message.role === 'tool') lines.push(messageText(message))
      else lines.push(messageText(message))
    }
    return lines.length > 0 ? lines.join('\n\n') : 'AI agent ready.'
  }

  appendLog(line) {
    if (!this.logElement) return
    const current = this.logElement.textContent || ''
    this.logElement.textContent = current ? `${current}\n${line}` : line
  }

  setBusy(busy) {
    if (this.sendButton) this.sendButton.disabled = busy
  }

  setStatus(text, tone = '') {
    if (!this.statusElement) return
    this.statusElement.textContent = text
    this.statusElement.className = ''
    if (tone) this.statusElement.classList.add(tone)
  }
}

if (!customElements.get('view-ai')) {
  customElements.define('view-ai', ViewAi)
}
