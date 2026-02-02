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
}
