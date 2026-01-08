/**
 * ViewSkeleton - 2D Skeleton Animation Editor View
 * 
 * A canvas-based view for creating and editing 2D bone skeletons.
 * Extends ViewCanvasBase for pan/zoom/fit functionality.
 * 
 * Features:
 * - Create bones by dragging on canvas
 * - Select bones (click) with multi-select (shift+click)
 * - Rotate bones by dragging their tips
 * - Translate skeleton by dragging root joint
 * - Delete bones with Delete key
 * - Save/load via SQL storage
 * 
 * Coordinate system: Y increases upward (flipped from canvas default)
 */

import { ViewCanvasBase } from "./view-canvas-base.js"
import { bus } from "../systems/event-bus.js"
import { renderSkeleton, renderGrid, renderLabels, renderPreviewBone } from "./skeleton/SkeletonRenderer.js"
import {
  createEditorState,
  updateHover,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  deleteSelectedBones,
  selectAll,
  deselectAll,
  updateTransforms,
  getCursor,
  startCreateChild,
  EditorMode
} from "./skeleton/SkeletonEditor.js"

function noop() { }

export class ViewSkeleton extends ViewCanvasBase {
  static get observedAttributes() {
    return ['data-key']
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'data-key' && oldVal !== newVal) {
      this.skeletonKey = newVal
      this.unsubscribe()
      this.unsubscribe = bus.on(`cache:changed:${this.getSelectQuery()}`, this.dataChanged)
    }
  }

  constructor() {
    super()
    this.DE = new TextDecoder()
    this.skeletonKey = 'humanoid'
    this.unsubscribe = noop

    // Editor state
    this.editorState = createEditorState()

    // Show labels toggle
    this.showLabels = false

    // Bind keyboard handler
    this._onKeyDownEditor = this._onKeyDownEditor.bind(this)
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

    this.unsubscribe = bus.on(`cache:changed:${this.getSelectQuery()}`, this.dataChanged)

    // Setup header button handlers
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

    const addBoneBtn = this.queryHeaderControl('[data-action="add-bone"]')
    if (addBoneBtn) {
      addBoneBtn.onclick = () => this.addBoneAtCenter()
    }

    const toggleLabelsBtn = this.queryHeaderControl('[data-action="toggle-labels"]')
    if (toggleLabelsBtn) {
      toggleLabelsBtn.onclick = () => {
        this.showLabels = !this.showLabels
        toggleLabelsBtn.classList.toggle('active', this.showLabels)
        this.draw()
      }
    }

    // Add keyboard listener for this view
    this.addEventListener('keydown', this._onKeyDownEditor)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.unsubscribe()
    this.removeEventListener('keydown', this._onKeyDownEditor)
  }

  // --- Data Management ---

  dataChanged = (data) => {
    this.data = data
    updateTransforms(this.editorState, data)
    this.contentBounds = this.calculateContentBounds(data)
    this.draw()
  }

  async fetchData() {
    bus.emit(`cache:load:${this.getSelectQuery()}`)
    return this.data
  }

  getSelectQuery() {
    return `SELECT data FROM skeleton_storage WHERE name = '${this.skeletonKey}'`
  }

  getInsertQueryFn() {
    return (name, escapedData) => {
      return `INSERT OR REPLACE INTO skeleton_storage (name, data) VALUES ('${name}', '${escapedData}')`
    }
  }

  // --- Content Bounds ---

  calculateContentBounds(data) {
    if (!data || !data.bones || data.bones.length === 0) {
      // Default bounds for empty skeleton
      return { minX: -200, minY: -200, maxX: 200, maxY: 200 }
    }

    const transforms = this.editorState.transforms
    if (transforms.length === 0) {
      return { minX: -200, minY: -200, maxX: 200, maxY: 200 }
    }

    let minX = Infinity, minY = Infinity
    let maxX = -Infinity, maxY = -Infinity

    // Include skeleton origin
    minX = Math.min(minX, data.x)
    minY = Math.min(minY, data.y)
    maxX = Math.max(maxX, data.x)
    maxY = Math.max(maxY, data.y)

    // Include all bone positions
    for (const transform of transforms) {
      if (!transform) continue

      minX = Math.min(minX, transform.worldX, transform.endX)
      minY = Math.min(minY, transform.worldY, transform.endY)
      maxX = Math.max(maxX, transform.worldX, transform.endX)
      maxY = Math.max(maxY, transform.worldY, transform.endY)
    }

    // Add padding
    const padding = 50
    return {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding
    }
  }

  // --- Rendering ---

  drawContent(ctx, data) {
    // Flip Y axis so Y increases upward
    ctx.save()
    ctx.scale(1, -1)

    // Draw grid
    const bounds = this.contentBounds
    renderGrid(ctx, bounds)

    if (data && data.bones) {
      // Draw skeleton
      renderSkeleton(ctx, data, this.editorState.transforms, {
        hoveredBone: this.editorState.hoveredBone,
        hoveredPart: this.editorState.hoveredPart,
        selectedBones: this.editorState.selectedBones
      })

      // Draw labels if enabled
      if (this.showLabels) {
        // Flip text back so it's readable
        ctx.save()
        ctx.scale(1, -1)
        // Need to transform coordinates for flipped text
        const flippedTransforms = this.editorState.transforms.map(t => ({
          ...t,
          worldY: -t.worldY,
          endY: -t.endY
        }))
        renderLabels(ctx, { ...data, bones: data.bones }, flippedTransforms, this.scale)
        ctx.restore()
      }

      // Draw preview bone during creation
      if (this.editorState.mode === EditorMode.CREATE && this.editorState.isDragging) {
        renderPreviewBone(
          ctx,
          this.editorState.createStartX,
          this.editorState.createStartY,
          this.editorState.createEndX,
          this.editorState.createEndY
        )
      }
    }

    ctx.restore()
  }

  // --- Interaction Hooks ---

  /**
   * Convert screen coordinates to world coordinates (with Y flip)
   */
  _screenToWorld(screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect()
    const canvasX = screenX - rect.left
    const canvasY = screenY - rect.top

    // Apply inverse viewport transform
    const worldX = (canvasX - this.offsetX) / this.scale
    // Flip Y
    const worldY = -((canvasY - this.offsetY) / this.scale)

    return { worldX, worldY }
  }

  onCanvasMouseDown(e) {
    if (!this.data) return

    const { worldX, worldY } = this._screenToWorld(e.clientX, e.clientY)

    // Alt+click to start creating child bone
    // Check both tip (leaf bone) and joint (where child would attach to parent)
    if (e.altKey && this.editorState.hoveredBone !== null) {
      if (this.editorState.hoveredPart === 'tip' || this.editorState.hoveredPart === 'joint') {
        startCreateChild(this.editorState, this.data, this.editorState.hoveredBone, worldX, worldY)
        this.draw()
        return
      }
    }

    const result = handleMouseDown(this.editorState, this.data, worldX, worldY, e.shiftKey)

    if (result.changed) {
      this.data = result.skeleton
      this.canvas.style.cursor = getCursor(this.editorState)
      this.draw()
    }
  }

  onCanvasMouseMove(e) {
    const { worldX, worldY } = this._screenToWorld(e.clientX, e.clientY)

    if (this.editorState.isDragging) {
      const result = handleMouseMove(this.editorState, this.data, worldX, worldY)

      if (result.changed) {
        this.data = result.skeleton
        this.draw()
      }
    } else {
      // Update hover state
      const changed = updateHover(this.editorState, this.data, worldX, worldY)
      if (changed) {
        this.canvas.style.cursor = getCursor(this.editorState)
        this.draw()
      }
    }
  }

  onCanvasMouseUp(e) {
    if (!this.data) return

    const { worldX, worldY } = this._screenToWorld(e.clientX, e.clientY)
    const result = handleMouseUp(this.editorState, this.data, worldX, worldY)

    if (result.changed) {
      this.data = result.skeleton
      this.contentBounds = this.calculateContentBounds(this.data)
    }

    this.canvas.style.cursor = getCursor(this.editorState)
    this.draw()
  }

  // --- Keyboard Handling ---

  _onKeyDownEditor(e) {
    // Only handle if this view is focused
    if (!this.contains(document.activeElement) && document.activeElement !== this) {
      return
    }

    switch (e.key) {
      case 'Delete':
      case 'Backspace': {
        const result = deleteSelectedBones(this.editorState, this.data)
        if (result.changed) {
          this.data = result.skeleton
          this.contentBounds = this.calculateContentBounds(this.data)
          this.draw()
        }
        e.preventDefault()
        break
      }

      case 'Escape':
        deselectAll(this.editorState)
        this.draw()
        e.preventDefault()
        break

      case 'a':
        if (e.ctrlKey || e.metaKey) {
          selectAll(this.editorState, this.data)
          this.draw()
          e.preventDefault()
        }
        break
    }
  }

  // --- Hover Info ---

  getHoverInfo(worldX, worldY, data) {
    // Note: worldY is already flipped by the base class
    // We need to flip it back for our coordinate system
    const flippedY = -worldY

    if (!data || !data.bones) return null

    const state = this.editorState
    if (state.hoveredBone === null) return null

    const bone = data.bones[state.hoveredBone]
    const props = data.props?.[state.hoveredBone]
    const name = props?.name || `bone_${state.hoveredBone}`
    const transform = state.transforms[state.hoveredBone]

    return `
      <strong>${name}</strong><br>
      Angle: ${bone.a.toFixed(1)}°<br>
      Length: ${bone.l.toFixed(1)}px<br>
      World: (${transform.worldX.toFixed(0)}, ${transform.worldY.toFixed(0)})
    `
  }

  // --- Actions ---

  /**
   * Add a new bone at the center of the viewport
   */
  addBoneAtCenter() {
    if (!this.data) {
      // Create new skeleton
      this.data = {
        name: this.skeletonKey,
        x: 0,
        y: 0,
        props: { "0": { name: "root" } },
        bones: [{ parent: null, a: 90, l: 50 }]
      }
    } else if (this.editorState.selectedBones.size > 0) {
      // Add child to first selected bone
      const parentIndex = Array.from(this.editorState.selectedBones)[0]
      const newIndex = this.data.bones.length

      const newBones = [...this.data.bones, {
        parent: parentIndex,
        a: 0,
        l: 50
      }]

      const newProps = { ...this.data.props }
      newProps[newIndex] = { name: `bone_${newIndex}` }

      this.data = { ...this.data, bones: newBones, props: newProps }

      // Select the new bone
      this.editorState.selectedBones.clear()
      this.editorState.selectedBones.add(newIndex)
    } else {
      // Add child to root
      const rootIndex = this.data.bones.findIndex(b => b.parent === null)
      if (rootIndex !== -1) {
        const newIndex = this.data.bones.length

        const newBones = [...this.data.bones, {
          parent: rootIndex,
          a: 0,
          l: 50
        }]

        const newProps = { ...this.data.props }
        newProps[newIndex] = { name: `bone_${newIndex}` }

        this.data = { ...this.data, bones: newBones, props: newProps }

        // Select the new bone
        this.editorState.selectedBones.clear()
        this.editorState.selectedBones.add(newIndex)
      }
    }

    updateTransforms(this.editorState, this.data)
    this.contentBounds = this.calculateContentBounds(this.data)
    this.draw()
  }
}

customElements.define('view-skeleton', ViewSkeleton)
