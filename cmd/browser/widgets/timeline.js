function createMockTimelineModel() {
  const state = {
    activeLayerId: 'body',
    activeFrame: 0,
    frameCount: 4,
    showFrames: true,
    firstFrameNumber: 1,
    layers: [
      {
        id: 'shadow',
        name: 'Shadow',
        kind: 'layer',
        visible: true,
        locked: false,
        continuous: true,
        cels: [{ frame: 0 }, { frame: 1 }, { frame: 2 }, { frame: 3 }],
      },
      {
        id: 'character',
        name: 'Character',
        kind: 'group',
        visible: true,
        locked: false,
        collapsed: false,
        children: [
          {
            id: 'gun',
            name: 'Gun',
            kind: 'layer',
            visible: true,
            locked: false,
            continuous: true,
            cels: [{ frame: 0 }, { frame: 2 }],
          },
          {
            id: 'body',
            name: 'Body',
            kind: 'layer',
            visible: true,
            locked: false,
            continuous: true,
            cels: [{ frame: 0 }, { frame: 1 }, { frame: 2 }, { frame: 3 }],
          },
        ],
      },
      {
        id: 'background',
        name: 'Background',
        kind: 'layer',
        visible: true,
        locked: false,
        continuous: true,
        cels: [{ frame: 0 }],
      },
    ],
  }

  return {
    get activeLayerId() { return state.activeLayerId },
    set activeLayerId(layerId) { state.activeLayerId = layerId },
    get activeFrame() { return state.activeFrame },
    set activeFrame(frame) { state.activeFrame = frame },
    get frameCount() { return state.frameCount },
    get showFrames() { return state.showFrames },
    get firstFrameNumber() { return state.firstFrameNumber },
    get layers() { return state.layers },
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function validateLayer(layer, path) {
  if (!layer || typeof layer !== 'object' || Array.isArray(layer)) throw new Error(`${path} must be an object`)
  if (typeof layer.id !== 'string' || layer.id.length === 0) throw new Error(`${path}.id is required`)
  if (typeof layer.name !== 'string') throw new Error(`${path}.name is required`)
  if (layer.kind !== 'layer' && layer.kind !== 'group') throw new Error(`${path}.kind must be layer or group`)
  if (typeof layer.visible !== 'boolean') throw new Error(`${path}.visible is required`)
  if (typeof layer.locked !== 'boolean') throw new Error(`${path}.locked is required`)

  if (layer.kind === 'group') {
    if (!Array.isArray(layer.children)) throw new Error(`${path}.children is required for groups`)
    layer.children.forEach((child, index) => validateLayer(child, `${path}.children[${index}]`))
    return
  }

  if (Object.hasOwn(layer, 'children')) throw new Error(`${path}.children is invalid for non-group layers`)
  if (typeof layer.continuous !== 'boolean') throw new Error(`${path}.continuous is required for layers`)
}

function flattenLayers(layers, depth = 0, rows = []) {
  layers.forEach((layer) => {
    rows.push({ layer, depth })
    if (layer.kind === 'group' && !layer.collapsed) flattenLayers(layer.children, depth + 1, rows)
  })
  return rows
}

function hasCel(layer, frame) {
  if (!Array.isArray(layer.cels)) return false
  return layer.cels.some((cel) => cel.frame === frame)
}

export class WidgetTimeline extends HTMLElement {
  constructor() {
    super()
    this._model = createMockTimelineModel()
  }

  connectedCallback() {
    this.render()
  }

  get model() {
    return this._model
  }

  set model(model) {
    this._model = model
    if (this.isConnected) this.render()
  }

  render() {
    const model = this._model
    this._validateModel(model)
    const rows = flattenLayers(model.layers)
    const frames = Array.from({ length: model.frameCount }, (_, index) => index)

    this.innerHTML = `
      <article data-element="timeline">
        <table data-element="timeline-table">
          <thead data-element="frame-header">
            <tr>
              <th>Layer</th>
              <th>Visible</th>
              <th>Locked</th>
              <th>Continuous</th>
              ${model.showFrames ? frames.map((frame) => `<th>${model.firstFrameNumber + frame}</th>`).join('') : ''}
            </tr>
          </thead>
          <tbody data-element="layer-rows">
            ${rows.map(({ layer, depth }) => this._renderLayerRow(layer, depth, frames)).join('')}
          </tbody>
        </table>
      </article>
    `

    this.querySelectorAll('[data-layer-id]').forEach((row) => {
      row.addEventListener('click', () => {
        model.activeLayerId = row.getAttribute('data-layer-id')
        this.render()
      })
    })

    this.querySelectorAll('[data-action="select-cel"]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation()
        model.activeLayerId = button.getAttribute('data-layer-id')
        model.activeFrame = Number(button.getAttribute('data-frame'))
        if (typeof model.selectCel === 'function') {
          model.selectCel({ layerId: model.activeLayerId, frame: model.activeFrame })
        }
        this.render()
      })
    })
  }

  _renderLayerRow(layer, depth, frames) {
    const active = layer.id === this._model.activeLayerId
    const groupPrefix = layer.kind === 'group' ? (layer.collapsed ? '▸ ' : '▾ ') : ''
    const indent = '&nbsp;'.repeat(depth * 4)
    return `
      <tr data-layer-id="${escapeHtml(layer.id)}" aria-selected="${active ? 'true' : 'false'}">
        <td>${indent}${groupPrefix}${escapeHtml(layer.name)}</td>
        <td>${layer.visible ? 'yes' : 'no'}</td>
        <td>${layer.locked ? 'yes' : 'no'}</td>
        <td>${layer.kind === 'layer' ? (layer.continuous ? 'yes' : 'no') : ''}</td>
        ${this._model.showFrames ? frames.map((frame) => `
          <td>
            <button data-action="select-cel" data-layer-id="${escapeHtml(layer.id)}" data-frame="${frame}" aria-pressed="${active && this._model.activeFrame === frame ? 'true' : 'false'}">${hasCel(layer, frame) ? '●' : '○'}</button>
          </td>
        `).join('') : ''}
      </tr>
    `
  }

  _validateModel(model) {
    if (!model || typeof model !== 'object' || Array.isArray(model)) throw new Error('widget-timeline.model must be an object')
    if (typeof model.activeLayerId !== 'string') throw new Error('widget-timeline.model.activeLayerId is required')
    if (!Number.isInteger(model.activeFrame) || model.activeFrame < 0) throw new Error('widget-timeline.model.activeFrame must be a non-negative integer')
    if (!Number.isInteger(model.frameCount) || model.frameCount < 1) throw new Error('widget-timeline.model.frameCount must be a positive integer')
    if (typeof model.showFrames !== 'boolean') throw new Error('widget-timeline.model.showFrames is required')
    if (!Number.isInteger(model.firstFrameNumber)) throw new Error('widget-timeline.model.firstFrameNumber is required')
    if (!Array.isArray(model.layers)) throw new Error('widget-timeline.model.layers is required')
    model.layers.forEach((layer, index) => validateLayer(layer, `widget-timeline.model.layers[${index}]`))
  }
}

if (!customElements.get('widget-timeline')) {
  customElements.define('widget-timeline', WidgetTimeline)
}
