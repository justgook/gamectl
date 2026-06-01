import { runtime, unwrap } from "/core/runtime.js"
import { ViewCanvasBase } from "/util/view-canvas-base.js"
import {
  compileXmlToMjir,
  initialGridFromXml,
} from "/util/markov-junior/xml-to-mjir.js"

const PALETTE = {
  B: "#000000", I: "#1D2B53", P: "#7E2553", E: "#008751",
  N: "#AB5236", D: "#5F574F", A: "#C2C3C7", W: "#FFF1E8",
  R: "#FF004D", O: "#FFA300", Y: "#FFEC27", G: "#00E436",
  U: "#29ADFF", S: "#83769C", K: "#FF77A8", F: "#FFCCAA",
  b: "#291814", i: "#111d35", p: "#422136", e: "#125359",
  n: "#742f29", d: "#49333b", a: "#a28879", w: "#f3ef7d",
  r: "#be1250", o: "#ff6c24", y: "#a8e72e", g: "#00b543",
  u: "#065ab5", s: "#754665", k: "#ff6e59", f: "#ff9d81",
  C: "#00ffff", c: "#5fcde4", H: "#e4bb40", h: "#8a6f30",
  J: "#4b692f", j: "#45107e", L: "#847e87", l: "#696a6a",
  M: "#ff00ff", m: "#9c09cc", Q: "#9badb7", q: "#3f3f74",
  T: "#37946e", t: "#323c39", V: "#8f974a", v: "#524b24",
  X: "#ff0000", x: "#d95763", Z: "#ffffff", z: "#cbdbfc",
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function normalizePath(path) {
  const raw = String(path || "").trim()
  assert(raw.length > 0, "view-markov path must be non-empty")
  return raw.split("/").filter(Boolean).join("/")
}

function basename(path) {
  return normalizePath(path).split("/").pop()
}

function exampleLabel(example) {
  const suffix = example.decoderReady ? "" : " [not ready]"
  return `${example.label || example.name || example.id}${suffix}`
}

function toRows(cells, width, height, values) {
  assert(Array.isArray(cells), "view-markov grid cells must be an array")
  assert(cells.length >= width * height, "view-markov grid cells length does not match dimensions")
  const rows = []
  for (let y = 0; y < height; y += 1) {
    let row = ""
    for (let x = 0; x < width; x += 1) {
      const index = cells[x + y * width]
      row += values[index] ?? "?"
    }
    rows.push(row)
  }
  return rows
}

export class ViewMarkov extends ViewCanvasBase {
  static get observedAttributes() {
    return ["data-source", "data-mode"]
  }

  constructor() {
    super()
    this.mode = "library"
    this.source = ""
    this.running = false
    this.statusElement = null
    this.metaElement = null
    this.pathElement = null
  }

  connectedCallback() {
    if (this.dataset.ready) return
    this.dataset.ready = "1"

    this.mode = String(this.popupProps?.mode || (this.popupProps?.path ? "preview" : "") || this.getAttribute("data-mode") || this.config?.mode || "library")
    this.source = String(this.popupProps?.path || this.getAttribute("data-source") || this.config?.defaultSource || "").trim()
    if (!this.source && this.mode === "library") this.source = this.examples()[0].id
    assert(this.mode === "library" || this.mode === "preview", `view-markov unsupported mode: ${this.mode}`)

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
    assert(this.statusElement instanceof HTMLOutputElement, "view-markov missing status output")
    assert(this.metaElement instanceof HTMLOutputElement, "view-markov missing meta output")
    assert(this.pathElement instanceof HTMLOutputElement, "view-markov missing path output")

    super.connectedCallback()
    this.syncHeaderControls({ resetRunConfig: true })
    void this.generate()
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return
    if (name === "data-source") this.source = String(newValue || "").trim()
    if (name === "data-mode") this.mode = String(newValue || "library")
    if (this.dataset.ready) {
      this.syncHeaderControls({ resetRunConfig: name === "data-source" })
      void this.generate()
    }
  }

  createViewPluginMethods() {
    return {
      reload: async () => {
        await this.generate()
        return { ok: true }
      },
      run: async () => {
        await this.generate()
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
        this.zoomFit()
        return { ok: true }
      },
    }
  }

  createHeaderControlsElement() {
    const toolbar = document.createElement("div")
    toolbar.dataset.element = "toolbar"
    toolbar.innerHTML = `
      <div role="buttongroup" data-element="file-actions">
        <select data-field="model" aria-label="MarkovJunior model"></select>
        <button type="button" data-action="reset" aria-label="Reset" title="Reset"><i aria-hidden="true">restart_alt</i></button>
      </div>
      <div role="buttongroup" data-element="tool-actions">
        <input type="number" data-field="seed" aria-label="Seed" title="Seed" min="0" step="1" value="1" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
        <input type="number" data-field="steps" aria-label="Steps" title="Steps" min="0" step="1" value="1000" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
        <button type="button" data-action="generate" aria-label="Generate" title="Generate"><i aria-hidden="true">play_arrow</i></button>
        <button type="button" data-action="reroll" aria-label="Reroll seed" title="Reroll seed"><i aria-hidden="true">casino</i></button>
      </div>
      <div role="buttongroup" data-element="view-actions">
        <button type="button" data-action="zoom-out" aria-label="Zoom out" title="Zoom out"><i aria-hidden="true">zoom_out</i></button>
        <button type="button" data-action="zoom-fit" aria-label="Fit" title="Fit"><i aria-hidden="true">fit_screen</i></button>
        <button type="button" data-action="zoom-in" aria-label="Zoom in" title="Zoom in"><i aria-hidden="true">zoom_in</i></button>
      </div>
    `

    const select = toolbar.querySelector('[data-field="model"]')
    assert(select instanceof HTMLSelectElement, "view-markov model select missing")
    if (this.mode === "preview") select.hidden = true
    this.populateModelSelect(select)

    select.addEventListener("change", () => {
      this.source = select.value
      this.setAttribute("data-source", this.source)
    })
    toolbar.querySelector('[data-action="reset"]').addEventListener("click", () => this.generate())
    toolbar.querySelector('[data-action="generate"]').addEventListener("click", () => this.generate())
    toolbar.querySelector('[data-action="reroll"]').addEventListener("click", () => this.reroll())
    toolbar.querySelector('[data-action="zoom-out"]').addEventListener("click", () => this.zoomOut())
    toolbar.querySelector('[data-action="zoom-fit"]').addEventListener("click", () => this.zoomFit())
    toolbar.querySelector('[data-action="zoom-in"]').addEventListener("click", () => this.zoomIn())
    return toolbar
  }

  examples() {
    const examples = this.config?.examples
    assert(Array.isArray(examples) && examples.length > 0, "view-markov config.examples must be a non-empty array")
    return examples
  }

  populateModelSelect(select) {
    let group = null
    let groupName = ""
    for (const example of this.examples()) {
      const category = String(example.category || "MarkovJunior")
      if (!(group instanceof HTMLOptGroupElement) || groupName !== category) {
        group = document.createElement("optgroup")
        group.label = category
        groupName = category
        select.appendChild(group)
      }
      const option = document.createElement("option")
      option.value = example.id
      option.textContent = exampleLabel(example)
      option.dataset.source = example.source
      option.dataset.decoderReady = example.decoderReady ? "true" : "false"
      group.appendChild(option)
    }
  }

  selectedExample() {
    const source = this.source || this.config?.defaultSource
    const normalized = source ? normalizePath(source) : ""
    return this.examples().find((example) => example.id === source || normalizePath(example.source) === normalized || basename(example.source) === basename(normalized)) || null
  }

  syncHeaderControls({ resetRunConfig = false } = {}) {
    const example = this.selectedExample()
    const select = this.queryHeaderControl('[data-field="model"]')
    const seedInput = this.queryHeaderControl('[data-field="seed"]')
    const stepsInput = this.queryHeaderControl('[data-field="steps"]')
    if (select instanceof HTMLSelectElement && example) select.value = example.id
    if (resetRunConfig && seedInput instanceof HTMLInputElement && example?.seed != null) seedInput.value = String(example.seed)
    if (resetRunConfig && stepsInput instanceof HTMLInputElement && example?.steps != null) stepsInput.value = String(example.steps)
    if (this.pathElement instanceof HTMLOutputElement) this.pathElement.textContent = example?.source || this.source
  }

  setStatus(text, tone = null) {
    assert(this.statusElement instanceof HTMLOutputElement, "view-markov status output is not initialized")
    this.statusElement.textContent = text
    this.statusElement.classList.remove("accent", "success", "warning", "danger", "info")
    if (tone) this.statusElement.classList.add(tone)
  }

  seed() {
    const input = this.queryHeaderControl('[data-field="seed"]')
    assert(input instanceof HTMLInputElement, "view-markov missing seed input")
    const value = Number(input.value)
    assert(Number.isInteger(value) && value >= 0, "view-markov seed must be a non-negative integer")
    return value
  }

  steps() {
    const input = this.queryHeaderControl('[data-field="steps"]')
    assert(input instanceof HTMLInputElement, "view-markov missing steps input")
    const value = Number(input.value)
    assert(Number.isInteger(value) && value >= 0, "view-markov steps must be a non-negative integer")
    return value
  }

  async reroll() {
    const input = this.queryHeaderControl('[data-field="seed"]')
    assert(input instanceof HTMLInputElement, "view-markov missing seed input")
    input.value = String(Math.floor(Math.random() * 0x7fffffff) + 1)
    await this.generate()
  }

  async generate() {
    if (this.running) return
    this.running = true
    const started = performance.now()
    try {
      const example = this.selectedExample()
      assert(example, `view-markov could not resolve source '${this.source}'`)
      this.source = example.id
      this.syncHeaderControls()
      if (example.decoderReady !== true) {
        this.setData(null, { autoFit: false })
        this.setStatus(`${exampleLabel(example)} is listed but not preview-ready yet`, "warning")
        return
      }
      if (example.depth !== 1 || example.render !== "2d") {
        this.setData(null, { autoFit: false })
        this.setStatus(`${exampleLabel(example)} needs ${example.render || `${example.depth}D`} renderer`, "warning")
        return
      }

      this.setStatus(`Generating ${exampleLabel(example)}...`, "info")
      const xml = unwrap(await runtime.invoke("fs/fs::read-text", example.source), example.source)
      const modelIr = compileXmlToMjir(xml)
      const initialCells = initialGridFromXml(xml, example.width, example.height, example.depth)
      const grid = unwrap(await runtime.invoke(
        "markov-junior/markov-junior::run",
        modelIr,
        initialCells,
        {
          width: example.width,
          height: example.height,
          depth: example.depth,
          seed: this.seed(),
          "max-steps": this.steps(),
        },
      ), "markov-junior.run")

      this.applyGrid(grid, example, Math.round(performance.now() - started))
      this.setStatus(`${exampleLabel(example)} generated in ${Math.round(performance.now() - started)}ms`, "success")
    } catch (error) {
      this.setData(null, { autoFit: false })
      this.setStatus(`Error: ${error?.message || error}`, "danger")
      console.error("view-markov generate failed:", error)
    } finally {
      this.running = false
    }
  }

  applyGrid(grid, example, durationMs) {
    assert(grid && typeof grid === "object" && !Array.isArray(grid), "view-markov grid must be object")
    const rows = toRows(grid.cells, grid.width, grid.height, grid.values)
    this.setData({ ...grid, rows }, { autoFit: true })
    assert(this.metaElement instanceof HTMLOutputElement, "view-markov meta output is not initialized")
    this.metaElement.textContent = `${grid.width} × ${grid.height} × ${grid.depth} · values ${grid.values} · seed ${this.seed()} · steps ${grid["steps-run"]}/${this.steps()} · changed ${grid.changed}${grid.done ? " · done" : ""} · ${durationMs}ms · ${example.id}`
  }

  calculateContentBounds(data) {
    if (!data) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
    return { minX: 0, minY: 0, maxX: data.width, maxY: data.height }
  }

  drawContent(ctx, data) {
    if (!data) return
    ctx.fillStyle = "#101820"
    ctx.fillRect(0, 0, data.width, data.height)
    for (let y = 0; y < data.height; y += 1) {
      const row = data.rows[y]
      for (let x = 0; x < data.width; x += 1) {
        ctx.fillStyle = PALETTE[row[x]] || "#ff00ff"
        ctx.fillRect(x, y, 1, 1)
      }
    }
  }
}

if (!customElements.get("view-markov")) {
  customElements.define("view-markov", ViewMarkov)
}
