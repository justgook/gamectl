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
    // Defines the bounding box of the content in world coordinates (minX, maxX, minY, maxY)
    this.contentBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };

    this.canvas = null;
    this.ctx = null;
    this.wrapper = null;
    this.tileInfo = null; // For hover tooltip
    this.data = null;

    // Bind event handlers
    this._onWheel = this._onWheel.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onMouseLeave = this._onMouseLeave.bind(this);
  }

  _createControls() {
    const controls = document.createElement('div');
    controls.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 100;
      display: flex;
      gap: 8px;
      padding: 8px;
      background: rgba(0, 0, 0, 0.5);
      border-radius: 4px;
    `;

    // Reload Button
    const reloadButton = document.createElement('button');
    reloadButton.textContent = '🔄 Reload';
    reloadButton.className = 'button-secondary'; // Assuming a class from app.css/design tokens
    reloadButton.style.cssText = 'padding: 4px 8px; font-size: 12px; cursor: pointer;';
    reloadButton.onclick = () => this.loadAndDraw();
    
    // Zoom In Button
    const zoomInButton = document.createElement('button');
    zoomInButton.textContent = '+';
    zoomInButton.className = 'button-secondary';
    zoomInButton.style.cssText = 'padding: 4px 8px; font-size: 12px; cursor: pointer;';
    zoomInButton.onclick = () => this.zoomIn();

    // Zoom Out Button
    const zoomOutButton = document.createElement('button');
    zoomOutButton.textContent = '−';
    zoomOutButton.className = 'button-secondary';
    zoomOutButton.style.cssText = 'padding: 4px 8px; font-size: 12px; cursor: pointer;';
    zoomOutButton.onclick = () => this.zoomOut();

    // Fit to Content Button
    const fitButton = document.createElement('button');
    fitButton.textContent = '⊡ Fit';
    fitButton.className = 'button-secondary';
    fitButton.style.cssText = 'padding: 4px 8px; font-size: 12px; cursor: pointer;';
    fitButton.onclick = () => this.fitToContent();

    controls.appendChild(reloadButton);
    controls.appendChild(zoomInButton);
    controls.appendChild(zoomOutButton);
    controls.appendChild(fitButton);

    return controls;
  }

  connectedCallback() {
    super.connectedCallback();

    // Setup DOM structure: wrapper > canvas + tileInfo
    this.wrapper = document.createElement('div');
    this.wrapper.style.cssText = `
      width: 100%;
      height: 100%;
      position: relative;
      overflow: hidden;
      cursor: grab;
    `;

    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      transform-origin: 0 0;
    `;

    this.tileInfo = document.createElement('div');
    this.tileInfo.id = 'tileInfo';
    this.tileInfo.style.cssText = `
      position: absolute;
      background: rgba(0, 0, 0, 0.85);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      pointer-events: none;
      display: none;
      z-index: 1000;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    `;

    this.wrapper.appendChild(this.canvas);
    this.wrapper.appendChild(this.tileInfo);
    this.wrapper.appendChild(this._createControls());

    // Clear any template content and append our canvas wrapper
    this.content.innerHTML = '';
    this.content.appendChild(this.wrapper);
    
    this.ctx = this.canvas.getContext('2d');
    
    this._addEventListeners();
    
    // Ensure canvas is sized correctly (handles case where w/h were set before connectedCallback)
    this.onResize(this.w, this.h);
    
    // Initial data load and draw
    this.loadAndDraw();
  }
  
  disconnectedCallback() {
    this._removeEventListeners();
  }

  _addEventListeners() {
    this.wrapper.addEventListener('wheel', this._onWheel, { passive: false });
    this.wrapper.addEventListener('mousedown', this._onMouseDown);
    this.wrapper.addEventListener('mousemove', this._onMouseMove);
    this.wrapper.addEventListener('mouseup', this._onMouseUp);
    this.wrapper.addEventListener('mouseleave', this._onMouseLeave);
  }

  _removeEventListeners() {
    if (!this.wrapper) return;
    this.wrapper.removeEventListener('wheel', this._onWheel);
    this.wrapper.removeEventListener('mousedown', this._onMouseDown);
    this.wrapper.removeEventListener('mousemove', this._onMouseMove);
    this.wrapper.removeEventListener('mouseup', this._onMouseUp);
    this.wrapper.removeEventListener('mouseleave', this._onMouseLeave);
  }

  // Called by View on resize
  _updatePosition() {
    super._updatePosition();
    this.onResize(this.w, this.h);
  }

  onResize(width, height) {
    if (!this.canvas) return;

    // Set canvas resolution to match the element size for sharp rendering
    this.canvas.width = width;
    this.canvas.height = height;

    // Redraw on resize
    this.draw();
  }

  // --- Abstract Methods (Subclasses must implement) ---

  async fetchData() {
    throw new Error("Subclass must implement fetchData()");
  }

  calculateContentBounds(data) {
    throw new Error("Subclass must implement calculateContentBounds(data)");
  }

  drawContent(ctx, data) {
    throw new Error("Subclass must implement drawContent(ctx, data)");
  }

  getHoverInfo(worldX, worldY, data) {
    // Optional: return null if no info
    return null;
  }

  // --- Data and Drawing Pipeline ---

  async loadAndDraw() {
    try {
      this.data = await this.fetchData();
      if (this.data) {
        this.contentBounds = this.calculateContentBounds(this.data);
      }
      this.draw();
    } catch (e) {
      console.error("Error loading or drawing canvas data:", e);
      this.data = null;
      this.draw(); // Draw placeholder/error state
    }
  }

  draw() {
    if (!this.ctx) return;

    const { width, height } = this.canvas;
    this.ctx.save();
    this.ctx.clearRect(0, 0, width, height);

    // Apply background
    this.ctx.fillStyle = '#1e1e1e'; // Dark background
    this.ctx.fillRect(0, 0, width, height);

    // Apply transform
    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(this.scale, this.scale);

    if (this.data) {
      this.drawContent(this.ctx, this.data);
    } else {
      this._drawPlaceholder(width, height);
    }

    this.ctx.restore();
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

  _constrainPosition() {
    if (!this.data) return;

    const wrapperWidth = this.w;
    const wrapperHeight = this.h;
    const { minX, maxX, minY, maxY } = this.contentBounds;

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    // Calculate allowed offset ranges
    const minVisibleRatio = 0.2;
    const minVisibleWidth = contentWidth * minVisibleRatio;
    const minVisibleHeight = contentHeight * minVisibleRatio;

    // Max offset: keep content's minX/minY visible
    const maxOffsetX = wrapperWidth - minX * this.scale - minVisibleWidth;
    const minOffsetX = -maxX * this.scale + minVisibleWidth;
    const maxOffsetY = wrapperHeight - minY * this.scale - minVisibleHeight;
    const minOffsetY = -maxY * this.scale + minVisibleHeight;

    // Apply constraints
    this.offsetX = Math.max(minOffsetX, Math.min(maxOffsetX, this.offsetX));
    this.offsetY = Math.max(minOffsetY, Math.min(maxOffsetY, this.offsetY));

    // Additional constraints to prevent extreme panning
    const maxPanDistance = Math.max(wrapperWidth, wrapperHeight) * 2;
    this.offsetX = Math.max(-maxPanDistance, Math.min(maxPanDistance, this.offsetX));
    this.offsetY = Math.max(-maxPanDistance, Math.min(maxPanDistance, this.offsetY));
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
    this.draw();
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
    this.draw();
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
    this.draw();
  }

  // --- Interaction Handlers ---

  _onWheel(e) {
    e.preventDefault();
    const rect = this.wrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (e.ctrlKey || e.metaKey) {
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      this.zoom(x, y, factor);
    } else {
      this.offsetX -= e.deltaX;
      this.offsetY -= e.deltaY;
      this._constrainPosition();
      this.draw();
    }
  }

  _onMouseDown(e) {
    this.isDragging = true;
    this.dragStartX = e.clientX - this.offsetX;
    this.dragStartY = e.clientY - this.offsetY;
    this.wrapper.style.cursor = 'grabbing';
  }

  _onMouseMove(e) {
    if (this.isDragging) {
      this.offsetX = e.clientX - this.dragStartX;
      this.offsetY = e.clientY - this.dragStartY;
      this._constrainPosition();
      this.draw();
    }

    this._handleHover(e);
  }

  _onMouseUp() {
    this.isDragging = false;
    this.wrapper.style.cursor = 'grab';
  }

  _onMouseLeave() {
    this.isDragging = false;
    this.wrapper.style.cursor = 'grab';
    this.tileInfo.style.display = 'none';
  }

  _handleHover(e) {
    if (!this.data || this.isDragging) {
      this.tileInfo.style.display = 'none';
      return;
    }

    const rect = this.wrapper.getBoundingClientRect();

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
}
customElements.define('view-canvas-base', ViewCanvasBase);
