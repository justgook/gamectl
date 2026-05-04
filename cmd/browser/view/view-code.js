import { runtime } from '/core/runtime.js'
import { registerViewPlugin, unregisterViewPlugin } from '/util/view-plugin.js'
import { createWriteInput } from '/util/fs.js'

const textDecoder = new TextDecoder()

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function decodeOutput(result) {
  return textDecoder.decode(result?.output || new Uint8Array())
}

export class ViewCode extends HTMLElement {
  static get observedAttributes() {
    return ['data-source']
  }

  constructor() {
    super()
    this.popupProps = this.popupProps || {}
    this.formElement = null
    this.editorElement = null
    this.statusOutput = null
    this.saveButton = null
    this.path = ''
  }

  connectedCallback() {
    registerViewPlugin(this)
    if (this.dataset.ready) return
    this.dataset.ready = '1'
    this.style.display = 'contents'
    this.path = String(this.getAttribute('data-source') || '').trim()
    assert(this.path, 'view-code requires data-source')

    this.innerHTML = `
      <form data-element="form" novalidate>
        <label for="view-code-path">Path</label>
        <output id="view-code-path" data-element="path"></output>
        <code-editor data-field="content" lang="lua" rows="24" spellcheck="false" placeholder="-- Lua code"></code-editor>
        <footer>
          <output data-element="status">Loading...</output>
          <button type="button" data-action="cancel">Cancel</button>
          <button type="submit" data-action="save" class="accent">Save</button>
        </footer>
      </form>
    `

    this.formElement = this.querySelector('[data-element="form"]')
    this.editorElement = this.querySelector('[data-field="content"]')
    this.statusOutput = this.querySelector('[data-element="status"]')
    this.saveButton = this.querySelector('[data-action="save"]')
    const cancelButton = this.querySelector('[data-action="cancel"]')
    const pathOutput = this.querySelector('[data-element="path"]')

    assert(this.formElement instanceof HTMLFormElement, 'view-code missing form element')
    assert(this.editorElement, 'view-code missing code editor')
    assert(this.statusOutput instanceof HTMLOutputElement, 'view-code missing status output')
    assert(this.saveButton instanceof HTMLButtonElement, 'view-code missing save button')
    assert(cancelButton instanceof HTMLButtonElement, 'view-code missing cancel button')
    assert(pathOutput instanceof HTMLOutputElement, 'view-code missing path output')

    pathOutput.textContent = this.path

    cancelButton.addEventListener('click', async () => {
      await runtime.call('ui.popup', 'close', { ok: false, cancelled: true, path: this.path })
    })

    this.formElement.addEventListener('submit', async (event) => {
      event.preventDefault()
      await this.save()
    })

    void this.load()
  }

  setBusy(isBusy) {
    this.saveButton.disabled = isBusy
  }

  setStatus(text, tone = null) {
    this.statusOutput.textContent = text
    this.statusOutput.classList.remove('accent', 'success', 'warning', 'danger', 'info')
    if (tone) this.statusOutput.classList.add(tone)
  }

  async load() {
    this.setBusy(true)
    this.setStatus('Loading...', 'info')
    try {
      const result = await runtime.call('fs', 'read', this.path)
      if (result.returnCode !== 0) {
        throw new Error(decodeOutput(result) || `fs.read failed: ${result.returnCode}`)
      }
      this.editorElement.value = decodeOutput(result)
      this.setStatus('Ready', 'success')
      queueMicrotask(() => this.editorElement.focus())
    } catch (error) {
      this.setStatus(`Error: ${error?.message || error}`, 'danger')
      console.error('view-code load failed:', error)
    } finally {
      this.setBusy(false)
    }
  }

  async save() {
    this.setBusy(true)
    this.setStatus('Saving...', 'info')
    try {
      const result = await runtime.call('fs', 'write', createWriteInput(this.path, this.editorElement.value))
      if (result.returnCode !== 0) {
        throw new Error(decodeOutput(result) || `fs.write failed: ${result.returnCode}`)
      }
      this.setStatus('Saved', 'success')
      await runtime.call('ui.popup', 'close', { ok: true, cancelled: false, path: this.path })
    } catch (error) {
      this.setStatus(`Error: ${error?.message || error}`, 'danger')
      console.error('view-code save failed:', error)
    } finally {
      this.setBusy(false)
    }
  }

  disconnectedCallback() {
    void unregisterViewPlugin(this)
  }
}

if (!customElements.get('view-code')) {
  customElements.define('view-code', ViewCode)
}
