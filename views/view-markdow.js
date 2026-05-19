import { runtime, unwrap } from '/core/runtime.js'
import { registerViewPlugin, unregisterViewPlugin, viewOk } from '/util/view-plugin.js'
import markdownit from '/widgets/markdown-it.js'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function getFilename(path) {
  return String(path || '').split('/').pop() || ''
}

const markdown = markdownit({
  html: false,
  linkify: true,
  typographer: true,
})

export class ViewMarkdow extends HTMLElement {
  static get observedAttributes() {
    return ['data-source']
  }

  constructor() {
    super()
    this.popupProps = this.popupProps || {}
    this.path = ''
    this.articleElement = null
    this.pathOutput = null
    this.statusOutput = null
  }

  connectedCallback() {
    registerViewPlugin(this, this.createViewPluginMethods())
    if (this.dataset.ready) return
    this.dataset.ready = '1'
    this.style.display = 'contents'
    this.path = String(this.popupProps?.path || this.getAttribute('data-source') || '').trim()
    assert(this.path, 'view-markdow requires data-source')

    this.innerHTML = `
      <article class="prose" data-element="markdown"></article>
      <footer>
        <output data-element="path"></output>
        <output data-element="status">Loading...</output>
      </footer>
    `

    this.articleElement = this.querySelector('[data-element="markdown"]')
    this.pathOutput = this.querySelector('[data-element="path"]')
    this.statusOutput = this.querySelector('[data-element="status"]')

    assert(this.articleElement instanceof HTMLElement, 'view-markdow missing article element')
    assert(this.pathOutput instanceof HTMLOutputElement, 'view-markdow missing path output')
    assert(this.statusOutput instanceof HTMLOutputElement, 'view-markdow missing status output')

    this.pathOutput.textContent = this.path
    void this.load()
  }

  disconnectedCallback() {
    void unregisterViewPlugin(this)
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return
    if (name !== 'data-source') return

    this.path = String(newValue || '').trim()
    if (this.pathOutput) this.pathOutput.textContent = this.path
    if (this.dataset.ready) void this.load()
  }

  createViewPluginMethods() {
    return {
      reload: async () => {
        await this.reload()
        return viewOk()
      },
    }
  }

  setStatus(text, tone = null) {
    assert(this.statusOutput instanceof HTMLOutputElement, 'view-markdow status output is not initialized')
    this.statusOutput.textContent = text
    this.statusOutput.classList.remove('accent', 'success', 'warning', 'danger', 'info')
    if (tone) this.statusOutput.classList.add(tone)
  }

  async load() {
    assert(this.articleElement instanceof HTMLElement, 'view-markdow article element is not initialized')
    assert(this.path.length > 0, 'view-markdow requires data-source')

    this.setStatus('Loading...', 'info')
    try {
      const source = unwrap(await runtime.invoke('fs/fs::read-text', this.path))
      this.articleElement.innerHTML = markdown.render(source)
      this.setStatus(`Rendered ${getFilename(this.path)}`, 'success')
    } catch (error) {
      this.articleElement.textContent = ''
      this.setStatus(`Error: ${error?.message || error}`, 'danger')
      console.error('view-markdow load failed:', error)
    }
  }

  async reload() {
    await this.load()
  }
}

if (!customElements.get('view-markdow')) {
  customElements.define('view-markdow', ViewMarkdow)
}
