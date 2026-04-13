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
    this.paginationElement = null
    this.tableStatusContainer = null
    this.queryContainer = null
    this._headerControlsElement = null
  }

  connectedCallback() {
    if (this.dataset.ready) return
    this.dataset.ready = '1'

    this.style.display = "contents"

    this.innerHTML = `
      <aside data-element="tables-pane">
        <table data-element="tables-container"></table>
        <output data-element="tables-status"></output>
      </aside>
      <article>
        <table data-element="table-container"></table>
      </article>
      <footer>
        <output data-element="status"></output>
        <view-pagination data-page="0" data-page-size-options="10,20,50,100"></view-pagination>
      </footer>
    `

    this.tablesContainer = this.querySelector('[data-element="tables-container"]')
    this.tablesStatusContainer = this.querySelector('[data-element="tables-status"]')
    this.tableContainer = this.querySelector('[data-element="table-container"]')
    this.paginationElement = this.querySelector('view-pagination')
    this.tableStatusContainer = this.querySelector('[data-element="status"]')

    this._mountHeaderControls()

    this.paginationElement?.addEventListener('change', async (event) => {
      this.currentPage = event.detail.page
      this.pageSize = event.detail.pageSize
      await this.fetchTableData()
    })

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
    this.tablesContainer.innerHTML = ''

    const head = document.createElement('thead')
    head.innerHTML = '<tr><th>Name</th><th>Rows</th></tr>'
    this.tablesContainer.appendChild(head)

    const body = document.createElement('tbody')
    this.tablesContainer.appendChild(body)

    for (const tableInfo of this.tables) {
      const row = document.createElement('tr')
      row.dataset.element = 'table-row'
      row.dataset.table = tableInfo.name
      row.setAttribute('role', 'button')
      row.setAttribute('tabindex', '0')

      const nameCell = document.createElement('td')
      nameCell.textContent = tableInfo.name

      const countCell = document.createElement('td')
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
    this.tableContainer.innerHTML = ''

    const tbody = document.createElement('tbody')

    if (!this.selectedTable) {
      const tr = document.createElement('tr')
      const td = document.createElement('td')
      td.textContent = 'Select a table.'
      tr.appendChild(td)
      tbody.appendChild(tr)
      this.tableContainer.appendChild(tbody)
      return
    }

    if (this.columns.length === 0) {
      const tr = document.createElement('tr')
      const td = document.createElement('td')
      td.textContent = 'No data. Set data-query attribute or check your query.'
      tr.appendChild(td)
      tbody.appendChild(tr)
      this.tableContainer.appendChild(tbody)
      return
    }

    const colgroup = document.createElement('colgroup')
    this.columns.forEach(() => {
      colgroup.appendChild(document.createElement('col'))
    })
    this.tableContainer.appendChild(colgroup)

    const thead = document.createElement('thead')
    const headerRow = document.createElement('tr')
    this.columns.forEach((column) => {
      const th = document.createElement('th')
      th.textContent = column
      th.dataset.column = column
      headerRow.appendChild(th)
    })
    thead.appendChild(headerRow)
    this.tableContainer.appendChild(thead)

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
    this.tableContainer.appendChild(tbody)
  }

  renderCell(td, value, column) {
    const colType = this.detectColumnType(column, value)

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
    if (!this.paginationElement) return
    this.paginationElement.page = this.currentPage
    this.paginationElement.pageSize = this.pageSize
    this.paginationElement.totalCount = this.totalCount
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
