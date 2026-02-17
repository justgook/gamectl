import { bus } from '../../systems/event-bus.js'
import { toast } from '../../systems/toast.js'

/**
 * SettingsTabPlugins
 *
 * Full plugin and view management UI:
 * - Shows all plugins from the SQL plugins table
 * - Shows all views from the SQL views table
 * - Base entries: shown with lock icon, cannot be disabled
 * - Built-in entries: can be enabled/disabled
 * - User entries: can be enabled/disabled and deleted
 * - Add new plugin/view by URL + name
 * - Restart banner when changes require reload
 */

const decoder = new TextDecoder()

class SettingsTabPlugins extends HTMLElement {
  constructor() {
    super()
    this.plugins = []
    this.views = []
    this.pendingChanges = false
  }

  connectedCallback() {
    this.style.display = 'block'
    this.style.height = '100%'
    this.style.overflow = 'auto'

    this.loadData()
  }

  async loadData() {
    try {
      const [pluginsResult, viewsResult] = await Promise.all([
        window.pluginManager.call('sql', 'query',
          'SELECT name, url, version, enabled, type, scope FROM plugins ORDER BY type, rowid'
        ),
        window.pluginManager.call('sql', 'query',
          'SELECT name, url, enabled, type FROM views ORDER BY type, rowid'
        )
      ])

      this.plugins = this.parsePluginsCsv(decoder.decode(pluginsResult.output))
      this.views = this.parseViewsCsv(decoder.decode(viewsResult.output))

      this.render()
    } catch (error) {
      console.error('[Plugins] Failed to load data:', error)
      this.innerHTML = '<div class="settings-plugins-placeholder">Failed to load plugin/view registry</div>'
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
    // CSV columns: name,url,enabled,type
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      // Split from the right: type is last, enabled is second-to-last
      // URL is between first comma and second-to-last comma
      const lastComma = line.lastIndexOf(',')
      if (lastComma === -1) continue
      const secondLastComma = line.lastIndexOf(',', lastComma - 1)
      if (secondLastComma === -1) continue
      const firstComma = line.indexOf(',')
      if (firstComma === -1) continue

      result.push({
        name: line.slice(0, firstComma),
        url: line.slice(firstComma + 1, secondLastComma),
        enabled: line.slice(secondLastComma + 1, lastComma) === '1',
        type: line.slice(lastComma + 1)
      })
    }
    return result
  }

  render() {
    this.innerHTML = ''

    const container = document.createElement('div')
    container.className = 'settings-plugins-container'

    // Restart banner
    if (this.pendingChanges) {
      container.appendChild(this.renderRestartBanner())
    }

    // Add plugin form
    container.appendChild(this.renderAddSection('Plugin', 'plugins',
      'Plugin name (e.g. my-plugin)',
      'URL (e.g. http://example.com/plugin.wasm, local:/plugins/x.wasm)',
      { includeScope: true }
    ))

    // Plugin registry table
    container.appendChild(this.renderRegistrySection('Plugin Registry', this.plugins, 'plugins'))

    // Add view form
    container.appendChild(this.renderAddSection('View', 'views',
      'View name (e.g. my-view)',
      'URL (e.g. http://example.com/view.js, local:/views/view-x.js)'
    ))

    // View registry table
    container.appendChild(this.renderRegistrySection('View Registry', this.views, 'views'))

    this.appendChild(container)
  }

  renderRestartBanner() {
    const banner = document.createElement('div')
    banner.className = 'settings-plugins-restart-banner'

    const text = document.createElement('span')
    text.textContent = 'Changes require a restart to take effect'

    const btn = document.createElement('button')
    btn.className = 'button-primary'
    btn.textContent = 'Restart Now'
    btn.addEventListener('click', async () => {
      bus.emit('file:save')
      setTimeout(() => window.location.reload(), 500)
    })

    banner.appendChild(text)
    banner.appendChild(btn)
    return banner
  }

  renderAddSection(label, table, namePlaceholder, urlPlaceholder, options = {}) {
    const section = document.createElement('div')
    section.className = 'settings-plugins-section'

    const header = document.createElement('h3')
    header.className = 'settings-plugins-section-header'
    header.textContent = `Add ${label}`
    section.appendChild(header)

    const form = document.createElement('div')
    form.className = 'settings-plugins-add-form'

    const nameInput = document.createElement('input')
    nameInput.type = 'text'
    nameInput.className = 'settings-plugins-input'
    nameInput.placeholder = namePlaceholder

    const urlInput = document.createElement('input')
    urlInput.type = 'text'
    urlInput.className = 'settings-plugins-input'
    urlInput.placeholder = urlPlaceholder

    let scopeInput = null
    if (table === 'plugins' && options.includeScope) {
      scopeInput = document.createElement('select')
      scopeInput.className = 'settings-plugins-input'

      const globalOption = document.createElement('option')
      globalOption.value = 'global'
      globalOption.textContent = 'Global'

      const viewOption = document.createElement('option')
      viewOption.value = 'view'
      viewOption.textContent = 'View'

      scopeInput.appendChild(globalOption)
      scopeInput.appendChild(viewOption)
    }

    const addBtn = document.createElement('button')
    addBtn.className = 'button-primary'
    addBtn.textContent = 'Add'
    addBtn.addEventListener('click', () => this.addEntry(table, nameInput, urlInput, scopeInput))

    form.appendChild(nameInput)
    form.appendChild(urlInput)
    if (scopeInput) {
      form.appendChild(scopeInput)
    }
    form.appendChild(addBtn)
    section.appendChild(form)

    return section
  }

  async addEntry(table, nameInput, urlInput, scopeInput) {
    const name = nameInput.value.trim()
    const url = urlInput.value.trim()

    if (!name) {
      toast.error('Name is required')
      return
    }
    if (!url) {
      toast.error('URL is required')
      return
    }

    const list = table === 'plugins' ? this.plugins : this.views
    if (list.find(e => e.name === name)) {
      toast.error(`'${name}' already exists`)
      return
    }

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
          `INSERT INTO ${table} (name, url, type, enabled) VALUES ('${escapedName}', '${escapedUrl}', 'user', 1)`
        )
      }

      nameInput.value = ''
      urlInput.value = ''

      this.pendingChanges = true
      toast.success(`'${name}' added`)

      await this.loadData()
    } catch (error) {
      console.error(`[Plugins] Failed to add ${table} entry:`, error)
      toast.error(`Failed to add entry`)
    }
  }

  renderRegistrySection(title, entries, table) {
    const section = document.createElement('div')
    section.className = 'settings-plugins-section'

    const header = document.createElement('h3')
    header.className = 'settings-plugins-section-header'
    header.textContent = title
    section.appendChild(header)

    // FS note (only for plugins)
    if (table === 'plugins') {
      const fsNote = document.createElement('div')
      fsNote.className = 'settings-plugins-fs-note'
      fsNote.innerHTML = '<span class="settings-plugins-name">fs</span> <span class="settings-plugins-badge settings-plugins-badge-base">HOST</span> <span>Filesystem — always available (JavaScript host functions)</span>'
      section.appendChild(fsNote)
    }

    const tbl = document.createElement('table')
    tbl.className = 'settings-plugins-table'

    const thead = document.createElement('thead')
    thead.innerHTML = `<tr>
      <th>Name</th>
      <th>URL</th>
      <th>Type</th>
      ${table === 'plugins' ? '<th>Scope</th>' : ''}
      <th>Status</th>
      <th>Actions</th>
    </tr>`
    tbl.appendChild(thead)

    const tbody = document.createElement('tbody')
    for (const entry of entries) {
      tbody.appendChild(this.renderEntryRow(entry, table))
    }
    tbl.appendChild(tbody)
    section.appendChild(tbl)

    return section
  }

  renderEntryRow(entry, table) {
    const tr = document.createElement('tr')

    // Name
    const nameCell = document.createElement('td')
    nameCell.className = 'settings-plugins-name'
    nameCell.textContent = entry.name
    tr.appendChild(nameCell)

    // URL
    const urlCell = document.createElement('td')
    urlCell.className = 'settings-plugins-url'
    urlCell.textContent = entry.url
    urlCell.title = entry.url
    tr.appendChild(urlCell)

    // Type badge
    const typeCell = document.createElement('td')
    const typeBadge = document.createElement('span')
    typeBadge.className = `settings-plugins-badge settings-plugins-badge-${entry.type}`
    typeBadge.textContent = entry.type
    typeCell.appendChild(typeBadge)
    tr.appendChild(typeCell)

    if (table === 'plugins') {
      const scopeCell = document.createElement('td')
      scopeCell.textContent = entry.scope || 'global'
      tr.appendChild(scopeCell)
    }

    // Status
    const statusCell = document.createElement('td')
    const statusBadge = document.createElement('span')
    if (entry.enabled) {
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

    if (entry.type === 'base') {
      const lock = document.createElement('span')
      lock.className = 'settings-plugins-lock'
      lock.textContent = 'locked'
      lock.title = 'Base entry — cannot be disabled'
      actionsCell.appendChild(lock)
    } else {
      const toggleBtn = document.createElement('button')
      toggleBtn.className = 'settings-plugins-toggle'
      toggleBtn.textContent = entry.enabled ? 'Disable' : 'Enable'
      toggleBtn.addEventListener('click', () => this.toggleEntry(table, entry))
      actionsCell.appendChild(toggleBtn)

      if (entry.type === 'user') {
        const deleteBtn = document.createElement('button')
        deleteBtn.className = 'settings-plugins-delete'
        deleteBtn.textContent = 'Remove'
        deleteBtn.addEventListener('click', () => this.deleteEntry(table, entry))
        actionsCell.appendChild(deleteBtn)
      }
    }

    tr.appendChild(actionsCell)
    return tr
  }

  async toggleEntry(table, entry) {
    const newEnabled = entry.enabled ? 0 : 1
    const escapedName = entry.name.replace(/'/g, "''")

    try {
      await window.pluginManager.call('sql', 'exec',
        `UPDATE ${table} SET enabled = ${newEnabled} WHERE name = '${escapedName}'`
      )

      this.pendingChanges = true
      toast.success(`'${entry.name}' ${newEnabled ? 'enabled' : 'disabled'}`)

      await this.loadData()
    } catch (error) {
      console.error(`[Plugins] Failed to toggle ${table} entry:`, error)
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

      this.pendingChanges = true
      toast.success(`'${entry.name}' removed`)

      await this.loadData()
    } catch (error) {
      console.error(`[Plugins] Failed to delete ${table} entry:`, error)
      toast.error('Failed to remove entry')
    }
  }
}

customElements.define('settings-tab-plugins', SettingsTabPlugins)
