import { runtime } from '../core/runtime.js'
import { registerViewPlugin, unregisterViewPlugin } from '../util/view-plugin.js'
import { createWriteInput } from '../util/fs.js'

const decoder = new TextDecoder()

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function decodeOutput(result) {
  return decoder.decode(result?.output || new Uint8Array())
}

export class FilesJson extends HTMLElement {
  constructor() {
    super()
    this.popupProps = this.popupProps || {}
    this.formElement = null
    this.editorElement = null
    this.statusElement = null
    this.saveButton = null
    this.path = ''
  }

  connectedCallback() {
    registerViewPlugin(this)
    if (this.dataset.ready) return
    this.dataset.ready = '1'

    this.style.display = 'contents'
    this.path = String(this.popupProps?.path || '')
    assert(this.path, 'files-json requires popupProps.path')

    this.innerHTML = `
      <form data-element="form" novalidate>
        <label for="files-json-path">Path</label>
        <output id="files-json-path" data-element="path"></output>
        <code-editor data-field="content" placeholder="{}" rows="24"></code-editor>
        <footer>
          <output data-element="status">Loading...</output>
          <button type="button" data-action="cancel">Cancel</button>
          <button type="submit" data-action="save" class="accent">Save</button>
        </footer>
      </form>
    `

    this.formElement = this.querySelector('[data-element="form"]')
    this.editorElement = this.querySelector('[data-field="content"]')
    this.statusElement = this.querySelector('[data-element="status"]')
    this.saveButton = this.querySelector('[data-action="save"]')
    const pathElement = this.querySelector('[data-element="path"]')

    assert(this.formElement instanceof HTMLFormElement, 'files-json missing form element')
    assert(this.editorElement, 'files-json missing editor element')
    assert(this.statusElement instanceof HTMLOutputElement, 'files-json missing status output')
    assert(this.saveButton instanceof HTMLButtonElement, 'files-json missing save button')
    assert(pathElement instanceof HTMLOutputElement, 'files-json missing path output')

    pathElement.textContent = this.path

    this.querySelector('[data-action="cancel"]')?.addEventListener('click', async () => {
      await runtime.call('ui.popup', 'close', { reload: false, cancelled: true })
    })

    this.formElement.addEventListener('submit', async (event) => {
      event.preventDefault()
      await this.save()
    })

    this.editorElement.addEventListener('keydown', async (event) => {
      if (event.key === 's' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        await this.save()
      }
    })

    void this.load()
  }

  setBusy(isBusy) {
    this.saveButton.disabled = isBusy
  }

  setStatus(text, tone = null) {
    this.statusElement.textContent = text
    this.statusElement.classList.remove('accent', 'success', 'warning', 'danger', 'info')
    if (tone) this.statusElement.classList.add(tone)
  }

  async load() {
    this.setBusy(true)
    this.setStatus('Loading...', 'info')

    try {
      const result = await runtime.call('fs', 'read', this.path)
      if (result.returnCode !== 0) {
        throw new Error(decodeOutput(result) || `fs.read failed: ${result.returnCode}`)
      }

      const text = decodeOutput(result)
      const parsed = text.trim() ? JSON.parse(text) : null
      this.editorElement.value = `${JSON.stringify(parsed, null, 2)}\n`
      this.setStatus('Ready', 'success')
      queueMicrotask(() => this.editorElement.focus())
    } catch (error) {
      this.setStatus(`Error: ${error?.message || error}`, 'danger')
      console.error('files-json load failed:', error)
    } finally {
      this.setBusy(false)
    }
  }

  async save() {
    this.setBusy(true)
    this.setStatus('Validating...', 'info')

    try {
      const raw = this.editorElement.value
      const parsed = JSON.parse(raw)
      const encoded = `${JSON.stringify(parsed, null, 2)}\n`

      this.setStatus('Saving...', 'info')
      const result = await runtime.call('fs', 'write', createWriteInput(this.path, encoded))
      if (result.returnCode !== 0) {
        throw new Error(decodeOutput(result) || `fs.write failed: ${result.returnCode}`)
      }

      this.editorElement.value = encoded
      this.setStatus('Saved', 'success')
      await runtime.call('ui.popup', 'close', {
        reload: true,
        selectedPath: this.path,
      })
    } catch (error) {
      this.setStatus(`Error: ${error?.message || error}`, 'danger')
      console.error('files-json save failed:', error)
    } finally {
      this.setBusy(false)
    }
  }

  disconnectedCallback() {
    void unregisterViewPlugin(this)
  }
}

if (!customElements.get('files-json')) {
  customElements.define('files-json', FilesJson)
}
