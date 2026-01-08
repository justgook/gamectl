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
  updateTransforms,
  getCursor,
  startCreateChild,
  EditorMode,
  SelectionIntent,
  ManipulationIntent
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

    // Event listeners (will be populated in connectedCallback)
    this._selectionUnsubscribers = []
    this._manipulationUnsubscribers = []

    // Flag to prevent event loops when applying external changes
    this._applyingExternalChange = false
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

    // Register selection event listeners
    this._selectionUnsubscribers = [
      bus.on('skeleton:bone:select', this._onBoneSelect),
      bus.on('skeleton:bone:deselect', this._onBoneDeselect),
      bus.on('skeleton:selection:clear', this._onSelectionClear),
      bus.on('skeleton:selection:all', this._onSelectionAll)
    ]

    // Register manipulation event listeners
    this._manipulationUnsubscribers = [
      bus.on('skeleton:bone:rotate', this._onBoneRotate),
      bus.on('skeleton:translate', this._onSkeletonTranslate)
    ]
  }

  // --- Selection Event Handlers ---

  _onBoneSelect = ({ boneIndex }) => {
    this.editorState.selectedBones.add(boneIndex)
    this.draw()
  }

  _onBoneDeselect = ({ boneIndex }) => {
    this.editorState.selectedBones.delete(boneIndex)
    this.draw()
  }

  _onSelectionClear = () => {
    this.editorState.selectedBones.clear()
    this.draw()
  }

  _onSelectionAll = () => {
    if (!this.data) return
    this.editorState.selectedBones.clear()
    for (let i = 0; i < this.data.bones.length; i++) {
      this.editorState.selectedBones.add(i)
    }
    this.draw()
  }

  // --- Manipulation Event Handlers ---

  _onBoneRotate = ({ boneIndex, angle }) => {
    if (!this.data || !this.data.bones[boneIndex]) return
    
    // Skip if already at this angle (prevent loops)
    const currentAngle = this.data.bones[boneIndex].a
    if (Math.abs(currentAngle - angle) < 0.001) return

    // Apply external change
    this._applyingExternalChange = true
    const newBones = [...this.data.bones]
    newBones[boneIndex] = { ...newBones[boneIndex], a: angle }
    this.data = { ...this.data, bones: newBones }
    updateTransforms(this.editorState, this.data)
    this._applyingExternalChange = false

    this.draw()
  }

  _onSkeletonTranslate = ({ x, y }) => {
    if (!this.data) return
    
    // Skip if already at this position (prevent loops)
    if (Math.abs(this.data.x - x) < 0.001 && Math.abs(this.data.y - y) < 0.001) return

    // Apply external change
    this._applyingExternalChange = true
    this.data = { ...this.data, x, y }
    updateTransforms(this.editorState, this.data)
    this.contentBounds = this.calculateContentBounds(this.data)
    this._applyingExternalChange = false

    this.draw()
  }

  /**
   * Emit bus event based on selection intent returned from editor
   */
  _emitSelectionIntent(intent) {
    if (!intent) return

    switch (intent.type) {
      case SelectionIntent.SELECT:
        bus.emit('skeleton:bone:select', { boneIndex: intent.boneIndex })
        break
      case SelectionIntent.DESELECT:
        bus.emit('skeleton:bone:deselect', { boneIndex: intent.boneIndex })
        break
      case SelectionIntent.CLEAR:
        bus.emit('skeleton:selection:clear', {})
        // Handle chained intent (e.g., clear then select)
        if (intent.then) {
          this._emitSelectionIntent(intent.then)
        }
        break
      // SelectionIntent.NONE - do nothing
    }
  }

  /**
   * Emit bus event based on manipulation intent returned from editor
   */
  _emitManipulationIntent(intent) {
    if (!intent || this._applyingExternalChange) return

    switch (intent.type) {
      case ManipulationIntent.ROTATE:
        bus.emit('skeleton:bone:rotate', { boneIndex: intent.boneIndex, angle: intent.angle })
        break
      case ManipulationIntent.TRANSLATE:
        bus.emit('skeleton:translate', { x: intent.x, y: intent.y })
        break
      // ManipulationIntent.NONE - do nothing
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.unsubscribe()
    this.removeEventListener('keydown', this._onKeyDownEditor)

    // Unsubscribe from selection events
    this._selectionUnsubscribers.forEach(unsub => unsub())
    this._selectionUnsubscribers = []

    // Unsubscribe from manipulation events
    this._manipulationUnsubscribers.forEach(unsub => unsub())
    this._manipulationUnsubscribers = []
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

    // Emit selection event based on intent
    this._emitSelectionIntent(result.selectionIntent)

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

    // Emit selection event based on intent (e.g., selecting newly created bone)
    this._emitSelectionIntent(result.selectionIntent)

    // Emit manipulation event (rotation/translation finished)
    this._emitManipulationIntent(result.manipulationIntent)

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
        bus.emit('skeleton:selection:clear', {})
        e.preventDefault()
        break

      case 'a':
        if (e.ctrlKey || e.metaKey) {
          bus.emit('skeleton:selection:all', {})
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
    let newIndex = null

    if (!this.data) {
      // Create new skeleton
      this.data = {
        name: this.skeletonKey,
        x: 0,
        y: 0,
        props: { "0": { name: "root" } },
        bones: [{ parent: null, a: 90, l: 50 }]
      }
      newIndex = 0
    } else if (this.editorState.selectedBones.size > 0) {
      // Add child to first selected bone
      const parentIndex = Array.from(this.editorState.selectedBones)[0]
      newIndex = this.data.bones.length

      const newBones = [...this.data.bones, {
        parent: parentIndex,
        a: 0,
        l: 50
      }]

      const newProps = { ...this.data.props }
      newProps[newIndex] = { name: `bone_${newIndex}` }

      this.data = { ...this.data, bones: newBones, props: newProps }
    } else {
      // Add child to root
      const rootIndex = this.data.bones.findIndex(b => b.parent === null)
      if (rootIndex !== -1) {
        newIndex = this.data.bones.length

        const newBones = [...this.data.bones, {
          parent: rootIndex,
          a: 0,
          l: 50
        }]

        const newProps = { ...this.data.props }
        newProps[newIndex] = { name: `bone_${newIndex}` }

        this.data = { ...this.data, bones: newBones, props: newProps }
      }
    }

    updateTransforms(this.editorState, this.data)
    this.contentBounds = this.calculateContentBounds(this.data)

    // Select the new bone via event (clear others first)
    if (newIndex !== null) {
      bus.emit('skeleton:selection:clear', {})
      bus.emit('skeleton:bone:select', { boneIndex: newIndex })
    }

    this.draw()
  }
}

customElements.define('view-skeleton', ViewSkeleton)
