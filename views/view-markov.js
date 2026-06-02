import { runtime, unwrap } from "/core/runtime.js"
import { ViewCanvasBase } from "/util/view-canvas-base.js"
import { VoxelOrbitRenderer } from "/util/voxel-orbit-renderer.js"
import { paletteFromSymbolColors, voxelRenderDataFromIndexedGrid } from "/util/vox/grid.js"
import {
  compileXmlToMjir,
  initialGridFromXml,
  xmlAttr,
  xmlRootStartTag,
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
  return example.label || example.name || example.id
}

function exampleDimensionLabel(example) {
  assert(example.render === "2d" || example.render === "vox", `view-markov unsupported render mode: ${example.render}`)
  return example.render === "vox" ? "3D" : "2D"
}

function exampleSizeLabel(example) {
  assert(Number.isInteger(example.width) && example.width > 0, `view-markov example ${example.id} width must be a positive integer`)
  assert(Number.isInteger(example.height) && example.height > 0, `view-markov example ${example.id} height must be a positive integer`)
  assert(Number.isInteger(example.depth) && example.depth > 0, `view-markov example ${example.id} depth must be a positive integer`)
  return example.depth > 1 ? `${example.width}×${example.height}×${example.depth}` : `${example.width}×${example.height}`
}

function exampleSelectLabel(example) {
  return `${exampleLabel(example)} · ${exampleDimensionLabel(example)} · ${exampleSizeLabel(example)}`
}

function uniqueXmlAttrValues(xml, name) {
  return [...xml.matchAll(new RegExp(`\\b${name}="([^"]+)"`, "g"))].map((match) => match[1])
}

function unique(values) {
  return [...new Set(values)]
}

function joinResourcePath(root, ...parts) {
  return [root, ...parts].map((part) => String(part || "").trim()).filter(Boolean).join("/")
}

async function decodePngRgba(bytes) {
  const image = await createImageBitmap(new Blob([bytes], { type: "image/png" }))
  const canvas = document.createElement("canvas")
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext("2d")
  assert(ctx, "view-markov PNG decode requires 2d context")
  ctx.drawImage(image, 0, 0)
  image.close()
  const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  const colors = []
  for (let i = 0; i < rgba.length; i += 4) colors.push((((rgba[i + 3] << 24) >>> 0) | (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2]))
  return { width: canvas.width, height: canvas.height, colors }
}

async function decodePngPattern(bytes, legend) {
  const { width, height, colors } = await decodePngRgba(bytes)
  const uniqueColors = []
  const data = colors.map((color) => {
    let index = uniqueColors.indexOf(color)
    if (index < 0) {
      index = uniqueColors.length
      uniqueColors.push(color)
    }
    if (index >= legend.length) throw new Error(`rule PNG uses ${index + 1} colors but legend has ${legend.length}`)
    return legend[index]
  })
  return { width, height, depth: 1, data }
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
    this.session = null
    this.playing = false
    this.animationFrame = 0
    this.statusElement = null
    this.metaElement = null
    this.pathElement = null
    this.voxelRenderer = null
    this.voxelPalette = paletteFromSymbolColors(PALETTE)
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
    this.showReadyState()
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return
    if (name === "data-source") this.source = String(newValue || "").trim()
    if (name === "data-mode") this.mode = String(newValue || "library")
    if (this.dataset.ready) {
      void this.dismissSession()
      this.syncHeaderControls({ resetRunConfig: name === "data-source" })
      this.showReadyState()
    }
  }

  createViewPluginMethods() {
    return {
      reload: async () => {
        await this.resetSession()
        return { ok: true }
      },
      run: async () => {
        await this.stepCurrent()
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
        <button type="button" data-action="reroll" aria-label="Reroll seed" title="Reroll seed"><i aria-hidden="true">casino</i></button>
        <input type="number" data-field="steps" aria-label="Steps" title="Steps" min="0" step="1" value="1000" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
        <button type="button" data-action="step" aria-label="Step" title="Step"><i aria-hidden="true">skip_next</i></button>
        <button type="button" data-action="play-pause" aria-label="Play" title="Play"><i aria-hidden="true">play_arrow</i></button>
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
    toolbar.querySelector('[data-action="reset"]').addEventListener("click", () => this.resetSession())
    toolbar.querySelector('[data-action="step"]').addEventListener("click", () => this.stepCurrent())
    toolbar.querySelector('[data-action="play-pause"]').addEventListener("click", () => this.togglePlayback())
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
      option.textContent = exampleSelectLabel(example)
      option.title = `${exampleLabel(example)} · ${example.source}`
      option.dataset.source = example.source
      option.dataset.render = example.render
      option.dataset.dimensions = exampleSizeLabel(example)
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

  showReadyState() {
    const example = this.selectedExample()
    this.setData(null, { autoFit: false })
    if (this.metaElement instanceof HTMLOutputElement && example) {
      this.metaElement.textContent = `${example.width} × ${example.height} × ${example.depth} · seed ${this.seed()} · steps ${this.steps()} · ${example.id}`
    }
    this.setStatus(example ? `${exampleLabel(example)} ready; press Generate` : "Select a model", "info")
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
    await this.resetSession()
  }

  disconnectedCallback() {
    this.stopPlayback()
    if (this.voxelRenderer) this.voxelRenderer.dispose()
    this.voxelRenderer = null
    void this.dismissSession()
    super.disconnectedCallback()
  }

  async readFile(path) {
    return new Uint8Array(unwrap(await runtime.invoke("fs/fs::read-file", path), path))
  }

  async readOptionalFile(path) {
    try {
      return await this.readFile(path)
    } catch (error) {
      const message = String(error?.message || error)
      if (message.includes("no-entry") || message.includes("No such file") || message.includes("not found") || message.includes("os error 2")) return null
      throw error
    }
  }

  async createCompileOptions(xml, example) {
    const resourceRoot = normalizePath(this.config?.resourceRoot || "markov-junior/resources")
    const folder = xmlAttr(xmlRootStartTag(xml), "folder", "")
    const rulePatterns = new Map()
    const ruleVox = new Map()
    const samplePngs = new Map()
    const tilesetXml = new Map()
    const tileVox = new Map()

    const ruleFolders = unique([folder, ...uniqueXmlAttrValues(xml, "folder")])
    for (const file of unique([
      ...uniqueXmlAttrValues(xml, "file"),
      ...uniqueXmlAttrValues(xml, "fin"),
      ...uniqueXmlAttrValues(xml, "fout"),
    ])) {
      for (const ruleFolder of ruleFolders) {
        if (example.depth === 1) {
          const pngPath = joinResourcePath(resourceRoot, "rules", ruleFolder, `${file}.png`)
          const png = await this.readOptionalFile(pngPath)
          if (png) rulePatterns.set(`${ruleFolder}\0${file}`, await decodePngPattern(png, this.legendForRule(xml, file)))
        } else {
          const voxPath = joinResourcePath(resourceRoot, "rules", ruleFolder, `${file}.vox`)
          const vox = await this.readOptionalFile(voxPath)
          if (vox) ruleVox.set(`${ruleFolder}\0${file}`, vox)
        }
      }
    }

    for (const sample of unique(uniqueXmlAttrValues(xml, "sample"))) {
      const samplePath = joinResourcePath(resourceRoot, "samples", `${sample}.png`)
      samplePngs.set(sample, await decodePngRgba(await this.readFile(samplePath)))
    }

    for (const tileset of unique(uniqueXmlAttrValues(xml, "tileset"))) {
      const tilesetPath = joinResourcePath(resourceRoot, "tilesets", `${tileset}.xml`)
      const text = unwrap(await runtime.invoke("fs/fs::read-text", tilesetPath), tilesetPath)
      tilesetXml.set(tileset, text)
      const start = xmlRootStartTag(xml)
      const tilesName = xmlAttr(start, "tiles", tileset)
      for (const tileName of unique(uniqueXmlAttrValues(text, "name"))) {
        const voxPath = joinResourcePath(resourceRoot, "tilesets", tilesName, `${tileName}.vox`)
        tileVox.set(`${tilesName}\0${tileName}`, await this.readFile(voxPath))
      }
    }

    return {
      folder,
      depth: example.depth,
      loadRulePattern: (file, legend, requestedFolder = "") => {
        const key = `${requestedFolder}\0${file}`
        const pattern = rulePatterns.get(key)
        if (pattern) return pattern
        return undefined
      },
      loadRuleVox: (file, requestedFolder = "") => ruleVox.get(`${requestedFolder}\0${file}`),
      loadSamplePng: (sample) => samplePngs.get(sample),
      loadTilesetXml: (name) => tilesetXml.get(name),
      loadTileVox: (tilesName, tileName) => tileVox.get(`${tilesName}\0${tileName}`),
    }
  }

  legendForRule(xml, file) {
    const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const match = xml.match(new RegExp(`<[^>]+\\b(?:file|fin|fout)="${escaped}"[^>]*\\blegend="([^"]+)"`))
    assert(match, `view-markov rule resource ${file} missing legend attribute`)
    return match[1]
  }

  async dismissSession({ stopPlayback = true } = {}) {
    if (stopPlayback) this.stopPlayback()
    if (!this.session) return
    const session = this.session
    this.session = null
    unwrap(await runtime.invoke("markov-junior/markov-junior::dismiss", session), "markov-junior.dismiss")
    await runtime.releaseResource(session)
  }

  async resetSession({ preservePlayback = false } = {}) {
    if (this.running) return
    this.running = true
    const started = performance.now()
    try {
      await this.dismissSession({ stopPlayback: !preservePlayback })
      const example = this.selectedExample()
      assert(example, `view-markov could not resolve source '${this.source}'`)
      this.source = example.id
      this.syncHeaderControls()
      assert(example.render === "2d" || example.render === "vox", `view-markov unsupported render mode: ${example.render}`)
      if (example.render === "2d") this.ensure2dCanvas()
      if (example.render === "vox") {
        assert(example.depth > 1, `view-markov vox render requires depth > 1 for ${example.id}`)
        assert(typeof example.transparent === "string", `view-markov vox example ${example.id} requires transparent symbols`)
        this.ensureVoxelCanvas()
      }

      this.setStatus(`Resetting ${exampleLabel(example)}...`, "info")
      const xml = unwrap(await runtime.invoke("fs/fs::read-text", example.source), example.source)
      const modelIr = compileXmlToMjir(xml, await this.createCompileOptions(xml, example))
      const initialCells = initialGridFromXml(xml, example.width, example.height, example.depth)
      const state = unwrap(await runtime.invoke(
        "markov-junior/markov-junior::create",
        modelIr,
        initialCells,
        {
          width: example.width,
          height: example.height,
          depth: example.depth,
          seed: this.seed(),
        },
      ), "markov-junior.create")
      this.session = state.handle
      this.applyGrid(state.grid, example, Math.round(performance.now() - started))
      this.setStatus(`${exampleLabel(example)} ready in ${Math.round(performance.now() - started)}ms`, "success")
    } catch (error) {
      this.session = null
      this.setData(null, { autoFit: false })
      this.setStatus(`Error: ${error?.message || error}`, "danger")
      console.error("view-markov reset failed:", error)
    } finally {
      this.running = false
    }
  }

  async stepCurrent() {
    if (this.running) return
    if (!this.session) await this.resetSession({ preservePlayback: this.playing })
    if (!this.session) {
      if (this.playing) this.stopPlayback()
      return
    }
    this.running = true
    const started = performance.now()
    try {
      const example = this.selectedExample()
      assert(example, `view-markov could not resolve source '${this.source}'`)
      const grid = unwrap(await runtime.invoke("markov-junior/markov-junior::step", this.session, this.steps()), "markov-junior.step")
      this.applyGrid(grid, example, Math.round(performance.now() - started))
      this.setStatus(grid.done ? `Done in ${grid["steps-run"]} steps` : `Stepped in ${Math.round(performance.now() - started)}ms`, grid.done ? "success" : "info")
      if (grid.done) this.stopPlayback()
    } catch (error) {
      this.stopPlayback()
      this.setStatus(`Error: ${error?.message || error}`, "danger")
      console.error("view-markov step failed:", error)
    } finally {
      this.running = false
    }
  }

  togglePlayback() {
    if (this.playing) {
      this.stopPlayback()
      return
    }
    this.playing = true
    this.syncPlaybackButton()
    this.animationFrame = requestAnimationFrame(() => this.playbackTick())
  }

  stopPlayback() {
    this.playing = false
    if (this.animationFrame !== 0) cancelAnimationFrame(this.animationFrame)
    this.animationFrame = 0
    this.syncPlaybackButton()
  }

  syncPlaybackButton() {
    const button = this.queryHeaderControl('[data-action="play-pause"]')
    if (!(button instanceof HTMLButtonElement)) return
    const icon = button.querySelector("i")
    if (icon) icon.textContent = this.playing ? "pause" : "play_arrow"
    button.setAttribute("aria-label", this.playing ? "Pause" : "Play")
    button.setAttribute("title", this.playing ? "Pause" : "Play")
  }

  async playbackTick() {
    if (!this.playing) return
    await this.stepCurrent()
    if (!this.playing) return
    this.animationFrame = requestAnimationFrame(() => this.playbackTick())
  }

  _onResized(width, height) {
    if (this.voxelRenderer) {
      this.voxelRenderer.resize(width, height)
      return
    }
    super._onResized(width, height)
  }

  applyCanvasLayout() {
    assert(this.canvas instanceof HTMLCanvasElement, "view-markov missing canvas")
    this.canvas.style.width = "100%"
    this.canvas.style.height = "100%"
    this.canvas.style.minWidth = "0"
    this.canvas.style.minHeight = "0"
    this.canvas.style.maxWidth = "100%"
    this.canvas.style.maxHeight = "100%"
    this.canvas.style.justifySelf = "stretch"
    this.canvas.style.alignSelf = "stretch"
  }

  replaceCanvas() {
    assert(this.canvas instanceof HTMLCanvasElement, "view-markov missing canvas")
    this._resizeObserver.unobserve(this.canvas)
    this._removeEventListeners()
    const replacement = document.createElement("canvas")
    replacement.dataset.element = "canvas"
    this.canvas.replaceWith(replacement)
    this.canvas = replacement
    this.applyCanvasLayout()
    this._resizeObserver.observe(this.canvas)
    return replacement
  }

  ensureVoxelCanvas() {
    if (this.voxelRenderer) return
    this.replaceCanvas()
    this.ctx = null
    this.voxelRenderer = new VoxelOrbitRenderer(this.canvas)
  }

  ensure2dCanvas() {
    if (!this.voxelRenderer && this.ctx) return
    if (this.voxelRenderer) {
      this.voxelRenderer.dispose()
      this.voxelRenderer = null
      this.replaceCanvas()
    }
    this.ctx = this.canvas.getContext("2d")
    assert(this.ctx, "view-markov failed to create 2d context")
    this.ctx.imageSmoothingEnabled = false
    this._addEventListeners()
  }

  zoomIn() {
    if (this.voxelRenderer) {
      this.voxelRenderer.zoom(0.8)
      return
    }
    super.zoomIn()
  }

  zoomOut() {
    if (this.voxelRenderer) {
      this.voxelRenderer.zoom(1.25)
      return
    }
    super.zoomOut()
  }

  zoomFit() {
    if (this.voxelRenderer) {
      this.voxelRenderer.fit()
      return true
    }
    return super.zoomFit()
  }

  applyGrid(grid, example, durationMs) {
    assert(grid && typeof grid === "object" && !Array.isArray(grid), "view-markov grid must be object")
    if (example.render === "vox") {
      this.ensureVoxelCanvas()
      const renderData = voxelRenderDataFromIndexedGrid(grid, {
        ...this.voxelPalette,
        transparent: example.transparent,
      })
      this.voxelRenderer.setInstances(renderData)
      this.data = { ...grid, render: "vox" }
    } else {
      this.ensure2dCanvas()
      const rows = toRows(grid.cells, grid.width, grid.height, grid.values)
      this.setData({ ...grid, rows, render: "2d" }, { autoFit: true })
    }
    assert(this.metaElement instanceof HTMLOutputElement, "view-markov meta output is not initialized")
    this.metaElement.textContent = `${grid.width} × ${grid.height} × ${grid.depth} · values ${grid.values} · seed ${this.seed()} · steps ${grid["steps-run"]}/${this.steps()} · changed ${grid.changed}${grid.done ? " · done" : ""} · ${durationMs}ms · ${example.id}`
  }

  calculateContentBounds(data) {
    if (!data || data.render === "vox") return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
    return { minX: 0, minY: 0, maxX: data.width, maxY: data.height }
  }

  drawContent(ctx, data) {
    if (!data || data.render === "vox") return
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
