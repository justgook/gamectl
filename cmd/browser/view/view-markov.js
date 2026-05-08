import { runtime } from '/core/runtime.js'
import { ViewCanvasBase } from '/util/view-canvas-base.js'

const decoder = new TextDecoder()

const PALETTE = {
  B: '#000000', I: '#1D2B53', P: '#7E2553', E: '#008751', N: '#AB5236', D: '#5F574F', A: '#C2C3C7', W: '#FFF1E8',
  R: '#FF004D', O: '#FFA300', Y: '#FFEC27', G: '#00E436', U: '#29ADFF', S: '#83769C', K: '#FF77A8', F: '#FFCCAA',
  b: '#291814', i: '#111d35', p: '#422136', e: '#125359', n: '#742f29', d: '#49333b', a: '#a28879', w: '#f3ef7d',
  r: '#be1250', o: '#ff6c24', y: '#a8e72e', g: '#00b543', u: '#065ab5', s: '#754665', k: '#ff6e59', f: '#ff9d81',
  C: '#00ffff', c: '#5fcde4', H: '#e4bb40', h: '#8a6f30', J: '#4b692f', j: '#45107e', L: '#847e87', l: '#696a6a',
  M: '#ff00ff', m: '#9c09cc', Q: '#9badb7', q: '#3f3f74', T: '#37946e', t: '#323c39', V: '#8f974a', v: '#524b24',
  X: '#ff0000', x: '#d95763', Z: '#ffffff', z: '#cbdbfc',
}

const EXAMPLES = [
  { name: 'Basic', width: 60, height: 60, steps: 1000 },
  { name: 'Backtracker', width: 89, height: 89, steps: 20000 },
  { name: 'MazeGrowth', width: 120, height: 120, steps: 10000 },
  { name: 'RegularSAW', width: 39, height: 39, steps: 10000 },
  { name: 'River', width: 80, height: 80, steps: 2000 },
  { name: 'Cave', width: 60, height: 60, steps: 2000 },
  { name: 'Flowers', width: 60, height: 60, steps: 5000 },
  { name: 'BiasedVoronoi', width: 80, height: 80, steps: 1000 },
  { name: 'GameOfLife', width: 120, height: 120, steps: 100 },
  { name: 'ForestFireCA', width: 160, height: 160, steps: 80 },
]

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function decodeOutput(result) {
  return decoder.decode(result?.output || new Uint8Array())
}

function parseJsonOutput(result, context) {
  const text = decodeOutput(result)
  if (result.returnCode !== 0) throw new Error(text || `${context} failed: ${result.returnCode}`)
  return JSON.parse(text)
}

function exampleByName(name) {
  const example = EXAMPLES.find((entry) => entry.name === name)
  assert(example, `unknown markov example '${name}'`)
  return example
}

function modelUrl(name) {
  return `/demo/res-markov/models/${encodeURIComponent(name)}.xml`
}

async function fetchModelXml(name) {
  const response = await fetch(modelUrl(name), { cache: 'no-store' })
  if (!response.ok) throw new Error(`failed to load ${name}.xml: ${response.status} ${response.statusText}`)
  return await response.text()
}

function rowsFromCells(cells, width, height) {
  assert(typeof cells === 'string' && cells.length > 0, 'markov result cells must be non-empty string')
  const firstSlice = cells.split(' ')[0]
  const rows = firstSlice.split('/')
  assert(rows.length === height, `markov result row count ${rows.length} does not match height ${height}`)
  for (const row of rows) assert(row.length === width, `markov result row width ${row.length} does not match width ${width}`)
  return rows
}

export class ViewMarkov extends ViewCanvasBase {
  static get observedAttributes() {
    return ['data-source']
  }

  constructor() {
    super()
    this.exampleName = 'Basic'
    this.statusElement = null
    this.metaElement = null
    this.pathElement = null
    this.running = false
  }

  connectedCallback() {
    if (this.dataset.ready) return
    this.dataset.ready = '1'

    const source = String(this.getAttribute('data-source') || this.viewConfig?.defaultSource || 'Basic').trim()
    this.exampleName = exampleByName(source).name

    this.innerHTML = `
      <canvas data-element="canvas"></canvas>
      <footer data-element="footer">
        <output data-element="path"></output>
        <output data-element="meta"></output>
        <output data-element="status">Ready</output>
      </footer>
    `

    this.statusElement = this.querySelector('[data-element="status"]')
    this.metaElement = this.querySelector('[data-element="meta"]')
    this.pathElement = this.querySelector('[data-element="path"]')
    assert(this.statusElement instanceof HTMLOutputElement, 'view-markov missing status output')
    assert(this.metaElement instanceof HTMLOutputElement, 'view-markov missing meta output')
    assert(this.pathElement instanceof HTMLOutputElement, 'view-markov missing path output')

    super.connectedCallback()
    this.syncHeaderControls()
    void this.runCurrent()
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return
    if (name !== 'data-source') return
    const source = String(newValue || '').trim()
    assert(source.length > 0, 'view-markov data-source must be non-empty example name')
    this.exampleName = exampleByName(source).name
    if (this.dataset.ready) {
      this.syncHeaderControls()
      void this.runCurrent()
    }
  }

  createViewPluginMethods() {
    return {
      reload: async () => {
        await this.runCurrent()
        return { ok: true }
      },
      run: async () => {
        await this.runCurrent()
        return { ok: true }
      },
      zoomIn: async () => {
        this.zoomIn()
        return { ok: true }
      },
      zoomOut: async () => {
        this.zoomOut()
        return { ok: true }
      },
      zoomFit: async () => {
        this.fitToContent()
        return { ok: true }
      },
    }
  }

  createHeaderControlsElement() {
    const toolbar = document.createElement('div')
    toolbar.dataset.element = 'toolbar'
    toolbar.innerHTML = `
      <div role="buttongroup" data-element="file-actions">
        <select data-field="example" aria-label="Example"></select>
        <button type="button" data-action="reload" aria-label="Run" title="Run"><i aria-hidden="true">play_arrow</i></button>
      </div>
      <div role="buttongroup" data-element="tool-actions">
        <input type="number" data-field="seed" aria-label="Seed" title="Seed" min="0" step="1" value="1">
        <input type="number" data-field="steps" aria-label="Steps" title="Steps override (0 = model default)" min="0" step="1" value="0">
        <button type="button" data-action="reroll" aria-label="Reroll" title="Reroll seed"><i aria-hidden="true">casino</i></button>
      </div>
      <div role="buttongroup" data-element="view-actions">
        <button type="button" data-action="zoom-out" aria-label="Zoom out" title="Zoom out"><i aria-hidden="true">zoom_out</i></button>
        <button type="button" data-action="zoom-fit" aria-label="Fit" title="Fit"><i aria-hidden="true">fit_screen</i></button>
        <button type="button" data-action="zoom-in" aria-label="Zoom in" title="Zoom in"><i aria-hidden="true">zoom_in</i></button>
      </div>
    `

    const select = toolbar.querySelector('[data-field="example"]')
    assert(select instanceof HTMLSelectElement, 'view-markov example select missing')
    for (const example of EXAMPLES) {
      const option = document.createElement('option')
      option.value = example.name
      option.textContent = example.name
      select.appendChild(option)
    }

    select.addEventListener('change', () => {
      this.exampleName = exampleByName(select.value).name
      this.setAttribute('data-source', this.exampleName)
    })
    toolbar.querySelector('[data-action="reload"]').addEventListener('click', () => this.runCurrent())
    toolbar.querySelector('[data-action="reroll"]').addEventListener('click', () => this.reroll())
    toolbar.querySelector('[data-action="zoom-out"]').addEventListener('click', () => this.zoomOut())
    toolbar.querySelector('[data-action="zoom-fit"]').addEventListener('click', () => this.fitToContent())
    toolbar.querySelector('[data-action="zoom-in"]').addEventListener('click', () => this.zoomIn())
    return toolbar
  }

  syncHeaderControls() {
    const example = exampleByName(this.exampleName)
    const select = this.queryHeaderControl('[data-field="example"]')
    const stepsInput = this.queryHeaderControl('[data-field="steps"]')
    if (select instanceof HTMLSelectElement) select.value = example.name
    if (stepsInput instanceof HTMLInputElement) stepsInput.value = String(Math.max(0, example.steps))
    if (this.pathElement instanceof HTMLOutputElement) this.pathElement.textContent = modelUrl(example.name)
  }

  setStatus(text, tone = null) {
    assert(this.statusElement instanceof HTMLOutputElement, 'view-markov status output is not initialized')
    this.statusElement.textContent = text
    this.statusElement.classList.remove('accent', 'success', 'warning', 'danger', 'info')
    if (tone) this.statusElement.classList.add(tone)
  }

  seed() {
    const input = this.queryHeaderControl('[data-field="seed"]')
    assert(input instanceof HTMLInputElement, 'view-markov missing seed input')
    const value = Number(input.value)
    assert(Number.isInteger(value) && value >= 0, 'view-markov seed must be a non-negative integer')
    return value
  }

  steps() {
    const input = this.queryHeaderControl('[data-field="steps"]')
    assert(input instanceof HTMLInputElement, 'view-markov missing steps input')
    const value = Number(input.value)
    assert(Number.isInteger(value) && value >= 0, 'view-markov steps must be a non-negative integer')
    return value
  }

  async reroll() {
    const input = this.queryHeaderControl('[data-field="seed"]')
    assert(input instanceof HTMLInputElement, 'view-markov missing seed input')
    input.value = String(Math.floor(Math.random() * 0x7fffffff) + 1)
    await this.runCurrent()
  }

  async runCurrent() {
    if (this.running) return
    this.running = true
    const example = exampleByName(this.exampleName)
    this.setStatus(`Running ${example.name}...`, 'info')
    try {
      const modelXml = await fetchModelXml(example.name)
      const started = performance.now()
      const result = await runtime.call('markov', 'run', {
        modelXml,
        width: example.width,
        height: example.height,
        depth: 1,
        seed: this.seed(),
        steps: this.steps(),
      })
      const grid = parseJsonOutput(result, 'markov.run')
      const rows = rowsFromCells(grid.cells, grid.width, grid.height)
      this.setData({ ...grid, rows }, { autoFit: true })
      assert(this.metaElement instanceof HTMLOutputElement, 'view-markov meta output is not initialized')
      this.metaElement.textContent = `${grid.width} × ${grid.height} · values ${grid.values} · steps ${grid.stepsRun} · changed ${grid.changed}`
      this.setStatus(`${example.name} generated in ${Math.round(performance.now() - started)}ms`, 'success')
    } catch (error) {
      this.setData(null, { autoFit: false })
      this.setStatus(`Error: ${error?.message || error}`, 'danger')
      console.error('view-markov run failed:', error)
    } finally {
      this.running = false
    }
  }

  calculateContentBounds(data) {
    if (!data) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
    return { minX: 0, minY: 0, maxX: data.width, maxY: data.height }
  }

  drawContent(ctx, data) {
    if (!data) return

    ctx.fillStyle = '#101820'
    ctx.fillRect(0, 0, data.width, data.height)

    for (let y = 0; y < data.height; y += 1) {
      const row = data.rows[y]
      for (let x = 0; x < data.width; x += 1) {
        const symbol = row[x]
        ctx.fillStyle = PALETTE[symbol] || '#ff00ff'
        ctx.fillRect(x, y, 1, 1)
      }
    }
  }
}

if (!customElements.get('view-markov')) {
  customElements.define('view-markov', ViewMarkov)
}
