import { runtime } from '../core/runtime.js'
import { registerViewPlugin, unregisterViewPlugin } from '../util/view-plugin.js'
import { parseCSVLines } from '../util/csv.js'

const textDecoder = new TextDecoder()
const DEFAULT_TILE_SIZE = 16
const DEFAULT_MAP_WIDTH = 32
const DEFAULT_MAP_HEIGHT = 32

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function decodeOutput(result) {
  return textDecoder.decode(result?.output || new Uint8Array())
}

function quoteSqlValue(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function parsePositiveInt(value, label) {
  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer`)
  return parsed
}

export class TilemapSettings extends HTMLElement {
  static get observedAttributes() {
    return ['data-source', 'data-mode', 'data-title']
  }

  constructor() {
    super()
    this.nameInput = null
    this.tileSizeInput = null
    this.widthInput = null
    this.heightInput = null
    this.statusElement = null
    this.formElement = null
    this.legendElement = null
    this.saveButton = null
    this.tilemap = null
  }

  connectedCallback() {
    registerViewPlugin(this)
    if (this.dataset.ready) return
    this.dataset.ready = '1'
    this.style.display = 'contents'

    this.innerHTML = `
      <form data-element="form" novalidate>
        <fieldset>
          <legend data-element="legend">Tilemap Settings</legend>

          <label for="tilemap-settings-name">Name</label>
          <input id="tilemap-settings-name" type="text" data-field="name" autocomplete="off" placeholder="my_tilemap">

          <label for="tilemap-settings-tile-size">Tile size</label>
          <input id="tilemap-settings-tile-size" type="number" min="1" step="1" data-field="tile-size">

          <label for="tilemap-settings-map-width">Map width</label>
          <input id="tilemap-settings-map-width" type="number" min="1" step="1" data-field="map-width">

          <label for="tilemap-settings-map-height">Map height</label>
          <input id="tilemap-settings-map-height" type="number" min="1" step="1" data-field="map-height">
        </fieldset>

        <footer>
          <output data-element="status"></output>
          <button type="button" data-action="cancel">Cancel</button>
          <button type="submit" data-action="save" class="accent">Save</button>
        </footer>
      </form>
    `

    this.formElement = this.querySelector('[data-element="form"]')
    this.legendElement = this.querySelector('[data-element="legend"]')
    this.nameInput = this.querySelector('[data-field="name"]')
    this.tileSizeInput = this.querySelector('[data-field="tile-size"]')
    this.widthInput = this.querySelector('[data-field="map-width"]')
    this.heightInput = this.querySelector('[data-field="map-height"]')
    this.statusElement = this.querySelector('[data-element="status"]')
    this.saveButton = this.querySelector('[data-action="save"]')

    assert(this.formElement instanceof HTMLFormElement, 'tilemap-settings missing form')
    assert(this.legendElement instanceof HTMLLegendElement, 'tilemap-settings missing legend')
    assert(this.nameInput instanceof HTMLInputElement, 'tilemap-settings missing name input')
    assert(this.tileSizeInput instanceof HTMLInputElement, 'tilemap-settings missing tile size input')
    assert(this.widthInput instanceof HTMLInputElement, 'tilemap-settings missing map width input')
    assert(this.heightInput instanceof HTMLInputElement, 'tilemap-settings missing map height input')
    assert(this.statusElement instanceof HTMLOutputElement, 'tilemap-settings missing status output')
    assert(this.saveButton instanceof HTMLButtonElement, 'tilemap-settings missing save button')

    this.applyModeText()

    this.querySelector('[data-action="cancel"]').addEventListener('click', async () => {
      await runtime.call('ui.popup', 'close', { reload: false, cancelled: true })
    })

    this.formElement.addEventListener('submit', async (event) => {
      event.preventDefault()
      await this.save()
    })

    void this.load()
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return
    if (!this.dataset.ready) return
    if (name === 'data-source' || name === 'data-mode') void this.load()
    if (name === 'data-title' || name === 'data-mode') this.applyModeText()
  }

  get mode() {
    const mode = String(this.getAttribute('data-mode') || 'edit').trim()
    assert(mode === 'create' || mode === 'edit', `tilemap-settings unsupported data-mode ${mode}`)
    return mode
  }

  applyModeText() {
    const title = String(this.getAttribute('data-title') || (this.mode === 'create' ? 'Create Tilemap' : 'Tilemap Settings')).trim()
    this.legendElement.textContent = title
    this.saveButton.textContent = this.mode === 'create' ? 'Create' : 'Save'
  }

  dataSourceName() {
    const value = String(this.getAttribute('data-source') || '').trim()
    assert(value.length > 0, 'tilemap-settings requires data-source')
    const prefix = 'sql:tilemap_storage/'
    return value.startsWith(prefix) ? value.slice(prefix.length) : value
  }

  async load() {
    try {
      if (this.mode === 'create') {
        this.tilemap = this.createDefaultTilemap()
        this.renderTilemap(this.tilemap)
        this.setStatus('Enter tilemap name and settings', 'info')
        queueMicrotask(() => this.nameInput.focus())
        return
      }

      const name = this.dataSourceName()
      this.setStatus(`Loading ${name}…`, 'info')
      this.tilemap = await this.loadTilemap(name)
      this.renderTilemap(this.tilemap)
      this.setStatus(`Loaded ${name}`, 'success')
      queueMicrotask(() => this.nameInput.focus())
    } catch (error) {
      this.setStatus(`Error: ${error.message}`, 'danger')
    }
  }

  createDefaultTilemap() {
    return {
      name: '',
      data: {
        props: { tileSize: String(DEFAULT_TILE_SIZE) },
        layers: [{
          width: DEFAULT_MAP_WIDTH,
          data: new Array(DEFAULT_MAP_WIDTH * DEFAULT_MAP_HEIGHT).fill(0),
          props: { name: 'Layer 0' },
        }],
      },
    }
  }

  async loadTilemap(name) {
    const csv = await this.callSql(`SELECT name, data FROM tilemap_storage WHERE name = ${quoteSqlValue(name)} LIMIT 1`)
    const lines = parseCSVLines(csv.trim())
    assert(lines.length === 2, `tilemap_storage missing tilemap ${name}`)
    const headers = lines[0]
    const row = lines[1]
    const nameIndex = headers.indexOf('name')
    const dataIndex = headers.indexOf('data')
    assert(nameIndex >= 0 && dataIndex >= 0, 'tilemap_storage query returned unexpected columns')
    const data = JSON.parse(row[dataIndex])
    this.validateStorageData(data)
    return { name: row[nameIndex], data }
  }

  validateStorageData(data) {
    assert(data && typeof data === 'object' && !Array.isArray(data), 'tilemap storage data must be object JSON')
    assert(Array.isArray(data.layers), 'tilemap storage data.layers must be array')
    assert(data.layers.length > 0, 'tilemap storage must contain at least one layer')
    for (const [index, layer] of data.layers.entries()) {
      assert(layer && typeof layer === 'object' && !Array.isArray(layer), `tilemap layer ${index} must be object`)
      assert(Number.isInteger(layer.width) && layer.width > 0, `tilemap layer ${index}.width must be positive integer`)
      assert(Array.isArray(layer.data), `tilemap layer ${index}.data must be array`)
    }
  }

  renderTilemap(tilemap) {
    const props = tilemap.data.props && typeof tilemap.data.props === 'object' && !Array.isArray(tilemap.data.props) ? tilemap.data.props : {}
    this.nameInput.value = tilemap.name
    this.tileSizeInput.value = String(parsePositiveInt(props.tileSize ?? props.sourceTileSize ?? props.tw ?? DEFAULT_TILE_SIZE, 'Tile size'))
    this.widthInput.value = String(Math.max(...tilemap.data.layers.map((layer) => layer.width)))
    this.heightInput.value = String(Math.max(...tilemap.data.layers.map((layer) => Math.ceil(layer.data.length / layer.width))))
  }

  async save() {
    assert(this.tilemap, 'tilemap-settings save requires loaded tilemap')
    const name = this.nameInput.value.trim()
    if (!name) {
      this.nameInput.classList.add('danger')
      this.nameInput.focus()
      this.setStatus('Error: Name is required', 'danger')
      return
    }
    this.nameInput.classList.remove('danger')

    const tileSize = parsePositiveInt(this.tileSizeInput.value, 'Tile size')
    const width = parsePositiveInt(this.widthInput.value, 'Map width')
    const height = parsePositiveInt(this.heightInput.value, 'Map height')

    const data = this.updatedStorageData(this.tilemap.data, { tileSize, width, height })
    this.setStatus('Saving…', 'info')
    try {
      await this.execSql(`INSERT OR REPLACE INTO tilemap_storage (name, data) VALUES (${quoteSqlValue(name)}, ${quoteSqlValue(JSON.stringify(data))})`)
      await runtime.call('ui.popup', 'close', { reload: true, cancelled: false, name })
    } catch (error) {
      this.setStatus(`Error: ${error.message}`, 'danger')
    }
  }

  updatedStorageData(data, settings) {
    const props = data.props && typeof data.props === 'object' && !Array.isArray(data.props) ? { ...data.props } : {}
    props.tileSize = String(settings.tileSize)

    return {
      props,
      layers: data.layers.map((layer) => ({
        width: settings.width,
        data: this.resizeLayerData(layer, settings.width, settings.height),
        props: layer.props && typeof layer.props === 'object' && !Array.isArray(layer.props) ? { ...layer.props } : {},
      })),
    }
  }

  resizeLayerData(layer, width, height) {
    const next = new Array(width * height).fill(0)
    const previousWidth = layer.width
    const previousHeight = Math.ceil(layer.data.length / previousWidth)
    const copyWidth = Math.min(previousWidth, width)
    const copyHeight = Math.min(previousHeight, height)
    for (let y = 0; y < copyHeight; y++) {
      for (let x = 0; x < copyWidth; x++) {
        next[y * width + x] = Number(layer.data[y * previousWidth + x] || 0)
      }
    }
    return next
  }

  setStatus(text, tone = null) {
    this.statusElement.textContent = text
    this.statusElement.classList.remove('accent', 'success', 'warning', 'danger', 'info')
    if (tone) this.statusElement.classList.add(tone)
  }

  async callSql(sql) {
    const result = await runtime.call('sql', 'query', sql)
    if (result.returnCode !== 0) throw new Error(decodeOutput(result) || `sql query failed: ${result.returnCode}`)
    return decodeOutput(result)
  }

  async execSql(sql) {
    const result = await runtime.call('sql', 'exec', sql)
    if (result.returnCode !== 0) throw new Error(decodeOutput(result) || `sql exec failed: ${result.returnCode}`)
    return decodeOutput(result)
  }

  disconnectedCallback() {
    void unregisterViewPlugin(this)
  }
}

if (!customElements.get('tilemap-settings')) {
  customElements.define('tilemap-settings', TilemapSettings)
}
