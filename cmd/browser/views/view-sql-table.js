import { bus } from "../systems/event-bus.js"

/**
 * ViewSqlTable - A CastleDB-inspired SQL-driven table view component
 * 
 * Usage:
 * <view-sql-table
 *   data-query="SELECT * FROM monsters LIMIT :limit OFFSET :offset"
 *   data-count-query="SELECT COUNT(*) FROM monsters"
 *   data-table="monsters"
 *   data-page-size="20"
 * ></view-sql-table>
 * 
 * Supports:
 * - Auto-detection of columns from query results
 * - Pagination with :offset and :limit placeholders
 * - Inline editing with automatic UPDATE/INSERT/DELETE
 * - Image columns (image-base64, image-url types via data-column-types)
 * - Reference columns with lookups
 */
export class ViewSqlTable extends HTMLElement {
  static get viewMeta() { return { displayName: 'SQL Table', category: 'Data' } }

  static observedAttributes = ['data-query', 'data-count-query', 'data-table', 'data-page-size', 'data-column-types', 'data-mode', 'data-confirm-label']

  constructor() {
    super()
    this.currentPage = 0
    this.pageSize = 20
    this.totalCount = 0
    this.rows = []
    this.columns = []
    this.columnTypes = {} // { columnName: 'image-base64' | 'image-url' | 'text' | 'number' | 'boolean' }
    this.primaryKey = 'id' // Assume 'id' by default, can be detected
    this.editingCell = null
    this.mode = 'browser'
    this.confirmLabel = 'Select'
    this.selectedRowIndex = -1
    this.chooserActions = null
    this.tableContainer = null
    this.paginationContainer = null
    this.statusContainer = null
    this._headerControlsElement = null
    this._unsubscribeTableSelect = null
  }

  connectedCallback() {
    this.style.display = 'flex'
    this.style.flexDirection = 'column'
    this.style.width = '100%'
    this.style.height = '100%'
    this.setAttribute('tabindex', '0')

    this.innerHTML = `
      <div data-element="table-container"></div>
      <footer>
        <div data-element="pagination" part="pagination"></div>
        <div data-element="status"></div>
      </footer>
    `

    this._mountHeaderControls()

    this.tableContainer = this.querySelector('[data-element="table-container"]')
    this.paginationContainer = this.querySelector('[data-element="pagination"]')
    this.statusContainer = this.querySelector('[data-element="status"]')

    // Parse attributes
    this.pageSize = parseInt(this.getAttribute('data-page-size') || '20', 10)
    this.mode = this.getAttribute('data-mode') || 'browser'
    this.confirmLabel = this.getAttribute('data-confirm-label') || 'Select'
    this.parseColumnTypes()

    // Focus management
    this.addEventListener('focusin', () => {
      bus.emit('view:focus', { view: 'view-sql-table', mode: 'sql-table' })
    })

    this.addEventListener('focusout', () => {
      bus.emit('view:blur', { view: 'view-sql-table', mode: 'sql-table' })
    })

    // Keyboard navigation
    this.addEventListener('keydown', (e) => this.handleKeyDown(e))

    // Toolbar buttons
    const toolbar = this._headerControlsElement
    if (toolbar) {
      toolbar.querySelector('[data-action="refresh"]')?.addEventListener('click', () => this.refresh())
      toolbar.querySelector('[data-action="insert"]')?.addEventListener('click', () => this.insertRow())
      toolbar.querySelector('[data-action="delete"]')?.addEventListener('click', () => this.deleteSelectedRow())
    }

    // Listen for table selection events from view-sql-tables
    this._unsubscribeTableSelect = bus.on('sql-table:select', (payload) => {
      this.handleTableSelect(payload.table)
    })

    if (this.mode === 'chooser') {
      this.setupChooserMode()
    }

    // Initial data load
    this.refresh()
  }

  disconnectedCallback() {
    // Cleanup event listener
    if (this._unsubscribeTableSelect) {
      this._unsubscribeTableSelect()
      this._unsubscribeTableSelect = null
    }

    this._unmountHeaderControls()
    this._removeChooserActions()
  }

  createHeaderControlsElement() {
    const toolbar = document.createElement('div')
    toolbar.dataset.element = 'toolbar'
    toolbar.className = 'sql-table-toolbar'
    toolbar.setAttribute('slot', 'header-controls')
    toolbar.innerHTML = `
      <button data-action="refresh" aria-label="Refresh" title="Refresh (Ctrl+R)"><i aria-hidden="true">refresh</i></button>
      <button data-action="insert" aria-label="Insert Row" title="Insert Row (Insert)"><i aria-hidden="true">add</i></button>
      <button data-action="delete" aria-label="Delete Row" title="Delete Row (Ctrl+Del / Cmd+Backspace)"><i aria-hidden="true">remove</i></button>
    `
    return toolbar
  }

  _mountHeaderControls() {
    if (!this.parentElement || this._headerControlsElement) return

    const headerControls = this.createHeaderControlsElement()
    if (headerControls) {
      this._headerControlsElement = headerControls
      this.parentElement.appendChild(headerControls)
    }
  }

  _unmountHeaderControls() {
    if (this._headerControlsElement && this._headerControlsElement.parentElement) {
      this._headerControlsElement.remove()
      this._headerControlsElement = null
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue && this.tableContainer) {
      if (name === 'data-column-types') {
        this.parseColumnTypes()
      } else if (name === 'data-mode') {
        this.mode = newValue || 'browser'
        if (this.mode === 'chooser') {
          this.setupChooserMode()
        } else {
          this._removeChooserActions()
        }
        this.render()
        return
      } else if (name === 'data-confirm-label') {
        this.confirmLabel = newValue || 'Select'
        this.updateChooserUI()
        return
      }
      this.currentPage = 0
      this.clearSelection()
      this.refresh()
    }
  }

  setupChooserMode() {
    const hideActions = ['insert', 'delete']
    hideActions.forEach(action => {
      const btn = this._headerControlsElement?.querySelector(`[data-action="${action}"]`)
      if (btn) btn.hidden = true
    })

    if (!this.chooserActions) {
      this.chooserActions = document.createElement('div')
      this.chooserActions.className = 'sql-table-chooser-actions'
      this.chooserActions.innerHTML = `
        <span data-element="chooser-selection-info"></span>
        <div>
          <button type="button" data-action="cancel">Cancel</button>
          <button type="button" data-action="select" disabled>${this.confirmLabel}</button>
        </div>
      `

      this.chooserActions.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('chooser-cancel', { bubbles: true }))
      })

      this.chooserActions.querySelector('[data-action="select"]')?.addEventListener('click', () => {
        this.confirmSelection()
      })

      this.appendChild(this.chooserActions)
    }

    this.updateChooserUI()
  }

  _removeChooserActions() {
    if (this.chooserActions?.parentElement) {
      this.chooserActions.remove()
    }
    this.chooserActions = null

    const showActions = ['insert', 'delete']
    showActions.forEach(action => {
      const btn = this._headerControlsElement?.querySelector(`[data-action="${action}"]`)
      if (btn) btn.hidden = false
    })
  }

  updateChooserUI() {
    if (!this.chooserActions) return

    const selectBtn = this.chooserActions.querySelector('[data-action="select"]')
    const selectionInfo = this.chooserActions.querySelector('[data-element="chooser-selection-info"]')
    const selection = this.getSelection()

    if (selectionInfo) {
      selectionInfo.textContent = selection?.row
        ? `${selection.row.name || selection.primaryKeyValue || '1 row selected'}`
        : ''
    }

    if (selectBtn) {
      selectBtn.textContent = this.confirmLabel
      selectBtn.disabled = !selection
    }

    this.dispatchEvent(new CustomEvent('selection-changed', {
      bubbles: true,
      detail: { selection }
    }))
  }

  getSelection() {
    const row = this.rows[this.selectedRowIndex]
    if (!row) return null

    return {
      row,
      rowIndex: this.selectedRowIndex,
      primaryKey: this.primaryKey,
      primaryKeyValue: row[this.primaryKey] ?? null
    }
  }

  static projectSelection(selection, options = {}) {
    if (!selection) return null

    let value = selection.row
    if (typeof options.returnColumn === 'string' && options.returnColumn) {
      value = selection.row?.[options.returnColumn]
    } else if (Array.isArray(options.returnFields) && options.returnFields.length > 0) {
      value = {}
      options.returnFields.forEach((field) => {
        if (typeof field === 'string' && field) {
          value[field] = selection.row?.[field]
        }
      })
    }

    return {
      ...selection,
      value
    }
  }

  confirmSelection() {
    const selection = this.getSelection()
    if (!selection) return
    this.dispatchEvent(new CustomEvent('chooser-select', {
      bubbles: true,
      detail: { selection }
    }))
  }

  clearSelection() {
    this.selectedRowIndex = -1
  }

  applyRowSelectionState(row, selected) {
    row.setAttribute('aria-selected', selected ? 'true' : 'false')
  }

  parseColumnTypes() {
    const typesAttr = this.getAttribute('data-column-types')
    if (typesAttr) {
      try {
        this.columnTypes = JSON.parse(typesAttr)
      } catch (e) {
        console.error('Failed to parse data-column-types:', e)
        this.columnTypes = {}
      }
    }
  }

  /**
   * Handle table selection from view-sql-tables component.
   * Updates query attributes and refreshes the view to show the selected table.
   */
  handleTableSelect(tableName) {
    if (this.mode === 'chooser') return
    if (!tableName) return

    // Update attributes to show the selected table
    this.setAttribute('data-query', `SELECT * FROM "${tableName}" LIMIT :limit OFFSET :offset`)
    this.setAttribute('data-count-query', `SELECT COUNT(*) FROM "${tableName}"`)
    this.setAttribute('data-table', tableName)

    // Reset pagination and refresh
    this.currentPage = 0
    this.refresh()
  }

  handleKeyDown(e) {
    if (this.editingCell) {
      if (e.key === 'Escape') {
        this.cancelEdit()
        e.preventDefault()
      } else if (e.key === 'Enter' && !e.shiftKey) {
        this.commitEdit()
        e.preventDefault()
      } else if (e.key === 'Tab') {
        this.commitEdit()
        // Move to next cell
        const { rowIndex, colIndex } = this.editingCell
        if (e.shiftKey) {
          this.startEditAt(rowIndex, colIndex - 1)
        } else {
          this.startEditAt(rowIndex, colIndex + 1)
        }
        e.preventDefault()
      }
      return
    }

    // Navigation when not editing
    if (this.mode === 'chooser') {
      if (e.key === 'Enter') {
        this.confirmSelection()
        e.preventDefault()
      } else if (e.key === 'Escape') {
        this.dispatchEvent(new CustomEvent('chooser-cancel', { bubbles: true }))
        e.preventDefault()
      }
      return
    }

    if (e.key === 'Insert' || (e.key === 'n' && e.ctrlKey)) {
      this.insertRow()
      e.preventDefault()
    } else if ((e.key === 'Delete' && e.ctrlKey) || (e.key === 'Backspace' && e.metaKey)) {
      if (this.selectedRowIndex >= 0) {
        this.deleteRow(this.selectedRowIndex)
      }
      e.preventDefault()
    } else if (e.key === 'r' && e.ctrlKey) {
      this.refresh()
      e.preventDefault()
    }
  }

  async refresh() {
    this.setStatus('Loading...')
    try {
      await Promise.all([this.fetchCount(), this.fetchData()])
      if (this.mode === 'chooser' || this.selectedRowIndex >= this.rows.length) {
        this.clearSelection()
      }
      this.render()
      this.setStatus(`${this.totalCount} rows`)
    } catch (error) {
      this.setStatus(`Error: ${error.message}`)
      console.error('ViewSqlTable error:', error)
    }
  }

  async fetchCount() {
    const countQuery = this.getAttribute('data-count-query')
    if (!countQuery) {
      this.totalCount = 0
      return
    }

    const result = await window.pluginManager.call('sql', 'query', countQuery)
    const csv = new TextDecoder().decode(result.output)
    const lines = csv.trim().split('\n')
    if (lines.length >= 2) {
      // First line is header, second is the count
      this.totalCount = parseInt(lines[1], 10) || 0
    }
  }

  async fetchData() {
    let query = this.getAttribute('data-query')
    if (!query) {
      this.rows = []
      this.columns = []
      return
    }

    // Interpolate pagination params
    const offset = this.currentPage * this.pageSize
    query = this.interpolateQuery(query, {
      offset,
      limit: this.pageSize
    })

    const result = await window.pluginManager.call('sql', 'query', query)
    const csv = new TextDecoder().decode(result.output)
    const parsed = this.parseCSV(csv)

    if (parsed.length > 0) {
      this.columns = parsed[0]
      this.rows = parsed.slice(1).map(row => {
        const obj = {}
        this.columns.forEach((col, i) => {
          obj[col] = row[i]
        })
        return obj
      })
    } else {
      this.columns = []
      this.rows = []
    }

    // Try to detect primary key
    if (this.columns.includes('id')) {
      this.primaryKey = 'id'
    } else if (this.columns.length > 0) {
      this.primaryKey = this.columns[0]
    }
  }

  interpolateQuery(query, params) {
    return query.replace(/:(\w+)/g, (match, name) => {
      if (params.hasOwnProperty(name)) {
        const value = params[name]
        if (typeof value === 'string') {
          return `'${value.replace(/'/g, "''")}'`
        }
        return String(value)
      }
      return match
    })
  }

  parseCSV(csv) {
    const rows = []
    let currentRow = []
    let currentField = ''
    let inQuotes = false
    const text = csv.trim()

    for (let i = 0; i < text.length; i++) {
      const char = text[i]

      if (char === '"') {
        if (inQuotes && text[i + 1] === '"') {
          // Escaped quote inside quoted field
          currentField += '"'
          i++
        } else {
          // Toggle quote state
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        currentRow.push(currentField)
        currentField = ''
      } else if (char === '\n' && !inQuotes) {
        // End of row (only when not inside quotes)
        currentRow.push(currentField)
        currentField = ''
        if (currentRow.length > 0) {
          rows.push(currentRow)
        }
        currentRow = []
      } else if (char === '\r' && !inQuotes) {
        // Skip carriage return when not in quotes
        continue
      } else {
        // Regular character (including newlines inside quoted fields)
        currentField += char
      }
    }

    // Don't forget the last field and row
    currentRow.push(currentField)
    if (currentRow.length > 0 && currentRow.some(f => f !== '')) {
      rows.push(currentRow)
    }

    return rows
  }

  render() {
    this.renderTable()
    this.renderPagination()
  }

  renderTable() {
    if (!this.tableContainer) return

    if (this.columns.length === 0) {
      this.tableContainer.innerHTML = '<div class="sql-table-empty">No data. Set data-query attribute or check your query.</div>'
      return
    }

    const table = document.createElement('table')
    table.className = 'sql-table'

    // Header
    const thead = document.createElement('thead')
    const headerRow = document.createElement('tr')

    // Row number column
    const thNum = document.createElement('th')
    thNum.className = 'sql-table-row-num'
    thNum.textContent = '#'
    headerRow.appendChild(thNum)

    this.columns.forEach(col => {
      const th = document.createElement('th')
      th.textContent = col
      th.dataset.column = col
      headerRow.appendChild(th)
    })

    thead.appendChild(headerRow)
    table.appendChild(thead)

    // Body
    const tbody = document.createElement('tbody')

    this.rows.forEach((row, rowIndex) => {
      const tr = document.createElement('tr')
      tr.dataset.rowIndex = rowIndex
      this.applyRowSelectionState(tr, rowIndex === this.selectedRowIndex)
      tr.addEventListener('click', () => {
        this.selectRow(rowIndex)
      })

      // Row number
      const tdNum = document.createElement('td')
      tdNum.className = 'sql-table-row-num'
      tdNum.textContent = this.currentPage * this.pageSize + rowIndex + 1
      tr.appendChild(tdNum)

      this.columns.forEach((col, colIndex) => {
        const td = document.createElement('td')
        td.dataset.column = col
        td.dataset.rowIndex = rowIndex
        td.dataset.colIndex = colIndex

        this.renderCell(td, row[col], col)

        td.addEventListener('dblclick', () => {
          if (this.mode === 'chooser') {
            this.selectRow(rowIndex)
            this.confirmSelection()
            return
          }
          this.startEdit(td, rowIndex, colIndex, row[col], col)
        })

        tr.appendChild(td)
      })

      tbody.appendChild(tr)
    })

    table.appendChild(tbody)
    this.tableContainer.innerHTML = ''
    this.tableContainer.appendChild(table)
    if (this.mode === 'chooser') {
      this.updateChooserUI()
    }
  }

  renderCell(td, value, column) {
    const colType = this.columnTypes[column] || this.detectColumnType(column, value)

    td.className = `sql-table-cell sql-table-cell-${colType}`

    switch (colType) {
      case 'image-base64':
        if (value && value.length > 0) {
          const img = document.createElement('img')
          // Detect image format from base64 header or default to png
          let mimeType = 'image/png'
          if (value.startsWith('/9j/')) mimeType = 'image/jpeg'
          else if (value.startsWith('R0lGOD')) mimeType = 'image/gif'
          else if (value.startsWith('UklGR')) mimeType = 'image/webp'
          img.src = `data:${mimeType};base64,${value}`
          img.className = 'sql-table-image'
          td.appendChild(img)
        } else {
          td.textContent = '(no image)'
          td.classList.add('sql-table-cell-empty')
        }
        break

      case 'image-url':
        if (value && value.length > 0) {
          const img = document.createElement('img')
          img.src = value
          img.className = 'sql-table-image'
          td.appendChild(img)
        } else {
          td.textContent = '(no image)'
          td.classList.add('sql-table-cell-empty')
        }
        break

      case 'boolean':
        const checkbox = document.createElement('input')
        checkbox.type = 'checkbox'
        checkbox.checked = value === '1' || value === 'true' || value === true
        checkbox.disabled = true
        td.appendChild(checkbox)
        break

      case 'number':
        td.textContent = value ?? ''
        td.style.textAlign = 'right'
        break

      default:
        // Truncate long text
        const maxLen = 100
        if (value && value.length > maxLen) {
          td.textContent = value.substring(0, maxLen) + '...'
          td.title = value
        } else {
          td.textContent = value ?? ''
        }
    }
  }

  /**
   * Detect column type based on column name conventions.
   * Boolean columns: starts with "is", "has", "can", "should", "was", "will"
   *                  or matches reserved words: enabled, disabled, stackable, active, visible, hidden, locked, deleted, archived
   * Image columns: detected by value content (base64 signatures)
   * Number/text: fallback based on value
   */
  detectColumnType(column, value) {
    // Check if it looks like base64 image (must check value for this)
    if (typeof value === 'string' && value.length > 100) {
      // Common base64 image signatures
      if (value.startsWith('iVBOR') || // PNG
        value.startsWith('/9j/') || // JPEG
        value.startsWith('R0lGOD') || // GIF
        value.startsWith('UklGR')) { // WebP
        return 'image-base64'
      }
    }

    // Boolean detection by column name
    const lowerCol = column.toLowerCase()
    const booleanPrefixes = ['is', 'has', 'can', 'should', 'was', 'will']
    const booleanWords = [
      'enabled', 'disabled', 'stackable', 'active', 'visible', 'hidden',
      'locked', 'deleted', 'archived', 'published', 'featured', 'verified',
      'approved', 'completed', 'required', 'optional', 'default'
    ]

    // Check prefixes (e.g., isEnabled, hasItems, canEdit)
    for (const prefix of booleanPrefixes) {
      if (lowerCol.startsWith(prefix) && lowerCol.length > prefix.length) {
        // Ensure it's not just a word starting with these letters (e.g., "island", "hash")
        const nextChar = lowerCol[prefix.length]
        if (nextChar === '_' || nextChar === nextChar.toUpperCase()) {
          return 'boolean'
        }
        // Also check for snake_case: is_enabled
        if (column.toLowerCase().startsWith(prefix + '_')) {
          return 'boolean'
        }
      }
    }

    // Check exact boolean words
    if (booleanWords.includes(lowerCol)) {
      return 'boolean'
    }

    return 'text'
  }

  renderPagination() {
    if (!this.paginationContainer) return

    const totalPages = Math.ceil(this.totalCount / this.pageSize) || 1

    this.paginationContainer.innerHTML = `
      <button data-action="first" aria-label="First page" title="First page" ${this.currentPage === 0 ? 'disabled' : ''}><i aria-hidden="true">first_page</i></button>
      <button data-action="prev" aria-label="Previous page" title="Previous page" ${this.currentPage === 0 ? 'disabled' : ''}><i aria-hidden="true">chevron_left</i></button>
      <span class="sql-table-page-info">Page ${this.currentPage + 1} of ${totalPages}</span>
      <button data-action="next" aria-label="Next page" title="Next page" ${this.currentPage >= totalPages - 1 ? 'disabled' : ''}><i aria-hidden="true">chevron_right</i></button>
      <button data-action="last" aria-label="Last page" title="Last page" ${this.currentPage >= totalPages - 1 ? 'disabled' : ''}><i aria-hidden="true">last_page</i></button>
      <select data-action="page-size">
        ${[10, 20, 50, 100].map(size =>
      `<option value="${size}" ${size === this.pageSize ? 'selected' : ''}>${size} rows</option>`
    ).join('')}
      </select>
    `

    // Event handlers
    this.paginationContainer.querySelector('[data-action="first"]').addEventListener('click', () => {
      this.currentPage = 0
      this.clearSelection()
      this.refresh()
    })
    this.paginationContainer.querySelector('[data-action="prev"]').addEventListener('click', () => {
      if (this.currentPage > 0) {
        this.currentPage--
        this.clearSelection()
        this.refresh()
      }
    })
    this.paginationContainer.querySelector('[data-action="next"]').addEventListener('click', () => {
      const totalPages = Math.ceil(this.totalCount / this.pageSize)
      if (this.currentPage < totalPages - 1) {
        this.currentPage++
        this.clearSelection()
        this.refresh()
      }
    })
    this.paginationContainer.querySelector('[data-action="last"]').addEventListener('click', () => {
      const totalPages = Math.ceil(this.totalCount / this.pageSize)
      this.currentPage = totalPages - 1
      this.clearSelection()
      this.refresh()
    })
    this.paginationContainer.querySelector('[data-action="page-size"]').addEventListener('change', (e) => {
      this.pageSize = parseInt(e.target.value, 10)
      this.currentPage = 0
      this.clearSelection()
      this.refresh()
    })
  }

  setStatus(text) {
    if (this.statusContainer) {
      this.statusContainer.textContent = text
    }
  }

  selectRow(rowIndex) {
    this.selectedRowIndex = rowIndex
    this.tableContainer?.querySelectorAll('tbody tr').forEach((row) => {
      this.applyRowSelectionState(row, parseInt(row.dataset.rowIndex, 10) === rowIndex)
    })
    if (this.mode === 'chooser') {
      this.updateChooserUI()
    }
  }

  // === Editing ===

  startEdit(td, rowIndex, colIndex, currentValue, column) {
    // Don't edit row number column
    if (column === this.primaryKey && this.rows[rowIndex][this.primaryKey]) {
      // Allow editing primary key only for new rows
      // For now, let's allow it but warn
    }

    // Cancel any existing edit
    this.cancelEdit()

    const colType = this.columnTypes[column] || this.detectColumnType(column, currentValue)

    this.editingCell = {
      td,
      rowIndex,
      colIndex,
      column,
      originalValue: currentValue
    }

    td.classList.add('editing')
    td.innerHTML = ''

    if (colType === 'boolean') {
      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.checked = currentValue === '1' || currentValue === 'true' || currentValue === true
      checkbox.addEventListener('change', () => {
        this.editingCell.newValue = checkbox.checked ? '1' : '0'
        this.commitEdit()
      })
      td.appendChild(checkbox)
      checkbox.focus()
    } else if (colType === 'text' && currentValue && currentValue.length > 50) {
      // Use textarea for long text
      const textarea = document.createElement('textarea')
      textarea.value = currentValue || ''
      textarea.className = 'sql-table-edit-textarea'
      td.appendChild(textarea)
      textarea.focus()
      textarea.select()
    } else {
      const input = document.createElement('input')
      input.type = colType === 'number' ? 'number' : 'text'
      input.value = currentValue || ''
      input.className = 'sql-table-edit-input'
      td.appendChild(input)
      input.focus()
      input.select()
    }
  }

  startEditAt(rowIndex, colIndex) {
    // Wrap around columns
    if (colIndex < 0) {
      colIndex = this.columns.length - 1
      rowIndex--
    } else if (colIndex >= this.columns.length) {
      colIndex = 0
      rowIndex++
    }

    // Check bounds
    if (rowIndex < 0 || rowIndex >= this.rows.length) {
      return
    }

    const column = this.columns[colIndex]
    const row = this.rows[rowIndex]
    const td = this.tableContainer.querySelector(`td[data-row-index="${rowIndex}"][data-col-index="${colIndex}"]`)

    if (td) {
      this.startEdit(td, rowIndex, colIndex, row[column], column)
    }
  }

  cancelEdit() {
    if (!this.editingCell) return

    const { td, rowIndex, column, originalValue } = this.editingCell
    td.classList.remove('editing')
    this.renderCell(td, originalValue, column)
    this.editingCell = null
  }

  async commitEdit() {
    if (!this.editingCell) return

    const { td, rowIndex, column, originalValue } = this.editingCell
    const input = td.querySelector('input, textarea')
    let newValue

    if (input) {
      if (input.type === 'checkbox') {
        newValue = input.checked ? '1' : '0'
      } else {
        newValue = input.value
      }
    } else {
      newValue = this.editingCell.newValue
    }

    td.classList.remove('editing')

    // Check if value actually changed
    if (newValue === originalValue) {
      this.renderCell(td, originalValue, column)
      this.editingCell = null
      return
    }

    // Update local data
    this.rows[rowIndex][column] = newValue
    this.renderCell(td, newValue, column)

    // Persist to database
    const tableName = this.getAttribute('data-table')
    if (tableName) {
      const row = this.rows[rowIndex]
      const pkValue = row[this.primaryKey]

      if (pkValue) {
        await this.updateRow(tableName, this.primaryKey, pkValue, column, newValue)
      }
    }

    this.editingCell = null
  }

  async updateRow(table, pkColumn, pkValue, column, value) {
    const escapedValue = typeof value === 'string'
      ? `'${value.replace(/'/g, "''")}'`
      : value === null || value === '' ? 'NULL' : value

    const sql = `UPDATE ${table} SET ${column} = ${escapedValue} WHERE ${pkColumn} = '${pkValue}'`

    try {
      await window.pluginManager.call('sql', 'exec', sql)
      this.setStatus(`Updated ${column}`)
    } catch (error) {
      this.setStatus(`Error: ${error.message}`)
      console.error('Update failed:', error)
    }
  }

  async insertRow() {
    const tableName = this.getAttribute('data-table')
    if (!tableName) {
      this.setStatus('Cannot insert: no data-table attribute')
      return
    }

    // Create a new row with default values
    const newRow = {}
    this.columns.forEach(col => {
      newRow[col] = col === this.primaryKey ? null : ''
    })

    // Insert into database
    const columnList = this.columns.filter(c => c !== this.primaryKey).join(', ')
    const valueList = this.columns
      .filter(c => c !== this.primaryKey)
      .map(() => "''")
      .join(', ')

    const sql = `INSERT INTO ${tableName} (${columnList}) VALUES (${valueList})`

    try {
      await window.pluginManager.call('sql', 'exec', sql)
      this.setStatus('Row inserted')
      await this.refresh()

      // Go to last page to see the new row
      const totalPages = Math.ceil(this.totalCount / this.pageSize)
      this.currentPage = totalPages - 1
      await this.refresh()
    } catch (error) {
      this.setStatus(`Insert error: ${error.message}`)
      console.error('Insert failed:', error)
    }
  }

  deleteSelectedRow() {
    if (this.selectedRowIndex >= 0) {
      const rowIndex = this.selectedRowIndex
      this.deleteRow(rowIndex)
    } else {
      this.setStatus('No row selected')
    }
  }

  async deleteRow(rowIndex) {
    const tableName = this.getAttribute('data-table')
    if (!tableName) {
      this.setStatus('Cannot delete: no data-table attribute')
      return
    }

    const row = this.rows[rowIndex]
    const pkValue = row[this.primaryKey]

    if (!pkValue) {
      this.setStatus('Cannot delete: no primary key value')
      return
    }

    if (!confirm(`Delete row with ${this.primaryKey} = ${pkValue}?`)) {
      return
    }

    const sql = `DELETE FROM ${tableName} WHERE ${this.primaryKey} = '${pkValue}'`

    try {
      await window.pluginManager.call('sql', 'exec', sql)
      this.setStatus('Row deleted')
      this.clearSelection()
      await this.refresh()
    } catch (error) {
      this.setStatus(`Delete error: ${error.message}`)
      console.error('Delete failed:', error)
    }
  }

  static async choose(options = {}) {
    return new Promise((resolve) => {
      const popupManager = document.querySelector('popup-manager')
      if (!popupManager) {
        console.error('ViewSqlTable.choose: popup-manager not found')
        resolve(null)
        return
      }

      const popup = document.createElement('view-popup')
      popup.setAttribute('size', options.size || 'large')

      const title = document.createElement('h2')
      title.slot = 'title'
      title.textContent = options.title || 'Select Row'
      popup.appendChild(title)

      const table = document.createElement('view-sql-table')
      table.setAttribute('data-mode', 'chooser')
      table.setAttribute('data-query', options.query || 'SELECT 1')
      if (options.countQuery) table.setAttribute('data-count-query', options.countQuery)
      if (options.table) table.setAttribute('data-table', options.table)
      if (options.pageSize) table.setAttribute('data-page-size', String(options.pageSize))
      if (options.confirmLabel) table.setAttribute('data-confirm-label', String(options.confirmLabel))
      if (options.columnTypes) table.setAttribute('data-column-types', JSON.stringify(options.columnTypes))

      popup.appendChild(table)
      popupManager.appendChild(popup)

      let resolved = false

      table.addEventListener('chooser-select', (e) => {
        if (resolved) return
        resolved = true
        popup.close()
        resolve(ViewSqlTable.projectSelection(e.detail.selection, options))
      })

      table.addEventListener('chooser-cancel', () => {
        if (resolved) return
        resolved = true
        popup.close()
        resolve(null)
      })

      popup.addEventListener('popup-closing', () => {
        if (resolved) return
        resolved = true
        resolve(null)
      })
    })
  }
}

export default ViewSqlTable
