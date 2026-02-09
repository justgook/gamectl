import { bus } from "../systems/event-bus.js"

export class ViewSqlConsole extends HTMLElement {
  static get viewMeta() { return { displayName: 'SQL Console', category: 'Utilities' } }

  constructor() {
    super()
    this.history = []
    this.historyIndex = -1
    this.outputArea = null
    this.inputArea = null
  }

  connectedCallback() {
    this.style.display = 'flex'
    this.style.flexDirection = 'column'
    this.style.width = '100%'
    this.style.height = '100%'
    this.setAttribute('tabindex', '0')

    const template = document.getElementById('view-sql-console')
    const content = template.content.cloneNode(true)
    this.appendChild(content)

    this.outputArea = this.querySelector('[data-element="output"]')
    this.inputArea = this.querySelector('[data-element="input"]')

    this.inputArea.addEventListener('keydown', (e) => this.handleKeyDown(e))

    // Focus management
    this.addEventListener('focusin', () => {
      bus.emit('view:focus', { view: 'view-sql-console', mode: 'sql-console' })
    })

    this.addEventListener('focusout', () => {
      bus.emit('view:blur', { view: 'view-sql-console', mode: 'sql-console' })
    })

    // Focus input on click
    this.addEventListener('click', () => {
      this.inputArea.focus()
    })

    // Welcome message
    this.appendOutput('info', 'SQL Console Ready. Type SQL queries and press Enter.')
    this.appendOutput('info', 'Use Shift+Enter for multi-line input.')
  }

  disconnectedCallback() {
    // Cleanup if needed
  }

  handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const sql = this.inputArea.value.trim()
      if (sql) {
        this.executeQuery(sql)
        this.history.push(sql)
        this.historyIndex = this.history.length
        this.inputArea.value = ''
      }
    } else if (e.key === 'ArrowUp') {
      if (this.historyIndex > 0) {
        this.historyIndex--
        this.inputArea.value = this.history[this.historyIndex]
        // Move cursor to end
        setTimeout(() => {
          this.inputArea.selectionStart = this.inputArea.selectionEnd = this.inputArea.value.length
        }, 0)
      }
      e.preventDefault()
    } else if (e.key === 'ArrowDown') {
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++
        this.inputArea.value = this.history[this.historyIndex]
      } else {
        this.historyIndex = this.history.length
        this.inputArea.value = ''
      }
      e.preventDefault()
    } else if (e.key === 'l' && e.ctrlKey) {
      // Ctrl+L to clear
      e.preventDefault()
      this.clearOutput()
    }
  }

  async executeQuery(sql) {
    // Show the command
    this.appendOutput('command', sql)

    try {
      const isSelect = sql.trim().toUpperCase().startsWith('SELECT')
        || sql.trim().toUpperCase().startsWith('PRAGMA')
        || sql.trim().toUpperCase().startsWith('EXPLAIN')

      if (isSelect) {
        const result = await window.pluginManager.call('sql', 'query', sql)
        const csv = new TextDecoder().decode(result.output)

        if (csv.trim()) {
          const table = this.formatAsTable(csv)
          this.appendOutput('result', table)
        } else {
          this.appendOutput('info', '(empty result)')
        }
      } else {
        const result = await window.pluginManager.call('sql', 'exec', sql)
        const output = new TextDecoder().decode(result.output)
        this.appendOutput('success', output || 'OK')
      }
    } catch (error) {
      this.appendOutput('error', error.message || String(error))
    }
  }

  formatAsTable(csv) {
    const lines = csv.trim().split('\n')
    if (lines.length === 0) return ''

    // Parse CSV (simple - assumes no commas in values)
    const rows = lines.map(line => this.parseCSVLine(line))
    if (rows.length === 0) return ''

    // Calculate column widths
    const colCount = rows[0].length
    const colWidths = []
    for (let c = 0; c < colCount; c++) {
      let maxWidth = 0
      for (const row of rows) {
        const cellLen = (row[c] || '').length
        if (cellLen > maxWidth) maxWidth = cellLen
      }
      colWidths.push(Math.max(maxWidth, 1))
    }

    // Build table
    const output = []

    // Header separator
    const separator = '+' + colWidths.map(w => '-'.repeat(w + 2)).join('+') + '+'

    // Header row
    output.push(separator)
    const header = rows[0]
    output.push('| ' + header.map((cell, i) => (cell || '').padEnd(colWidths[i])).join(' | ') + ' |')
    output.push(separator)

    // Data rows
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r]
      output.push('| ' + row.map((cell, i) => (cell || '').padEnd(colWidths[i])).join(' | ') + ' |')
    }

    if (rows.length > 1) {
      output.push(separator)
    }

    // Row count
    output.push(`(${rows.length - 1} row${rows.length - 1 !== 1 ? 's' : ''})`)

    return output.join('\n')
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

  appendOutput(type, content) {
    const div = document.createElement('div')
    div.style.marginBottom = '4px'
    div.style.whiteSpace = 'pre-wrap'
    div.style.fontFamily = "'Roboto Mono', monospace"
    div.style.fontSize = 'var(--font-size-sm)'

    switch (type) {
      case 'command':
        div.style.color = 'var(--color-semantic-text-accent)'
        div.textContent = '> ' + content
        break
      case 'result':
        div.style.color = 'var(--color-semantic-text-primary)'
        div.textContent = content
        break
      case 'error':
        div.style.color = '#ff6b6b'
        div.textContent = 'ERROR: ' + content
        break
      case 'success':
        div.style.color = '#69db7c'
        div.textContent = content
        break
      case 'info':
        div.style.color = 'var(--color-semantic-text-tertiary)'
        div.textContent = content
        break
    }

    this.outputArea.appendChild(div)

    // Auto-scroll
    this.outputArea.scrollTop = this.outputArea.scrollHeight
  }

  clearOutput() {
    this.outputArea.innerHTML = ''
    this.appendOutput('info', 'Console cleared.')
  }
}

export default ViewSqlConsole
