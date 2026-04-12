import { runtime } from '../core/runtime.js'

const textDecoder = new TextDecoder()

function decodeOutput(result) {
  return textDecoder.decode(result?.output || new Uint8Array())
}

function quoteIdent(name) {
  return String(name).replace(/"/g, '""')
}

export class SqlTableEditor extends HTMLElement {
  constructor() {
    super()
    this.popupProps = this.popupProps || {}
    this.columnsContainer = null
    this.statusContainer = null
    this.tableNameInput = null
  }

  connectedCallback() {
    if (this.dataset.ready) return
    this.dataset.ready = '1'

    const mode = this.popupProps?.mode || 'create'

    this.style.display = 'flex'
    this.style.flexDirection = 'column'
    this.style.gap = 'var(--space-4)'

    this.innerHTML = `
      <form data-element="form" novalidate style="display:flex; flex-direction:column; gap:var(--space-4);">
        <div style="display: flex; flex-direction: column; gap: var(--space-2);">
          <label for="sql-table-editor-name">Table name</label>
          <input id="sql-table-editor-name" type="text" data-field="table-name" placeholder="my_table" autocomplete="off">
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
          <button type="submit" data-action="save" class="accent">${mode === 'create' ? 'Create table' : 'Save'}</button>
        </footer>
        <div data-element="status"></div>
      </form>
    `

    this.columnsContainer = this.querySelector('[data-element="columns"]')
    this.statusContainer = this.querySelector('[data-element="status"]')
    this.tableNameInput = this.querySelector('[data-field="table-name"]')

    this._addColumnRow(this.columnsContainer, 'id', 'INTEGER', true, true)
    this._addColumnRow(this.columnsContainer, '', 'TEXT', false, false)

    this.querySelector('[data-action="add-column"]').addEventListener('click', () => {
      this._addColumnRow(this.columnsContainer, '', 'TEXT', false, false)
    })

    this.querySelector('[data-action="cancel"]').addEventListener('click', async () => {
      await runtime.call('ui.popup', 'close', { reload: false, cancelled: true })
    })

    this.querySelector('[data-element="form"]').addEventListener('submit', async (event) => {
      event.preventDefault()
      await this.save()
    })

    queueMicrotask(() => {
      this.tableNameInput.focus()
    })
  }

  setStatus(text, tone = null) {
    this.statusContainer.textContent = text
    this.statusContainer.classList.remove('accent', 'success', 'warning', 'danger', 'info')
    if (tone) {
      this.statusContainer.classList.add(tone)
    }
  }

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
    removeButton.setAttribute('aria-label', 'Remove Column')
    removeButton.innerHTML = '<i aria-hidden="true">delete</i>'
    removeCell.appendChild(removeButton)

    row.appendChild(nameCell)
    row.appendChild(typeCell)
    row.appendChild(primaryCell)
    row.appendChild(autoCell)
    row.appendChild(notNullCell)
    row.appendChild(removeCell)

    removeButton.addEventListener('click', () => {
      row.remove()
    })

    container.appendChild(row)
  }

  collectColumns() {
    const columnRows = this.querySelectorAll('[data-element="column-row"]')
    const columns = []

    for (const row of columnRows) {
      const colName = row.querySelector('[data-field="column-name"]').value.trim()
      if (!colName) continue

      columns.push({
        name: colName,
        type: row.querySelector('[data-field="column-type"]').value,
        primaryKey: row.querySelector('[data-field="primary-key"]').checked,
        autoIncrement: row.querySelector('[data-field="auto-increment"]').checked,
        notNull: row.querySelector('[data-field="not-null"]').checked,
      })
    }

    return columns
  }

  async save() {
    const tableName = this.tableNameInput.value.trim()

    if (!tableName) {
      this.tableNameInput.classList.add('danger')
      this.tableNameInput.focus()
      this.setStatus('Error: Table name is required', 'danger')
      return
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      this.tableNameInput.classList.add('danger')
      this.tableNameInput.focus()
      this.setStatus('Error: Invalid table name', 'danger')
      return
    }

    this.tableNameInput.classList.remove('danger')

    const columns = this.collectColumns()
    if (columns.length === 0) {
      this.setStatus('Error: At least one column required', 'danger')
      return
    }

    for (const column of columns) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column.name)) {
        this.setStatus(`Error: Invalid column name: ${column.name}`, 'danger')
        return
      }
    }

    const columnDefs = columns.map((col) => {
      let def = `"${quoteIdent(col.name)}" ${col.type}`
      if (col.primaryKey) def += ' PRIMARY KEY'
      if (col.autoIncrement && col.type === 'INTEGER') def += ' AUTOINCREMENT'
      if (col.notNull && !col.primaryKey) def += ' NOT NULL'
      return def
    })

    const sql = `CREATE TABLE "${quoteIdent(tableName)}" (\n  ${columnDefs.join(',\n  ')}\n)`

    this.setStatus('Creating table...', 'info')

    try {
      const result = await runtime.call('sql', 'exec', sql)
      if (result.returnCode !== 0) {
        throw new Error(decodeOutput(result) || `sql exec failed: ${result.returnCode}`)
      }

      await runtime.call('ui.popup', 'close', {
        reload: true,
        tableName,
        mode: 'create',
      })
    } catch (error) {
      this.setStatus(`Error: ${error.message}`, 'danger')
      console.error('sql-table-editor create failed:', error)
    }
  }
}

if (!customElements.get('sql-table-editor')) {
  customElements.define('sql-table-editor', SqlTableEditor)
}
