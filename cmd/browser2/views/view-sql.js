import { runtime } from '../core/runtime.js'
import { parseCSVLines } from '../util/csv.js'

const textDecoder = new TextDecoder()

function decodeOutput(result) {
  return textDecoder.decode(result?.output || new Uint8Array())
}

function quoteIdent(name) {
  return String(name).replace(/"/g, '""')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

export class ViewSql extends HTMLElement {
  static get observedAttributes() {
    return [
      'data-mode',
      'data-query',
      'data-count-query',
      'data-page-size',
      'data-confirm-label',
      'data-return-column',
      'data-return-fields',
    ]
  }

  constructor() {
    super()
    this.popupProps = this.popupProps || {}
    this.tables = []
    this.selectedTable = null
    this.rows = []
    this.columns = []
    this.currentPage = 0
    this.pageSize = 20
    this.totalCount = 0
    this.mode = 'browser'
    this.query = ''
    this.countQuery = ''
    this.confirmLabel = 'Select'
    this.returnColumn = ''
    this.returnFields = []
    this.selectedRowIndex = -1
    this.tablesPaneElement = null
    this.tablesContainer = null
    this.tablesStatusContainer = null
    this.tableContainer = null
    this.paginationElement = null
    this.tableStatusContainer = null
    this.actionCancelButton = null
    this.actionSelectButton = null
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
      <footer data-element="footer">
        <output data-element="status"></output>
        <view-pagination data-page="0" data-page-size-options="10,20,50,100"></view-pagination>
      </footer>
    `

    this.tablesPaneElement = this.querySelector('[data-element="tables-pane"]')
    this.tablesContainer = this.querySelector('[data-element="tables-container"]')
    this.tablesStatusContainer = this.querySelector('[data-element="tables-status"]')
    this.tableContainer = this.querySelector('[data-element="table-container"]')
    this.paginationElement = this.querySelector('view-pagination')
    this.tableStatusContainer = this.querySelector('[data-element="status"]')

    this.readConfig()
    this._mountHeaderControls()
    this.renderFooter()
    this.updateModeUI()

    this.paginationElement?.addEventListener('change', async (event) => {
      this.currentPage = event.detail.page
      this.pageSize = event.detail.pageSize
      if (this.mode === 'chooser') {
        await this.fetchQueryData()
        this.renderTable()
        this.renderPagination()
        this.updateChooserUI()
        this.setTableStatus(`${this.totalCount} rows`)
        return
      }
      await this.fetchTableData()
    })

    const toolbar = this._headerControlsElement
    if (toolbar) {
      toolbar.querySelector('[data-action="refresh"]')?.addEventListener('click', () => this.refresh(null))
      toolbar.querySelector('[data-action="create-table"]')?.addEventListener('click', () => this.openCreateTablePopup())
    }

    this.addEventListener('keydown', (event) => this.handleKeyDown(event))

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
    if (!this._headerControlsElement) return
    const createTableButton = this._headerControlsElement.querySelector('[data-action="create-table"]')
    if (createTableButton instanceof HTMLButtonElement) {
      createTableButton.disabled = this.mode !== 'browser'
    }
  }

  readConfig() {
    const props = this.popupProps || {}
    this.mode = String(props.mode || this.getAttribute('data-mode') || 'browser')
    this.query = String(props.query || this.getAttribute('data-query') || '')
    this.countQuery = String(props.countQuery || this.getAttribute('data-count-query') || '')
    this.confirmLabel = String(props.confirmLabel || this.getAttribute('data-confirm-label') || 'Select')
    this.returnColumn = String(props.returnColumn || this.getAttribute('data-return-column') || '')
    const returnFieldsInput = props.returnFields ?? this.getAttribute('data-return-fields') ?? ''
    this.returnFields = Array.isArray(returnFieldsInput)
      ? returnFieldsInput.map((field) => String(field)).filter(Boolean)
      : String(returnFieldsInput)
        .split(',')
        .map((field) => field.trim())
        .filter(Boolean)

    const pageSizeValue = props.pageSize ?? this.getAttribute('data-page-size') ?? '20'
    const parsedPageSize = parseInt(String(pageSizeValue), 10)
    this.pageSize = Number.isFinite(parsedPageSize) && parsedPageSize > 0 ? parsedPageSize : 20
  }

  renderFooter() {
    const footer = this.querySelector('[data-element="footer"]')
    if (!(footer instanceof HTMLElement)) return

    this.actionCancelButton?.remove()
    this.actionSelectButton?.remove()
    this.actionCancelButton = null
    this.actionSelectButton = null

    if (this.mode !== 'chooser') return

    this.actionCancelButton = document.createElement('button')
    this.actionCancelButton.type = 'button'
    this.actionCancelButton.dataset.action = 'cancel'
    this.actionCancelButton.textContent = 'Cancel'
    this.actionCancelButton.addEventListener('click', async () => {
      await runtime.call('ui.popup', 'close', { cancelled: true, ok: false })
    })
    footer.appendChild(this.actionCancelButton)

    this.actionSelectButton = document.createElement('button')
    this.actionSelectButton.type = 'button'
    this.actionSelectButton.dataset.action = 'select'
    this.actionSelectButton.classList.add('accent')
    this.actionSelectButton.textContent = this.confirmLabel
    this.actionSelectButton.addEventListener('click', async () => {
      await this.confirmSelection()
    })
    footer.appendChild(this.actionSelectButton)
  }

  updateModeUI() {
    if (this.tablesPaneElement instanceof HTMLElement) {
      this.tablesPaneElement.hidden = this.mode === 'chooser'
    }
    this.updateHeaderControlsUI()
    this.updateChooserUI()
  }

  async callSql(sql) {
    const result = await runtime.call('sql', 'query', sql)
    if (result.returnCode !== 0) {
      throw new Error(decodeOutput(result) || `sql query failed: ${result.returnCode}`)
    }
    return decodeOutput(result)
  }

  async refresh(tableToSelect = null) {
    this.readConfig()
    this.renderFooter()
    this.updateModeUI()

    if (this.mode === 'chooser') {
      this.setTableStatus('Loading...')
      this.setTablesStatus('')
      this.selectedTable = null
      this.selectedRowIndex = -1
      await this.fetchQueryData()
      this.renderTable()
      this.renderPagination()
      this.updateChooserUI()
      this.setTableStatus(`${this.totalCount} rows`)
      return
    }

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

  interpolateQuery(query, params) {
    return String(query).replace(/:(\w+)/g, (match, name) => {
      if (!(name in params)) return match
      const value = params[name]
      if (typeof value === 'string') {
        return `'${value.replace(/'/g, "''")}'`
      }
      return String(value)
    })
  }

  async fetchQueryData() {
    assert(this.query, 'view-sql chooser mode requires query')
    assert(this.countQuery, 'view-sql chooser mode requires countQuery')

    const params = {
      offset: this.currentPage * this.pageSize,
      limit: this.pageSize,
      pageSize: this.pageSize,
      page: this.currentPage,
    }

    const countCsv = await this.callSql(this.interpolateQuery(this.countQuery, params))
    const countLines = parseCSVLines(countCsv.trim())
    this.totalCount = parseInt(countLines[1]?.[0] || '0', 10) || 0

    const rowsCsv = await this.callSql(this.interpolateQuery(this.query, params))
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

    if (this.mode !== 'chooser' && !this.selectedTable) {
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

    this.rows.forEach((row, rowIndex) => {
      const tr = document.createElement('tr')
      tr.dataset.rowIndex = String(rowIndex)
      tr.setAttribute('aria-selected', rowIndex === this.selectedRowIndex ? 'true' : 'false')
      tr.addEventListener('click', () => this.selectRow(rowIndex))
      tr.addEventListener('dblclick', async () => {
        this.selectRow(rowIndex)
        if (this.mode === 'chooser') await this.confirmSelection()
      })

      this.columns.forEach((column) => {
        const td = document.createElement('td')
        td.dataset.column = column
        this.renderCell(td, row[column], column)
        tr.appendChild(td)
      })
      tbody.appendChild(tr)
    })
    this.tableContainer.appendChild(tbody)
    this.updateChooserUI()
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

  selectRow(rowIndex) {
    this.selectedRowIndex = rowIndex
    this.querySelectorAll('tr[data-row-index]').forEach((row) => {
      row.setAttribute('aria-selected', Number(row.dataset.rowIndex) === rowIndex ? 'true' : 'false')
    })
    this.updateChooserUI()
  }

  getSelection() {
    const row = this.rows[this.selectedRowIndex]
    if (!row) return null

    const primaryKey = this.columns.includes('id') ? 'id' : this.columns[0] || null
    return {
      row,
      rowIndex: this.selectedRowIndex,
      primaryKey,
      primaryKeyValue: primaryKey ? row[primaryKey] ?? null : null,
    }
  }

  projectSelection(selection) {
    if (!selection) return null

    let value = selection.row
    if (this.returnColumn) {
      value = selection.row?.[this.returnColumn]
    } else if (this.returnFields.length > 0) {
      value = {}
      for (const field of this.returnFields) {
        value[field] = selection.row?.[field]
      }
    }

    return {
      ...selection,
      value,
    }
  }

  updateChooserUI() {
    if (this.mode !== 'chooser') return
    const selection = this.getSelection()
    if (this.actionSelectButton instanceof HTMLButtonElement) {
      this.actionSelectButton.textContent = this.confirmLabel
      this.actionSelectButton.disabled = !selection
    }
    this.dispatchEvent(new CustomEvent('selection-changed', {
      bubbles: true,
      detail: { selection: this.projectSelection(selection) },
    }))
  }

  async confirmSelection() {
    const selection = this.getSelection()
    if (!selection) return
    const payload = this.projectSelection(selection)
    await runtime.call('ui.popup', 'close', payload)
  }

  handleKeyDown(event) {
    if (this.mode !== 'chooser') return

    if (event.key === 'Enter') {
      event.preventDefault()
      void this.confirmSelection()
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      void runtime.call('ui.popup', 'close', { cancelled: true, ok: false })
    }
  }

  setTablesStatus(text) {
    if (this.tablesStatusContainer instanceof HTMLOutputElement) {
      this.tablesStatusContainer.textContent = text
    }
  }

  setTableStatus(text) {
    if (this.tableStatusContainer instanceof HTMLOutputElement) {
      this.tableStatusContainer.textContent = text
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || !this.dataset.ready) return

    if (name === 'data-page-size') {
      const parsed = parseInt(String(newValue || '20'), 10)
      this.pageSize = Number.isFinite(parsed) && parsed > 0 ? parsed : 20
      this.currentPage = 0
      void this.refresh()
      return
    }

    if (name === 'data-mode' || name === 'data-query' || name === 'data-count-query' || name === 'data-confirm-label' || name === 'data-return-column' || name === 'data-return-fields') {
      this.currentPage = 0
      this.selectedRowIndex = -1
      void this.refresh()
    }
  }
}

if (!customElements.get('view-sql')) {
  customElements.define('view-sql', ViewSql)
}
