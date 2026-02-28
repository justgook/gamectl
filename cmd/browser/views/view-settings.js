import { bus } from '../systems/event-bus.js'
import { toast } from '../systems/toast.js'
import { ensureThemeStylesheetLink } from '../systems/theme-stylesheet.js'
import { parseCSVLines } from '../util/csv.js'

const APPEARANCE_STORAGE_KEY = 'gamectl.appearance'
const decoder = new TextDecoder()

/**
 * ViewSettings - Settings panel with tabbed interface
 * 
 * Three tabs:
 *   - Keybindings: Full editor for keyboard shortcuts
 *   - Appearance: Theme, font, size selectors
 *   - Plugins: Read-only listing of built-in plugins and views
 */
export class ViewSettings extends HTMLElement {
  static get viewMeta() { return { displayName: 'Settings', category: 'System' } }

  constructor() {
    super()
    this.activeTab = 'general'
    this._headerControlsElement = null
    this._renderToken = 0

    this.general = {
      backend: 'opfs',
      webdavUrl: ''
    }

    this.keybindings = {
      bindings: [],
      pendingChanges: new Map(),
      filterText: '',
      capturing: null,
      captureHandler: null,
      captureClickHandler: null
    }

    this.appearance = {
      settings: {},
      themeManifest: null
    }

    this.plugins = {
      plugins: [],
      views: [],
      pendingChanges: false
    }
  }

  connectedCallback() {
    this.setAttribute('tabindex', '0')

    this._mountHeaderControls()
    this.render()

    // Focus management
    this.addEventListener('focusin', () => {
      bus.emit('view:focus', { view: 'view-settings', mode: 'settings' })
    })

    this.addEventListener('focusout', () => {
      bus.emit('view:blur', { view: 'view-settings', mode: 'settings' })
    })
  }

  disconnectedCallback() {
    this._unmountHeaderControls()
    this.stopCapture()
  }

  _tabs() {
    return [
      { id: 'general', label: 'General' },
      { id: 'keybindings', label: 'Keybindings' },
      { id: 'appearance', label: 'Appearance' },
      { id: 'plugins', label: 'Plugins' },
    ]
  }

  _mountHeaderControls() {
    if (!this.parentElement) return

    if (!this._headerControlsElement) {
      this._headerControlsElement = document.createElement('div')
      this._headerControlsElement.setAttribute('slot', 'header-controls')
      this._headerControlsElement.setAttribute('aria-label', 'Settings tabs')
      this.parentElement.appendChild(this._headerControlsElement)
    }

    this._renderHeaderControls()
  }

  _renderHeaderControls() {
    if (!this._headerControlsElement) return
    this._headerControlsElement.innerHTML = ''

    this._tabs().forEach(tab => {
      const btn = document.createElement('button')
      btn.textContent = tab.label
      btn.dataset.tab = tab.id
      btn.setAttribute('aria-pressed', tab.id === this.activeTab ? 'true' : 'false')
      btn.disabled = tab.id === this.activeTab
      btn.addEventListener('click', () => this.switchTab(tab.id))
      this._headerControlsElement.appendChild(btn)
    })
  }

  _unmountHeaderControls() {
    if (this._headerControlsElement?.parentElement) {
      this._headerControlsElement.remove()
      this._headerControlsElement = null
    }
  }

  render() {
    const token = ++this._renderToken
    this.innerHTML = ''

    const content = document.createElement('section')
    this.appendChild(content)

    this.renderTabContent(content, token)
  }

  async renderTabContent(content, token) {
    if (token !== this._renderToken) return

    if (this.activeTab === 'general') {
      this.renderGeneral(content)
      return
    }

    if (this.activeTab === 'keybindings') {
      await this.loadKeybindings()
      if (token !== this._renderToken) return
      this.renderKeybindings(content)
      return
    }

    if (this.activeTab === 'appearance') {
      await this.loadAppearance()
      if (token !== this._renderToken) return
      this.renderAppearance(content)
      return
    }

    if (this.activeTab === 'plugins') {
      await this.loadPlugins()
      if (token !== this._renderToken) return
      this.renderPlugins(content)
    }
  }

  switchTab(tabId) {
    if (tabId === this.activeTab) return
    this.stopCapture()
    this.activeTab = tabId
    this._renderHeaderControls()
    this.render()
  }

  loadGeneralFromLocalStorage() {
    const url = localStorage.getItem('fs.webdav.url')
    if (url) {
      this.general.backend = 'webdav'
      this.general.webdavUrl = url
    } else {
      this.general.backend = 'opfs'
      this.general.webdavUrl = ''
    }
  }

  renderGeneral(content) {
    this.loadGeneralFromLocalStorage()

    const wrap = document.createElement('div')
    wrap.style.display = 'flex'
    wrap.style.flexDirection = 'column'
    wrap.style.gap = '12px'
    wrap.style.maxWidth = '760px'

    const section = document.createElement('fieldset')
    section.style.display = 'flex'
    section.style.flexDirection = 'column'
    section.style.gap = '12px'

    const legend = document.createElement('legend')
    legend.textContent = 'File Storage'
    section.appendChild(legend)

    const desc = document.createElement('p')
    desc.textContent = 'Choose where project files are stored. Changing the backend requires a page reload.'
    section.appendChild(desc)

    const backends = [
      {
        id: 'opfs',
        label: 'OPFS (Browser Storage)',
        desc: 'Origin Private File System. Files stored locally in the browser. No setup required.'
      },
      {
        id: 'webdav',
        label: 'WebDAV',
        desc: 'Remote file server via WebDAV protocol. Use rclone serve webdav for local dev.'
      }
    ]

    const radioGroup = document.createElement('div')
    radioGroup.style.display = 'flex'
    radioGroup.style.flexDirection = 'column'
    radioGroup.style.gap = '8px'

    for (const backend of backends) {
      const item = document.createElement('label')
      item.style.display = 'grid'
      item.style.gridTemplateColumns = '18px 1fr'
      item.style.alignItems = 'start'
      item.style.gap = '8px'
      item.style.padding = '8px'
      item.style.border = '1px solid var(--border)'
      item.style.borderRadius = '4px'

      const radio = document.createElement('input')
      radio.type = 'radio'
      radio.name = 'fs-backend'
      radio.value = backend.id
      radio.checked = backend.id === this.general.backend
      radio.addEventListener('change', () => {
        this.general.backend = backend.id
        webdavConfig.hidden = this.general.backend !== 'webdav'
      })

      const title = document.createElement('span')
      title.textContent = backend.label
      title.style.fontWeight = '600'

      const text = document.createElement('small')
      text.textContent = backend.desc
      text.style.display = 'block'
      text.style.marginTop = '2px'
      text.style.opacity = '0.85'

      const textWrap = document.createElement('span')
      textWrap.appendChild(title)
      textWrap.appendChild(text)

      item.appendChild(radio)
      item.appendChild(textWrap)
      radioGroup.appendChild(item)
    }
    section.appendChild(radioGroup)

    const webdavConfig = document.createElement('div')
    webdavConfig.hidden = this.general.backend !== 'webdav'
    webdavConfig.style.display = 'flex'
    webdavConfig.style.flexDirection = 'column'
    webdavConfig.style.gap = '6px'

    const urlLabel = document.createElement('label')
    urlLabel.style.display = 'flex'
    urlLabel.style.flexDirection = 'column'
    urlLabel.style.gap = '6px'

    const urlTitle = document.createElement('span')
    urlTitle.textContent = 'WebDAV URL'
    urlTitle.style.fontWeight = '600'

    const urlInput = document.createElement('input')
    urlInput.type = 'url'
    urlInput.placeholder = 'http://localhost:8080'
    urlInput.value = this.general.webdavUrl
    urlInput.addEventListener('input', (e) => {
      this.general.webdavUrl = e.target.value.trim()
    })

    const urlHint = document.createElement('small')
    urlHint.textContent = 'e.g. http://localhost:8080 for rclone serve webdav .'

    urlLabel.appendChild(urlTitle)
    urlLabel.appendChild(urlInput)
    urlLabel.appendChild(urlHint)
    webdavConfig.appendChild(urlLabel)
    section.appendChild(webdavConfig)

    const status = document.createElement('p')
    const currentUrl = localStorage.getItem('fs.webdav.url')
    status.textContent = currentUrl
      ? `Active: WebDAV (${currentUrl})`
      : 'Active: OPFS (Browser Storage)'
    status.style.margin = '0'
    status.style.padding = '8px 10px'
    status.style.border = '1px solid var(--border)'
    status.style.borderRadius = '4px'
    status.style.background = 'var(--surface)'
    section.appendChild(status)

    const applyBtn = document.createElement('button')
    applyBtn.textContent = 'Apply & Reload'
    applyBtn.style.alignSelf = 'flex-start'
    applyBtn.addEventListener('click', () => this.applyGeneral())
    section.appendChild(applyBtn)

    wrap.appendChild(section)
    content.appendChild(wrap)
  }

  applyGeneral() {
    if (this.general.backend === 'webdav') {
      if (!this.general.webdavUrl) {
        toast.error('WebDAV URL is required')
        return
      }
      localStorage.setItem('fs.webdav.url', this.general.webdavUrl)
    } else {
      localStorage.removeItem('fs.webdav.url')
    }

    toast.info('Reloading with new storage backend...')
    setTimeout(() => window.location.reload(), 500)
  }

  async loadKeybindings() {
    try {
      const result = await window.pluginManager.call(
        'sql', 'query',
        'SELECT id, mode, keys, event_name, event_data, description, enabled FROM keybindings ORDER BY mode, keys'
      )
      const csv = decoder.decode(result.output)
      const lines = parseCSVLines(csv.trim())

      if (lines.length < 2) {
        this.keybindings.bindings = []
        return
      }

      this.keybindings.bindings = []
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i]
        if (row.length < 7) continue
        this.keybindings.bindings.push({
          id: parseInt(row[0]),
          mode: row[1],
          keys: row[2],
          eventName: row[3],
          eventData: row[4] || '',
          description: row[5] || '',
          enabled: row[6] === '1'
        })
      }
    } catch (err) {
      console.error('[ViewSettings] Failed to load keybindings:', err)
      this.keybindings.bindings = []
    }
  }

  renderKeybindings(content) {
    const wrap = document.createElement('div')

    const toolbar = document.createElement('div')

    const searchInput = document.createElement('input')
    searchInput.type = 'text'
    searchInput.placeholder = 'Filter keybindings...'
    searchInput.value = this.keybindings.filterText
    searchInput.addEventListener('input', (e) => {
      this.keybindings.filterText = e.target.value.toLowerCase()
      this.renderKeybindingsList(list)
    })
    toolbar.appendChild(searchInput)

    const saveBtn = document.createElement('button')
    saveBtn.textContent = 'Save'
    saveBtn.addEventListener('click', () => this.saveKeybindings())
    toolbar.appendChild(saveBtn)

    wrap.appendChild(toolbar)

    const list = document.createElement('div')
    wrap.appendChild(list)
    this.renderKeybindingsList(list)

    content.appendChild(wrap)
  }

  renderKeybindingsList(listContainer) {
    listContainer.innerHTML = ''

    const groups = new Map()
    for (const b of this.keybindings.bindings) {
      if (this.keybindings.filterText) {
        const haystack = `${b.mode} ${b.keys} ${b.eventName} ${b.description}`.toLowerCase()
        if (!haystack.includes(this.keybindings.filterText)) continue
      }

      if (!groups.has(b.mode)) groups.set(b.mode, [])
      groups.get(b.mode).push(b)
    }

    if (groups.size === 0) {
      const empty = document.createElement('div')
      empty.textContent = this.keybindings.filterText ? 'No matching keybindings' : 'No keybindings defined'
      listContainer.appendChild(empty)
      return
    }

    for (const [mode, bindings] of groups) {
      const section = document.createElement('details')
      section.open = true

      const summary = document.createElement('summary')
      summary.textContent = mode
      section.appendChild(summary)

      const table = document.createElement('table')
      const thead = document.createElement('thead')
      thead.innerHTML = '<tr><th>On</th><th>Event</th><th>Description</th><th>Key</th><th></th></tr>'
      table.appendChild(thead)

      const tbody = document.createElement('tbody')
      for (const binding of bindings) {
        tbody.appendChild(this.createKeybindingRow(binding, listContainer))
      }
      table.appendChild(tbody)

      section.appendChild(table)
      listContainer.appendChild(section)
    }
  }

  createKeybindingRow(binding, listContainer) {
    const changes = this.keybindings.pendingChanges.get(binding.id) || {}
    const currentKeys = changes.keys ?? binding.keys
    const currentEnabled = changes.enabled ?? binding.enabled

    const tr = document.createElement('tr')

    const enabledCell = document.createElement('td')
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = currentEnabled
    checkbox.addEventListener('change', () => {
      if (!this.keybindings.pendingChanges.has(binding.id)) this.keybindings.pendingChanges.set(binding.id, {})
      this.keybindings.pendingChanges.get(binding.id).enabled = checkbox.checked
    })
    enabledCell.appendChild(checkbox)
    tr.appendChild(enabledCell)

    const eventCell = document.createElement('td')
    eventCell.textContent = binding.eventName
    tr.appendChild(eventCell)

    const descCell = document.createElement('td')
    descCell.textContent = binding.description
    tr.appendChild(descCell)

    const keysCell = document.createElement('td')
    const keysBtn = document.createElement('button')
    keysBtn.textContent = currentKeys || '-'
    keysBtn.title = 'Click to rebind'
    keysBtn.addEventListener('click', () => this.startCapture(binding, keysBtn, listContainer))
    keysCell.appendChild(keysBtn)
    tr.appendChild(keysCell)

    const actionsCell = document.createElement('td')
    const clearBtn = document.createElement('button')
    clearBtn.textContent = 'x'
    clearBtn.title = 'Clear key assignment'
    clearBtn.addEventListener('click', () => {
      if (!this.keybindings.pendingChanges.has(binding.id)) this.keybindings.pendingChanges.set(binding.id, {})
      this.keybindings.pendingChanges.get(binding.id).keys = ''
      this.renderKeybindingsList(listContainer)
    })
    actionsCell.appendChild(clearBtn)
    tr.appendChild(actionsCell)

    return tr
  }

  startCapture(binding, element, listContainer) {
    this.stopCapture()
    element.textContent = 'Press key...'
    this.keybindings.capturing = { binding, element }

    this.keybindings.captureHandler = (e) => {
      e.preventDefault()
      e.stopPropagation()

      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return

      const key = this.normalizeKey(e)
      if (!key) return

      if (!this.keybindings.pendingChanges.has(binding.id)) this.keybindings.pendingChanges.set(binding.id, {})
      this.keybindings.pendingChanges.get(binding.id).keys = key

      this.stopCapture()
      this.renderKeybindingsList(listContainer)
    }

    document.addEventListener('keydown', this.keybindings.captureHandler, true)

    this.keybindings.captureClickHandler = (e) => {
      if (e.target !== element) {
        this.cancelCapture()
        this.renderKeybindingsList(listContainer)
      }
    }
    setTimeout(() => {
      document.addEventListener('click', this.keybindings.captureClickHandler)
    }, 0)
  }

  stopCapture() {
    if (this.keybindings.captureHandler) {
      document.removeEventListener('keydown', this.keybindings.captureHandler, true)
      this.keybindings.captureHandler = null
    }
    if (this.keybindings.captureClickHandler) {
      document.removeEventListener('click', this.keybindings.captureClickHandler)
      this.keybindings.captureClickHandler = null
    }
    this.keybindings.capturing = null
  }

  cancelCapture() {
    this.stopCapture()
  }

  normalizeKey(event) {
    const specialKeys = {
      'Enter': 'CR', 'Escape': 'Esc', ' ': 'Space', 'Tab': 'Tab',
      'Backspace': 'BS', 'Delete': 'Del',
      'ArrowUp': 'Up', 'ArrowDown': 'Down', 'ArrowLeft': 'Left', 'ArrowRight': 'Right'
    }
    for (let i = 1; i <= 12; i++) specialKeys[`F${i}`] = `F${i}`

    const hasCmd = event.metaKey
    const hasAlt = event.altKey
    const hasShift = event.shiftKey
    const hasCtrl = event.ctrlKey

    if (specialKeys[event.key]) {
      const base = specialKeys[event.key]
      if (hasCmd || hasAlt || hasShift || hasCtrl) {
        let mod = '<'
        if (hasCmd) mod += 'C-'
        if (hasAlt) mod += 'M-'
        if (hasShift) mod += 'S-'
        if (hasCtrl) mod += 'D-'
        return mod + base + '>'
      }
      return '<' + base + '>'
    }

    if (hasCmd || hasAlt || hasCtrl) {
      let baseKey = event.key
      if (baseKey.length === 1 && baseKey >= 'A' && baseKey <= 'Z') baseKey = baseKey.toLowerCase()
      let mod = '<'
      if (hasCmd) mod += 'C-'
      if (hasAlt) mod += 'M-'
      if (hasShift) mod += 'S-'
      if (hasCtrl) mod += 'D-'
      return mod + baseKey + '>'
    }

    return event.key
  }

  async saveKeybindings() {
    try {
      for (const [id, changes] of this.keybindings.pendingChanges) {
        const parts = []
        if (changes.keys !== undefined) parts.push(`keys='${changes.keys.replace(/'/g, "''")}'`)
        if (changes.enabled !== undefined) parts.push(`enabled=${changes.enabled ? 1 : 0}`)
        if (parts.length > 0) {
          await window.pluginManager.call('sql', 'exec', `UPDATE keybindings SET ${parts.join(', ')} WHERE id=${id}`)
        }
      }

      this.keybindings.pendingChanges.clear()
      await this.loadKeybindings()
      this.render()

      if (window.keybindingManager) await window.keybindingManager.reloadBindings()
      toast.success('Keybindings saved')
    } catch (err) {
      console.error('[ViewSettings] Keybindings save failed:', err)
      toast.error('Failed to save keybindings')
    }
  }

  async loadAppearance() {
    if (!this.appearance.themeManifest) {
      this.appearance.themeManifest = await fetch('themes/themes.json').then(response => response.json())
    }

    const defaultTheme = this.appearance.themeManifest.defaultTheme
    const defaults = {
      'appearance.theme': defaultTheme,
      'appearance.font-family': 'default',
      'appearance.font-size': '14'
    }

    try {
      const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        this.appearance.settings = { ...defaults, ...parsed }
      } else {
        const result = await window.pluginManager.call('sql', 'query', "SELECT key, value FROM settings WHERE category='appearance'")
        const csv = decoder.decode(result.output)
        const lines = parseCSVLines(csv.trim())

        this.appearance.settings = { ...defaults }
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i]
          if (row.length >= 2) this.appearance.settings[row[0]] = row[1]
        }
      }
    } catch (err) {
      console.error('[ViewSettings] Failed to load appearance settings:', err)
      this.appearance.settings = defaults
    }

    this.applyTheme(this.appearance.settings['appearance.theme'])
    this.applyFontFamily(this.appearance.settings['appearance.font-family'] || 'default')
    this.applyFontSize(this.appearance.settings['appearance.font-size'] || '14')
  }

  renderAppearance(content) {
    const wrap = document.createElement('div')

    const themeSection = document.createElement('fieldset')
    const themeLegend = document.createElement('legend')
    themeLegend.textContent = 'Theme'
    themeSection.appendChild(themeLegend)
    const themeSelect = document.createElement('select')
    const themes = this.appearance.themeManifest.themes
    const activeTheme = this.appearance.settings['appearance.theme']
    Object.entries(themes).forEach(([value, theme]) => {
      const option = document.createElement('option')
      option.value = value
      option.textContent = theme.label
      option.selected = value === activeTheme
      themeSelect.appendChild(option)
    })
    themeSelect.addEventListener('change', (e) => {
      this.appearance.settings['appearance.theme'] = e.target.value
      this.applyTheme(e.target.value)
    })
    themeSection.appendChild(themeSelect)
    wrap.appendChild(themeSection)

    const fontSection = document.createElement('fieldset')
    const fontLegend = document.createElement('legend')
    fontLegend.textContent = 'Base Font Family'
    fontSection.appendChild(fontLegend)
    const fontSelect = document.createElement('select')
    const fonts = [
      { value: 'default', label: 'Theme Default' },
      { value: 'Roboto, sans-serif', label: 'Roboto' },
      { value: 'JetBrains Mono, monospace', label: 'JetBrains Mono' },
      { value: 'IBM Plex Mono, monospace', label: 'IBM Plex Mono' },
      { value: 'sans-serif', label: 'System Sans' },
      { value: 'monospace', label: 'System Mono' }
    ]
    fonts.forEach(font => {
      const option = document.createElement('option')
      option.value = font.value
      option.textContent = font.label
      if (font.value !== 'default') option.style.fontFamily = font.value
      option.selected = font.value === (this.appearance.settings['appearance.font-family'] || 'default')
      fontSelect.appendChild(option)
    })
    fontSelect.addEventListener('change', (e) => {
      this.appearance.settings['appearance.font-family'] = e.target.value
      this.applyFontFamily(e.target.value)
    })
    fontSection.appendChild(fontSelect)
    wrap.appendChild(fontSection)

    const sizeSection = document.createElement('fieldset')
    const sizeLegend = document.createElement('legend')
    sizeLegend.textContent = 'Font Size'
    sizeSection.appendChild(sizeLegend)
    const row = document.createElement('div')
    const slider = document.createElement('input')
    slider.type = 'range'
    slider.min = '10'
    slider.max = '24'
    slider.step = '1'
    slider.value = this.appearance.settings['appearance.font-size'] || '14'
    const display = document.createElement('output')
    display.textContent = `${slider.value}px`
    slider.addEventListener('input', (e) => {
      display.textContent = `${e.target.value}px`
      this.appearance.settings['appearance.font-size'] = e.target.value
      this.applyFontSize(e.target.value)
    })
    row.appendChild(slider)
    row.appendChild(display)
    sizeSection.appendChild(row)
    wrap.appendChild(sizeSection)

    const actions = document.createElement('div')
    const saveBtn = document.createElement('button')
    saveBtn.textContent = 'Save'
    saveBtn.addEventListener('click', () => this.saveAppearance())
    const resetBtn = document.createElement('button')
    resetBtn.textContent = 'Reset to Default'
    resetBtn.addEventListener('click', () => this.resetAppearanceDefaults())
    actions.appendChild(saveBtn)
    actions.appendChild(resetBtn)
    wrap.appendChild(actions)

    content.appendChild(wrap)
  }

  applyTheme(value) {
    if (typeof window.__applyThemeStylesheet === 'function') {
      window.__applyThemeStylesheet(value)
      return
    }

    const themeKey = this.appearance.themeManifest.themes[value] ? value : this.appearance.themeManifest.defaultTheme
    const href = this.appearance.themeManifest.themes[themeKey]?.href
    if (!href) return

    const documentLink = ensureThemeStylesheetLink(document)
    if (documentLink) documentLink.setAttribute('href', href)

    document.querySelectorAll('view-area, view-popup').forEach(el => {
      const link = ensureThemeStylesheetLink(el.shadowRoot)
      if (link) link.setAttribute('href', href)
    })
  }

  applyFontFamily(value) {
    if (!value || value === 'default') {
      document.documentElement.style.removeProperty('--ui-font-body-override')
      document.documentElement.style.removeProperty('--ui-font-body')
      return
    }

    document.documentElement.style.setProperty('--ui-font-body-override', value)
    document.documentElement.style.setProperty('--ui-font-body', value)
  }

  applyFontSize(value) {
    document.documentElement.style.setProperty('--font-size-md', `${value}px`)
  }

  saveAppearance() {
    try {
      localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(this.appearance.settings))
      this.applyTheme(this.appearance.settings['appearance.theme'])
      this.applyFontFamily(this.appearance.settings['appearance.font-family'] || 'default')
      this.applyFontSize(this.appearance.settings['appearance.font-size'] || '14')
      toast.success('Appearance settings saved locally')
    } catch (err) {
      console.error('[ViewSettings] Appearance save failed:', err)
      toast.error('Failed to save appearance settings')
    }
  }

  resetAppearanceDefaults() {
    const defaultTheme = this.appearance.themeManifest.defaultTheme
    this.appearance.settings = {
      'appearance.theme': defaultTheme,
      'appearance.font-family': 'default',
      'appearance.font-size': '14'
    }
    this.applyTheme(defaultTheme)
    this.applyFontFamily('default')
    this.applyFontSize('14')
    this.render()
  }

  async loadPlugins() {
    try {
      const [pluginsResult, viewsResult] = await Promise.all([
        window.pluginManager.call('sql', 'query', 'SELECT name, url, version, enabled, type, scope FROM plugins ORDER BY type, rowid'),
        window.pluginManager.call('sql', 'query', 'SELECT name, url, enabled, type FROM views ORDER BY type, rowid')
      ])

      this.plugins.plugins = this.parsePluginsCsv(decoder.decode(pluginsResult.output))
      this.plugins.views = this.parseViewsCsv(decoder.decode(viewsResult.output))
    } catch (error) {
      console.error('[ViewSettings] Failed to load plugins/views:', error)
      this.plugins.plugins = []
      this.plugins.views = []
    }
  }

  parsePluginsCsv(csv) {
    const lines = csv.trim().split('\n')
    const result = []
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const firstComma = line.indexOf(',')
      const lastComma = line.lastIndexOf(',')
      if (firstComma === -1 || lastComma === -1) continue

      const secondLastComma = line.lastIndexOf(',', lastComma - 1)
      const thirdLastComma = line.lastIndexOf(',', secondLastComma - 1)
      const fourthLastComma = line.lastIndexOf(',', thirdLastComma - 1)
      if (secondLastComma === -1 || thirdLastComma === -1 || fourthLastComma === -1) continue

      result.push({
        name: line.slice(0, firstComma),
        url: line.slice(firstComma + 1, fourthLastComma),
        version: line.slice(fourthLastComma + 1, thirdLastComma),
        enabled: line.slice(thirdLastComma + 1, secondLastComma) === '1',
        type: line.slice(secondLastComma + 1, lastComma),
        scope: line.slice(lastComma + 1)
      })
    }
    return result
  }

  parseViewsCsv(csv) {
    const lines = csv.trim().split('\n')
    const result = []
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      const lastComma = line.lastIndexOf(',')
      const secondLastComma = line.lastIndexOf(',', lastComma - 1)
      const firstComma = line.indexOf(',')
      if (lastComma === -1 || secondLastComma === -1 || firstComma === -1) continue

      result.push({
        name: line.slice(0, firstComma),
        url: line.slice(firstComma + 1, secondLastComma),
        enabled: line.slice(secondLastComma + 1, lastComma) === '1',
        type: line.slice(lastComma + 1)
      })
    }
    return result
  }

  renderPlugins(content) {
    const wrap = document.createElement('div')

    if (this.plugins.pendingChanges) {
      const banner = document.createElement('fieldset')
      const legend = document.createElement('legend')
      legend.textContent = 'Restart Required'
      banner.appendChild(legend)

      const row = document.createElement('div')
      const text = document.createElement('span')
      text.textContent = 'Changes require a restart to take effect'
      const btn = document.createElement('button')
      btn.textContent = 'Restart Now'
      btn.addEventListener('click', () => {
        bus.emit('file:save')
        setTimeout(() => window.location.reload(), 500)
      })
      row.appendChild(text)
      row.appendChild(btn)
      banner.appendChild(row)
      wrap.appendChild(banner)
    }

    wrap.appendChild(this.renderAddEntrySection('Plugin', 'plugins', true))
    wrap.appendChild(this.renderRegistrySection('Plugin Registry', this.plugins.plugins, 'plugins'))
    wrap.appendChild(this.renderAddEntrySection('View', 'views', false))
    wrap.appendChild(this.renderRegistrySection('View Registry', this.plugins.views, 'views'))

    content.appendChild(wrap)
  }

  renderAddEntrySection(label, table, includeScope) {
    const section = document.createElement('fieldset')
    const legend = document.createElement('legend')
    legend.textContent = `Add ${label}`
    section.appendChild(legend)

    const form = document.createElement('div')

    const nameInput = document.createElement('input')
    nameInput.type = 'text'
    nameInput.placeholder = `${label} name`
    form.appendChild(nameInput)

    const urlInput = document.createElement('input')
    urlInput.type = 'text'
    urlInput.placeholder = 'URL'
    form.appendChild(urlInput)

    let scopeInput = null
    if (includeScope) {
      scopeInput = document.createElement('select')
      const globalOption = document.createElement('option')
      globalOption.value = 'global'
      globalOption.textContent = 'Global'
      const viewOption = document.createElement('option')
      viewOption.value = 'view'
      viewOption.textContent = 'View'
      scopeInput.appendChild(globalOption)
      scopeInput.appendChild(viewOption)
      form.appendChild(scopeInput)
    }

    const addBtn = document.createElement('button')
    addBtn.textContent = 'Add'
    addBtn.addEventListener('click', () => this.addEntry(table, nameInput, urlInput, scopeInput))
    form.appendChild(addBtn)

    section.appendChild(form)
    return section
  }

  renderRegistrySection(title, entries, table) {
    const section = document.createElement('fieldset')
    const legend = document.createElement('legend')
    legend.textContent = title
    section.appendChild(legend)

    if (table === 'plugins') {
      const note = document.createElement('p')
      note.textContent = 'fs [HOST] Filesystem - always available (JavaScript host functions)'
      section.appendChild(note)
    }

    const tbl = document.createElement('table')
    const thead = document.createElement('thead')
    thead.innerHTML = `<tr><th>Name</th><th>URL</th><th>Type</th>${table === 'plugins' ? '<th>Scope</th>' : ''}<th>Status</th><th>Actions</th></tr>`
    tbl.appendChild(thead)

    const tbody = document.createElement('tbody')
    for (const entry of entries) {
      tbody.appendChild(this.renderRegistryRow(entry, table))
    }
    tbl.appendChild(tbody)

    section.appendChild(tbl)
    return section
  }

  renderRegistryRow(entry, table) {
    const tr = document.createElement('tr')

    const nameCell = document.createElement('td')
    nameCell.textContent = entry.name
    tr.appendChild(nameCell)

    const urlCell = document.createElement('td')
    urlCell.textContent = entry.url
    urlCell.title = entry.url
    tr.appendChild(urlCell)

    const typeCell = document.createElement('td')
    typeCell.textContent = entry.type
    tr.appendChild(typeCell)

    if (table === 'plugins') {
      const scopeCell = document.createElement('td')
      scopeCell.textContent = entry.scope || 'global'
      tr.appendChild(scopeCell)
    }

    const statusCell = document.createElement('td')
    statusCell.textContent = entry.enabled ? 'Enabled' : 'Disabled'
    tr.appendChild(statusCell)

    const actionsCell = document.createElement('td')
    if (entry.type === 'base') {
      const lock = document.createElement('span')
      lock.textContent = 'locked'
      lock.title = 'Base entry - cannot be disabled'
      actionsCell.appendChild(lock)
    } else {
      const toggleBtn = document.createElement('button')
      toggleBtn.textContent = entry.enabled ? 'Disable' : 'Enable'
      toggleBtn.addEventListener('click', () => this.toggleEntry(table, entry))
      actionsCell.appendChild(toggleBtn)

      if (entry.type === 'user') {
        const deleteBtn = document.createElement('button')
        deleteBtn.textContent = 'Remove'
        deleteBtn.addEventListener('click', () => this.deleteEntry(table, entry))
        actionsCell.appendChild(deleteBtn)
      }
    }
    tr.appendChild(actionsCell)

    return tr
  }

  async addEntry(table, nameInput, urlInput, scopeInput) {
    const name = nameInput.value.trim()
    const url = urlInput.value.trim()

    if (!name) return toast.error('Name is required')
    if (!url) return toast.error('URL is required')

    const list = table === 'plugins' ? this.plugins.plugins : this.plugins.views
    if (list.find(e => e.name === name)) return toast.error(`'${name}' already exists`)

    try {
      const escapedName = name.replace(/'/g, "''")
      const escapedUrl = url.replace(/'/g, "''")
      if (table === 'plugins') {
        const scope = (scopeInput?.value || 'global').replace(/'/g, "''")
        await window.pluginManager.call('sql', 'exec',
          `INSERT INTO plugins (name, url, type, enabled, scope) VALUES ('${escapedName}', '${escapedUrl}', 'user', 1, '${scope}')`
        )
      } else {
        await window.pluginManager.call('sql', 'exec',
          `INSERT INTO views (name, url, type, enabled) VALUES ('${escapedName}', '${escapedUrl}', 'user', 1)`
        )
      }

      nameInput.value = ''
      urlInput.value = ''
      this.plugins.pendingChanges = true
      toast.success(`'${name}' added`)
      await this.loadPlugins()
      this.render()
    } catch (error) {
      console.error('[ViewSettings] Failed to add entry:', error)
      toast.error('Failed to add entry')
    }
  }

  async toggleEntry(table, entry) {
    const newEnabled = entry.enabled ? 0 : 1
    const escapedName = entry.name.replace(/'/g, "''")

    try {
      await window.pluginManager.call('sql', 'exec',
        `UPDATE ${table} SET enabled = ${newEnabled} WHERE name = '${escapedName}'`
      )

      this.plugins.pendingChanges = true
      toast.success(`'${entry.name}' ${newEnabled ? 'enabled' : 'disabled'}`)
      await this.loadPlugins()
      this.render()
    } catch (error) {
      console.error('[ViewSettings] Failed to toggle entry:', error)
      toast.error('Failed to update entry')
    }
  }

  async deleteEntry(table, entry) {
    if (entry.type !== 'user') {
      toast.error('Only user entries can be removed')
      return
    }

    const escapedName = entry.name.replace(/'/g, "''")

    try {
      await window.pluginManager.call('sql', 'exec',
        `DELETE FROM ${table} WHERE name = '${escapedName}' AND type = 'user'`
      )

      this.plugins.pendingChanges = true
      toast.success(`'${entry.name}' removed`)
      await this.loadPlugins()
      this.render()
    } catch (error) {
      console.error('[ViewSettings] Failed to delete entry:', error)
      toast.error('Failed to remove entry')
    }
  }
}

export default ViewSettings
