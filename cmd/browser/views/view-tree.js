import { ViewCanvasBase } from "./view-canvas-base.js"
import { bus } from "../systems/event-bus.js"

function noop() { }

// Layout constants
const NODE_MIN_WIDTH = 200;
const NODE_PADDING = 16;
const HORIZONTAL_SPACING = 150;
const VERTICAL_SPACING = 50;
const MIN_VERTICAL_SPACING = 50;
const PADDING = 100;
const LINE_HEIGHT = 18;
const MAX_VISIBLE_DATA = 3;

// Color palette
const TREE_COLORS = {
  ROOT_GRADIENT_START: '#7e22ce',
  ROOT_GRADIENT_END: '#6b21a8',
  NODE_GRADIENT_START: '#667eea',
  NODE_GRADIENT_END: '#5568d3',
  EDGE_GRADIENT_START: '#667eea',
  EDGE_GRADIENT_END: '#764ba2',
  NODE_TEXT: 'white',
  NODE_DATA_TEXT: 'rgba(255, 255, 255, 0.95)',
  BUTTON_BG: 'rgba(0, 0, 0, 0.15)',
  BUTTON_BORDER: 'rgba(255, 255, 255, 0.3)',
};

/**
 * Tree Visualizer View Component for tree structure.
 * Displays hierarchical tree structures using a canvas.
 * Supports configurable store key via data-key attribute.
 */
export class ViewTree extends ViewCanvasBase {
  static get observedAttributes() {
    return ['data-key']
  }

  constructor() {
    super()
    this.treeKey = 'progression' // Default key for tree data storage

    // Tree-specific state
    this.nodePositions = {};
    this.nodeSizes = {};
    this.expandedNodes = new Set();
    this.unsubscribe = noop
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'data-key' && oldVal !== newVal) {
      this.treeKey = newVal
      this.unsubscribe()
      this.unsubscribe = bus.on(this.sqlQuery(), this.dataChanged)
      if (this.isConnected) this.fetchData()
    }
  }

  setupUI() {
    // Create tooltip
    this.tileInfo = document.createElement('div')
    this.tileInfo.className = 'tooltip'
    this.tileInfo.setAttribute('data-tooltip', '')
    this.tileInfo.style.display = 'none'
    this.appendChild(this.tileInfo)
  }

  connectedCallback() {
    super.connectedCallback()
    this.unsubscribe = bus.on(this.sqlQuery(), this.dataChanged)

    // Setup button handlers (query from header controls)
    const reloadBtn = this.queryHeaderControl('[data-action="reload"]')
    if (reloadBtn) {
      reloadBtn.onclick = () => this.fetchData()
    }

    const zoomInBtn = this.queryHeaderControl('[data-action="zoom-in"]')
    if (zoomInBtn) {
      zoomInBtn.onclick = () => this.zoomIn()
    }

    const zoomOutBtn = this.queryHeaderControl('[data-action="zoom-out"]')
    if (zoomOutBtn) {
      zoomOutBtn.onclick = () => this.zoomOut()
    }

    const zoomFitBtn = this.queryHeaderControl('[data-action="zoom-fit"]')
    if (zoomFitBtn) {
      zoomFitBtn.onclick = () => this.fitToContent()
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.unsubscribe()
  }

  // --- Abstract Methods Implementation ---

  sqlQuery() {
    return `cache:changed:SELECT data FROM tree_storage WHERE name = '${this.treeKey}'`
  }

  async fetchData() {
    bus.emit(this.sqlQuery().replace("cache:changed:", "cache:load:"))

    return this.data
  }

  dataChanged = (data) => {
    this.data = data
    this.contentBounds = this.calculateContentBounds(this.data)
    this.draw()
  }

  calculateContentBounds(data) {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }

    // First calculate layout to get node positions
    this._calculateLayout(data);

    // Find bounds from node positions
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const pos of Object.values(this.nodePositions)) {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + pos.width);
      maxY = Math.max(maxY, pos.y + pos.height);
    }

    // Add padding
    return {
      minX: minX - PADDING,
      minY: minY - PADDING,
      maxX: maxX + PADDING,
      maxY: maxY + PADDING,
    };
  }

  drawContent(ctx, data) {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return;
    }

    // Draw edges first (so they appear behind nodes)
    this._drawEdges(ctx, data);

    // Draw nodes
    for (let i = 0; i < data.length; i++) {
      this._drawNode(ctx, data, i);
    }
  }

  getHoverInfo(worldX, worldY, data) {
    if (!data || !Array.isArray(data)) return null;

    // Check if hovering over any node
    for (const [nodeIndex, pos] of Object.entries(this.nodePositions)) {
      if (worldX >= pos.x && worldX <= pos.x + pos.width &&
        worldY >= pos.y && worldY <= pos.y + pos.height) {
        const node = data[parseInt(nodeIndex)];
        const nodeName = this._getNodeName(node);
        const isRoot = parseInt(nodeIndex) === 0;

        let html = `
          <div class="info-row"><span class="info-label">Node:</span> <span class="info-value">${nodeName}</span></div>
          <div class="info-row"><span class="info-label">Index:</span> <span class="info-value">${nodeIndex}</span></div>
        `;

        if (isRoot) {
          html += `<div class="info-row"><span class="info-label">Type:</span> <span class="info-value">Root</span></div>`;
        } else {
          html += `<div class="info-row"><span class="info-label">Parent:</span> <span class="info-value">${node.parent}</span></div>`;
        }

        const childCount = this._getChildren(data, parseInt(nodeIndex)).length;
        html += `<div class="info-row"><span class="info-label">Children:</span> <span class="info-value">${childCount}</span></div>`;

        return html;
      }
    }

    return null;
  }

  // --- Helper Methods ---

  _getNodeName(node) {
    return (node && node.data && node.data.name) || 'unknown';
  }

  _getChildren(data, nodeIndex) {
    const children = [];
    for (let i = 0; i < data.length; i++) {
      if (data[i].parent === nodeIndex) {
        children.push(i);
      }
    }
    return children;
  }

  // --- Tree-Specific Layout Calculation ---

  _calculateLayout(data) {
    this.nodePositions = {};
    this.nodeSizes = {};
    const levels = {};

    // Calculate node sizes
    const calculateSizes = (nodeIndex) => {
      if (this.nodeSizes[nodeIndex] !== undefined) return;

      const size = this._calculateNodeSize(data, nodeIndex);
      this.nodeSizes[nodeIndex] = size;

      const children = this._getChildren(data, nodeIndex);
      children.forEach(childIndex => calculateSizes(childIndex));
    };

    // Assign nodes to levels
    const assignLevels = (nodeIndex, level = 0) => {
      if (!levels[level]) {
        levels[level] = [];
      }
      levels[level].push(nodeIndex);

      const children = this._getChildren(data, nodeIndex);
      children.forEach(childIndex => assignLevels(childIndex, level + 1));
    };

    calculateSizes(0); // Start with root (index 0)
    assignLevels(0);

    // Position nodes
    Object.keys(levels).forEach((level, levelIndex) => {
      const nodesAtLevel = levels[level];

      // Calculate total height for this level
      let levelHeight = 0;
      nodesAtLevel.forEach((nodeIndex, index) => {
        levelHeight += this.nodeSizes[nodeIndex].height;
        if (index < nodesAtLevel.length - 1) {
          levelHeight += MIN_VERTICAL_SPACING;
        }
      });

      // Calculate horizontal position
      let currentX = PADDING;
      for (let i = 0; i < levelIndex; i++) {
        const prevLevelMaxWidth = Math.max(...levels[i].map(nodeIndex => this.nodeSizes[nodeIndex].width));
        currentX += prevLevelMaxWidth + HORIZONTAL_SPACING;
      }

      // Calculate starting Y to center the level
      const canvasHeight = Math.max(levelHeight + PADDING * 2, this.h || 600);
      const startY = (canvasHeight - levelHeight) / 2;

      // Position each node in the level
      let currentY = startY;
      nodesAtLevel.forEach((nodeIndex, index) => {
        const size = this.nodeSizes[nodeIndex];
        this.nodePositions[nodeIndex] = {
          x: currentX,
          y: currentY,
          width: size.width,
          height: size.height
        };

        currentY += size.height;

        if (index < nodesAtLevel.length - 1) {
          currentY += MIN_VERTICAL_SPACING;
        }
      });
    });
  }

  _calculateNodeSize(data, nodeIndex) {
    const node = data[nodeIndex];
    if (!this.ctx) return { width: NODE_MIN_WIDTH, height: 100 };

    const nodeName = this._getNodeName(node);
    this.ctx.font = 'bold 15px Arial';
    const nameWidth = this.ctx.measureText(nodeName).width;

    let maxWidth = Math.max(NODE_MIN_WIDTH, nameWidth + NODE_PADDING * 2);
    let height = NODE_PADDING * 2 + 20;

    if (node.data && Object.keys(node.data).length > 0) {
      this.ctx.font = '12px Arial';
      const dataEntries = Object.entries(node.data);
      const isExpanded = this.expandedNodes.has(nodeIndex);
      const visibleCount = isExpanded ? dataEntries.length : Math.min(MAX_VISIBLE_DATA, dataEntries.length);

      dataEntries.slice(0, visibleCount).forEach(([key, value]) => {
        const text = `${key}: ${value}`;
        const textWidth = this.ctx.measureText(text).width;
        maxWidth = Math.max(maxWidth, textWidth + NODE_PADDING * 3);
      });

      height += LINE_HEIGHT * visibleCount + 8;

      if (dataEntries.length > MAX_VISIBLE_DATA) {
        height += 34; // Expand/collapse button
      }
    }

    return { width: maxWidth, height };
  }

  // --- Drawing Methods ---

  _drawEdges(ctx, data) {
    for (let i = 0; i < data.length; i++) {
      const node = data[i];
      if (i === 0) continue; // Root has no parent

      this._drawEdge(ctx, data, node.parent, i);
    }
  }

  _drawEdge(ctx, data, fromIndex, toIndex) {
    const from = this.nodePositions[fromIndex];
    const to = this.nodePositions[toIndex];

    if (!from || !to) return;

    const startX = from.x + from.width;
    const startY = from.y + from.height / 2;
    const endX = to.x;
    const endY = to.y + to.height / 2;

    // Draw edge with gradient and shadow
    ctx.shadowBlur = 10 / this.scale;
    ctx.shadowColor = 'rgba(102, 126, 234, 0.3)';

    const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
    gradient.addColorStop(0, TREE_COLORS.EDGE_GRADIENT_START);
    gradient.addColorStop(1, TREE_COLORS.EDGE_GRADIENT_END);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 3 / this.scale;
    ctx.beginPath();
    ctx.moveTo(startX, startY);

    const controlX = startX + (endX - startX) / 2;
    ctx.bezierCurveTo(controlX, startY, controlX, endY, endX, endY);
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Draw arrow
    const arrowSize = 10 / this.scale;
    ctx.fillStyle = TREE_COLORS.EDGE_GRADIENT_END;
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - arrowSize, endY - arrowSize / 2);
    ctx.lineTo(endX - arrowSize, endY + arrowSize / 2);
    ctx.closePath();
    ctx.fill();
  }

  _drawNode(ctx, data, nodeIndex) {
    const pos = this.nodePositions[nodeIndex];
    if (!pos) return;

    const node = data[nodeIndex];
    const isRoot = nodeIndex === 0;

    // Draw shadow
    ctx.shadowBlur = 15 / this.scale;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowOffsetY = 4 / this.scale;

    // Draw node background with gradient
    const radius = 12 / this.scale;
    const gradient = ctx.createLinearGradient(pos.x, pos.y, pos.x, pos.y + pos.height);
    if (isRoot) {
      gradient.addColorStop(0, TREE_COLORS.ROOT_GRADIENT_START);
      gradient.addColorStop(1, TREE_COLORS.ROOT_GRADIENT_END);
    } else {
      gradient.addColorStop(0, TREE_COLORS.NODE_GRADIENT_START);
      gradient.addColorStop(1, TREE_COLORS.NODE_GRADIENT_END);
    }

    ctx.fillStyle = gradient;
    ctx.beginPath();
    this._roundRect(ctx, pos.x, pos.y, pos.width, pos.height, radius);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Draw border
    ctx.strokeStyle = isRoot ? TREE_COLORS.ROOT_GRADIENT_END : TREE_COLORS.NODE_GRADIENT_END;
    ctx.lineWidth = 2 / this.scale;
    ctx.stroke();

    // Draw node name
    ctx.fillStyle = TREE_COLORS.NODE_TEXT;
    ctx.font = `bold ${15 / this.scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const text = this._getNodeName(node);
    ctx.fillText(text, pos.x + pos.width / 2, pos.y + NODE_PADDING / this.scale);

    // Draw node data
    if (node.data && Object.keys(node.data).length > 0) {
      ctx.font = `${12 / this.scale}px Arial`;
      ctx.fillStyle = TREE_COLORS.NODE_DATA_TEXT;
      ctx.textAlign = 'left';
      let dataY = pos.y + NODE_PADDING / this.scale + 30 / this.scale;

      const dataEntries = Object.entries(node.data);
      const isExpanded = this.expandedNodes.has(nodeIndex);
      const visibleCount = isExpanded ? dataEntries.length : Math.min(MAX_VISIBLE_DATA, dataEntries.length);

      dataEntries.slice(0, visibleCount).forEach(([key, value]) => {
        const dataText = `${key}: ${value}`;
        ctx.fillText(dataText, pos.x + NODE_PADDING / this.scale, dataY);
        dataY += LINE_HEIGHT / this.scale;
      });

      // Draw expand/collapse button if needed
      if (dataEntries.length > MAX_VISIBLE_DATA) {
        const buttonY = pos.y + pos.height - NODE_PADDING / this.scale - 26 / this.scale;
        const buttonText = isExpanded ? '▲ Show less' : `▼ Show ${dataEntries.length - MAX_VISIBLE_DATA} more`;

        ctx.fillStyle = TREE_COLORS.BUTTON_BG;
        const buttonRadius = 6 / this.scale;
        ctx.beginPath();
        this._roundRect(ctx, pos.x + NODE_PADDING / this.scale, buttonY,
          pos.width - NODE_PADDING * 2 / this.scale, 26 / this.scale, buttonRadius);
        ctx.fill();

        ctx.strokeStyle = TREE_COLORS.BUTTON_BORDER;
        ctx.lineWidth = 1 / this.scale;
        ctx.stroke();

        ctx.fillStyle = TREE_COLORS.NODE_TEXT;
        ctx.font = `bold ${11 / this.scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(buttonText, pos.x + pos.width / 2, buttonY + 13 / this.scale);
      }
    }
  }

  _roundRect(ctx, x, y, width, height, radius) {
    if (width < 2 * radius) radius = width / 2;
    if (height < 2 * radius) radius = height / 2;
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }

  // Override mouse down to handle expand/collapse buttons
  _onMouseDown(e) {
    if (!this.data) {
      super._onMouseDown(e);
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - this.offsetX) / this.scale;
    const y = (e.clientY - rect.top - this.offsetY) / this.scale;

    const clicked = this._checkExpandButtonClick(x, y);
    if (clicked) {
      return;
    }

    super._onMouseDown(e);
  }

  _checkExpandButtonClick(x, y) {
    for (const [nodeIndexStr, pos] of Object.entries(this.nodePositions)) {
      const nodeIndex = parseInt(nodeIndexStr);
      const node = this.data[nodeIndex];
      if (!node.data || Object.keys(node.data).length <= MAX_VISIBLE_DATA) continue;

      const buttonY = pos.y + pos.height - NODE_PADDING / this.scale - 26 / this.scale;
      const buttonX = pos.x + NODE_PADDING / this.scale;
      const buttonWidth = pos.width - NODE_PADDING * 2 / this.scale;
      const buttonHeight = 26 / this.scale;

      if (x >= buttonX && x <= buttonX + buttonWidth &&
        y >= buttonY && y <= buttonY + buttonHeight) {
        if (this.expandedNodes.has(nodeIndex)) {
          this.expandedNodes.delete(nodeIndex);
        } else {
          this.expandedNodes.add(nodeIndex);
        }
        this.contentBounds = this.calculateContentBounds(this.data)
        this.draw()
        return true;
      }
    }
    return false;
  }
}
