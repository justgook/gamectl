import { runtime } from '/core/runtime.js'
import { registerViewPlugin, unregisterViewPlugin } from '/util/view-plugin.js'

const FS_STORAGE_KEY = 'browser.fs'
const WEBDAV_URL_STORAGE_KEY = 'browser.fs.webdav.url'
const DEFAULT_PROVIDER = 'fs.opfs'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function sanitizeWebdavDisplayUrl(rawUrl) {
  if (!rawUrl) return ''

  try {
    const parsed = new URL(rawUrl)
    parsed.username = ''
    parsed.password = ''
    return parsed.toString()
  } catch {
    return rawUrl.replace(/:\/\/[^@/]+@/, '://')
  }
}

function readConfig() {
  const provider = localStorage.getItem(FS_STORAGE_KEY) || DEFAULT_PROVIDER
  const webdavUrl = localStorage.getItem(WEBDAV_URL_STORAGE_KEY) || ''
  return { provider, webdavUrl }
}

function validateWebdavUrl(raw) {
  const value = String(raw || '').trim()
  assert(value.length > 0, 'WebDAV URL is required')
  const parsed = new URL(value)
  assert(parsed.protocol === 'http:' || parsed.protocol === 'https:', 'WebDAV URL must use http or https')
  return value
}

export class ViewSettingFs extends HTMLElement {
  constructor() {
    super()
    this.provider = DEFAULT_PROVIDER
    this.webdavUrl = ''
    this.formElement = null
    this.providerSelectElement = null
    this.webdavLabelElement = null
    this.webdavInputElement = null
    this.statusElement = null
    this.summaryElement = null
    this.applyButtonElement = null
  }

  connectedCallback() {
    registerViewPlugin(this)
    if (this.dataset.ready) return
    this.dataset.ready = '1'

    this.style.display = 'contents'
    this.loadState()

    this.innerHTML = `
      <form data-element="form">
        <label>
          Filesystem Provider
          <select data-field="provider">
            <option value="fs.opfs">OPFS</option>
            <option value="fs.webdav">WebDAV</option>
          </select>
        </label>
        <label data-element="webdav-url">
          WebDAV URL
          <input type="url" data-field="webdav-url" placeholder="http://localhost:8080" />
        </label>
        <output data-element="summary"></output>
        <output data-element="status"></output>
        <footer>
          <button type="submit" class="accent">Apply & Reload</button>
        </footer>
      </form>
    `

    this.formElement = this.querySelector('[data-element="form"]')
    this.providerSelectElement = this.querySelector('[data-field="provider"]')
    this.webdavLabelElement = this.querySelector('[data-element="webdav-url"]')
    this.webdavInputElement = this.querySelector('[data-field="webdav-url"]')
    this.summaryElement = this.querySelector('[data-element="summary"]')
    this.statusElement = this.querySelector('[data-element="status"]')
    this.applyButtonElement = this.querySelector('button[type="submit"]')

    assert(this.formElement instanceof HTMLFormElement, 'view-setting-fs missing form element')
    assert(this.providerSelectElement instanceof HTMLSelectElement, 'view-setting-fs missing provider select')
    assert(this.webdavLabelElement instanceof HTMLLabelElement, 'view-setting-fs missing WebDAV field')
    assert(this.webdavInputElement instanceof HTMLInputElement, 'view-setting-fs missing WebDAV input')
    assert(this.summaryElement instanceof HTMLOutputElement, 'view-setting-fs missing summary output')
    assert(this.statusElement instanceof HTMLOutputElement, 'view-setting-fs missing status output')
    assert(this.applyButtonElement instanceof HTMLButtonElement, 'view-setting-fs missing apply button')

    this.providerSelectElement.value = this.provider
    this.webdavInputElement.value = this.webdavUrl

    this.providerSelectElement.addEventListener('change', () => {
      this.provider = this.providerSelectElement.value
      this.renderState()
    })

    this.webdavInputElement.addEventListener('input', () => {
      this.webdavUrl = this.webdavInputElement.value.trim()
      this.renderSummary()
      if (this.statusElement.textContent) this.setStatus('')
    })

    this.formElement.addEventListener('submit', async (event) => {
      event.preventDefault()
      await this.apply()
    })

    this.renderState()
  }

  loadState() {
    const config = readConfig()
    this.provider = config.provider
    this.webdavUrl = config.webdavUrl
  }

  renderState() {
    assert(this.providerSelectElement instanceof HTMLSelectElement, 'view-setting-fs provider select not initialized')
    assert(this.webdavLabelElement instanceof HTMLLabelElement, 'view-setting-fs WebDAV field not initialized')
    assert(this.webdavInputElement instanceof HTMLInputElement, 'view-setting-fs WebDAV input not initialized')

    this.providerSelectElement.value = this.provider
    this.webdavLabelElement.hidden = this.provider !== 'fs.webdav'
    this.webdavInputElement.required = this.provider === 'fs.webdav'
    this.renderSummary()
  }

  renderSummary() {
    assert(this.summaryElement instanceof HTMLOutputElement, 'view-setting-fs summary output not initialized')

    if (this.provider === 'fs.webdav') {
      const displayUrl = sanitizeWebdavDisplayUrl(this.webdavUrl)
      this.summaryElement.textContent = displayUrl
        ? `Active on next reload: WebDAV (${displayUrl})`
        : 'Active on next reload: WebDAV (URL not set yet)'
      this.summaryElement.className = ''
      this.summaryElement.classList.add(displayUrl ? 'info' : 'warning')
      return
    }

    this.summaryElement.textContent = 'Active on next reload: OPFS (browser storage)'
    this.summaryElement.className = ''
    this.summaryElement.classList.add('info')
  }

  setStatus(text, tone = '') {
    assert(this.statusElement instanceof HTMLOutputElement, 'view-setting-fs status output not initialized')
    this.statusElement.textContent = text
    this.statusElement.className = ''
    if (tone) this.statusElement.classList.add(tone)
  }

  async apply() {
    assert(this.applyButtonElement instanceof HTMLButtonElement, 'view-setting-fs apply button not initialized')

    this.applyButtonElement.disabled = true

    try {
      if (this.provider === 'fs.webdav') {
        const url = validateWebdavUrl(this.webdavInputElement.value)
        localStorage.setItem(FS_STORAGE_KEY, 'fs.webdav')
        localStorage.setItem(WEBDAV_URL_STORAGE_KEY, url)
      } else {
        localStorage.setItem(FS_STORAGE_KEY, 'fs.opfs')
        localStorage.removeItem(WEBDAV_URL_STORAGE_KEY)
      }

      this.setStatus('Reloading with updated filesystem provider...', 'info')
      await runtime.call('ui.toast', 'info', { message: 'Reloading with updated filesystem provider...' })
      window.location.reload()
    } catch (error) {
      this.setStatus(String(error?.message || error), 'danger')
      await runtime.call('ui.toast', 'error', { message: String(error?.message || error) })
    } finally {
      this.applyButtonElement.disabled = false
    }
  }

  disconnectedCallback() {
    void unregisterViewPlugin(this)
  }
}

if (!customElements.get('view-setting-fs')) {
  customElements.define('view-setting-fs', ViewSettingFs)
}
