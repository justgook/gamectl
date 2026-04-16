import { runtime } from '../core/runtime.js'
import { parseCSVLines } from '../util/csv.js'
import { ViewCanvasBase } from '../util/view-canvas-base.js'

const decoder = new TextDecoder()

const NODE_MIN_WIDTH = 200
const NODE_PADDING = 16
const HORIZONTAL_SPACING = 150
const MIN_VERTICAL_SPACING = 50
const PADDING = 100
const LINE_HEIGHT = 18
const MAX_VISIBLE_DATA = 3

const TREE_COLORS = {
  rootGradientStart: '#7e22ce',
  rootGradientEnd: '#6b21a8',
  nodeGradientStart: '#667eea',
  nodeGradientEnd: '#5568d3',
  edgeGradientStart: '#667eea',
  edgeGradientEnd: '#764ba2',
  nodeText: 'white',
  nodeDataText: 'rgba(255, 255, 255, 0.95)',
  buttonBg: 'rgba(0, 0, 0, 0.15)',
  buttonBorder: 'rgba(255, 255, 255, 0.3)',
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function decodeOutput(result) {
  return decoder.decode(result?.output || new Uint8Array())
}

export class ViewTree extends ViewCanvasBase {
  static get observedAttributes() {
    return ['data-key']
  }

  constructor() {
    super()
    this.treeKey = this.getAttribute('data-key') || 'progression'
    this.nodePositions = {}
    this.nodeSizes = {}
    this.expandedNodes = new Set()
    this.keyElement = null
    this.statusElement = null
  }

  connectedCallback() {
    if (!this.dataset.ready) {
      this.dataset.ready = '1'
      this.style.display = 'contents'
      this.innerHTML = `
        <canvas data-element="canvas"></canvas>
        <footer>
          <output data-element="key"></output>
          <output data-element="status"></output>
        </footer>
      `
      this.keyElement = this.querySelector('[data-element="key"]')
      this.statusElement = this.querySelector('[data-element="status"]')
      assert(this.keyElement instanceof HTMLOutputElement, 'view-tree missing key output')
      assert(this.statusElement instanceof HTMLOutputElement, 'view-tree missing status output')
    }

    super.connectedCallback()

    const openButton = this.queryHeaderControl('[data-action="open"]')
    if (openButton instanceof HTMLButtonElement) {
      openButton.onclick = () => this.openChooser()
    }

    const reloadButton = this.queryHeaderControl('[data-action="reload"]')
    if (reloadButton instanceof HTMLButtonElement) {
      reloadButton.onclick = () => this.loadTree()
    }

    const zoomInButton = this.queryHeaderControl('[data-action="zoom-in"]')
    if (zoomInButton instanceof HTMLButtonElement) {
      zoomInButton.onclick = () => this.zoomIn()
    }

    const zoomOutButton = this.queryHeaderControl('[data-action="zoom-out"]')
    if (zoomOutButton instanceof HTMLButtonElement) {
      zoomOutButton.onclick = () => this.zoomOut()
    }

    const fitButton = this.queryHeaderControl('[data-action="zoom-fit"]')
    if (fitButton instanceof HTMLButtonElement) {
      fitButton.onclick = () => this.fitToContent()
    }

    this.updateFooter()
    void this.loadTree()
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return
    if (name !== 'data-key') return
    this.treeKey = newValue || 'progression'
    this.updateFooter()
    if (this.dataset.ready) {
      void this.loadTree()
    }
  }

  createHeaderControlsElement() {
    const toolbar = document.createElement('div')
    toolbar.dataset.element = 'toolbar'
    toolbar.innerHTML = `
      <button data-action="open" aria-label="Open tree" title="Open tree"><i aria-hidden="true">folder_open</i></button>
      <button data-action="reload" aria-label="Reload" title="Reload"><i aria-hidden="true">refresh</i></button>
      <button data-action="zoom-in" aria-label="Zoom In" title="Zoom In"><i aria-hidden="true">zoom_in</i></button>
      <button data-action="zoom-out" aria-label="Zoom Out" title="Zoom Out"><i aria-hidden="true">zoom_out</i></button>
      <button data-action="zoom-fit" aria-label="Fit View" title="Fit View"><i aria-hidden="true">fit_screen</i></button>
    `
    return toolbar
  }

  updateFooter(status = null, tone = null) {
    if (this.keyElement instanceof HTMLOutputElement) {
      this.keyElement.textContent = `Key: ${this.treeKey}`
    }
    if (status !== null) {
      this.setStatus(status, tone)
    }
  }

  setStatus(text, tone = null) {
    if (!(this.statusElement instanceof HTMLOutputElement)) return
    this.statusElement.textContent = text
    this.statusElement.classList.remove('accent', 'success', 'warning', 'danger', 'info')
    if (tone) this.statusElement.classList.add(tone)
  }

  async callSql(sql) {
    const result = await runtime.call('sql', 'query', sql)
    if (result.returnCode !== 0) {
      throw new Error(decodeOutput(result) || `sql query failed: ${result.returnCode}`)
    }
    return decodeOutput(result)
  }

  async loadTree() {
    this.updateFooter(`Loading ${this.treeKey}...`, 'info')
    try {
      const escapedKey = this.treeKey.replace(/'/g, "''")
      const csv = await this.callSql(`SELECT data FROM tree_storage WHERE name = '${escapedKey}'`)
      const lines = parseCSVLines(csv.trim())
      const payload = lines[1]?.[0]
      assert(payload, `tree '${this.treeKey}' was not found`)
      const data = JSON.parse(payload)
      assert(Array.isArray(data), `tree '${this.treeKey}' must be an array`)
      this.setData(data)
      this.updateFooter(`${data.length} nodes`, 'success')
    } catch (error) {
      this.nodePositions = {}
      this.nodeSizes = {}
      this.setData(null)
      this.updateFooter(`Error: ${error?.message || error}`, 'danger')
      console.error('view-tree load failed:', error)
    }
  }

  async openChooser() {
    const result = await runtime.call('ui.popup', 'open', {
      title: 'Open Tree',
      size: 'large',
      tag: 'view-sql',
      props: {
        mode: 'chooser',
        query: `SELECT name, length(data) AS bytes FROM tree_storage ORDER BY name LIMIT :limit OFFSET :offset`,
        countQuery: `SELECT COUNT(*) AS count FROM tree_storage`,
        returnColumn: 'name',
        confirmLabel: 'Open',
      },
    })

    const payload = JSON.parse(decodeOutput(result) || 'null')
    if (!payload || payload.cancelled) return
    const nextKey = String(payload.value || '')
    if (!nextKey) return
    this.setAttribute('data-key', nextKey)
  }

  calculateContentBounds(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
    }

    this.calculateLayout(data)

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const pos of Object.values(this.nodePositions)) {
      minX = Math.min(minX, pos.x)
      minY = Math.min(minY, pos.y)
      maxX = Math.max(maxX, pos.x + pos.width)
      maxY = Math.max(maxY, pos.y + pos.height)
    }

    return {
      minX: minX - PADDING,
      minY: minY - PADDING,
      maxX: maxX + PADDING,
      maxY: maxY + PADDING,
    }
  }

  drawContent(ctx, data) {
    if (!Array.isArray(data) || data.length === 0) return
    this.drawEdges(ctx, data)
    for (let i = 0; i < data.length; i += 1) {
      this.drawNode(ctx, data, i)
    }
  }

  getNodeName(node) {
    return node?.data?.name || 'unknown'
  }

  getChildren(data, nodeIndex) {
    const children = []
    for (let i = 0; i < data.length; i += 1) {
      if (data[i].parent === nodeIndex) children.push(i)
    }
    return children
  }

  calculateLayout(data) {
    this.nodePositions = {}
    this.nodeSizes = {}
    const levels = {}

    const calculateSizes = (nodeIndex) => {
      if (this.nodeSizes[nodeIndex] !== undefined) return
      this.nodeSizes[nodeIndex] = this.calculateNodeSize(data, nodeIndex)
      for (const childIndex of this.getChildren(data, nodeIndex)) {
        calculateSizes(childIndex)
      }
    }

    const assignLevels = (nodeIndex, level = 0) => {
      if (!levels[level]) levels[level] = []
      levels[level].push(nodeIndex)
      for (const childIndex of this.getChildren(data, nodeIndex)) {
        assignLevels(childIndex, level + 1)
      }
    }

    calculateSizes(0)
    assignLevels(0)

    Object.keys(levels).forEach((level, levelIndex) => {
      const nodesAtLevel = levels[level]
      let levelHeight = 0
      nodesAtLevel.forEach((nodeIndex, index) => {
        levelHeight += this.nodeSizes[nodeIndex].height
        if (index < nodesAtLevel.length - 1) levelHeight += MIN_VERTICAL_SPACING
      })

      let currentX = PADDING
      for (let i = 0; i < levelIndex; i += 1) {
        const prevLevelMaxWidth = Math.max(...levels[i].map((nodeIndex) => this.nodeSizes[nodeIndex].width))
        currentX += prevLevelMaxWidth + HORIZONTAL_SPACING
      }

      const canvasHeight = Math.max(levelHeight + PADDING * 2, this.canvas?.height || 600)
      const startY = (canvasHeight - levelHeight) / 2

      let currentY = startY
      nodesAtLevel.forEach((nodeIndex, index) => {
        const size = this.nodeSizes[nodeIndex]
        this.nodePositions[nodeIndex] = {
          x: currentX,
          y: currentY,
          width: size.width,
          height: size.height,
        }
        currentY += size.height
        if (index < nodesAtLevel.length - 1) currentY += MIN_VERTICAL_SPACING
      })
    })
  }

  calculateNodeSize(data, nodeIndex) {
    const node = data[nodeIndex]
    if (!this.ctx) return { width: NODE_MIN_WIDTH, height: 100 }

    const nodeName = this.getNodeName(node)
    this.ctx.font = 'bold 15px Arial'
    const nameWidth = this.ctx.measureText(nodeName).width

    let maxWidth = Math.max(NODE_MIN_WIDTH, nameWidth + NODE_PADDING * 2)
    let height = NODE_PADDING * 2 + 20

    if (node.data && Object.keys(node.data).length > 0) {
      this.ctx.font = '12px Arial'
      const dataEntries = Object.entries(node.data)
      const isExpanded = this.expandedNodes.has(nodeIndex)
      const visibleCount = isExpanded ? dataEntries.length : Math.min(MAX_VISIBLE_DATA, dataEntries.length)

      dataEntries.slice(0, visibleCount).forEach(([key, value]) => {
        const text = `${key}: ${value}`
        const textWidth = this.ctx.measureText(text).width
        maxWidth = Math.max(maxWidth, textWidth + NODE_PADDING * 3)
      })

      height += LINE_HEIGHT * visibleCount + 8
      if (dataEntries.length > MAX_VISIBLE_DATA) {
        height += 34
      }
    }

    return { width: maxWidth, height }
  }

  drawEdges(ctx, data) {
    for (let i = 1; i < data.length; i += 1) {
      this.drawEdge(ctx, data[i].parent, i)
    }
  }

  drawEdge(ctx, fromIndex, toIndex) {
    const from = this.nodePositions[fromIndex]
    const to = this.nodePositions[toIndex]
    if (!from || !to) return

    const startX = from.x + from.width
    const startY = from.y + from.height / 2
    const endX = to.x
    const endY = to.y + to.height / 2

    ctx.shadowBlur = 10 / this.scale
    ctx.shadowColor = 'rgba(102, 126, 234, 0.3)'

    const gradient = ctx.createLinearGradient(startX, startY, endX, endY)
    gradient.addColorStop(0, TREE_COLORS.edgeGradientStart)
    gradient.addColorStop(1, TREE_COLORS.edgeGradientEnd)
    ctx.strokeStyle = gradient
    ctx.lineWidth = 3 / this.scale
    ctx.beginPath()
    ctx.moveTo(startX, startY)

    const controlX = startX + (endX - startX) / 2
    ctx.bezierCurveTo(controlX, startY, controlX, endY, endX, endY)
    ctx.stroke()

    ctx.shadowBlur = 0

    const arrowSize = 10 / this.scale
    ctx.fillStyle = TREE_COLORS.edgeGradientEnd
    ctx.beginPath()
    ctx.moveTo(endX, endY)
    ctx.lineTo(endX - arrowSize, endY - arrowSize / 2)
    ctx.lineTo(endX - arrowSize, endY + arrowSize / 2)
    ctx.closePath()
    ctx.fill()
  }

  drawNode(ctx, data, nodeIndex) {
    const pos = this.nodePositions[nodeIndex]
    if (!pos) return

    const node = data[nodeIndex]
    const isRoot = nodeIndex === 0

    ctx.shadowBlur = 15 / this.scale
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)'
    ctx.shadowOffsetY = 4 / this.scale

    const radius = 12 / this.scale
    const gradient = ctx.createLinearGradient(pos.x, pos.y, pos.x, pos.y + pos.height)
    if (isRoot) {
      gradient.addColorStop(0, TREE_COLORS.rootGradientStart)
      gradient.addColorStop(1, TREE_COLORS.rootGradientEnd)
    } else {
      gradient.addColorStop(0, TREE_COLORS.nodeGradientStart)
      gradient.addColorStop(1, TREE_COLORS.nodeGradientEnd)
    }

    ctx.fillStyle = gradient
    ctx.beginPath()
    this.roundRect(ctx, pos.x, pos.y, pos.width, pos.height, radius)
    ctx.fill()

    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0

    ctx.strokeStyle = isRoot ? TREE_COLORS.rootGradientEnd : TREE_COLORS.nodeGradientEnd
    ctx.lineWidth = 2 / this.scale
    ctx.stroke()

    ctx.fillStyle = TREE_COLORS.nodeText
    ctx.font = `bold ${15 / this.scale}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(this.getNodeName(node), pos.x + pos.width / 2, pos.y + NODE_PADDING / this.scale)

    if (node.data && Object.keys(node.data).length > 0) {
      ctx.font = `${12 / this.scale}px Arial`
      ctx.fillStyle = TREE_COLORS.nodeDataText
      ctx.textAlign = 'left'
      let dataY = pos.y + NODE_PADDING / this.scale + 30 / this.scale

      const dataEntries = Object.entries(node.data)
      const isExpanded = this.expandedNodes.has(nodeIndex)
      const visibleCount = isExpanded ? dataEntries.length : Math.min(MAX_VISIBLE_DATA, dataEntries.length)

      dataEntries.slice(0, visibleCount).forEach(([key, value]) => {
        ctx.fillText(`${key}: ${value}`, pos.x + NODE_PADDING / this.scale, dataY)
        dataY += LINE_HEIGHT / this.scale
      })

      if (dataEntries.length > MAX_VISIBLE_DATA) {
        const buttonY = pos.y + pos.height - NODE_PADDING / this.scale - 26 / this.scale
        const buttonText = isExpanded ? '▲ Show less' : `▼ Show ${dataEntries.length - MAX_VISIBLE_DATA} more`

        ctx.fillStyle = TREE_COLORS.buttonBg
        ctx.beginPath()
        this.roundRect(
          ctx,
          pos.x + NODE_PADDING / this.scale,
          buttonY,
          pos.width - (NODE_PADDING * 2) / this.scale,
          26 / this.scale,
          6 / this.scale,
        )
        ctx.fill()

        ctx.strokeStyle = TREE_COLORS.buttonBorder
        ctx.lineWidth = 1 / this.scale
        ctx.stroke()

        ctx.fillStyle = TREE_COLORS.nodeText
        ctx.font = `bold ${11 / this.scale}px Arial`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(buttonText, pos.x + pos.width / 2, buttonY + 13 / this.scale)
      }
    }
  }

  roundRect(ctx, x, y, width, height, radius) {
    let r = radius
    if (width < 2 * r) r = width / 2
    if (height < 2 * r) r = height / 2
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + width, y, x + width, y + height, r)
    ctx.arcTo(x + width, y + height, x, y + height, r)
    ctx.arcTo(x, y + height, x, y, r)
    ctx.arcTo(x, y, x + width, y, r)
    ctx.closePath()
  }

  onCanvasMouseDown(event) {
    if (!Array.isArray(this.data)) return
    const point = this.getWorldPoint(event.clientX, event.clientY)
    if (this.checkExpandButtonClick(point.x, point.y)) return
  }

  checkExpandButtonClick(x, y) {
    for (const [nodeIndexText, pos] of Object.entries(this.nodePositions)) {
      const nodeIndex = Number(nodeIndexText)
      const node = this.data?.[nodeIndex]
      if (!node?.data || Object.keys(node.data).length <= MAX_VISIBLE_DATA) continue

      const buttonY = pos.y + pos.height - NODE_PADDING / this.scale - 26 / this.scale
      const buttonX = pos.x + NODE_PADDING / this.scale
      const buttonWidth = pos.width - (NODE_PADDING * 2) / this.scale
      const buttonHeight = 26 / this.scale

      if (x < buttonX || x > buttonX + buttonWidth || y < buttonY || y > buttonY + buttonHeight) continue

      if (this.expandedNodes.has(nodeIndex)) this.expandedNodes.delete(nodeIndex)
      else this.expandedNodes.add(nodeIndex)
      this.contentBounds = this.calculateContentBounds(this.data)
      this.draw()
      return true
    }
    return false
  }
}

if (!customElements.get('view-tree')) {
  customElements.define('view-tree', ViewTree)
}
