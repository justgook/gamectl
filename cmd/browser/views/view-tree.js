import { ViewCanvasBase } from "./view-canvas-base.js"

// Layout constants
const NODE_MIN_WIDTH = 200;
const NODE_PADDING = 16;
const HORIZONTAL_SPACING = 150;
const VERTICAL_SPACING = 50;
const MIN_VERTICAL_SPACING = 50;
const PADDING = 100;
const LINE_HEIGHT = 18;
const MAX_VISIBLE_DATA = 3;
const EDGE_LABEL_PADDING = 10;

// Color palette
const TREE_COLORS = {
  ROOT_GRADIENT_START: '#7e22ce',
  ROOT_GRADIENT_END: '#6b21a8',
  NODE_GRADIENT_START: '#667eea',
  NODE_GRADIENT_END: '#5568d3',
  EDGE_GRADIENT_START: '#667eea',
  EDGE_GRADIENT_END: '#764ba2',
  EDGE_LABEL_BG: 'rgba(126, 34, 206, 0.95)',
  EDGE_LABEL_TEXT: 'white',
  NODE_TEXT: 'white',
  NODE_DATA_TEXT: 'rgba(255, 255, 255, 0.95)',
  BUTTON_BG: 'rgba(0, 0, 0, 0.15)',
  BUTTON_BORDER: 'rgba(255, 255, 255, 0.3)',
};

/**
 * Tree Visualizer View Component.
 * Displays hierarchical tree structures using a canvas.
 */
export class ViewTree extends ViewCanvasBase {
  constructor() {
    super("view-tree")
    this.treeKey = 'demo-world' // Key for tree data storage
    this.DE = new TextDecoder()
    
    // Tree-specific state
    this.nodePositions = {};
    this.nodeSizes = {};
    this.expandedNodes = new Set();
    this.edgeLabelBounds = [];
  }

  // --- Abstract Methods Implementation ---

  async fetchData() {
    if (!window.pluginManager) {
      console.warn('Plugin manager not available.')
      return null
    }
    try {
      // Get tree data using toJSON method
      const result = await window.pluginManager.call('tree-storage', 'toJSON', `{"id":"${this.treeKey}"}`)
      const data = this.DE.decode(result.output)
      return JSON.parse(data)
    } catch (error) {
      console.warn('Failed to get tree data:', error)
      // Return example structure for testing
      return {
        "nodes": {
          "root": {
            "name": "Tutorial",
            "data": {"difficulty": "easy", "type": "intro", "time": "5min"},
            "children": [
              {"to": "level1", "name": "Next Level"},
              {"to": "bonus1", "name": "Secret Path"}
            ]
          },
          "level1": {
            "name": "Forest Path",
            "data": {"difficulty": "medium", "enemies": "3", "collectibles": "5"},
            "parent": "root",
            "children": [
              {"to": "level2a", "name": "Main Route"},
              {"to": "level2b", "name": "Alternate Path"}
            ]
          },
          "bonus1": {
            "name": "Hidden Cave",
            "data": {"difficulty": "hard", "reward": "legendary sword"},
            "parent": "root"
          },
          "level2a": {
            "name": "Mountain Pass",
            "data": {"difficulty": "hard", "boss": "Dragon"},
            "parent": "level1"
          },
          "level2b": {
            "name": "River Valley",
            "data": {"difficulty": "medium", "puzzle": "bridge"},
            "parent": "level1"
          }
        },
        "root": "root"
      };
    }
  }

  calculateContentBounds(data) {
    if (!data || !data.nodes || !data.root) {
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
    if (!data || !data.nodes || !data.root) {
      return;
    }

    // Reset edge label bounds for overlap detection
    this.edgeLabelBounds = [];

    // Draw edges first (so they appear behind nodes)
    this._drawEdges(ctx, data);

    // Draw nodes
    for (const nodeId of Object.keys(this.nodePositions)) {
      this._drawNode(ctx, data, nodeId);
    }
  }

  getHoverInfo(worldX, worldY, data) {
    if (!data || !data.nodes) return null;

    // Check if hovering over any node
    for (const [nodeId, pos] of Object.entries(this.nodePositions)) {
      if (worldX >= pos.x && worldX <= pos.x + pos.width &&
          worldY >= pos.y && worldY <= pos.y + pos.height) {
        const node = data.nodes[nodeId];
        const isRoot = nodeId === data.root;
        
        let html = `
          <div class="info-row"><span class="info-label">Node:</span> <span class="info-value">${node.name || nodeId}</span></div>
          <div class="info-row"><span class="info-label">ID:</span> <span class="info-value">${nodeId}</span></div>
        `;
        
        if (isRoot) {
          html += `<div class="info-row"><span class="info-label">Type:</span> <span class="info-value">Root</span></div>`;
        } else if (node.parent) {
          html += `<div class="info-row"><span class="info-label">Parent:</span> <span class="info-value">${node.parent}</span></div>`;
        }
        
        const childCount = node.children ? node.children.length : 0;
        html += `<div class="info-row"><span class="info-label">Children:</span> <span class="info-value">${childCount}</span></div>`;
        
        return html;
      }
    }
    
    return null;
  }

  // --- Tree-Specific Layout Calculation ---

  _calculateLayout(data) {
    this.nodePositions = {};
    this.nodeSizes = {};
    const levels = {};

    // Calculate node sizes
    const calculateSizes = (nodeId) => {
      if (this.nodeSizes[nodeId]) return;
      
      const size = this._calculateNodeSize(data, nodeId);
      this.nodeSizes[nodeId] = size;

      const node = data.nodes[nodeId];
      if (node && node.children) {
        node.children.forEach(child => calculateSizes(child.to));
      }
    };

    // Assign nodes to levels
    const assignLevels = (nodeId, level = 0) => {
      if (!levels[level]) {
        levels[level] = [];
      }
      levels[level].push(nodeId);

      const node = data.nodes[nodeId];
      if (node && node.children) {
        node.children.forEach(child => assignLevels(child.to, level + 1));
      }
    };

    calculateSizes(data.root);
    assignLevels(data.root);

    // Calculate vertical spacing requirements
    const nodeSpacingRequirements = {};
    Object.keys(levels).forEach(level => {
      const nodesAtLevel = levels[level];
      nodesAtLevel.forEach((nodeId, index) => {
        if (index === nodesAtLevel.length - 1) return;

        const nextNodeId = nodesAtLevel[index + 1];
        let maxLabelHeight = 0;

        // Check edge labels that might be between these nodes
        const node = data.nodes[nodeId];
        if (node && node.children) {
          node.children.forEach(child => {
            if (child.name) {
              const labelSize = this._calculateEdgeLabelSize(child.name);
              maxLabelHeight = Math.max(maxLabelHeight, labelSize.height);
            }
          });
        }

        nodeSpacingRequirements[`${nodeId}-${nextNodeId}`] = maxLabelHeight;
      });
    });

    // Position nodes
    Object.keys(levels).forEach((level, levelIndex) => {
      const nodesAtLevel = levels[level];

      // Calculate total height for this level
      let levelHeight = 0;
      nodesAtLevel.forEach((nodeId, index) => {
        levelHeight += this.nodeSizes[nodeId].height;
        if (index < nodesAtLevel.length - 1) {
          const nextNodeId = nodesAtLevel[index + 1];
          const requiredSpace = nodeSpacingRequirements[`${nodeId}-${nextNodeId}`] || 0;
          const spacing = Math.max(MIN_VERTICAL_SPACING, requiredSpace + EDGE_LABEL_PADDING * 2);
          levelHeight += spacing;
        }
      });

      // Calculate horizontal position
      let currentX = PADDING;
      for (let i = 0; i < levelIndex; i++) {
        const prevLevelMaxWidth = Math.max(...levels[i].map(nodeId => this.nodeSizes[nodeId].width));
        currentX += prevLevelMaxWidth + HORIZONTAL_SPACING;
      }

      // Calculate starting Y to center the level
      const canvasHeight = Math.max(levelHeight + PADDING * 2, this.h || 600);
      const startY = (canvasHeight - levelHeight) / 2;

      // Position each node in the level
      let currentY = startY;
      nodesAtLevel.forEach((nodeId, index) => {
        const size = this.nodeSizes[nodeId];
        this.nodePositions[nodeId] = {
          x: currentX,
          y: currentY,
          width: size.width,
          height: size.height
        };

        currentY += size.height;

        if (index < nodesAtLevel.length - 1) {
          const nextNodeId = nodesAtLevel[index + 1];
          const requiredSpace = nodeSpacingRequirements[`${nodeId}-${nextNodeId}`] || 0;
          const spacing = Math.max(MIN_VERTICAL_SPACING, requiredSpace + EDGE_LABEL_PADDING * 2);
          currentY += spacing;
        }
      });
    });
  }

  _calculateNodeSize(data, nodeId) {
    const node = data.nodes[nodeId];
    if (!this.ctx) return { width: NODE_MIN_WIDTH, height: 100 };

    this.ctx.font = 'bold 15px Arial';
    const nameWidth = this.ctx.measureText(node.name || nodeId).width;

    let maxWidth = Math.max(NODE_MIN_WIDTH, nameWidth + NODE_PADDING * 2);
    let height = NODE_PADDING * 2 + 20;

    if (node.data && Object.keys(node.data).length > 0) {
      this.ctx.font = '12px Arial';
      const dataEntries = Object.entries(node.data);
      const isExpanded = this.expandedNodes.has(nodeId);
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

  _calculateEdgeLabelSize(edgeName) {
    if (!edgeName || !this.ctx) return { width: 0, height: 0 };

    this.ctx.font = 'bold 12px Arial';
    const maxLabelWidth = HORIZONTAL_SPACING * 0.5;
    const lines = this._wrapText(edgeName, maxLabelWidth);
    const lineHeight = 16;

    const textWidths = lines.map(line => this.ctx.measureText(line).width);
    const maxTextWidth = Math.max(...textWidths);
    const pillPadding = 8;

    return {
      width: maxTextWidth + pillPadding * 2,
      height: lines.length * lineHeight + pillPadding * 2
    };
  }

  _wrapText(text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = this.ctx.measureText(currentLine + ' ' + word).width;
      if (width < maxWidth) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  }

  // --- Drawing Methods ---

  _drawEdges(ctx, data) {
    Object.keys(data.nodes).forEach(nodeId => {
      const node = data.nodes[nodeId];
      if (node.children) {
        node.children.forEach(edge => {
          this._drawEdge(ctx, data, nodeId, edge.to, edge.name);
        });
      }
    });
  }

  _drawEdge(ctx, data, fromId, toId, edgeName) {
    const from = this.nodePositions[fromId];
    const to = this.nodePositions[toId];

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

    // Draw edge label
    if (edgeName) {
      const midX = startX + (endX - startX) / 2;
      const midY = startY + (endY - startY) / 2;

      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const maxLabelWidth = Math.abs(endX - startX) * 0.4;
      const lines = this._wrapText(edgeName, maxLabelWidth);
      const lineHeight = 16 / this.scale;
      const totalTextHeight = lines.length * lineHeight;

      const textWidths = lines.map(line => ctx.measureText(line).width);
      const maxTextWidth = Math.max(...textWidths);

      const pillPadding = 8 / this.scale;
      const pillHeight = totalTextHeight + pillPadding * 2;
      const pillWidth = maxTextWidth + pillPadding * 2;

      // Find non-overlapping position
      const position = this._findNonOverlappingPosition(midX, midY, pillWidth, pillHeight, startY, endY);
      this.edgeLabelBounds.push(position.bounds);

      // Draw label background
      ctx.fillStyle = TREE_COLORS.EDGE_LABEL_BG;
      ctx.beginPath();
      const radius = 11 / this.scale;
      this._roundRect(ctx, position.x - pillWidth / 2, position.y - pillHeight / 2,
        pillWidth, pillHeight, radius);
      ctx.fill();

      // Draw label text
      ctx.fillStyle = TREE_COLORS.EDGE_LABEL_TEXT;
      const textStartY = position.y - (lines.length - 1) * lineHeight / 2;
      lines.forEach((line, i) => {
        ctx.fillText(line, position.x, textStartY + i * lineHeight);
      });
    }
  }

  _findNonOverlappingPosition(midX, midY, width, height, startY, endY) {
    const offsets = [0, 20, -20, 40, -40, 60, -60, 80, -80];

    for (const offset of offsets) {
      const testY = midY + offset / this.scale;
      const bounds = {
        left: midX - width / 2,
        right: midX + width / 2,
        top: testY - height / 2,
        bottom: testY + height / 2
      };

      const edgeMinY = Math.min(startY, endY) - 100 / this.scale;
      const edgeMaxY = Math.max(startY, endY) + 100 / this.scale;

      if (testY - height / 2 >= edgeMinY &&
          testY + height / 2 <= edgeMaxY &&
          !this._checkLabelOverlap(bounds)) {
        return { x: midX, y: testY, bounds };
      }
    }

    const bounds = {
      left: midX - width / 2,
      right: midX + width / 2,
      top: midY - height / 2,
      bottom: midY + height / 2
    };
    return { x: midX, y: midY, bounds };
  }

  _checkLabelOverlap(bounds) {
    for (const existing of this.edgeLabelBounds) {
      if (!(bounds.right < existing.left ||
            bounds.left > existing.right ||
            bounds.bottom < existing.top ||
            bounds.top > existing.bottom)) {
        return true;
      }
    }
    return false;
  }

  _drawNode(ctx, data, nodeId) {
    const pos = this.nodePositions[nodeId];
    if (!pos) return;

    const node = data.nodes[nodeId];
    const isRoot = nodeId === data.root;

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
    const text = node.name || nodeId;
    ctx.fillText(text, pos.x + pos.width / 2, pos.y + NODE_PADDING / this.scale);

    // Draw node data
    if (node.data && Object.keys(node.data).length > 0) {
      ctx.font = `${12 / this.scale}px Arial`;
      ctx.fillStyle = TREE_COLORS.NODE_DATA_TEXT;
      ctx.textAlign = 'left';
      let dataY = pos.y + NODE_PADDING / this.scale + 30 / this.scale;

      const dataEntries = Object.entries(node.data);
      const isExpanded = this.expandedNodes.has(nodeId);
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

    const rect = this.wrapper.getBoundingClientRect();
    const x = (e.clientX - rect.left - this.offsetX) / this.scale;
    const y = (e.clientY - rect.top - this.offsetY) / this.scale;

    const clicked = this._checkExpandButtonClick(x, y);
    if (clicked) {
      return;
    }

    super._onMouseDown(e);
  }

  _checkExpandButtonClick(x, y) {
    for (const [nodeId, pos] of Object.entries(this.nodePositions)) {
      const node = this.data.nodes[nodeId];
      if (!node.data || Object.keys(node.data).length <= MAX_VISIBLE_DATA) continue;

      const buttonY = pos.y + pos.height - NODE_PADDING / this.scale - 26 / this.scale;
      const buttonX = pos.x + NODE_PADDING / this.scale;
      const buttonWidth = pos.width - NODE_PADDING * 2 / this.scale;
      const buttonHeight = 26 / this.scale;

      if (x >= buttonX && x <= buttonX + buttonWidth &&
          y >= buttonY && y <= buttonY + buttonHeight) {
        if (this.expandedNodes.has(nodeId)) {
          this.expandedNodes.delete(nodeId);
        } else {
          this.expandedNodes.add(nodeId);
        }
        this.loadAndDraw();
        return true;
      }
    }
    return false;
  }
}
