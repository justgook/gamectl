import { runtime } from '/core/runtime.js'
import { registerViewPlugin, unregisterViewPlugin } from '/util/view-plugin.js'
import { parseCSVLines } from '/util/csv.js'

const textDecoder = new TextDecoder()

function decodeOutput(result) {
  return textDecoder.decode(result?.output || new Uint8Array())
}

function isQueryStatement(sql) {
  const normalized = String(sql || '').trim().toUpperCase()
  return normalized.startsWith('SELECT')
    || normalized.startsWith('PRAGMA')
    || normalized.startsWith('EXPLAIN')
    || normalized.startsWith('WITH')
}

function formatCsvAsTable(csv) {
  const rows = parseCSVLines(String(csv || '').trim())
  if (rows.length === 0) return ''

  const columnCount = rows[0].length
  const columnWidths = []

  for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
    let width = 1
    for (const row of rows) {
      width = Math.max(width, String(row[columnIndex] || '').length)
    }
    columnWidths.push(width)
  }

  const separator = `+${columnWidths.map((width) => '-'.repeat(width + 2)).join('+')}+`
  const lines = []

  lines.push(separator)
  lines.push(`| ${rows[0].map((cell, index) => String(cell || '').padEnd(columnWidths[index])).join(' | ')} |`)
  lines.push(separator)

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
    lines.push(`| ${rows[rowIndex].map((cell, index) => String(cell || '').padEnd(columnWidths[index])).join(' | ')} |`)
  }

  if (rows.length > 1) {
    lines.push(separator)
  }

  lines.push(`(${rows.length - 1} row${rows.length - 1 === 1 ? '' : 's'})`)
  return lines.join('\n')
}

export class ViewSqlConsole extends HTMLElement {
  constructor() {
    super()
    this.history = []
    this.historyIndex = -1
    this.outputElement = null
    this.formElement = null
    this.inputElement = null
    this.runButton = null
    this.statusElement = null
  }

  connectedCallback() {
    registerViewPlugin(this)
    if (this.dataset.ready) return
    this.dataset.ready = '1'

    this.style.display = 'contents'
    this.setAttribute('tabindex', '0')

    this.innerHTML = `
      <article>
        <pre data-element="output"></pre>
      </article>
      <footer>
        <form data-element="form">
          <code-editor data-field="query" placeholder="SELECT * FROM sqlite_schema;" rows="3"></code-editor>
          <button type="submit" class="accent">Run</button>
          <output data-element="status"></output>
        </form>
      </footer>
    `

    this.outputElement = this.querySelector('[data-element="output"]')
    this.formElement = this.querySelector('[data-element="form"]')
    this.inputElement = this.querySelector('[data-field="query"]')
    this.runButton = this.querySelector('button[type="submit"]')
    this.statusElement = this.querySelector('[data-element="status"]')

    this.formElement?.addEventListener('submit', async (event) => {
      event.preventDefault()
      const sql = this.inputElement?.value.trim() || ''
      if (!sql) return
      await this.executeQuery(sql)
      this.history.push(sql)
      this.historyIndex = this.history.length
      if (this.inputElement) {
        this.inputElement.value = ''
      }
    })

    this.inputElement?.addEventListener('keydown', (event) => this.handleInputKeyDown(event))

    this.appendOutput('info', 'SQL Console Ready. Type SQL queries and press Run or Enter.')
    this.appendOutput('info', 'Use Shift+Enter for multi-line input.')

    queueMicrotask(() => this.inputElement?.focus())
  }

  handleInputKeyDown(event) {
    if (!this.inputElement) return

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      this.formElement?.requestSubmit()
      return
    }

    const textarea = this.inputElement.querySelector('textarea')
    if (!textarea) return

    if (event.key === 'ArrowUp' && !event.shiftKey) {
      const { selectionStart, selectionEnd } = textarea
      if (selectionStart === 0 && selectionEnd === 0 && this.historyIndex > 0) {
        event.preventDefault()
        this.historyIndex--
        this.inputElement.value = this.history[this.historyIndex] || ''
        queueMicrotask(() => {
          const nextTextarea = this.inputElement?.querySelector('textarea')
          if (!nextTextarea) return
          nextTextarea.selectionStart = nextTextarea.selectionEnd = nextTextarea.value.length
        })
      }
      return
    }

    if (event.key === 'ArrowDown' && !event.shiftKey) {
      const { selectionStart, selectionEnd, value } = textarea
      if (selectionStart === value.length && selectionEnd === value.length) {
        event.preventDefault()
        if (this.historyIndex < this.history.length - 1) {
          this.historyIndex++
          this.inputElement.value = this.history[this.historyIndex] || ''
        } else {
          this.historyIndex = this.history.length
          this.inputElement.value = ''
        }
        queueMicrotask(() => {
          const nextTextarea = this.inputElement?.querySelector('textarea')
          if (!nextTextarea) return
          nextTextarea.selectionStart = nextTextarea.selectionEnd = nextTextarea.value.length
        })
      }
    }
  }

  async executeQuery(sql) {
    this.appendOutput('command', sql)
    this.setStatus('Running...', 'info')
    if (this.runButton) this.runButton.disabled = true

    try {
      if (isQueryStatement(sql)) {
        const result = await runtime.call('sql', 'query', sql)
        if (result.returnCode !== 0) {
          throw new Error(decodeOutput(result) || `sql query failed: ${result.returnCode}`)
        }

        const csv = decodeOutput(result)
        if (csv.trim()) {
          this.appendOutput('result', formatCsvAsTable(csv))
          this.setStatus('Query finished', 'success')
        } else {
          this.appendOutput('info', '(empty result)')
          this.setStatus('Query finished', 'success')
        }
      } else {
        const result = await runtime.call('sql', 'exec', sql)
        if (result.returnCode !== 0) {
          throw new Error(decodeOutput(result) || `sql exec failed: ${result.returnCode}`)
        }

        this.appendOutput('success', decodeOutput(result) || 'OK')
        this.setStatus('Statement finished', 'success')
      }
    } catch (error) {
      this.appendOutput('error', error?.message || String(error))
      this.setStatus(`Error: ${error?.message || error}`, 'danger')
      console.error('view-sql-console query failed:', error)
    } finally {
      if (this.runButton) this.runButton.disabled = false
    }
  }

  appendOutput(type, content) {
    if (!this.outputElement) return

    const tone = type === 'command'
      ? 'accent'
      : type === 'success'
        ? 'success'
        : type === 'error'
          ? 'danger'
          : type === 'info'
            ? 'info'
            : null

    if (this.outputElement.childElementCount > 0) {
      const spacer = document.createElement('span')
      spacer.dataset.element = 'output-spacer'
      spacer.textContent = ''
      this.outputElement.appendChild(spacer)
    }

    const line = document.createElement('span')
    line.dataset.element = 'output-line'
    if (tone) {
      line.classList.add(tone)
    }

    const prefix = type === 'command' ? '> ' : type === 'error' ? 'ERROR: ' : ''
    line.textContent = `${prefix}${content}`
    this.outputElement.appendChild(line)
    this.outputElement.scrollTop = this.outputElement.scrollHeight
  }

  setStatus(text, tone = null) {
    if (!this.statusElement) return
    this.statusElement.textContent = text
    this.statusElement.classList.remove('accent', 'success', 'warning', 'danger', 'info')
    if (tone) {
      this.statusElement.classList.add(tone)
    }
  }

  disconnectedCallback() {
    void unregisterViewPlugin(this)
  }
}

if (!customElements.get('view-sql-console')) {
  customElements.define('view-sql-console', ViewSqlConsole)
}
