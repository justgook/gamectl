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
  static observedAttributes = ['data-query', 'data-count-query', 'data-table', 'data-page-size', 'data-column-types']

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
    this.tableContainer = null
    this.paginationContainer = null
    this.statusContainer = null
  }

  connectedCallback() {
    this.style.display = 'flex'
    this.style.flexDirection = 'column'
    this.style.width = '100%'
    this.style.height = '100%'
    this.setAttribute('tabindex', '0')

    const template = document.getElementById('view-sql-table')
    const content = template.content.cloneNode(true)
    this.appendChild(content)

    this.tableContainer = this.querySelector('[data-element="table-container"]')
    this.paginationContainer = this.querySelector('[data-element="pagination"]')
    this.statusContainer = this.querySelector('[data-element="status"]')

    // Parse attributes
    this.pageSize = parseInt(this.getAttribute('data-page-size') || '20', 10)
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
    const toolbar = this.querySelector('[data-element="toolbar"]')
    if (toolbar) {
      toolbar.querySelector('[data-action="refresh"]')?.addEventListener('click', () => this.refresh())
      toolbar.querySelector('[data-action="insert"]')?.addEventListener('click', () => this.insertRow())
    }

    // Initial data load
    this.refresh()
  }

  disconnectedCallback() {
    // Cleanup if needed
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue && this.tableContainer) {
      if (name === 'data-column-types') {
        this.parseColumnTypes()
      }
      this.currentPage = 0
      this.refresh()
    }
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
    if (e.key === 'Insert' || (e.key === 'n' && e.ctrlKey)) {
      this.insertRow()
      e.preventDefault()
    } else if (e.key === 'Delete' && e.ctrlKey) {
      const selectedRow = this.querySelector('tr.selected')
      if (selectedRow) {
        const rowIndex = parseInt(selectedRow.dataset.rowIndex, 10)
        this.deleteRow(rowIndex)
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
    const lines = csv.trim().split('\n')
    return lines.map(line => this.parseCSVLine(line))
  }

  parseCSVLine(line) {
    const result = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }
    result.push(current)

    return result
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

      // Row number
      const tdNum = document.createElement('td')
      tdNum.className = 'sql-table-row-num'
      tdNum.textContent = this.currentPage * this.pageSize + rowIndex + 1
      tdNum.addEventListener('click', (e) => {
        this.selectRow(tr, e.shiftKey)
      })
      tr.appendChild(tdNum)

      this.columns.forEach((col, colIndex) => {
        const td = document.createElement('td')
        td.dataset.column = col
        td.dataset.rowIndex = rowIndex
        td.dataset.colIndex = colIndex

        this.renderCell(td, row[col], col)

        td.addEventListener('dblclick', () => {
          this.startEdit(td, rowIndex, colIndex, row[col], col)
        })

        tr.appendChild(td)
      })

      tbody.appendChild(tr)
    })

    table.appendChild(tbody)
    this.tableContainer.innerHTML = ''
    this.tableContainer.appendChild(table)
  }

  renderCell(td, value, column) {
    const colType = this.columnTypes[column] || this.detectColumnType(value)

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

  detectColumnType(value) {
    if (value === null || value === undefined || value === '') {
      return 'text'
    }

    // Check if it looks like base64 image
    if (typeof value === 'string' && value.length > 100) {
      // Common base64 image signatures
      if (value.startsWith('iVBOR') || // PNG
          value.startsWith('/9j/') || // JPEG
          value.startsWith('R0lGOD') || // GIF
          value.startsWith('UklGR')) { // WebP
        return 'image-base64'
      }
    }

    // Check for boolean-ish
    if (value === '0' || value === '1' || value === 'true' || value === 'false') {
      return 'boolean'
    }

    // Check for number
    if (!isNaN(parseFloat(value)) && isFinite(value)) {
      return 'number'
    }

    return 'text'
  }

  renderPagination() {
    if (!this.paginationContainer) return

    const totalPages = Math.ceil(this.totalCount / this.pageSize) || 1

    this.paginationContainer.innerHTML = `
      <button data-action="first" ${this.currentPage === 0 ? 'disabled' : ''}>&laquo;</button>
      <button data-action="prev" ${this.currentPage === 0 ? 'disabled' : ''}>&lsaquo;</button>
      <span class="sql-table-page-info">Page ${this.currentPage + 1} of ${totalPages}</span>
      <button data-action="next" ${this.currentPage >= totalPages - 1 ? 'disabled' : ''}>&rsaquo;</button>
      <button data-action="last" ${this.currentPage >= totalPages - 1 ? 'disabled' : ''}>&raquo;</button>
      <select data-action="page-size">
        ${[10, 20, 50, 100].map(size => 
          `<option value="${size}" ${size === this.pageSize ? 'selected' : ''}>${size} rows</option>`
        ).join('')}
      </select>
    `

    // Event handlers
    this.paginationContainer.querySelector('[data-action="first"]').addEventListener('click', () => {
      this.currentPage = 0
      this.refresh()
    })
    this.paginationContainer.querySelector('[data-action="prev"]').addEventListener('click', () => {
      if (this.currentPage > 0) {
        this.currentPage--
        this.refresh()
      }
    })
    this.paginationContainer.querySelector('[data-action="next"]').addEventListener('click', () => {
      const totalPages = Math.ceil(this.totalCount / this.pageSize)
      if (this.currentPage < totalPages - 1) {
        this.currentPage++
        this.refresh()
      }
    })
    this.paginationContainer.querySelector('[data-action="last"]').addEventListener('click', () => {
      const totalPages = Math.ceil(this.totalCount / this.pageSize)
      this.currentPage = totalPages - 1
      this.refresh()
    })
    this.paginationContainer.querySelector('[data-action="page-size"]').addEventListener('change', (e) => {
      this.pageSize = parseInt(e.target.value, 10)
      this.currentPage = 0
      this.refresh()
    })
  }

  setStatus(text) {
    if (this.statusContainer) {
      this.statusContainer.textContent = text
    }
  }

  selectRow(tr, addToSelection) {
    if (!addToSelection) {
      this.querySelectorAll('tr.selected').forEach(row => row.classList.remove('selected'))
    }
    tr.classList.toggle('selected')
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

    const colType = this.columnTypes[column] || this.detectColumnType(currentValue)

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
      await this.refresh()
    } catch (error) {
      this.setStatus(`Delete error: ${error.message}`)
      console.error('Delete failed:', error)
    }
  }
}
