export class ViewAi extends HTMLElement {
  constructor() {
    super()
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
        <pre data-element="log">AI chat bootstrap view. Wiring to ai_agent is not implemented yet.</pre>
      </article>
      <footer>
        <form data-element="form">
          <code-editor data-field="prompt" placeholder="Ask the agent..." rows="4"></code-editor>
          <button type="submit" class="accent">Send</button>
          <output data-element="status">Idle</output>
        </form>
      </footer>
    `

    this.logElement = this.querySelector('[data-element="log"]')
    this.formElement = this.querySelector('[data-element="form"]')
    this.inputElement = this.querySelector('[data-field="prompt"]')
    this.sendButton = this.querySelector('button[type="submit"]')
    this.statusElement = this.querySelector('[data-element="status"]')

    this.formElement?.addEventListener('submit', (event) => {
      event.preventDefault()
      const prompt = this.inputElement?.value?.trim() || ''
      if (!prompt) return
      this.appendLog(`You: ${prompt}`)
      this.setStatus('ai_agent integration not implemented yet', 'warning')
      if (this.inputElement) this.inputElement.value = ''
    })
  }

  appendLog(line) {
    if (!this.logElement) return
    const current = this.logElement.textContent || ''
    this.logElement.textContent = current ? `${current}\n${line}` : line
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
