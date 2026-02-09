import { toast } from '../../systems/toast.js'

/**
 * SettingsTabGeneral
 * 
 * General application settings:
 * - File storage backend selector (OPFS / WebDAV / future backends)
 *   Reads/writes localStorage keys that PluginManagerProxy.detectBackend() uses.
 *   Changing backend requires a page reload to take effect.
 */
class SettingsTabGeneral extends HTMLElement {
  constructor() {
    super()
    this.backend = 'opfs'
    this.webdavUrl = ''
  }

  connectedCallback() {
    this.style.display = 'block'
    this.style.height = '100%'
    this.style.overflow = 'auto'

    this.loadFromLocalStorage()
    this.render()
  }

  loadFromLocalStorage() {
    const url = localStorage.getItem('fs.webdav.url')
    if (url) {
      this.backend = 'webdav'
      this.webdavUrl = url
    } else {
      this.backend = 'opfs'
      this.webdavUrl = ''
    }
  }

  render() {
    this.innerHTML = ''

    const container = document.createElement('div')
    container.className = 'settings-general-container'

    // File Storage section
    container.appendChild(this.renderStorageSection())

    this.appendChild(container)
  }

  renderStorageSection() {
    const section = document.createElement('div')
    section.className = 'settings-general-section'

    const header = document.createElement('h3')
    header.className = 'settings-general-section-header'
    header.textContent = 'File Storage'
    section.appendChild(header)

    const desc = document.createElement('p')
    desc.className = 'settings-general-desc'
    desc.textContent = 'Choose where project files are stored. Changing the backend requires a page reload.'
    section.appendChild(desc)

    // Backend options
    const backends = [
      {
        id: 'opfs',
        label: 'OPFS (Browser Storage)',
        desc: 'Origin Private File System. Files stored locally in the browser. No setup required.',
      },
      {
        id: 'webdav',
        label: 'WebDAV',
        desc: 'Remote file server via WebDAV protocol. Use rclone serve webdav for local dev.',
      },
    ]

    const radioGroup = document.createElement('div')
    radioGroup.className = 'settings-general-radio-group'

    for (const b of backends) {
      const item = document.createElement('label')
      item.className = 'settings-general-radio-item'
      if (b.id === this.backend) item.classList.add('active')

      const radio = document.createElement('input')
      radio.type = 'radio'
      radio.name = 'fs-backend'
      radio.value = b.id
      radio.checked = b.id === this.backend

      radio.addEventListener('change', () => {
        this.backend = b.id
        // Update active state on all items
        radioGroup.querySelectorAll('.settings-general-radio-item').forEach(el => el.classList.remove('active'))
        item.classList.add('active')
        // Show/hide WebDAV URL field
        this.updateWebDAVVisibility()
      })

      const textWrap = document.createElement('div')
      textWrap.className = 'settings-general-radio-text'

      const labelText = document.createElement('span')
      labelText.className = 'settings-general-radio-label'
      labelText.textContent = b.label

      const descText = document.createElement('span')
      descText.className = 'settings-general-radio-desc'
      descText.textContent = b.desc

      textWrap.appendChild(labelText)
      textWrap.appendChild(descText)

      item.appendChild(radio)
      item.appendChild(textWrap)
      radioGroup.appendChild(item)
    }

    section.appendChild(radioGroup)

    // WebDAV URL input
    const webdavConfig = document.createElement('div')
    webdavConfig.className = 'settings-general-webdav-config'
    webdavConfig.dataset.element = 'webdav-config'
    if (this.backend !== 'webdav') webdavConfig.style.display = 'none'

    const urlLabel = document.createElement('label')
    urlLabel.className = 'settings-general-field-label'
    urlLabel.textContent = 'WebDAV URL'

    const urlInput = document.createElement('input')
    urlInput.type = 'url'
    urlInput.className = 'settings-general-input'
    urlInput.placeholder = 'http://localhost:8080'
    urlInput.value = this.webdavUrl
    urlInput.addEventListener('input', (e) => {
      this.webdavUrl = e.target.value.trim()
    })

    const urlHint = document.createElement('span')
    urlHint.className = 'settings-general-hint'
    urlHint.textContent = 'e.g. http://localhost:8080 for rclone serve webdav .'

    webdavConfig.appendChild(urlLabel)
    webdavConfig.appendChild(urlInput)
    webdavConfig.appendChild(urlHint)
    section.appendChild(webdavConfig)

    // Current status
    const status = document.createElement('div')
    status.className = 'settings-general-status'

    const currentUrl = localStorage.getItem('fs.webdav.url')
    const currentBackend = currentUrl ? 'WebDAV' : 'OPFS'
    const statusText = currentUrl
      ? `Active: WebDAV (${currentUrl})`
      : 'Active: OPFS (Browser Storage)'

    const badge = document.createElement('span')
    badge.className = 'settings-general-status-badge'
    badge.textContent = statusText

    status.appendChild(badge)
    section.appendChild(status)

    // Actions
    const footer = document.createElement('div')
    footer.className = 'settings-general-footer'

    const applyBtn = document.createElement('button')
    applyBtn.className = 'button-primary'
    applyBtn.textContent = 'Apply & Reload'
    applyBtn.addEventListener('click', () => this.apply())
    footer.appendChild(applyBtn)

    section.appendChild(footer)

    return section
  }

  updateWebDAVVisibility() {
    const config = this.querySelector('[data-element="webdav-config"]')
    if (config) {
      config.style.display = this.backend === 'webdav' ? '' : 'none'
    }
  }

  async apply() {
    if (this.backend === 'webdav') {
      if (!this.webdavUrl) {
        toast.error('WebDAV URL is required')
        return
      }
      localStorage.setItem('fs.webdav.url', this.webdavUrl)
    } else {
      // OPFS - remove webdav key
      localStorage.removeItem('fs.webdav.url')
    }

    toast.info('Reloading with new storage backend...')

    // Small delay so the toast is visible before reload
    setTimeout(() => {
      window.location.reload()
    }, 500)
  }
}

customElements.define('settings-tab-general', SettingsTabGeneral)
