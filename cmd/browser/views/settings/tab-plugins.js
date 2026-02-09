/**
 * SettingsTabPlugins
 * 
 * Read-only listing of:
 * - Built-in WASM plugins with their type (Go/C/Zig)
 * - Registered views (custom elements with view- prefix)
 * 
 * Future: enable/disable plugins, add remote plugin URLs, manage views
 */
class SettingsTabPlugins extends HTMLElement {
  constructor() {
    super()
  }

  connectedCallback() {
    this.style.display = 'block'
    this.style.height = '100%'
    this.style.overflow = 'auto'

    this.render()
  }

  render() {
    this.innerHTML = ''

    const container = document.createElement('div')
    container.className = 'settings-plugins-container'

    // Built-in plugins section
    container.appendChild(this.renderPluginsSection())

    // Registered views section
    container.appendChild(this.renderViewsSection())

    // Remote plugins placeholder
    container.appendChild(this.renderRemoteSection())

    this.appendChild(container)
  }

  renderPluginsSection() {
    const section = document.createElement('div')
    section.className = 'settings-plugins-section'

    const header = document.createElement('h3')
    header.className = 'settings-plugins-section-header'
    header.textContent = 'Built-in Plugins'
    section.appendChild(header)

    // Known built-in plugins
    const plugins = [
      { name: 'sql', lang: 'C', desc: 'SQLite database engine' },
      { name: 'math', lang: 'C', desc: 'Math utilities' },
      { name: 'random', lang: 'Zig', desc: 'Random number generation' },
      { name: 'treegen', lang: 'Go', desc: 'World progression tree generator' },
      { name: 'biomes', lang: 'Go', desc: 'Biome assignment to tree nodes' },
      { name: 'keylock', lang: 'Go', desc: 'Key & lock assignment' },
      { name: 'minimap', lang: 'Go', desc: 'Minimap generator (v1)' },
      { name: 'minimap2', lang: 'Go', desc: 'Minimap generator (v2)' },
      { name: 'roomgen', lang: 'Go', desc: 'Room generator with exits and decoration' },
      { name: 'automap', lang: 'Go', desc: 'Automapping rules engine' },
      { name: 'sprite-detect', lang: 'Go', desc: 'Sprite blob detection in images' },
      { name: 'sprite-pack', lang: 'Go', desc: 'Sprite atlas packer' },
      { name: 'tile-detect', lang: 'Go', desc: 'Tile detection in images' },
      { name: 'image-process', lang: 'Go', desc: 'Image processing utilities' },
      { name: 'scaler', lang: 'Go', desc: 'Image scaling' },
    ]

    const table = document.createElement('table')
    table.className = 'settings-plugins-table'

    const thead = document.createElement('thead')
    thead.innerHTML = `<tr>
      <th>Plugin</th>
      <th>Language</th>
      <th>Description</th>
      <th>Status</th>
    </tr>`
    table.appendChild(thead)

    const tbody = document.createElement('tbody')
    for (const p of plugins) {
      const tr = document.createElement('tr')

      const nameCell = document.createElement('td')
      nameCell.className = 'settings-plugins-name'
      nameCell.textContent = p.name
      tr.appendChild(nameCell)

      const langCell = document.createElement('td')
      langCell.className = 'settings-plugins-lang'
      const badge = document.createElement('span')
      badge.className = `settings-plugins-badge settings-plugins-badge-${p.lang.toLowerCase()}`
      badge.textContent = p.lang
      langCell.appendChild(badge)
      tr.appendChild(langCell)

      const descCell = document.createElement('td')
      descCell.textContent = p.desc
      tr.appendChild(descCell)

      const statusCell = document.createElement('td')
      const statusBadge = document.createElement('span')
      statusBadge.className = 'settings-plugins-status-active'
      statusBadge.textContent = 'Active'
      statusCell.appendChild(statusBadge)
      tr.appendChild(statusCell)

      tbody.appendChild(tr)
    }
    table.appendChild(tbody)
    section.appendChild(table)

    return section
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
    // Check common known view tags
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

  renderRemoteSection() {
    const section = document.createElement('div')
    section.className = 'settings-plugins-section'

    const header = document.createElement('h3')
    header.className = 'settings-plugins-section-header'
    header.textContent = 'Remote Plugins'
    section.appendChild(header)

    const placeholder = document.createElement('div')
    placeholder.className = 'settings-plugins-placeholder'
    placeholder.textContent = 'Remote plugin loading will be available in a future update. You will be able to add plugins by URL and enable/disable dynamic view loading.'
    section.appendChild(placeholder)

    return section
  }
}

customElements.define('settings-tab-plugins', SettingsTabPlugins)
