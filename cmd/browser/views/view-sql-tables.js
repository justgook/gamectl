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
  static get viewMeta() { return { displayName: 'Tables', category: 'Data' } }

  constructor() {
    super()
    this.tables = []
    this.selectedTable = null
    this._headerControlsElement = null
    this.listContainer = null
    this.statusContainer = null
  }

  connectedCallback() {
    this.style.display = 'flex'
    this.style.flexDirection = 'column'
    this.style.width = '100%'
    this.style.height = '100%'
    this.style.minHeight = '0'

    this.innerHTML = `
      <section style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
        <main data-element="list-container" style="flex: 1; min-height: 0; overflow: auto;"></main>
        <footer data-element="status"></footer>
      </section>
    `

    this._mountHeaderControls()

    this.listContainer = this.querySelector('[data-element="list-container"]')
    this.statusContainer = this.querySelector('[data-element="status"]')

    // Toolbar buttons
    const toolbar = this._headerControlsElement
    if (toolbar) {
      toolbar.querySelector('[data-action="refresh"]')?.addEventListener('click', () => this.refresh())
      toolbar.querySelector('[data-action="new-table"]')?.addEventListener('click', () => this.showCreateTablePopup())
    }

    // Initial data load
    this.refresh()
  }

  disconnectedCallback() {
    this._unmountHeaderControls()
  }

  createHeaderControlsElement() {
    const toolbar = document.createElement('div')
    toolbar.dataset.element = 'toolbar'
    toolbar.setAttribute('slot', 'header-controls')
    toolbar.innerHTML = `
      <button data-action="refresh" aria-label="Refresh" title="Refresh"><i aria-hidden="true">refresh</i></button>
      <button data-action="new-table" aria-label="Create New Table" title="Create New Table"><i aria-hidden="true">post_add</i></button>
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

  async refresh() {
    this.setStatus('Loading...')
    try {
      await this.fetchTables()
      this.render()
      this.setStatus(`${this.tables.length} tables`)
    } catch (error) {
      this.setStatus(`Error: ${error.message}`, 'danger')
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
      this.listContainer.innerHTML = '<p style="padding: var(--space-3); color: var(--text-muted);">No tables found in database.</p>'
      return
    }

    this.listContainer.innerHTML = ''

    const tableElement = document.createElement('table')
    tableElement.style.width = '100%'
    tableElement.style.tableLayout = 'fixed'

    const caption = document.createElement('caption')
    caption.textContent = 'Database tables'
    tableElement.appendChild(caption)

    const head = document.createElement('thead')
    head.innerHTML = '<tr><th>Name</th><th style="width: 120px; text-align: right;">Rows</th></tr>'
    tableElement.appendChild(head)

    const body = document.createElement('tbody')
    tableElement.appendChild(body)

    for (const tableInfo of this.tables) {
      const row = document.createElement('tr')
      row.dataset.element = 'table-row'
      row.dataset.table = tableInfo.name
      row.setAttribute('role', 'button')
      row.setAttribute('tabindex', '0')
      row.style.cursor = 'pointer'

      const nameCell = document.createElement('td')
      nameCell.textContent = tableInfo.name

      const countCell = document.createElement('td')
      countCell.style.textAlign = 'right'
      countCell.textContent = tableInfo.rowCount >= 0 ? String(tableInfo.rowCount) : '?'

      row.appendChild(nameCell)
      row.appendChild(countCell)

      row.addEventListener('click', () => this.selectTable(tableInfo.name))
      row.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          this.selectTable(tableInfo.name)
        }
      })

      body.appendChild(row)
    }

    this.listContainer.appendChild(tableElement)
    this.updateSelectionUI()
  }

  selectTable(tableName) {
    this.selectedTable = tableName
    this.updateSelectionUI()

    // Emit event for all view-sql-table components
    bus.emit('sql-table:select', { table: tableName })

    this.setStatus(`Selected: ${tableName}`)
  }

  updateSelectionUI() {
    this.querySelectorAll('[data-element="table-row"]').forEach((row) => {
      const isSelected = row.dataset.table === this.selectedTable
      row.setAttribute('aria-selected', isSelected ? 'true' : 'false')
    })
  }

  setStatus(text, tone = null) {
    if (this.statusContainer) {
      this.statusContainer.textContent = text
      this.statusContainer.classList.remove('accent', 'success', 'warning', 'danger', 'info')
      if (tone) {
        this.statusContainer.classList.add(tone)
      }
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
    const content = document.createElement('form')
    content.setAttribute('novalidate', '')
    content.style.display = 'flex'
    content.style.flexDirection = 'column'
    content.style.gap = 'var(--space-4)'
    content.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: var(--space-2);">
        <label for="new-table-name">Table name</label>
        <input id="new-table-name" type="text" data-field="table-name" placeholder="my_table" autocomplete="off">
      </div>

      <section style="display: flex; flex-direction: column; gap: var(--space-2);">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: var(--space-3);">
          <strong>Columns</strong>
          <button type="button" data-action="add-column">Add column</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th style="width: 56px; text-align: center;">PK</th>
              <th style="width: 56px; text-align: center;">AI</th>
              <th style="width: 56px; text-align: center;">NN</th>
              <th style="width: 56px;"></th>
            </tr>
          </thead>
          <tbody data-element="columns"></tbody>
        </table>
      </section>

      <footer style="display: flex; justify-content: flex-end; gap: var(--space-2);">
        <button type="button" data-action="cancel">Cancel</button>
        <button type="submit" data-action="create" class="accent">Create table</button>
      </footer>
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

    content.addEventListener('submit', async (event) => {
      event.preventDefault()
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
    const row = document.createElement('tr')
    row.dataset.element = 'column-row'

    const nameCell = document.createElement('td')
    const nameInput = document.createElement('input')
    nameInput.type = 'text'
    nameInput.dataset.field = 'column-name'
    nameInput.placeholder = 'column_name'
    nameInput.value = name
    nameInput.autocomplete = 'off'
    nameInput.style.width = '100%'
    nameCell.appendChild(nameInput)

    const typeCell = document.createElement('td')
    const typeSelect = document.createElement('select')
    typeSelect.dataset.field = 'column-type'
    for (const optionType of ['TEXT', 'INTEGER', 'REAL', 'BLOB', 'NUMERIC']) {
      const option = document.createElement('option')
      option.value = optionType
      option.textContent = optionType
      option.selected = optionType === type
      typeSelect.appendChild(option)
    }
    typeSelect.style.width = '100%'
    typeCell.appendChild(typeSelect)

    const primaryCell = document.createElement('td')
    primaryCell.style.textAlign = 'center'
    const primaryInput = document.createElement('input')
    primaryInput.type = 'checkbox'
    primaryInput.dataset.field = 'primary-key'
    primaryInput.checked = isPrimaryKey
    primaryInput.title = 'Primary Key'
    primaryCell.appendChild(primaryInput)

    const autoCell = document.createElement('td')
    autoCell.style.textAlign = 'center'
    const autoInput = document.createElement('input')
    autoInput.type = 'checkbox'
    autoInput.dataset.field = 'auto-increment'
    autoInput.checked = isAutoIncrement
    autoInput.title = 'Auto Increment (INTEGER only)'
    autoCell.appendChild(autoInput)

    const notNullCell = document.createElement('td')
    notNullCell.style.textAlign = 'center'
    const notNullInput = document.createElement('input')
    notNullInput.type = 'checkbox'
    notNullInput.dataset.field = 'not-null'
    notNullInput.title = 'Not Null'
    notNullCell.appendChild(notNullInput)

    const removeCell = document.createElement('td')
    removeCell.style.textAlign = 'center'
    const removeButton = document.createElement('button')
    removeButton.type = 'button'
    removeButton.dataset.action = 'remove-column'
    removeButton.title = 'Remove Column'
    removeButton.textContent = 'Remove'
    removeCell.appendChild(removeButton)

    row.appendChild(nameCell)
    row.appendChild(typeCell)
    row.appendChild(primaryCell)
    row.appendChild(autoCell)
    row.appendChild(notNullCell)
    row.appendChild(removeCell)

    // Remove column handler
    removeButton.addEventListener('click', () => {
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
      tableNameInput.classList.add('danger')
      tableNameInput.focus()
      return
    }

    // Validate table name (alphanumeric and underscore only)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      tableNameInput.classList.add('danger')
      this.setStatus('Error: Invalid table name', 'danger')
      return
    }

    tableNameInput.classList.remove('danger')

    // Collect columns
    const columnRows = content.querySelectorAll('[data-element="column-row"]')
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
      this.setStatus('Error: At least one column required', 'danger')
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
      this.setStatus(`Created table: ${tableName}`, 'success')
      popup.close()

      // Refresh the table list
      await this.refresh()

      // Select the newly created table
      this.selectTable(tableName)
    } catch (error) {
      this.setStatus(`Error: ${error.message}`, 'danger')
      console.error('Create table failed:', error)
    }
  }
}

export default ViewSqlTables
