import { bus } from '../../systems/event-bus.js'
import { toast } from '../../systems/toast.js'
import { parseCSVLines } from '../../util/csv.js'

/**
 * SettingsTabKeybindings
 * 
 * Full keybinding editor with:
 * - List grouped by mode with collapsible sections
 * - Press-any-key capture for rebinding
 * - Enable/disable toggle per binding
 * - Clear key assignment (x button) - deletion only via direct DB access
 * - Search/filter
 * - Save back to SQL + reload keybinding manager
 */
class SettingsTabKeybindings extends HTMLElement {
  constructor() {
    super()
    this.bindings = []       // All keybindings from DB
    this.pendingChanges = new Map() // id -> { keys?, enabled? }
    this.filterText = ''
    this.capturing = null    // { id, element } if currently capturing a key
    this.captureHandler = null
  }

  async connectedCallback() {
    this.style.display = 'flex'
    this.style.flexDirection = 'column'
    this.style.height = '100%'

    await this.loadBindings()
    this.render()
  }

  disconnectedCallback() {
    this.stopCapture()
  }

  async loadBindings() {
    try {
      const result = await window.pluginManager.call(
        'sql', 'query',
        'SELECT id, mode, keys, event_name, event_data, description, enabled FROM keybindings ORDER BY mode, keys'
      )
      const csv = new TextDecoder().decode(result.output)
      const lines = parseCSVLines(csv.trim())

      if (lines.length < 2) {
        this.bindings = []
        return
      }

      this.bindings = []
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i]
        if (row.length < 7) continue
        this.bindings.push({
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
      console.error('[SettingsTabKeybindings] Failed to load bindings:', err)
      this.bindings = []
    }
  }

  render() {
    this.innerHTML = ''

    // Toolbar: search + add + save
    const toolbar = document.createElement('div')
    toolbar.className = 'settings-kb-toolbar'

    const searchInput = document.createElement('input')
    searchInput.type = 'text'
    searchInput.placeholder = 'Filter keybindings...'
    searchInput.className = 'settings-kb-search'
    searchInput.value = this.filterText
    searchInput.addEventListener('input', (e) => {
      this.filterText = e.target.value.toLowerCase()
      this.renderList()
    })
    toolbar.appendChild(searchInput)

    const saveBtn = document.createElement('button')
    saveBtn.className = 'button-primary'
    saveBtn.textContent = 'Save'
    saveBtn.addEventListener('click', () => this.save())
    toolbar.appendChild(saveBtn)

    this.appendChild(toolbar)

    // List container
    const listContainer = document.createElement('div')
    listContainer.className = 'settings-kb-list'
    listContainer.dataset.element = 'list'
    this.appendChild(listContainer)

    this.renderList()
  }

  renderList() {
    const listContainer = this.querySelector('[data-element="list"]')
    if (!listContainer) return
    listContainer.innerHTML = ''

    // Group by mode
    const groups = new Map()
    for (const b of this.bindings) {
      if (this.filterText) {
        const haystack = `${b.mode} ${b.keys} ${b.eventName} ${b.description}`.toLowerCase()
        if (!haystack.includes(this.filterText)) continue
      }

      if (!groups.has(b.mode)) groups.set(b.mode, [])
      groups.get(b.mode).push(b)
    }

    if (groups.size === 0) {
      const empty = document.createElement('div')
      empty.className = 'settings-kb-empty'
      empty.textContent = this.filterText ? 'No matching keybindings' : 'No keybindings defined'
      listContainer.appendChild(empty)
      return
    }

    for (const [mode, bindings] of groups) {
      const section = document.createElement('details')
      section.className = 'settings-kb-section'
      section.open = true

      const summary = document.createElement('summary')
      summary.className = 'settings-kb-section-header'
      summary.textContent = mode
      section.appendChild(summary)

      const table = document.createElement('table')
      table.className = 'settings-kb-table'

      // Header: On, Event, Description, Key, Clear
      const thead = document.createElement('thead')
      thead.innerHTML = `<tr>
        <th class="settings-kb-col-enabled">On</th>
        <th class="settings-kb-col-event">Event</th>
        <th class="settings-kb-col-desc">Description</th>
        <th class="settings-kb-col-keys">Key</th>
        <th class="settings-kb-col-actions"></th>
      </tr>`
      table.appendChild(thead)

      const tbody = document.createElement('tbody')
      for (const binding of bindings) {
        const row = this.createBindingRow(binding)
        tbody.appendChild(row)
      }
      table.appendChild(tbody)
      section.appendChild(table)
      listContainer.appendChild(section)
    }
  }

  createBindingRow(binding) {
    const changes = this.pendingChanges.get(binding.id) || {}
    const currentKeys = changes.keys ?? binding.keys
    const currentEnabled = changes.enabled ?? binding.enabled

    const tr = document.createElement('tr')
    tr.className = 'settings-kb-row'

    // 1. Enabled toggle
    const enabledCell = document.createElement('td')
    enabledCell.className = 'settings-kb-col-enabled'
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = currentEnabled
    checkbox.addEventListener('change', () => {
      if (!this.pendingChanges.has(binding.id)) {
        this.pendingChanges.set(binding.id, {})
      }
      this.pendingChanges.get(binding.id).enabled = checkbox.checked
    })
    enabledCell.appendChild(checkbox)
    tr.appendChild(enabledCell)

    // 2. Event
    const eventCell = document.createElement('td')
    eventCell.className = 'settings-kb-col-event'
    eventCell.textContent = binding.eventName
    tr.appendChild(eventCell)

    // 3. Description
    const descCell = document.createElement('td')
    descCell.className = 'settings-kb-col-desc'
    descCell.textContent = binding.description
    tr.appendChild(descCell)

    // 4. Key
    const keysCell = document.createElement('td')
    keysCell.className = 'settings-kb-col-keys'

    const keysBtn = document.createElement('button')
    keysBtn.className = 'settings-kb-key-btn'
    keysBtn.textContent = currentKeys || '\u2014'
    keysBtn.title = 'Click to rebind'
    if (!currentKeys) keysBtn.classList.add('settings-kb-key-empty')
    keysBtn.addEventListener('click', () => {
      this.startCapture(binding, keysBtn)
    })
    keysCell.appendChild(keysBtn)
    tr.appendChild(keysCell)

    // 5. Clear key button
    const actionsCell = document.createElement('td')
    actionsCell.className = 'settings-kb-col-actions'
    const clearBtn = document.createElement('button')
    clearBtn.className = 'settings-kb-delete-btn'
    clearBtn.textContent = '\u00d7'
    clearBtn.title = 'Clear key assignment'
    clearBtn.addEventListener('click', () => {
      if (!this.pendingChanges.has(binding.id)) {
        this.pendingChanges.set(binding.id, {})
      }
      this.pendingChanges.get(binding.id).keys = ''
      this.renderList()
    })
    actionsCell.appendChild(clearBtn)
    tr.appendChild(actionsCell)

    return tr
  }

  // --- Press-any-key capture ---

  startCapture(binding, element) {
    this.stopCapture()

    element.textContent = 'Press key...'
    element.classList.add('settings-kb-capturing')

    this.capturing = { binding, element }

    this.captureHandler = (e) => {
      e.preventDefault()
      e.stopPropagation()

      // Ignore modifier-only keys
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return

      const key = this.normalizeKey(e)
      if (!key) return

      const isNew = !binding.id
      if (isNew) {
        binding.keys = key
      } else {
        if (!this.pendingChanges.has(binding.id)) {
          this.pendingChanges.set(binding.id, {})
        }
        this.pendingChanges.get(binding.id).keys = key
      }

      element.textContent = key
      element.classList.remove('settings-kb-capturing')
      this.stopCapture()
    }

    // Use capture phase to intercept before keybinding manager
    document.addEventListener('keydown', this.captureHandler, true)

    // Click anywhere to cancel
    this._captureClickHandler = (e) => {
      if (e.target !== element) {
        this.cancelCapture()
      }
    }
    setTimeout(() => {
      document.addEventListener('click', this._captureClickHandler)
    }, 0)
  }

  stopCapture() {
    if (this.captureHandler) {
      document.removeEventListener('keydown', this.captureHandler, true)
      this.captureHandler = null
    }
    if (this._captureClickHandler) {
      document.removeEventListener('click', this._captureClickHandler)
      this._captureClickHandler = null
    }
    this.capturing = null
  }

  cancelCapture() {
    if (this.capturing) {
      const { binding, element } = this.capturing
      const changes = binding.id ? (this.pendingChanges.get(binding.id) || {}) : {}
      element.textContent = changes.keys ?? binding.keys
      element.classList.remove('settings-kb-capturing')
    }
    this.stopCapture()
  }

  /**
   * Normalize keyboard event to Vim-style notation
   * Mirrors keybinding-manager.js normalizeKey()
   */
  normalizeKey(event) {
    const specialKeys = {
      'Enter': 'CR', 'Escape': 'Esc', ' ': 'Space', 'Tab': 'Tab',
      'Backspace': 'BS', 'Delete': 'Del',
      'ArrowUp': 'Up', 'ArrowDown': 'Down', 'ArrowLeft': 'Left', 'ArrowRight': 'Right',
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
      if (baseKey.length === 1 && baseKey >= 'A' && baseKey <= 'Z') {
        baseKey = baseKey.toLowerCase()
      }
      let mod = '<'
      if (hasCmd) mod += 'C-'
      if (hasAlt) mod += 'M-'
      if (hasShift) mod += 'S-'
      if (hasCtrl) mod += 'D-'
      return mod + baseKey + '>'
    }

    // Plain key
    return event.key
  }

  // --- Save ---

  async save() {
    try {
      for (const [id, changes] of this.pendingChanges) {
        const parts = []
        if (changes.keys !== undefined) {
          parts.push(`keys='${changes.keys.replace(/'/g, "''")}'`)
        }
        if (changes.enabled !== undefined) {
          parts.push(`enabled=${changes.enabled ? 1 : 0}`)
        }
        if (parts.length > 0) {
          await window.pluginManager.call('sql', 'exec',
            `UPDATE keybindings SET ${parts.join(', ')} WHERE id=${id}`)
        }
      }

      // Clear pending state
      this.pendingChanges.clear()

      // Reload from DB
      await this.loadBindings()
      this.renderList()

      // Reload keybinding manager
      if (window.keybindingManager) {
        await window.keybindingManager.reloadBindings()
      }

      toast.success('Keybindings saved')
    } catch (err) {
      console.error('[SettingsTabKeybindings] Save failed:', err)
      toast.error('Failed to save keybindings')
    }
  }
}

customElements.define('settings-tab-keybindings', SettingsTabKeybindings)
