/**
 * 🏛️ LayoutSystem Class
 * Pure layout management using a binary tree structure.
 * No rendering or event handling - just layout calculations.
 */
class LayoutSystem {
  constructor(config = {}) {
    this.config = {
      handleWidth: config.handleWidth || 6,
      handleHeight: config.handleHeight || 6,
      predefinedPanels: config.predefinedPanels || null, // Array of { view, proportion, direction }
      ...config
    };

    this.nextId = 0;

    // Initialize layout tree
    if (this.config.predefinedPanels) {
      this.layoutTree = this._createPredefinedLayout(this.config.predefinedPanels);
    } else {
      // The layout tree starts with a single "root" panel
      this.layoutTree = {
        id: this._generateId(),
        isLeaf: true
      };
    }

    // Calculated layout data
    this.panelCoordinates = new Map(); // { id -> { area, node } }
    this.splitNodeAreas = new Map();   // { id -> area }
    this.handleData = new Map();       // { id -> { area, node } }
  }

  // --- Private Methods ---

  _generateId() {
    return `panel-${this.nextId++}`;
  }

  /**
   * Create predefined layout from config
   * @param {Array} panels - Array of { view, proportion, direction }
   * @returns {Object} Layout tree node
   */
  _createPredefinedLayout(panels) {
    if (!panels || panels.length === 0) {
      return { id: this._generateId(), isLeaf: true };
    }

    if (panels.length === 1) {
      return {
        id: this._generateId(),
        isLeaf: true,
        viewType: panels[0].view
      };
    }

    // Create splits recursively
    const first = panels[0];
    const rest = panels.slice(1);

    // Calculate split percentage based on first panel's proportion
    const totalProportion = panels.reduce((sum, p) => sum + (p.proportion || 0.5), 0);
    const splitPercentage = (first.proportion || 0.5) / totalProportion;

    const childA = {
      id: this._generateId(),
      isLeaf: true,
      viewType: first.view
    };

    const childB = rest.length === 1
      ? { id: this._generateId(), isLeaf: true, viewType: rest[0].view }
      : this._createPredefinedLayout(rest);

    return {
      id: this._generateId() + '-split',
      isLeaf: false,
      direction: first.direction || 'horizontal',
      splitPercentage: splitPercentage,
      children: [childA, childB]
    };
  }

  /** Finds a node and its parent in the tree */
  _findNodeAndParent(id, node = this.layoutTree, parent = null) {
    if (node.id === id) {
      return { node, parent };
    }
    if (node.isLeaf) {
      return null;
    }

    // It's a SplitNode, so recurse
    return this._findNodeAndParent(id, node.children[0], node) ||
      this._findNodeAndParent(id, node.children[1], node);
  }

  /** Recursively calculates the layout */
  _calculateLayout(node, area) {
    node.area = area; // Cache the area on the node itself

    if (node.isLeaf) {
      // This is a panel, store its final coordinates
      this.panelCoordinates.set(node.id, { area, node });
      return;
    }

    // This is a SplitNode, calculate areas for its children
    this.splitNodeAreas.set(node.id, area);
    const { x1, y1, x2, y2 } = area;
    const width = x2 - x1;
    const height = y2 - y1;

    let areaA, areaB, handleArea;
    const handleSize = node.direction === 'vertical' ? this.config.handleWidth : this.config.handleHeight;

    if (node.direction === 'vertical') {
      const splitX = x1 + width * node.splitPercentage;
      areaA = { x1, y1, x2: splitX, y2 };
      areaB = { x1: splitX, y1, x2, y2 };
      handleArea = {
        x1: splitX - handleSize / 2,
        y1: y1,
        x2: splitX + handleSize / 2,
        y2: y2
      };
    } else { // 'horizontal'
      const splitY = y1 + height * node.splitPercentage;
      areaA = { x1, y1, x2, y2: splitY };
      areaB = { x1, y1: splitY, x2, y2 };
      handleArea = {
        x1: x1,
        y1: splitY - handleSize / 2,
        x2: x2,
        y2: splitY + handleSize / 2
      };
    }

    // Store handle info
    this.handleData.set(node.id, { area: handleArea, node });

    // Recurse
    this._calculateLayout(node.children[0], areaA);
    this._calculateLayout(node.children[1], areaB);
  }

  // --- Public API ---

  /**
   * Recalculate layout for given root area
   * @param {Object} rootArea - { x1, y1, x2, y2 }
   */
  reset(rootArea) {
    // Clear old layout data
    this.panelCoordinates.clear();
    this.handleData.clear();
    this.splitNodeAreas.clear();

    // Calculate new coordinates
    this._calculateLayout(this.layoutTree, rootArea);
  }

  /**
   * Get all panels with their bounding boxes
   * @returns {Array} Array of { id, bb: { x1, y1, x2, y2 }, node }
   */
  panels() {
    const result = [];
    this.panelCoordinates.forEach(({ area, node }, id) => {
      result.push({ id, bb: area, node });
    });
    return result;
  }

  /**
   * Get bounding box for specific panel or handle
   * @param {string} id - Panel or handle ID
   * @returns {Object|null} { x1, y1, x2, y2 } or null if not found
   */
  bb(id) {
    // Check panels first
    const panelData = this.panelCoordinates.get(id);
    if (panelData) {
      return panelData.area;
    }

    // Check handles
    const handleDataItem = this.handleData.get(id);
    if (handleDataItem) {
      return handleDataItem.area;
    }

    return null;
  }

  /**
   * Get all handles with their bounding boxes
   * @returns {Array} Array of { id, bb: { x1, y1, x2, y2 }, node }
   */
  handles() {
    const result = [];
    this.handleData.forEach(({ area, node }, id) => {
      result.push({ id, bb: area, node });
    });
    return result;
  }

  /**
   * Get handle configuration
   * @returns {Object} { handleWidth, handleHeight }
   */
  handleSize() {
    return {
      width: this.config.handleWidth,
      height: this.config.handleHeight
    };
  }

  /**
   * Split a panel vertically or horizontally
   * @param {string} panelId - ID of panel to split
   * @param {string} direction - 'vertical' or 'horizontal'
   * @returns {Object|null} { parentId, childIds: [id1, id2] } or null if failed
   */
  split(panelId, direction) {
    const result = this._findNodeAndParent(panelId);
    if (!result) return null;

    const { node, parent } = result;
    if (!node.isLeaf) return null; // Can only split leaf panels

    // 1. Create two new children
    const childA = { id: this._generateId(), isLeaf: true };
    const childB = { id: this._generateId(), isLeaf: true };

    // 2. Create the new SplitNode
    const splitNode = {
      id: this._generateId() + '-split',
      isLeaf: false,
      direction: direction,
      splitPercentage: 0.5,
      children: [childA, childB]
    };

    // 3. Replace the old leaf node with the new split node
    if (parent === null) {
      // We are splitting the root
      this.layoutTree = splitNode;
    } else {
      // We are splitting a child
      const childIndex = parent.children.indexOf(node);
      parent.children[childIndex] = splitNode;
    }

    return {
      parentId: splitNode.id,
      childIds: [childA.id, childB.id]
    };
  }

  /**
   * Close a panel, promoting its sibling
   * @param {string} panelId - ID of panel to close
   * @returns {boolean} true if closed, false if failed (e.g., root panel)
   */
  close(panelId) {
    const result = this._findNodeAndParent(panelId);
    if (!result) return false;

    const { node, parent: splitNode } = result;
    if (!splitNode) return false; // Can't close the root panel

    // 1. Find the sibling
    const sibling = splitNode.children.find(c => c !== node);

    // 2. Find the grandparent
    const grandParentResult = this._findNodeAndParent(splitNode.id);
    const grandParent = grandParentResult ? grandParentResult.parent : null;

    // 3. Replace the splitNode with the sibling
    if (grandParent === null) {
      // The splitNode was the root
      this.layoutTree = sibling;
    } else {
      const childIndex = grandParent.children.indexOf(splitNode);
      grandParent.children[childIndex] = sibling;
    }

    return true;
  }

  /**
   * Update handle (splitter) position
   * @param {string} handleId - ID of handle to update
   * @param {number} position - New position (x for vertical, y for horizontal)
   * @returns {boolean} true if updated, false if failed
   */
  update(handleId, position) {
    const handleDataItem = this.handleData.get(handleId);
    if (!handleDataItem) return false;

    const { node } = handleDataItem;
    const nodeArea = node.area;
    if (!nodeArea) return false;

    let newPercentage;
    if (node.direction === 'vertical') {
      const totalWidth = nodeArea.x2 - nodeArea.x1;
      const newSplitX = position - nodeArea.x1;
      newPercentage = newSplitX / totalWidth;
    } else {
      const totalHeight = nodeArea.y2 - nodeArea.y1;
      const newSplitY = position - nodeArea.y1;
      newPercentage = newSplitY / totalHeight;
    }

    // Clamp percentage to avoid 0% or 100% splits
    node.splitPercentage = Math.max(0.1, Math.min(0.9, newPercentage));

    return true;
  }

  /**
   * Get the root panel ID (useful for checking if panel is root)
   * @returns {string} Root panel ID
   */
  getRootId() {
    return this.layoutTree.id;
  }

  /**
   * Check if a panel has a parent (i.e., can be closed)
   * @param {string} panelId - ID of panel to check
   * @returns {boolean} true if panel has parent, false otherwise
   */
  hasParent(panelId) {
    const result = this._findNodeAndParent(panelId);
    return result && result.parent !== null;
  }
}

// Export for use in browser
if (typeof window !== 'undefined') {
  window.LayoutSystem = LayoutSystem;
}

// Export for use in Node.js (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LayoutSystem;
}
