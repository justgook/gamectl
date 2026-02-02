import { bus } from "../systems/event-bus.js"

/**
 * ViewSqlTables - Lists all database tables with row counts
 * 
 * Usage:
 * <view-sql-tables></view-sql-tables>
 * 
 * Emits:
 * - sql-table:select: { table: 'tableName' } when a table is clicked
 * 
 * All view-sql-table components will listen for this event and update accordingly.
 */
export class ViewSqlTables extends HTMLElement {
  constructor() {
    super()
    this.tables = []
    this.selectedTable = null
    this.listContainer = null
    this.statusContainer = null
  }

  connectedCallback() {
    this.style.display = 'flex'
    this.style.flexDirection = 'column'
    this.style.width = '100%'
    this.style.height = '100%'

    const template = document.getElementById('view-sql-tables')
    const content = template.content.cloneNode(true)
    this.appendChild(content)

    this.listContainer = this.querySelector('[data-element="list-container"]')
    this.statusContainer = this.querySelector('[data-element="status"]')

    // Toolbar buttons
    const toolbar = this.querySelector('[data-element="toolbar"]')
    if (toolbar) {
      toolbar.querySelector('[data-action="refresh"]')?.addEventListener('click', () => this.refresh())
      toolbar.querySelector('[data-action="new-table"]')?.addEventListener('click', () => this.showCreateTablePopup())
    }

    // Initial data load
    this.refresh()
  }

  disconnectedCallback() {
    // Cleanup if needed
  }

  async refresh() {
    this.setStatus('Loading...')
    try {
      await this.fetchTables()
      this.render()
      this.setStatus(`${this.tables.length} tables`)
    } catch (error) {
      this.setStatus(`Error: ${error.message}`)
      console.error('ViewSqlTables error:', error)
    }
  }

  async fetchTables() {
    // Get all user tables (exclude sqlite internal tables)
    const schemaQuery = `SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
    const result = await window.pluginManager.call('sql', 'query', schemaQuery)
    const csv = new TextDecoder().decode(result.output)
    const lines = csv.trim().split('\n')

    // Skip header row, get table names
    const tableNames = lines.slice(1).filter(line => line.trim())

    // Get row count for each table
    this.tables = []
    for (const tableName of tableNames) {
      try {
        const countQuery = `SELECT COUNT(*) as count FROM "${tableName}"`
        const countResult = await window.pluginManager.call('sql', 'query', countQuery)
        const countCsv = new TextDecoder().decode(countResult.output)
        const countLines = countCsv.trim().split('\n')
        const rowCount = countLines.length >= 2 ? parseInt(countLines[1], 10) || 0 : 0

        this.tables.push({
          name: tableName,
          rowCount: rowCount
        })
      } catch (e) {
        // If count fails, still show table with unknown count
        this.tables.push({
          name: tableName,
          rowCount: -1
        })
      }
    }
  }

  render() {
    if (!this.listContainer) return

    if (this.tables.length === 0) {
      this.listContainer.innerHTML = '<div class="sql-tables-empty">No tables found in database.</div>'
      return
    }

    this.listContainer.innerHTML = ''

    for (const table of this.tables) {
      const item = document.createElement('div')
      item.className = 'sql-tables-item'
      if (table.name === this.selectedTable) {
        item.classList.add('selected')
      }

      const nameSpan = document.createElement('span')
      nameSpan.className = 'sql-tables-item-name'
      nameSpan.textContent = table.name

      const countSpan = document.createElement('span')
      countSpan.className = 'sql-tables-item-count'
      countSpan.textContent = table.rowCount >= 0 ? `${table.rowCount} rows` : '?'

      item.appendChild(nameSpan)
      item.appendChild(countSpan)

      item.addEventListener('click', () => this.selectTable(table.name))

      this.listContainer.appendChild(item)
    }
  }

  selectTable(tableName) {
    this.selectedTable = tableName

    // Update visual selection
    this.querySelectorAll('.sql-tables-item').forEach(item => {
      const nameSpan = item.querySelector('.sql-tables-item-name')
      if (nameSpan && nameSpan.textContent === tableName) {
        item.classList.add('selected')
      } else {
        item.classList.remove('selected')
      }
    })

    // Emit event for all view-sql-table components
    bus.emit('sql-table:select', { table: tableName })

    this.setStatus(`Selected: ${tableName}`)
  }

  setStatus(text) {
    if (this.statusContainer) {
      this.statusContainer.textContent = text
    }
  }

  /**
   * Show popup to create a new table
   */
  showCreateTablePopup() {
    const popupManager = document.querySelector('popup-manager')
    if (!popupManager) {
      console.error('PopupManager not found')
      return
    }

    // Build popup content
    const content = document.createElement('div')
    content.className = 'create-table-form'
    content.innerHTML = `
      <div class="create-table-field">
        <label class="create-table-label">Table Name</label>
        <input type="text" class="create-table-input" data-field="table-name" placeholder="my_table" autocomplete="off">
      </div>
      <div class="create-table-section">
        <div class="create-table-section-header">
          <label class="create-table-label">Columns</label>
          <button type="button" class="button-secondary create-table-add-column" data-action="add-column">+ Add Column</button>
        </div>
        <div class="create-table-columns" data-element="columns">
          <!-- Column rows will be added here -->
        </div>
      </div>
      <div class="create-table-actions">
        <button type="button" class="button-secondary" data-action="cancel">Cancel</button>
        <button type="button" class="button-primary" data-action="create">Create Table</button>
      </div>
    `

    const popup = popupManager.showPopup({
      title: 'Create New Table',
      content: content,
      size: 'medium'
    })

    // Add initial column (id as primary key)
    const columnsContainer = content.querySelector('[data-element="columns"]')
    this._addColumnRow(columnsContainer, 'id', 'INTEGER', true, true)
    this._addColumnRow(columnsContainer, '', 'TEXT', false, false)

    // Event handlers
    content.querySelector('[data-action="add-column"]').addEventListener('click', () => {
      this._addColumnRow(columnsContainer, '', 'TEXT', false, false)
    })

    content.querySelector('[data-action="cancel"]').addEventListener('click', () => {
      popup.close()
    })

    content.querySelector('[data-action="create"]').addEventListener('click', async () => {
      await this._handleCreateTable(content, popup)
    })

    // Focus table name input
    setTimeout(() => {
      content.querySelector('[data-field="table-name"]').focus()
    }, 100)
  }

  /**
   * Add a column row to the columns container
   */
  _addColumnRow(container, name = '', type = 'TEXT', isPrimaryKey = false, isAutoIncrement = false) {
    const row = document.createElement('div')
    row.className = 'create-table-column-row'
    row.innerHTML = `
      <input type="text" class="create-table-input create-table-column-name" data-field="column-name" placeholder="column_name" value="${name}" autocomplete="off">
      <select class="create-table-select" data-field="column-type">
        <option value="TEXT" ${type === 'TEXT' ? 'selected' : ''}>TEXT</option>
        <option value="INTEGER" ${type === 'INTEGER' ? 'selected' : ''}>INTEGER</option>
        <option value="REAL" ${type === 'REAL' ? 'selected' : ''}>REAL</option>
        <option value="BLOB" ${type === 'BLOB' ? 'selected' : ''}>BLOB</option>
        <option value="NUMERIC" ${type === 'NUMERIC' ? 'selected' : ''}>NUMERIC</option>
      </select>
      <label class="create-table-checkbox-label" title="Primary Key">
        <input type="checkbox" data-field="primary-key" ${isPrimaryKey ? 'checked' : ''}>
        <span>PK</span>
      </label>
      <label class="create-table-checkbox-label" title="Auto Increment (INTEGER only)">
        <input type="checkbox" data-field="auto-increment" ${isAutoIncrement ? 'checked' : ''}>
        <span>AI</span>
      </label>
      <label class="create-table-checkbox-label" title="Not Null">
        <input type="checkbox" data-field="not-null">
        <span>NN</span>
      </label>
      <button type="button" class="create-table-remove-column" data-action="remove-column" title="Remove Column">&times;</button>
    `

    // Remove column handler
    row.querySelector('[data-action="remove-column"]').addEventListener('click', () => {
      row.remove()
    })

    container.appendChild(row)
  }

  /**
   * Handle create table button click
   */
  async _handleCreateTable(content, popup) {
    const tableNameInput = content.querySelector('[data-field="table-name"]')
    const tableName = tableNameInput.value.trim()

    if (!tableName) {
      tableNameInput.classList.add('error')
      tableNameInput.focus()
      return
    }

    // Validate table name (alphanumeric and underscore only)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      tableNameInput.classList.add('error')
      this.setStatus('Error: Invalid table name')
      return
    }

    tableNameInput.classList.remove('error')

    // Collect columns
    const columnRows = content.querySelectorAll('.create-table-column-row')
    const columns = []

    for (const row of columnRows) {
      const colName = row.querySelector('[data-field="column-name"]').value.trim()
      if (!colName) continue // Skip empty column names

      const colType = row.querySelector('[data-field="column-type"]').value
      const isPrimaryKey = row.querySelector('[data-field="primary-key"]').checked
      const isAutoIncrement = row.querySelector('[data-field="auto-increment"]').checked
      const isNotNull = row.querySelector('[data-field="not-null"]').checked

      columns.push({
        name: colName,
        type: colType,
        primaryKey: isPrimaryKey,
        autoIncrement: isAutoIncrement,
        notNull: isNotNull
      })
    }

    if (columns.length === 0) {
      this.setStatus('Error: At least one column required')
      return
    }

    // Build CREATE TABLE SQL
    const columnDefs = columns.map(col => {
      let def = `"${col.name}" ${col.type}`
      if (col.primaryKey) def += ' PRIMARY KEY'
      if (col.autoIncrement && col.type === 'INTEGER') def += ' AUTOINCREMENT'
      if (col.notNull && !col.primaryKey) def += ' NOT NULL'
      return def
    })

    const sql = `CREATE TABLE "${tableName}" (\n  ${columnDefs.join(',\n  ')}\n)`

    try {
      await window.pluginManager.call('sql', 'exec', sql)
      this.setStatus(`Created table: ${tableName}`)
      popup.close()
      
      // Refresh the table list
      await this.refresh()
      
      // Select the newly created table
      this.selectTable(tableName)
    } catch (error) {
      this.setStatus(`Error: ${error.message}`)
      console.error('Create table failed:', error)
    }
  }
}
