import { runtime } from '../core/runtime.js'
import { registerViewPlugin, unregisterViewPlugin } from '../util/view-plugin.js'
import { GAMS_CONFIG_PATH, loadDefaultGamsConfig, validateGamsConfig } from '../core/gams-config.js'
import { createWriteInput } from '../util/fs.js'

const decoder = new TextDecoder()

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function decodeOutput(result) {
  return decoder.decode(result?.output || new Uint8Array())
}

function formatJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

export class ViewSettingPlugins extends HTMLElement {
  constructor() {
    super()
    this.formElement = null
    this.editorElement = null
    this.pathElement = null
    this.summaryElement = null
    this.statusElement = null
    this.saveButtonElement = null
    this.reloadButtonElement = null
    this.defaultsButtonElement = null
  }

  connectedCallback() {
    registerViewPlugin(this)
    if (this.dataset.ready) return
    this.dataset.ready = '1'

    this.style.display = 'contents'
    this.innerHTML = `
      <form data-element="form" novalidate>
        <label>
          GAMS Config File
          <output data-element="path"></output>
        </label>
        <output data-element="summary">Loading GAMS config…</output>
        <code-editor data-field="content" placeholder="{&quot;plugins&quot;:[]}" rows="28"></code-editor>
        <footer>
          <button type="button" data-action="load-defaults">Load Defaults</button>
          <button type="button" data-action="reload">Reload App</button>
          <button type="submit" data-action="save" class="accent">Save</button>
          <output data-element="status">Loading…</output>
        </footer>
      </form>
    `

    this.formElement = this.querySelector('[data-element="form"]')
    this.editorElement = this.querySelector('[data-field="content"]')
    this.pathElement = this.querySelector('[data-element="path"]')
    this.summaryElement = this.querySelector('[data-element="summary"]')
    this.statusElement = this.querySelector('[data-element="status"]')
    this.saveButtonElement = this.querySelector('[data-action="save"]')
    this.reloadButtonElement = this.querySelector('[data-action="reload"]')
    this.defaultsButtonElement = this.querySelector('[data-action="load-defaults"]')

    assert(this.formElement instanceof HTMLFormElement, 'view-setting-plugins missing form element')
    assert(this.editorElement, 'view-setting-plugins missing editor element')
    assert(this.pathElement instanceof HTMLOutputElement, 'view-setting-plugins missing path output')
    assert(this.summaryElement instanceof HTMLOutputElement, 'view-setting-plugins missing summary output')
    assert(this.statusElement instanceof HTMLOutputElement, 'view-setting-plugins missing status output')
    assert(this.saveButtonElement instanceof HTMLButtonElement, 'view-setting-plugins missing save button')
    assert(this.reloadButtonElement instanceof HTMLButtonElement, 'view-setting-plugins missing reload button')
    assert(this.defaultsButtonElement instanceof HTMLButtonElement, 'view-setting-plugins missing defaults button')

    this.pathElement.textContent = GAMS_CONFIG_PATH

    this.formElement.addEventListener('submit', async (event) => {
      event.preventDefault()
      await this.save()
    })

    this.defaultsButtonElement.addEventListener('click', async () => {
      this.editorElement.value = formatJson(await loadDefaultGamsConfig())
      this.summaryElement.textContent = 'Editor now shows built-in default GAMS config.'
      this.summaryElement.className = 'info'
      this.setStatus('Defaults loaded into editor', 'info')
      this.editorElement.focus()
    })

    this.reloadButtonElement.addEventListener('click', () => {
      window.location.reload()
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
    this.saveButtonElement.disabled = isBusy
    this.defaultsButtonElement.disabled = isBusy
  }

  setStatus(text, tone = '') {
    this.statusElement.textContent = text
    this.statusElement.className = ''
    if (tone) this.statusElement.classList.add(tone)
  }

  setSummary(text, tone = '') {
    this.summaryElement.textContent = text
    this.summaryElement.className = ''
    if (tone) this.summaryElement.classList.add(tone)
  }

  async load() {
    this.setBusy(true)
    this.setStatus('Loading…', 'info')

    try {
      const existsResult = await runtime.call('fs', 'exists', GAMS_CONFIG_PATH)
      if (existsResult.returnCode !== 0) {
        throw new Error(decodeOutput(existsResult) || `fs.exists failed: ${existsResult.returnCode}`)
      }

      const exists = decodeOutput(existsResult) === 'true'
      if (exists) {
        const result = await runtime.call('fs', 'read', GAMS_CONFIG_PATH)
        if (result.returnCode !== 0) {
          throw new Error(decodeOutput(result) || `fs.read failed: ${result.returnCode}`)
        }

        const parsed = validateGamsConfig(JSON.parse(decodeOutput(result)), GAMS_CONFIG_PATH)
        this.editorElement.value = formatJson(parsed)
        this.setSummary(`Loaded GAMS config from ${GAMS_CONFIG_PATH}.`, 'success')
        this.setStatus('Ready', 'success')
        queueMicrotask(() => this.editorElement.focus())
        return
      }

      this.editorElement.value = formatJson(await loadDefaultGamsConfig())
      this.setSummary(`No ${GAMS_CONFIG_PATH} found. Editor shows built-in fallback config until you save.`, 'warning')
      this.setStatus('Ready', 'success')
      queueMicrotask(() => this.editorElement.focus())
    } catch (error) {
      this.setStatus(String(error?.message || error), 'danger')
      await runtime.call('ui.toast', 'error', { message: String(error?.message || error) })
    } finally {
      this.setBusy(false)
    }
  }

  async save() {
    this.setBusy(true)
    this.setStatus('Saving…', 'info')

    try {
      const parsed = validateGamsConfig(JSON.parse(this.editorElement.value), GAMS_CONFIG_PATH)
      const encoded = formatJson(parsed)
      const result = await runtime.call('fs', 'write', createWriteInput(GAMS_CONFIG_PATH, encoded))
      if (result.returnCode !== 0) {
        throw new Error(decodeOutput(result) || `fs.write failed: ${result.returnCode}`)
      }

      this.editorElement.value = encoded
      this.setSummary(`Saved ${GAMS_CONFIG_PATH}. Reload the app to apply config changes.`, 'warning')
      this.setStatus('Saved. Reload required.', 'warning')
      await runtime.call('ui.toast', 'success', { message: `Saved ${GAMS_CONFIG_PATH}` })
    } catch (error) {
      this.setStatus(String(error?.message || error), 'danger')
      await runtime.call('ui.toast', 'error', { message: String(error?.message || error) })
    } finally {
      this.setBusy(false)
    }
  }

  disconnectedCallback() {
    void unregisterViewPlugin(this)
  }
}

if (!customElements.get('view-setting-plugins')) {
  customElements.define('view-setting-plugins', ViewSettingPlugins)
}
