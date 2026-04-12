import { runtime } from '../core/runtime.js'
import { parseCSVLines } from '../util/csv.js'

const textDecoder = new TextDecoder()

function decodeOutput(result) {
  return textDecoder.decode(result?.output || new Uint8Array())
}

function quoteIdent(name) {
  return String(name).replace(/"/g, '""')
}

export class ViewSql extends HTMLElement {
  constructor() {
    super()
    this.tables = []
    this.selectedTable = null
    this.rows = []
    this.columns = []
    this.currentPage = 0
    this.pageSize = parseInt(this.getAttribute('data-page-size') || '20', 10)
    this.totalCount = 0
    this.tablesContainer = null
    this.tablesStatusContainer = null
    this.tableContainer = null
    this.paginationContainer = null
    this.tableStatusContainer = null
    this.queryContainer = null
    this._headerControlsElement = null
  }

  connectedCallback() {
    if (this.dataset.ready) return
    this.dataset.ready = '1'

    this.style.display = 'flex'
    this.style.width = '100%'
    this.style.height = '100%'
    this.style.minHeight = '0'

    this.innerHTML = `
      <section data-element="sql-layout" style="display:grid; grid-template-columns: minmax(0,10rem) minmax(0, 1fr); width:100%; height:100%; min-height:0;">
        <section data-element="tables-pane" style="display:flex; flex-direction:column; min-height:0; border-right: var(--border, 1px solid var(--fg-separator));">
          <main data-element="list-container" style="flex:1; min-height:0; overflow:auto;"></main>
          <footer data-element="tables-status"></footer>
        </section>
        <section data-element="table-pane" style="display:flex; flex-direction:column; min-width:0; min-height:0;">
          <main data-element="table-container" style="flex:1; min-width:0; min-height:0; overflow:auto;"></main>
          <footer>
            <div data-element="pagination" part="pagination"></div>
            <div data-element="status"></div>
          </footer>
        </section>
      </section>
    `

    this.tablesContainer = this.querySelector('[data-element="list-container"]')
    this.tablesStatusContainer = this.querySelector('[data-element="tables-status"]')
    this.tableContainer = this.querySelector('[data-element="table-container"]')
    this.paginationContainer = this.querySelector('[data-element="pagination"]')
    this.tableStatusContainer = this.querySelector('[data-element="status"]')

    this._mountHeaderControls()

    const toolbar = this._headerControlsElement
    if (toolbar) {
      toolbar.querySelector('[data-action="refresh"]')?.addEventListener('click', () => this.refresh(null))
      toolbar.querySelector('[data-action="create-table"]')?.addEventListener('click', () => this.openCreateTablePopup())
    }

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
      <button data-action="refresh" aria-label="Reload" title="Reload"><i aria-hidden="true">refresh</i></button>
      <button data-action="create-table" aria-label="Create table" title="Create table"><i aria-hidden="true">post_add</i></button>
    `
    return toolbar
  }

  _mountHeaderControls() {
    if (!this.parentElement || this._headerControlsElement) return

    const headerControls = this.createHeaderControlsElement()
    this._headerControlsElement = headerControls
    this.parentElement.appendChild(headerControls)
    this.updateHeaderControlsUI()
  }

  _unmountHeaderControls() {
    if (this._headerControlsElement?.parentElement) {
      this._headerControlsElement.remove()
    }
    this._headerControlsElement = null
  }

  updateHeaderControlsUI() {
  }

  async callSql(sql) {
    const result = await runtime.call('sql', 'query', sql)
    if (result.returnCode !== 0) {
      throw new Error(decodeOutput(result) || `sql query failed: ${result.returnCode}`)
    }
    return decodeOutput(result)
  }

  async refresh(tableToSelect = null) {
    if (tableToSelect !== null) {
      this.selectedTable = tableToSelect
      this.currentPage = 0
    }

    this.setTablesStatus('Loading...')
    this.setTableStatus('Loading...')
    await this.fetchTables()
    this.renderTables()
    if (this.selectedTable) {
      await this.fetchTableData()
    } else {
      this.columns = []
      this.rows = []
      this.totalCount = 0
      this.renderTable()
      this.renderPagination()
      this.setTablesStatus(`${this.tables.length} tables`)
      this.setTableStatus('No table selected')
      this.updateHeaderControlsUI()
    }
  }

  async fetchTables() {
    const schemaQuery = `SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
    const csv = await this.callSql(schemaQuery)
    const lines = parseCSVLines(csv.trim())
    const names = lines.slice(1).map((line) => line[0]).filter(Boolean)

    this.tables = []
    for (const name of names) {
      const countCsv = await this.callSql(`SELECT COUNT(*) as count FROM ${quoteIdent(name)}`)
      const countLines = parseCSVLines(countCsv.trim())
      const rowCount = parseInt(countLines[1][0], 10) || 0
      this.tables.push({ name, rowCount })
    }

    if (!this.selectedTable || !this.tables.some((table) => table.name === this.selectedTable)) {
      this.selectedTable = this.tables[0] ? this.tables[0].name : null
      this.currentPage = 0
    }
  }

  async fetchTableData() {
    if (!this.selectedTable) return

    const tableName = quoteIdent(this.selectedTable)
    const countCsv = await this.callSql(`SELECT COUNT(*) AS count FROM ${tableName}`)
    const countLines = parseCSVLines(countCsv.trim())
    this.totalCount = parseInt(countLines[1][0], 10) || 0

    const offset = this.currentPage * this.pageSize
    const rowsCsv = await this.callSql(`SELECT * FROM ${tableName} LIMIT ${this.pageSize} OFFSET ${offset}`)
    const lines = parseCSVLines(rowsCsv.trim())

    if (lines.length > 0) {
      this.columns = lines[0]
      this.rows = lines.slice(1).map((row) => {
        const obj = {}
        this.columns.forEach((column, index) => {
          obj[column] = row[index] ?? ''
        })
        return obj
      })
    } else {
      this.columns = []
      this.rows = []
    }

    this.renderTable()
    this.renderPagination()
    this.setTablesStatus(`${this.tables.length} tables`)
    this.setTableStatus(`${this.totalCount} rows`)
  }

  async openCreateTablePopup() {
    const result = await runtime.call('ui.popup', 'open', {
      title: 'Create New Table',
      size: 'medium',
      tag: 'sql-table-editor',
      props: { mode: 'create' },
    })

    const payload = JSON.parse(decodeOutput(result) || 'null')
    if (payload?.reload) {
      await this.refresh(payload.tableName ?? null)
    }
  }

  renderTables() {
    if (this.tables.length === 0) {
      this.tablesContainer.innerHTML = '<p>No tables found in database.</p>'
      return
    }

    this.tablesContainer.innerHTML = ''

    const tableElement = document.createElement('table')

    const caption = document.createElement('caption')
    caption.textContent = 'Database tables'
    tableElement.appendChild(caption)

    const head = document.createElement('thead')
    head.innerHTML = '<tr><th>Name</th><th style="text-align: right;">Rows</th></tr>'
    tableElement.appendChild(head)

    const body = document.createElement('tbody')
    tableElement.appendChild(body)

    for (const tableInfo of this.tables) {
      const row = document.createElement('tr')
      row.dataset.element = 'table-row'
      row.dataset.table = tableInfo.name
      row.setAttribute('role', 'button')
      row.setAttribute('tabindex', '0')

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

    this.tablesContainer.appendChild(tableElement)
    this.updateSelectionUI()
    this.updateHeaderControlsUI()
  }

  async selectTable(tableName) {
    if (tableName === this.selectedTable) return
    this.selectedTable = tableName
    this.currentPage = 0
    this.updateSelectionUI()
    this.updateHeaderControlsUI()
    this.setTableStatus(`Loading ${tableName}...`)
    await this.fetchTableData()
  }

  updateSelectionUI() {
    this.querySelectorAll('[data-element="table-row"]').forEach((row) => {
      const isSelected = row.dataset.table === this.selectedTable
      row.setAttribute('aria-selected', isSelected ? 'true' : 'false')
    })
  }

  renderTable() {
    if (!this.selectedTable) {
      this.tableContainer.innerHTML = '<div class="sql-table-empty">Select a table.</div>'
      return
    }

    if (this.columns.length === 0) {
      this.tableContainer.innerHTML = '<div class="sql-table-empty">No data. Set data-query attribute or check your query.</div>'
      return
    }

    const table = document.createElement('table')
    table.className = 'sql-table'

    const colgroup = document.createElement('colgroup')
    this.columns.forEach(() => {
      colgroup.appendChild(document.createElement('col'))
    })
    table.appendChild(colgroup)

    const thead = document.createElement('thead')
    const headerRow = document.createElement('tr')
    this.columns.forEach((column) => {
      const th = document.createElement('th')
      th.textContent = column
      th.dataset.column = column
      headerRow.appendChild(th)
    })
    thead.appendChild(headerRow)
    table.appendChild(thead)

    const tbody = document.createElement('tbody')
    this.rows.forEach((row) => {
      const tr = document.createElement('tr')
      this.columns.forEach((column) => {
        const td = document.createElement('td')
        td.dataset.column = column
        this.renderCell(td, row[column], column)
        tr.appendChild(td)
      })
      tbody.appendChild(tr)
    })
    table.appendChild(tbody)

    this.tableContainer.innerHTML = ''
    this.tableContainer.appendChild(table)
  }

  renderCell(td, value, column) {
    const colType = this.detectColumnType(column, value)
    td.className = `sql-table-cell sql-table-cell-${colType}`

    switch (colType) {
      case 'boolean': {
        const checkbox = document.createElement('input')
        checkbox.type = 'checkbox'
        checkbox.checked = value === '1' || value === 'true' || value === true
        checkbox.disabled = true
        td.appendChild(checkbox)
        break
      }
      case 'number':
        td.textContent = value ?? ''
        td.style.textAlign = 'right'
        break
      default:
        if (value && value.length > 100) {
          td.textContent = value.substring(0, 100) + '...'
          td.title = value
        } else {
          td.textContent = value ?? ''
        }
    }
  }

  detectColumnType(column, value) {
    const lowerCol = String(column || '').toLowerCase()
    const booleanWords = [
      'enabled', 'disabled', 'stackable', 'active', 'visible', 'hidden',
      'locked', 'deleted', 'archived', 'published', 'featured', 'verified',
      'approved', 'completed', 'required', 'optional', 'default'
    ]

    if (booleanWords.includes(lowerCol)) return 'boolean'
    if (typeof value === 'number') return 'number'
    if (typeof value === 'string' && value.trim() && /^-?\d+(\.\d+)?$/.test(value.trim())) return 'number'
    return 'text'
  }

  renderPagination() {
    const totalPages = Math.ceil(this.totalCount / this.pageSize) || 1

    this.paginationContainer.innerHTML = `
      <button data-action="first" aria-label="First page" title="First page" ${this.currentPage === 0 ? 'disabled' : ''}><i aria-hidden="true">first_page</i></button>
      <button data-action="prev" aria-label="Previous page" title="Previous page" ${this.currentPage === 0 ? 'disabled' : ''}><i aria-hidden="true">chevron_left</i></button>
      <span class="sql-table-page-info">Page ${this.currentPage + 1} of ${totalPages}</span>
      <button data-action="next" aria-label="Next page" title="Next page" ${this.currentPage >= totalPages - 1 ? 'disabled' : ''}><i aria-hidden="true">chevron_right</i></button>
      <button data-action="last" aria-label="Last page" title="Last page" ${this.currentPage >= totalPages - 1 ? 'disabled' : ''}><i aria-hidden="true">last_page</i></button>
      <select data-action="page-size">
        ${[10, 20, 50, 100].map(size => `<option value="${size}" ${size === this.pageSize ? 'selected' : ''}>${size} rows</option>`).join('')}
      </select>
    `

    this.paginationContainer.querySelector('[data-action="first"]').addEventListener('click', async () => {
      this.currentPage = 0
      await this.fetchTableData()
    })
    this.paginationContainer.querySelector('[data-action="prev"]').addEventListener('click', async () => {
      if (this.currentPage > 0) {
        this.currentPage--
        await this.fetchTableData()
      }
    })
    this.paginationContainer.querySelector('[data-action="next"]').addEventListener('click', async () => {
      if (this.currentPage < totalPages - 1) {
        this.currentPage++
        await this.fetchTableData()
      }
    })
    this.paginationContainer.querySelector('[data-action="last"]').addEventListener('click', async () => {
      this.currentPage = totalPages - 1
      await this.fetchTableData()
    })
    this.paginationContainer.querySelector('[data-action="page-size"]').addEventListener('change', async (event) => {
      this.pageSize = parseInt(event.target.value, 10)
      this.currentPage = 0
      await this.fetchTableData()
    })
  }

  setTablesStatus(text) {
    this.tablesStatusContainer.textContent = text
  }

  setTableStatus(text) {
    this.tableStatusContainer.textContent = text
  }
}

if (!customElements.get('view-sql')) {
  customElements.define('view-sql', ViewSql)
}
