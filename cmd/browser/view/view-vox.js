import { runtime } from '/core/runtime.js'
import { ViewCanvasBase } from '/util/view-canvas-base.js'
import { decode as decodeVox } from '/util/vox/decode.js'

const decoder = new TextDecoder()
const TILE_W = 24
const TILE_H = 12
const CUBE_H = 18

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function decodeOutput(result) {
  return decoder.decode(result?.output || new Uint8Array())
}

function colorForIndex(palette, index) {
  if (palette) {
    const p = (index - 1) * 4
    return {
      r: palette[p],
      g: palette[p + 1],
      b: palette[p + 2],
      a: palette[p + 3] / 255,
    }
  }

  const hue = (index * 47) % 360
  return hslToRgb(hue, 68, 56)
}

function hslToRgb(h, s, l) {
  s /= 100
  l /= 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs((h / 60) % 2 - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else[r, g, b] = [c, 0, x]
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
    a: 1,
  }
}

function shade(color, factor) {
  return `rgba(${Math.max(0, Math.min(255, Math.round(color.r * factor)))}, ${Math.max(0, Math.min(255, Math.round(color.g * factor)))}, ${Math.max(0, Math.min(255, Math.round(color.b * factor)))}, ${color.a})`
}

function parseTranslation(value) {
  if (typeof value !== 'string' || value.length === 0) return { x: 0, y: 0, z: 0 }
  const parts = value.trim().split(/\s+/).map((part) => Number.parseInt(part, 10))
  assert(parts.length === 3 && parts.every(Number.isInteger), `view-vox invalid nTRN translation: ${value}`)
  return { x: parts[0], y: parts[1], z: parts[2] }
}

function decodeRotation(value) {
  if (typeof value !== 'string' || value.length === 0) return null
  const packed = Number.parseInt(value, 10)
  assert(Number.isInteger(packed) && packed >= 0 && packed <= 255, `view-vox invalid nTRN rotation: ${value}`)
  const row0 = packed & 3
  const row1 = (packed >> 2) & 3
  const row2 = [0, 1, 2].find((axis) => axis !== row0 && axis !== row1)
  assert(row2 !== undefined, `view-vox invalid nTRN rotation axes: ${value}`)
  const signs = [
    (packed & 16) ? -1 : 1,
    (packed & 32) ? -1 : 1,
    (packed & 64) ? -1 : 1,
  ]
  return [
    { axis: row0, sign: signs[0] },
    { axis: row1, sign: signs[1] },
    { axis: row2, sign: signs[2] },
  ]
}

function applyRotation(point, rotation) {
  if (!rotation) return point
  const values = [point.x, point.y, point.z]
  return {
    x: values[rotation[0].axis] * rotation[0].sign,
    y: values[rotation[1].axis] * rotation[1].sign,
    z: values[rotation[2].axis] * rotation[2].sign,
  }
}

function composeTransform(parent, frame) {
  const translation = parseTranslation(frame?._t)
  const rotation = decodeRotation(frame?._r)
  return {
    x: parent.x + translation.x,
    y: parent.y + translation.y,
    z: parent.z + translation.z,
    rotation: rotation || parent.rotation,
  }
}

function projectPoint(x, y, z, rotation) {
  let rx = x
  let ry = y
  if (rotation === 1) {
    rx = y
    ry = -x
  } else if (rotation === 2) {
    rx = -x
    ry = -y
  } else if (rotation === 3) {
    rx = -y
    ry = x
  }

  return {
    x: (rx - ry) * (TILE_W / 2),
    y: (rx + ry) * (TILE_H / 2) - z * CUBE_H,
    depth: rx + ry + z * 2,
  }
}

function collectInstances(vox) {
  const scene = vox.scene
  if (!scene || scene.shapes.length === 0 || scene.transforms.length === 0) {
    return vox.models.map((model, modelId) => ({ modelId, model, transform: { x: 0, y: 0, z: 0, rotation: null } }))
  }

  const transforms = new Map(scene.transforms.map((node) => [node.nodeId, node]))
  const groups = new Map(scene.groups.map((node) => [node.nodeId, node]))
  const shapes = new Map(scene.shapes.map((node) => [node.nodeId, node]))
  const childIds = new Set()
  for (const node of scene.transforms) childIds.add(node.childNodeId)
  for (const node of scene.groups) {
    for (const childNodeId of node.childNodeIds) childIds.add(childNodeId)
  }
  const roots = scene.transforms.filter((node) => !childIds.has(node.nodeId))
  assert(roots.length > 0, 'view-vox scene graph has no root transform')

  const instances = []
  function visit(nodeId, transform) {
    if (transforms.has(nodeId)) {
      const node = transforms.get(nodeId)
      const next = composeTransform(transform, node.frames[0] || {})
      visit(node.childNodeId, next)
      return
    }
    if (groups.has(nodeId)) {
      const node = groups.get(nodeId)
      for (const childNodeId of node.childNodeIds) visit(childNodeId, transform)
      return
    }
    if (shapes.has(nodeId)) {
      const node = shapes.get(nodeId)
      for (const entry of node.models) {
        const model = vox.models[entry.modelId]
        assert(model, `view-vox scene references missing model ${entry.modelId}`)
        instances.push({ modelId: entry.modelId, model, transform })
      }
      return
    }
    throw new Error(`view-vox scene references missing node ${nodeId}`)
  }

  for (const root of roots) visit(root.nodeId, { x: 0, y: 0, z: 0, rotation: null })
  assert(instances.length > 0, 'view-vox scene graph produced no model instances')
  return instances
}

function buildRenderVoxels(data, rotation) {
  const out = []
  for (const instance of data.instances) {
    const voxels = instance.model.voxels
    for (let p = 0; p < voxels.length; p += 4) {
      const local = applyRotation({ x: voxels[p], y: voxels[p + 1], z: voxels[p + 2] }, instance.transform.rotation)
      const x = local.x + instance.transform.x
      const y = local.y + instance.transform.y
      const z = local.z + instance.transform.z
      const colorIndex = voxels[p + 3]
      const projected = projectPoint(x, y, z, rotation)
      out.push({ x, y, z, colorIndex, sx: projected.x, sy: projected.y, depth: projected.depth })
    }
  }
  out.sort((a, b) => a.depth - b.depth || a.z - b.z || a.y - b.y || a.x - b.x)
  return out
}

function drawFace(ctx, points, fillStyle) {
  ctx.beginPath()
  ctx.moveTo(points[0][0], points[0][1])
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1])
  ctx.closePath()
  ctx.fillStyle = fillStyle
  ctx.fill()
}

function drawCube(ctx, voxel, color) {
  const x = voxel.sx
  const y = voxel.sy
  const hw = TILE_W / 2
  const hh = TILE_H / 2
  const h = CUBE_H

  const top = [
    [x, y - h],
    [x + hw, y - h + hh],
    [x, y - h + TILE_H],
    [x - hw, y - h + hh],
  ]
  const left = [
    [x - hw, y - h + hh],
    [x, y - h + TILE_H],
    [x, y + TILE_H],
    [x - hw, y + hh],
  ]
  const right = [
    [x + hw, y - h + hh],
    [x, y - h + TILE_H],
    [x, y + TILE_H],
    [x + hw, y + hh],
  ]

  drawFace(ctx, left, shade(color, 0.66))
  drawFace(ctx, right, shade(color, 0.82))
  drawFace(ctx, top, shade(color, 1.08))
}

export class ViewVox extends ViewCanvasBase {
  static get observedAttributes() {
    return ['data-source']
  }

  constructor() {
    super()
    this.path = ''
    this.statusElement = null
    this.pathElement = null
    this.rotation = 0
    this.rotating = false
    this.rotateStartX = 0
    this.rotateStartRotation = 0
  }

  connectedCallback() {
    if (this.dataset.ready) return
    this.dataset.ready = '1'

    this.path = String(this.popupProps?.path || this.getAttribute('data-source') || '').trim()
    assert(this.path, 'view-vox requires data-source')

    this.innerHTML = `
      <canvas data-element="canvas"></canvas>
      <footer data-element="footer">
        <output data-element="path"></output>
        <output data-element="status">Loading...</output>
      </footer>
    `

    this.statusElement = this.querySelector('[data-element="status"]')
    this.pathElement = this.querySelector('[data-element="path"]')
    assert(this.statusElement instanceof HTMLOutputElement, 'view-vox missing status output')
    assert(this.pathElement instanceof HTMLOutputElement, 'view-vox missing path output')
    this.pathElement.textContent = this.path

    super.connectedCallback()
    this.canvas.style.cursor = 'grab'
    void this.load()
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return
    if (name !== 'data-source') return
    this.path = String(newValue || '').trim()
    if (this.pathElement instanceof HTMLOutputElement) this.pathElement.textContent = this.path
    if (this.dataset.ready) void this.load()
  }

  createViewPluginMethods() {
    return {
      reload: async () => {
        await this.reload()
        return { ok: true }
      },
    }
  }

  createHeaderControlsElement() {
    const toolbar = document.createElement('div')
    toolbar.dataset.element = 'toolbar'
    toolbar.innerHTML = `
      <div role="buttongroup" data-element="file-actions">
        <button type="button" data-action="reload" aria-label="Reload" title="Reload"><i aria-hidden="true">refresh</i></button>
      </div>
      <div role="buttongroup" data-element="view-actions">
        <button type="button" data-action="zoom-out" aria-label="Zoom out" title="Zoom out"><i aria-hidden="true">zoom_out</i></button>
        <button type="button" data-action="zoom-fit" aria-label="Fit" title="Fit"><i aria-hidden="true">fit_screen</i></button>
        <button type="button" data-action="zoom-in" aria-label="Zoom in" title="Zoom in"><i aria-hidden="true">zoom_in</i></button>
      </div>
    `
    toolbar.querySelector('[data-action="reload"]').addEventListener('click', () => this.reload())
    toolbar.querySelector('[data-action="zoom-out"]').addEventListener('click', () => this.zoomOut())
    toolbar.querySelector('[data-action="zoom-fit"]').addEventListener('click', () => this.fitToContent())
    toolbar.querySelector('[data-action="zoom-in"]').addEventListener('click', () => this.zoomIn())
    return toolbar
  }

  async reload() {
    await this.load()
    await runtime.call('ui.toast', 'success', { message: `Reloaded ${this.path}` })
  }

  setStatus(text, tone = null) {
    assert(this.statusElement instanceof HTMLOutputElement, 'view-vox status output is not initialized')
    this.statusElement.textContent = text
    this.statusElement.classList.remove('accent', 'success', 'warning', 'danger', 'info')
    if (tone) this.statusElement.classList.add(tone)
  }

  async load() {
    assert(this.path, 'view-vox requires data-source')
    this.setStatus('Loading...', 'info')

    try {
      const result = await runtime.call('fs', 'read', this.path)
      if (result.returnCode !== 0) throw new Error(decodeOutput(result) || `fs.read failed: ${result.returnCode}`)

      const bytes = result.output instanceof Uint8Array ? result.output : new Uint8Array(result.output)
      const vox = decodeVox(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      const instances = collectInstances(vox)

      this.rotation = 0
      this.setData({ vox, instances }, { autoFit: true })
      this.setStatus(this.createStatusText(vox, instances), 'success')
    } catch (error) {
      this.setData(null, { autoFit: false })
      this.setStatus(`Error: ${error?.message || error}`, 'danger')
      console.error('view-vox load failed:', error)
    }
  }

  createStatusText(vox, instances) {
    const voxelCount = instances.reduce((sum, instance) => sum + instance.model.voxels.length / 4, 0)
    const modelText = vox.models.length === 1 ? '1 model' : `${vox.models.length} models`
    const instanceText = instances.length === 1 ? '1 instance' : `${instances.length} instances`
    return [
      modelText,
      instanceText,
      `${voxelCount} voxels`,
      vox.palette ? 'RGBA palette' : 'debug palette',
    ].join(' · ')
  }

  calculateContentBounds(data) {
    if (!data) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }

    const rendered = buildRenderVoxels(data, this.rotation)
    if (rendered.length === 0) return { minX: 0, minY: 0, maxX: TILE_W, maxY: TILE_H }

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const voxel of rendered) {
      minX = Math.min(minX, voxel.sx - TILE_W / 2)
      maxX = Math.max(maxX, voxel.sx + TILE_W / 2)
      minY = Math.min(minY, voxel.sy - CUBE_H)
      maxY = Math.max(maxY, voxel.sy + TILE_H)
    }

    return { minX, minY, maxX, maxY }
  }

  drawContent(ctx, data) {
    if (!data) return

    const rendered = buildRenderVoxels(data, this.rotation)
    for (const voxel of rendered) {
      drawCube(ctx, voxel, colorForIndex(data.vox.palette, voxel.colorIndex))
    }
  }

  rotateByDrag(deltaX) {
    const quarterTurns = Math.round(deltaX / 80)
    const next = ((this.rotateStartRotation + quarterTurns) % 4 + 4) % 4
    if (next === this.rotation) return
    this.rotation = next
    this.contentBounds = this.calculateContentBounds(this.data)
    this.fitToContent()
  }

  _onWheel(event) {
    event.preventDefault()
    const rect = this.canvas.getBoundingClientRect()
    this.zoom(event.clientX - rect.left, event.clientY - rect.top, event.deltaY < 0 ? 1.1 : 0.9)
  }

  _onMouseDown(event) {
    this.rotating = true
    this.rotateStartX = event.clientX
    this.rotateStartRotation = this.rotation
    this.canvas.style.cursor = 'grabbing'
  }

  _onMouseMove(event) {
    if (!this.rotating) return
    this.rotateByDrag(event.clientX - this.rotateStartX)
  }

  _onMouseUp() {
    this.rotating = false
    if (this.canvas) this.canvas.style.cursor = 'grab'
  }

  _onMouseLeave() {
    this.rotating = false
    if (this.canvas) this.canvas.style.cursor = 'grab'
  }

  _onKeyDown(event) {
    if (event.key === '+') {
      event.preventDefault()
      this.zoomIn()
      return
    }

    if (event.key === '-') {
      event.preventDefault()
      this.zoomOut()
      return
    }

    if (event.key.toLowerCase() === 'f') {
      event.preventDefault()
      this.fitToContent()
    }
  }

  _onKeyUp(_event) { }
}

if (!customElements.get('view-vox')) {
  customElements.define('view-vox', ViewVox)
}
