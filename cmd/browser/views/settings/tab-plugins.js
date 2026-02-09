import { bus } from '../../systems/event-bus.js'
import { toast } from '../../systems/toast.js'

/**
 * SettingsTabPlugins
 * 
 * Full plugin management UI:
 * - Shows all plugins from the SQL registry (plugins table)
 * - Base plugins (fs, sql): shown with lock icon, cannot be disabled
 * - Built-in plugins: can be enabled/disabled
 * - User plugins: can be enabled/disabled and deleted
 * - Add new plugin by URL + name
 * - Restart banner when changes require reload
 * - Registered views section (runtime custom element discovery)
 */

const decoder = new TextDecoder()

class SettingsTabPlugins extends HTMLElement {
  constructor() {
    super()
    this.plugins = []
    this.pendingChanges = false
  }

  connectedCallback() {
    this.style.display = 'block'
    this.style.height = '100%'
    this.style.overflow = 'auto'

    this.loadPlugins()
  }

  async loadPlugins() {
    try {
      const result = await window.pluginManager.call('sql', 'query',
        'SELECT name, url, version, enabled, type FROM plugins ORDER BY type, rowid'
      )
      const csv = decoder.decode(result.output).trim()
      const lines = csv.split('\n')

      this.plugins = []
      // Parse CSV: name,url,version,enabled,type
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        const parts = line.split(',')
        if (parts.length < 5) continue
        this.plugins.push({
          name: parts[0],
          url: parts[1],
          version: parts[2],
          enabled: parts[3] === '1',
          type: parts[4]
        })
      }

      this.render()
    } catch (error) {
      console.error('[Plugins] Failed to load plugins:', error)
      this.innerHTML = '<div class="settings-plugins-placeholder">Failed to load plugin registry</div>'
    }
  }

  render() {
    this.innerHTML = ''

    const container = document.createElement('div')
    container.className = 'settings-plugins-container'

    // Restart banner (hidden by default)
    if (this.pendingChanges) {
      container.appendChild(this.renderRestartBanner())
    }

    // Add plugin form
    container.appendChild(this.renderAddSection())

    // Plugin registry table
    container.appendChild(this.renderPluginsSection())

    // Registered views section
    container.appendChild(this.renderViewsSection())

    this.appendChild(container)
  }

  renderRestartBanner() {
    const banner = document.createElement('div')
    banner.className = 'settings-plugins-restart-banner'

    const text = document.createElement('span')
    text.textContent = 'Plugin changes require a restart to take effect'

    const btn = document.createElement('button')
    btn.className = 'button-primary'
    btn.textContent = 'Restart Now'
    btn.addEventListener('click', async () => {
      // Save database before reload
      bus.emit('file:save')
      setTimeout(() => window.location.reload(), 500)
    })

    banner.appendChild(text)
    banner.appendChild(btn)
    return banner
  }

  renderAddSection() {
    const section = document.createElement('div')
    section.className = 'settings-plugins-section'

    const header = document.createElement('h3')
    header.className = 'settings-plugins-section-header'
    header.textContent = 'Add Plugin'
    section.appendChild(header)

    const form = document.createElement('div')
    form.className = 'settings-plugins-add-form'

    const nameInput = document.createElement('input')
    nameInput.type = 'text'
    nameInput.className = 'settings-plugins-input'
    nameInput.placeholder = 'Plugin name (e.g. my-plugin)'
    nameInput.dataset.field = 'name'

    const urlInput = document.createElement('input')
    urlInput.type = 'text'
    urlInput.className = 'settings-plugins-input'
    urlInput.placeholder = 'URL (e.g. http://example.com/plugin.wasm, local:/plugins/x.wasm)'
    urlInput.dataset.field = 'url'

    const addBtn = document.createElement('button')
    addBtn.className = 'button-primary'
    addBtn.textContent = 'Add'
    addBtn.addEventListener('click', () => this.addPlugin(nameInput, urlInput))

    form.appendChild(nameInput)
    form.appendChild(urlInput)
    form.appendChild(addBtn)
    section.appendChild(form)

    return section
  }

  async addPlugin(nameInput, urlInput) {
    const name = nameInput.value.trim()
    const url = urlInput.value.trim()

    if (!name) {
      toast.error('Plugin name is required')
      return
    }
    if (!url) {
      toast.error('Plugin URL is required')
      return
    }

    // Check for duplicate
    if (this.plugins.find(p => p.name === name)) {
      toast.error(`Plugin '${name}' already exists`)
      return
    }

    try {
      const escapedName = name.replace(/'/g, "''")
      const escapedUrl = url.replace(/'/g, "''")
      await window.pluginManager.call('sql', 'exec',
        `INSERT INTO plugins (name, url, type, enabled) VALUES ('${escapedName}', '${escapedUrl}', 'user', 1)`
      )

      nameInput.value = ''
      urlInput.value = ''

      this.pendingChanges = true
      toast.success(`Plugin '${name}' added`)

      await this.loadPlugins()
    } catch (error) {
      console.error('[Plugins] Failed to add plugin:', error)
      toast.error('Failed to add plugin')
    }
  }

  renderPluginsSection() {
    const section = document.createElement('div')
    section.className = 'settings-plugins-section'

    const header = document.createElement('h3')
    header.className = 'settings-plugins-section-header'
    header.textContent = 'Plugin Registry'
    section.appendChild(header)

    // FS is a host function, not in DB - show it as a special row
    const fsNote = document.createElement('div')
    fsNote.className = 'settings-plugins-fs-note'
    fsNote.innerHTML = '<span class="settings-plugins-name">fs</span> <span class="settings-plugins-badge settings-plugins-badge-base">HOST</span> <span>Filesystem — always available (JavaScript host functions)</span>'
    section.appendChild(fsNote)

    const table = document.createElement('table')
    table.className = 'settings-plugins-table'

    const thead = document.createElement('thead')
    thead.innerHTML = `<tr>
      <th>Plugin</th>
      <th>URL</th>
      <th>Type</th>
      <th>Status</th>
      <th>Actions</th>
    </tr>`
    table.appendChild(thead)

    const tbody = document.createElement('tbody')
    for (const p of this.plugins) {
      tbody.appendChild(this.renderPluginRow(p))
    }
    table.appendChild(tbody)
    section.appendChild(table)

    return section
  }

  renderPluginRow(plugin) {
    const tr = document.createElement('tr')

    // Name
    const nameCell = document.createElement('td')
    nameCell.className = 'settings-plugins-name'
    nameCell.textContent = plugin.name
    tr.appendChild(nameCell)

    // URL
    const urlCell = document.createElement('td')
    urlCell.className = 'settings-plugins-url'
    urlCell.textContent = plugin.url
    urlCell.title = plugin.url
    tr.appendChild(urlCell)

    // Type badge
    const typeCell = document.createElement('td')
    const typeBadge = document.createElement('span')
    typeBadge.className = `settings-plugins-badge settings-plugins-badge-${plugin.type}`
    typeBadge.textContent = plugin.type
    typeCell.appendChild(typeBadge)
    tr.appendChild(typeCell)

    // Status
    const statusCell = document.createElement('td')
    const statusBadge = document.createElement('span')
    if (plugin.enabled) {
      statusBadge.className = 'settings-plugins-status-active'
      statusBadge.textContent = 'Enabled'
    } else {
      statusBadge.className = 'settings-plugins-status-inactive'
      statusBadge.textContent = 'Disabled'
    }
    statusCell.appendChild(statusBadge)
    tr.appendChild(statusCell)

    // Actions
    const actionsCell = document.createElement('td')
    actionsCell.className = 'settings-plugins-actions'

    if (plugin.type === 'base') {
      // Base plugins: lock icon, no actions
      const lock = document.createElement('span')
      lock.className = 'settings-plugins-lock'
      lock.textContent = 'locked'
      lock.title = 'Base plugin — cannot be disabled'
      actionsCell.appendChild(lock)
    } else {
      // Toggle enable/disable
      const toggleBtn = document.createElement('button')
      toggleBtn.className = 'settings-plugins-toggle'
      toggleBtn.textContent = plugin.enabled ? 'Disable' : 'Enable'
      toggleBtn.addEventListener('click', () => this.togglePlugin(plugin))
      actionsCell.appendChild(toggleBtn)

      // Delete button (only for user plugins)
      if (plugin.type === 'user') {
        const deleteBtn = document.createElement('button')
        deleteBtn.className = 'settings-plugins-delete'
        deleteBtn.textContent = 'Remove'
        deleteBtn.addEventListener('click', () => this.deletePlugin(plugin))
        actionsCell.appendChild(deleteBtn)
      }
    }

    tr.appendChild(actionsCell)
    return tr
  }

  async togglePlugin(plugin) {
    const newEnabled = plugin.enabled ? 0 : 1
    const escapedName = plugin.name.replace(/'/g, "''")

    try {
      await window.pluginManager.call('sql', 'exec',
        `UPDATE plugins SET enabled = ${newEnabled} WHERE name = '${escapedName}'`
      )

      this.pendingChanges = true
      toast.success(`Plugin '${plugin.name}' ${newEnabled ? 'enabled' : 'disabled'}`)

      await this.loadPlugins()
    } catch (error) {
      console.error('[Plugins] Failed to toggle plugin:', error)
      toast.error('Failed to update plugin')
    }
  }

  async deletePlugin(plugin) {
    if (plugin.type !== 'user') {
      toast.error('Only user plugins can be removed')
      return
    }

    const escapedName = plugin.name.replace(/'/g, "''")

    try {
      await window.pluginManager.call('sql', 'exec',
        `DELETE FROM plugins WHERE name = '${escapedName}' AND type = 'user'`
      )

      this.pendingChanges = true
      toast.success(`Plugin '${plugin.name}' removed`)

      await this.loadPlugins()
    } catch (error) {
      console.error('[Plugins] Failed to delete plugin:', error)
      toast.error('Failed to remove plugin')
    }
  }

  renderViewsSection() {
    const section = document.createElement('div')
    section.className = 'settings-plugins-section'

    const header = document.createElement('h3')
    header.className = 'settings-plugins-section-header'
    header.textContent = 'Registered Views'
    section.appendChild(header)

    // Discover all registered view-* custom elements
    const viewElements = []
    const knownViews = [
      'view-nodegraph', 'view-tree', 'view-tilemap', 'view-skeleton', 'view-timeline',
      'view-console', 'view-sql-console', 'view-sql-table', 'view-sql-tables',
      'view-files', 'view-pipeline', 'view-opr-unit-builder',
      'view-sprite-extractor', 'view-sprite-packer', 'view-tile-extractor',
      'view-animation-editor', 'view-settings',
    ]

    for (const tag of knownViews) {
      const registered = customElements.get(tag) !== undefined
      viewElements.push({ tag, registered })
    }

    const table = document.createElement('table')
    table.className = 'settings-plugins-table'

    const thead = document.createElement('thead')
    thead.innerHTML = `<tr>
      <th>View Tag</th>
      <th>Status</th>
    </tr>`
    table.appendChild(thead)

    const tbody = document.createElement('tbody')
    for (const v of viewElements) {
      const tr = document.createElement('tr')

      const nameCell = document.createElement('td')
      nameCell.className = 'settings-plugins-name'
      nameCell.textContent = v.tag
      tr.appendChild(nameCell)

      const statusCell = document.createElement('td')
      const badge = document.createElement('span')
      badge.className = v.registered ? 'settings-plugins-status-active' : 'settings-plugins-status-inactive'
      badge.textContent = v.registered ? 'Registered' : 'Not Found'
      statusCell.appendChild(badge)
      tr.appendChild(statusCell)

      tbody.appendChild(tr)
    }
    table.appendChild(tbody)
    section.appendChild(table)

    return section
  }
}

customElements.define('settings-tab-plugins', SettingsTabPlugins)
