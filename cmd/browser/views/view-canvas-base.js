import { View } from "./view.js"

const MIN_SCALE = 0.2;
const MAX_SCALE = 3;

/**
 * Base class for all canvas-based views (Minimap, Level Visualizer, Tree Visualizer).
 * Handles viewport management (pan, zoom, fit-to-content) and interaction.
 */
export class ViewCanvasBase extends View {
  constructor(contentTag) {
    super(contentTag);
    // Viewport state
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.spacePressed = false;
    // Defines the bounding box of the content in world coordinates (minX, maxX, minY, maxY)
    this.contentBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };

    this.canvas = null;
    this.ctx = null;
    this.tileInfo = null; // For hover tooltip
    this.data = null;

    // Bind event handlers
    this._onWheel = this._onWheel.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onMouseLeave = this._onMouseLeave.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();
    this.tileInfo = this.content.querySelector("[data-tooltip]")
    this.content.querySelector(`[data-action="reload"]`).onclick = () => this.fetchData()
    this.content.querySelector(`[data-action="zoom-in"]`).onclick = () => this.zoomIn()
    this.content.querySelector(`[data-action="zoom-out"]`).onclick = () => this.zoomOut()
    this.content.querySelector(`[data-action="zoom-fit"]`).onclick = () => this.fitToContent()
    this.canvas = this.content.querySelector(`canvas`)
    this.ctx = this.canvas.getContext('2d')
    this.ctx.imageSmoothingEnabled = false
    this._addEventListeners()
    this.onResize(this.w, this.h)
  }

  disconnectedCallback() {
    this._removeEventListeners();
  }

  _addEventListeners() {
    this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
    this.canvas.addEventListener('mousedown', this._onMouseDown);
    this.canvas.addEventListener('mousemove', this._onMouseMove);
    this.canvas.addEventListener('mouseup', this._onMouseUp);
    this.canvas.addEventListener('mouseleave', this._onMouseLeave);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  _removeEventListeners() {
    if (!this.canvas) return;
    this.canvas.removeEventListener('wheel', this._onWheel);
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    this.canvas.removeEventListener('mousemove', this._onMouseMove);
    this.canvas.removeEventListener('mouseup', this._onMouseUp);
    this.canvas.removeEventListener('mouseleave', this._onMouseLeave);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }

  // Called by View on resize
  _updatePosition() {
    super._updatePosition();
    this.onResize(this.w, this.h);
  }

  onResize(width, height) {
    // console.log("onResize", width, height)
    if (!this.canvas || (this.canvas.width === width && this.canvas.height === height)) return
    this.canvas.width = width
    this.canvas.height = height
    this.draw()
  }

  // --- Abstract Methods (Subclasses must implement) ---

  async fetchData() {
    throw new Error("Subclass must implement fetchData()");
  }

  calculateContentBounds(_data) {
    throw new Error("Subclass must implement calculateContentBounds(data)");
  }

  drawContent(_ctx, _data) {
    throw new Error("Subclass must implement drawContent(ctx, data)");
  }

  getHoverInfo(_worldX, _worldY, _data) {
    // Optional: return null if no info
    return null;
  }

  /**
   * Hook for child classes to handle mouse down when space is NOT pressed
   * @param {MouseEvent} e - Mouse event
   */
  onCanvasMouseDown(_e) {
    // Override in child classes for custom behavior (e.g., painting)
  }

  /**
   * Hook for child classes to handle mouse move when space is NOT pressed
   * @param {MouseEvent} e - Mouse event
   */
  onCanvasMouseMove(_e) {
    // Override in child classes for custom behavior (e.g., painting)
  }

  /**
   * Hook for child classes to handle mouse up when space is NOT pressed
   * @param {MouseEvent} e - Mouse event
   */
  onCanvasMouseUp(_e) {
    // Override in child classes for custom behavior (e.g., painting)
  }

  draw() {
    if (!this.canvas) { return }
    const { width, height } = this.canvas
    this.ctx.save()
    this.ctx.clearRect(0, 0, width, height)

    // Apply background
    this.ctx.fillStyle = '#1e1e1e'; // Dark background
    this.ctx.fillRect(0, 0, width, height)

    // Apply transform
    this.ctx.translate(this.offsetX, this.offsetY)
    this.ctx.scale(this.scale, this.scale)

    this.drawContent(this.ctx, this.data)


    this.ctx.restore()
  }

  _drawPlaceholder(width, height) {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform for placeholder
    this.ctx.fillStyle = '#333';
    this.ctx.fillRect(0, 0, width, height);
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '16px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('No Data or Error', width / 2, height / 2);
    this.ctx.restore();
  }

  // --- Viewport Management ---

  /**
   * Get current viewport transform matrix for renderers
   * @returns {Object} Viewport transform with helper methods
   */
  getViewportMatrix() {
    return {
      scale: this.scale,
      offsetX: this.offsetX,
      offsetY: this.offsetY,

      // Helper methods for coordinate transformation
      transformPoint: (worldX, worldY) => ({
        x: worldX * this.scale + this.offsetX,
        y: worldY * this.scale + this.offsetY
      }),

      inverseTransformPoint: (screenX, screenY) => ({
        x: (screenX - this.offsetX) / this.scale,
        y: (screenY - this.offsetY) / this.scale
      }),

      // Apply transform to canvas context
      applyTransform: (ctx) => {
        ctx.translate(this.offsetX, this.offsetY)
        ctx.scale(this.scale, this.scale)
      }
    }
  }

  _constrainPosition() {
    if (!this.data) return;

    const wrapperWidth = this.w;
    const wrapperHeight = this.h;
    const { minX, maxX, minY, maxY } = this.contentBounds;

    const scaledContentWidth = (maxX - minX) * this.scale;
    const scaledContentHeight = (maxY - minY) * this.scale;

    // Minimum visible margin (in screen pixels)
    const margin = 50;

    // Calculate constraints ensuring you can always pan to see all content
    // maxOffset: left/top edge of content can go up to (wrapperSize - margin) from left/top of viewport
    // minOffset: right/bottom edge of content must stay at least margin pixels from right/bottom of viewport
    const maxOffsetX = wrapperWidth - margin - minX * this.scale;
    const minOffsetX = margin - maxX * this.scale;
    const maxOffsetY = wrapperHeight - margin - minY * this.scale;
    const minOffsetY = margin - maxY * this.scale;

    // Only constrain if content fits - if minOffset > maxOffset, content is larger than viewport
    // In that case, allow full panning range
    if (minOffsetX <= maxOffsetX) {
      this.offsetX = Math.max(minOffsetX, Math.min(maxOffsetX, this.offsetX));
    }
    if (minOffsetY <= maxOffsetY) {
      this.offsetY = Math.max(minOffsetY, Math.min(maxOffsetY, this.offsetY));
    }
  }

  zoom(x, y, factor) {
    const oldScale = this.scale;
    this.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, this.scale * factor));

    const scaleChange = this.scale - oldScale;
    const relX = (x - this.offsetX) / oldScale;
    const relY = (y - this.offsetY) / oldScale;

    this.offsetX -= relX * scaleChange;
    this.offsetY -= relY * scaleChange;

    this._constrainPosition();
    this.draw()
  }

  zoomIn() {
    this.zoom(this.w / 2, this.h / 2, 1.2);
  }

  zoomOut() {
    this.zoom(this.w / 2, this.h / 2, 0.8);
  }

  fitToContent() {
    if (!this.data) return;

    const wrapperWidth = this.w;
    const wrapperHeight = this.h;
    const { minX, maxX, minY, maxY } = this.contentBounds;

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    const padding = 40; // Add some padding around the content
    const targetWidth = contentWidth + padding / this.scale;
    const targetHeight = contentHeight + padding / this.scale;

    const scaleX = wrapperWidth / targetWidth;
    const scaleY = wrapperHeight / targetHeight;
    let newScale = Math.min(scaleX, scaleY);

    newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));

    this.scale = newScale;

    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;

    // Center content in the viewport
    this.offsetX = wrapperWidth / 2 - contentCenterX * this.scale;
    this.offsetY = wrapperHeight / 2 - contentCenterY * this.scale;

    this._constrainPosition();
    this.draw()
  }

  resetView() {
    this.scale = 1;
    if (this.data) {
      const { minX, maxX, minY, maxY } = this.contentBounds;
      const contentCenterX = (minX + maxX) / 2;
      const contentCenterY = (minY + maxY) / 2;
      this.offsetX = this.w / 2 - contentCenterX * this.scale;
      this.offsetY = this.h / 2 - contentCenterY * this.scale;
    } else {
      this.offsetX = 0;
      this.offsetY = 0;
    }
    this._constrainPosition();
    this.draw()
  }

  _onWheel(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (e.ctrlKey || e.metaKey) {
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      this.zoom(x, y, factor);
    } else {
      this.offsetX -= e.deltaX;
      this.offsetY -= e.deltaY;
      this._constrainPosition();
      this.draw()
    }
  }

  _onMouseDown(e) {
    if (this.spacePressed) {
      // Space is pressed: pan viewport
      this.isDragging = true;
      this.dragStartX = e.clientX - this.offsetX;
      this.dragStartY = e.clientY - this.offsetY;
      this.canvas.style.cursor = 'grabbing';
    } else {
      // Space not pressed: delegate to child class
      this.onCanvasMouseDown(e);
    }
  }

  _onMouseMove(e) {
    if (this.isDragging && this.spacePressed) {
      // Panning with space
      this.offsetX = e.clientX - this.dragStartX;
      this.offsetY = e.clientY - this.dragStartY;
      this._constrainPosition();
      this.draw()
    } else if (!this.spacePressed) {
      // Not panning: delegate to child class
      this.onCanvasMouseMove(e);
    }

    this._handleHover(e);
  }

  _onMouseUp(e) {
    if (this.isDragging && this.spacePressed) {
      this.isDragging = false;
      this.canvas.style.cursor = 'grab';
    } else if (!this.spacePressed) {
      this.onCanvasMouseUp(e);
    }
  }

  _onMouseLeave() {
    this.isDragging = false;
    this.canvas.style.cursor = this.spacePressed ? 'grab' : 'default';
    this.tileInfo.style.display = 'none';
  }

  _handleHover(e) {
    if (!this.data || this.isDragging) {
      this.tileInfo.style.display = 'none';
      return;
    }

    const rect = this.canvas.getBoundingClientRect();

    // Calculate mouse position in world coordinates
    const mouseX = (e.clientX - rect.left - this.offsetX) / this.scale;
    const mouseY = (e.clientY - rect.top - this.offsetY) / this.scale;

    const info = this.getHoverInfo(mouseX, mouseY, this.data);

    if (info) {
      this.tileInfo.innerHTML = info;

      // Position tooltip near mouse
      this.tileInfo.style.left = (e.clientX - rect.left + 15) + 'px';
      this.tileInfo.style.top = (e.clientY - rect.top + 15) + 'px';
      this.tileInfo.style.display = 'block';
    } else {
      this.tileInfo.style.display = 'none';
    }
  }

  _onKeyDown(e) {
    if (e.code === 'Space' && !this.spacePressed) {
      this.spacePressed = true;
      if (this.canvas) {
        this.canvas.style.cursor = 'grab';
      }
      e.preventDefault();
    }
  }

  _onKeyUp(e) {
    if (e.code === 'Space') {
      this.spacePressed = false;
      // Clear dragging state when space is released to prevent jump on next space press
      this.isDragging = false;
      if (this.canvas) {
        this.canvas.style.cursor = 'default';
      }
    }
  }
}

customElements.define('view-canvas-base', ViewCanvasBase);
