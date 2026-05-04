import { runtime } from '../core/runtime.js'
import { registerViewPlugin, unregisterViewPlugin } from '../util/view-plugin.js'

const THEME_STORAGE_KEY = 'browser.theme'
const DEFAULT_THEME = 'the98'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function loadThemeManifest() {
  const response = await fetch('./themes/themes.json')
  assert(response.ok, `Failed to load themes manifest: ${response.status}`)
  return await response.json()
}

export class ViewSettingTheme extends HTMLElement {
  constructor() {
    super()
    this.themeManifest = null
    this.selectedTheme = localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME
    this.formElement = null
    this.themeSelectElement = null
    this.summaryElement = null
    this.statusElement = null
    this.saveButtonElement = null
    this.resetButtonElement = null
  }

  connectedCallback() {
    registerViewPlugin(this)
    if (this.dataset.ready) return
    this.dataset.ready = '1'

    this.style.display = 'contents'
    this.renderShell()
    void this.bootstrap()
  }

  renderShell() {
    this.innerHTML = `
      <form data-element="form">
        <label>
          Theme
          <select data-field="theme"></select>
        </label>
        <output data-element="summary">Loading themes…</output>
        <output data-element="status"></output>
        <footer>
          <button type="submit" class="accent">Save</button>
          <button type="button" data-action="reset">Reset to Default</button>
        </footer>
      </form>
    `

    this.formElement = this.querySelector('[data-element="form"]')
    this.themeSelectElement = this.querySelector('[data-field="theme"]')
    this.summaryElement = this.querySelector('[data-element="summary"]')
    this.statusElement = this.querySelector('[data-element="status"]')
    this.saveButtonElement = this.querySelector('button[type="submit"]')
    this.resetButtonElement = this.querySelector('[data-action="reset"]')

    assert(this.formElement instanceof HTMLFormElement, 'view-setting-theme missing form element')
    assert(this.themeSelectElement instanceof HTMLSelectElement, 'view-setting-theme missing theme select')
    assert(this.summaryElement instanceof HTMLOutputElement, 'view-setting-theme missing summary output')
    assert(this.statusElement instanceof HTMLOutputElement, 'view-setting-theme missing status output')
    assert(this.saveButtonElement instanceof HTMLButtonElement, 'view-setting-theme missing save button')
    assert(this.resetButtonElement instanceof HTMLButtonElement, 'view-setting-theme missing reset button')

    this.themeSelectElement.addEventListener('change', () => {
      this.selectedTheme = this.themeSelectElement.value
      this.applyPreview(this.selectedTheme)
      this.renderSummary()
      this.setStatus('Preview updated', 'info')
    })

    this.formElement.addEventListener('submit', async (event) => {
      event.preventDefault()
      await this.save()
    })

    this.resetButtonElement.addEventListener('click', async () => {
      await this.resetToDefault()
    })
  }

  async bootstrap() {
    try {
      this.themeManifest = await loadThemeManifest()
      this.populateThemeOptions()
      this.renderSummary()
      this.setStatus('Ready', 'success')
    } catch (error) {
      this.setStatus(String(error?.message || error), 'danger')
      await runtime.call('ui.toast', 'error', { message: String(error?.message || error) })
    }
  }

  populateThemeOptions() {
    assert(this.themeManifest && typeof this.themeManifest === 'object', 'view-setting-theme missing theme manifest')
    assert(this.themeSelectElement instanceof HTMLSelectElement, 'view-setting-theme theme select not initialized')

    const themes = this.themeManifest.themes
    const defaultTheme = this.themeManifest.defaultTheme || DEFAULT_THEME
    const selectedTheme = themes[this.selectedTheme] ? this.selectedTheme : defaultTheme
    this.selectedTheme = selectedTheme
    this.themeSelectElement.innerHTML = ''

    for (const [themeId, theme] of Object.entries(themes)) {
      const option = document.createElement('option')
      option.value = themeId
      option.textContent = theme.label
      option.selected = themeId === selectedTheme
      this.themeSelectElement.appendChild(option)
    }
  }

  renderSummary() {
    assert(this.summaryElement instanceof HTMLOutputElement, 'view-setting-theme summary output not initialized')

    if (!this.themeManifest) {
      this.summaryElement.textContent = 'Loading themes…'
      this.summaryElement.className = ''
      this.summaryElement.classList.add('info')
      return
    }

    const defaultTheme = this.themeManifest.defaultTheme || DEFAULT_THEME
    const theme = this.themeManifest.themes[this.selectedTheme]
    assert(theme, `Unknown theme '${this.selectedTheme}'`)
    const isDefault = this.selectedTheme === defaultTheme
    this.summaryElement.textContent = isDefault
      ? `Selected theme: ${theme.label} (default)`
      : `Selected theme: ${theme.label}`
    this.summaryElement.className = ''
    this.summaryElement.classList.add('info')
  }

  setStatus(text, tone = '') {
    assert(this.statusElement instanceof HTMLOutputElement, 'view-setting-theme status output not initialized')
    this.statusElement.textContent = text
    this.statusElement.className = ''
    if (tone) this.statusElement.classList.add(tone)
  }

  applyPreview(themeId) {
    const apply = window.__applyThemeStylesheet
    assert(typeof apply === 'function', 'browser theme apply hook is not installed')
    apply(themeId)
  }

  async save() {
    try {
      assert(this.themeManifest, 'view-setting-theme cannot save before manifest is loaded')
      assert(this.themeManifest.themes[this.selectedTheme], `Unknown theme '${this.selectedTheme}'`)
      localStorage.setItem(THEME_STORAGE_KEY, this.selectedTheme)
      this.applyPreview(this.selectedTheme)
      this.setStatus('Theme saved', 'success')
      await runtime.call('ui.toast', 'success', { message: 'Theme saved' })
    } catch (error) {
      this.setStatus(String(error?.message || error), 'danger')
      await runtime.call('ui.toast', 'error', { message: String(error?.message || error) })
    }
  }

  async resetToDefault() {
    try {
      assert(this.themeManifest, 'view-setting-theme cannot reset before manifest is loaded')
      const defaultTheme = this.themeManifest.defaultTheme || DEFAULT_THEME
      this.selectedTheme = defaultTheme
      assert(this.themeSelectElement instanceof HTMLSelectElement, 'view-setting-theme theme select not initialized')
      this.themeSelectElement.value = defaultTheme
      localStorage.setItem(THEME_STORAGE_KEY, defaultTheme)
      this.applyPreview(defaultTheme)
      this.renderSummary()
      this.setStatus('Theme reset to default', 'success')
      await runtime.call('ui.toast', 'success', { message: 'Theme reset to default' })
    } catch (error) {
      this.setStatus(String(error?.message || error), 'danger')
      await runtime.call('ui.toast', 'error', { message: String(error?.message || error) })
    }
  }

  disconnectedCallback() {
    void unregisterViewPlugin(this)
  }
}

if (!customElements.get('view-setting-theme')) {
  customElements.define('view-setting-theme', ViewSettingTheme)
}
