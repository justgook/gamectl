import { runtime } from '../core/runtime.js'
import { parseCSVLines } from '../util/csv.js'

const textDecoder = new TextDecoder()

function decodeOutput(result) {
  return textDecoder.decode(result?.output || new Uint8Array())
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

class ViewNgGraph extends HTMLElement {
  constructor() {
    super()
    this.mode = 'chooser'
    this.graphs = []
    this.selectedName = ''
    this.formElement = null
    this.statusOutput = null
    this.listBody = null
    this.selectButton = null
  }

  connectedCallback() {
    this.mode = String(this.getAttribute('data-mode') || 'chooser')
    this.render()
    void this.refresh()
  }

  async init(props = {}) {
    this.mode = String(props.mode || this.mode || 'chooser')
    this.render()
    await this.refresh()
  }

  render() {
    assert(this.mode === 'chooser', `view-ng-graph unsupported mode '${this.mode}'`)
    this.innerHTML = `
      <form>
        <fieldset>
          <legend>Graphs</legend>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Nodes</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody data-element="rows"></tbody>
          </table>
        </fieldset>
        <output data-element="status"></output>
        <footer>
          <button type="button" data-action="cancel">Cancel</button>
          <button type="submit" class="accent" data-action="select">Open</button>
        </footer>
      </form>
    `

    this.formElement = this.querySelector('form')
    this.statusOutput = this.querySelector('[data-element="status"]')
    this.listBody = this.querySelector('[data-element="rows"]')
    this.selectButton = this.querySelector('[data-action="select"]')

    assert(this.formElement instanceof HTMLFormElement, 'view-ng-graph missing form')
    assert(this.statusOutput instanceof HTMLOutputElement, 'view-ng-graph missing status output')
    assert(this.listBody instanceof HTMLTableSectionElement, 'view-ng-graph missing rows tbody')
    assert(this.selectButton instanceof HTMLButtonElement, 'view-ng-graph missing select button')

    this.formElement.addEventListener('submit', (event) => {
      event.preventDefault()
      void this.confirmSelection()
    })
    this.querySelector('[data-action="cancel"]').addEventListener('click', () => {
      void runtime.call('ui.popup', 'close', { cancelled: true, ok: false })
    })
  }

  setStatus(text, level = 'info') {
    assert(this.statusOutput instanceof HTMLOutputElement, 'view-ng-graph missing status output')
    this.statusOutput.textContent = String(text || '')
    this.statusOutput.className = level
  }

  async refresh() {
    const result = await runtime.call('ng', 'ng_graph_list', '')
    if (result.returnCode !== 0) {
      throw new Error(`ng.ng_graph_list failed: ${decodeOutput(result) || result.returnCode}`)
    }
    const csv = decodeOutput(result).trim()
    const rows = csv ? parseCSVLines(csv) : []
    const header = rows[0] || []
    const body = rows.slice(1)
    this.graphs = body.map((row) => {
      const obj = {}
      header.forEach((name, index) => {
        obj[name] = row[index] ?? ''
      })
      return obj
    })
    if (!this.selectedName && this.graphs.length > 0) {
      this.selectedName = String(this.graphs[0].name || '')
    }
    this.renderRows()
    this.setStatus(this.graphs.length > 0 ? `${this.graphs.length} graph${this.graphs.length === 1 ? '' : 's'} available` : 'No graphs found.', this.graphs.length > 0 ? 'info' : 'warning')
  }

  renderRows() {
    assert(this.listBody instanceof HTMLTableSectionElement, 'view-ng-graph missing rows tbody')
    this.listBody.innerHTML = ''
    for (const graph of this.graphs) {
      const row = document.createElement('tr')
      const name = String(graph.name || '')
      if (name === this.selectedName) row.setAttribute('aria-selected', 'true')
      row.innerHTML = `
        <td>${name}</td>
        <td>${String(graph.node_count || '')}</td>
        <td>${String(graph.updated_at || '')}</td>
      `
      row.addEventListener('click', () => {
        this.selectedName = name
        this.renderRows()
      })
      row.addEventListener('dblclick', () => {
        this.selectedName = name
        this.renderRows()
        void this.confirmSelection()
      })
      this.listBody.appendChild(row)
    }
    assert(this.selectButton instanceof HTMLButtonElement, 'view-ng-graph missing select button')
    this.selectButton.disabled = !this.selectedName
  }

  async confirmSelection() {
    if (!this.selectedName) return
    await runtime.call('ui.popup', 'close', {
      ok: true,
      cancelled: false,
      value: this.selectedName,
    })
  }
}

if (!customElements.get('view-ng-graph')) {
  customElements.define('view-ng-graph', ViewNgGraph)
}
