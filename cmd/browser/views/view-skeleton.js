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
 * - Named poses with pose selector
 * - Working pose state (separate from saved poses)
 * 
 * Coordinate system: Y increases upward (flipped from canvas default)
 * 
 * Data model:
 * - this.data: The skeleton data from storage (bind pose + structure + named poses)
 * - this.workingPose: Current working state { x, y, angles: {} }
 * - this.currentPoseName: Name of the currently loaded pose
 * - this.displaySkeleton: Computed skeleton with working pose applied (for rendering)
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
  SelectionIntent
} from "./skeleton/SkeletonEditor.js"
import {
  createEmptyPose,
  clonePose,
  applyPose,
  extractPose,
  isPoseDirty,
  posesEqual
} from "./skeleton/Pose.js"

function noop() { }

export class ViewSkeleton extends ViewCanvasBase {
  static get viewMeta() { return { displayName: 'Skeleton', category: 'Canvas' } }

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

    // Pose state
    this.currentPoseName = 'default'      // Currently loaded pose name
    this.workingPose = createEmptyPose()  // Current working state
    this.displaySkeleton = null           // Computed skeleton for rendering
    this.isDirty = false                  // Has unsaved changes
    this.isPreviewMode = false            // Animation preview mode (don't update workingPose)

    // Bind keyboard handler
    this._onKeyDownEditor = this._onKeyDownEditor.bind(this)

    // Event listeners (will be populated in connectedCallback)
    this._selectionUnsubscribers = []
  }

  createHeaderControlsElement() {
    const controls = document.createElement('div')
    controls.innerHTML = `
      <select data-action="pose-select" title="Select Pose">
        <option value="default">default</option>
      </select>
      <button data-action="pose-save" aria-label="Save Pose" title="Save Pose"><i aria-hidden="true">save</i></button>
      <button data-action="pose-new" aria-label="Save as New Pose" title="Save as New Pose"><i aria-hidden="true">add</i></button>
      <button data-action="pose-reset" aria-label="Reset to Saved Pose" title="Reset to Saved Pose"><i aria-hidden="true">replay</i></button>
      <span style="width: 1px; height: 20px; background: var(--border);"></span>
      <button data-action="add-bone" aria-label="Add Bone" title="Add Bone"><i aria-hidden="true">device_hub</i></button>
      <button data-action="toggle-labels" aria-label="Toggle Labels" title="Toggle Labels"><i aria-hidden="true">label</i></button>
      <span style="width: 1px; height: 20px; background: var(--border);"></span>
      <button data-action="save" class="accent" aria-label="Save Skeleton" title="Save Skeleton"><i aria-hidden="true">save</i></button>
      <button data-action="reload" aria-label="Reload" title="Reload"><i aria-hidden="true">refresh</i></button>
      <button data-action="zoom-in" aria-label="Zoom In" title="Zoom In"><i aria-hidden="true">zoom_in</i></button>
      <button data-action="zoom-out" aria-label="Zoom Out" title="Zoom Out"><i aria-hidden="true">zoom_out</i></button>
      <button data-action="zoom-fit" aria-label="Fit View" title="Fit View"><i aria-hidden="true">fit_screen</i></button>
    `
    return controls
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

    // Pose controls
    this._poseSelect = this.queryHeaderControl('[data-action="pose-select"]')
    if (this._poseSelect) {
      this._poseSelect.onchange = (e) => this.selectPose(e.target.value)
    }

    const poseSaveBtn = this.queryHeaderControl('[data-action="pose-save"]')
    if (poseSaveBtn) {
      poseSaveBtn.onclick = () => this.saveCurrentPose()
    }

    const poseNewBtn = this.queryHeaderControl('[data-action="pose-new"]')
    if (poseNewBtn) {
      poseNewBtn.onclick = () => this.saveAsNewPose()
    }

    const poseResetBtn = this.queryHeaderControl('[data-action="pose-reset"]')
    if (poseResetBtn) {
      poseResetBtn.onclick = () => this.resetToCurrentPose()
    }

    const saveBtn = this.queryHeaderControl('[data-action="save"]')
    if (saveBtn) {
      saveBtn.onclick = () => this.saveSkeleton()
    }

    // Add keyboard listener for this view
    this.addEventListener('keydown', this._onKeyDownEditor)

    // Register selection event listeners
    this._selectionUnsubscribers = [
      bus.on('skeleton:bone:select', this._onBoneSelect),
      bus.on('skeleton:bone:deselect', this._onBoneDeselect),
      bus.on('skeleton:selection:clear', this._onSelectionClear),
      bus.on('skeleton:selection:all', this._onSelectionAll),
      bus.on('skeleton:pose:preview', this._onPosePreview),
      bus.on('skeleton:pose:preview:stop', this._onPosePreviewStop),
      bus.on('skeleton:workingpose:request', this._onWorkingPoseRequest)
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
    if (!this.displaySkeleton) return
    this.editorState.selectedBones.clear()
    for (let i = 0; i < this.displaySkeleton.bones.length; i++) {
      this.editorState.selectedBones.add(i)
    }
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



  disconnectedCallback() {
    super.disconnectedCallback()
    this.unsubscribe()
    this.removeEventListener('keydown', this._onKeyDownEditor)

    // Unsubscribe from selection events
    this._selectionUnsubscribers.forEach(unsub => unsub())
    this._selectionUnsubscribers = []
  }

  // --- Data Management ---

  dataChanged = (data) => {
    const isInitialLoad = !this.data
    this.data = data
    
    // Initialize pose system on first load
    if (isInitialLoad && data) {
      this._initializePoseSystem(data)
    }
    
    // Update display skeleton and transforms
    this._updateDisplaySkeleton()
    this.contentBounds = this.calculateContentBounds(this.displaySkeleton)
    this.draw()
  }

  /**
   * Initialize pose system from skeleton data
   */
  _initializePoseSystem(data) {
    // Ensure poses object exists
    if (!data.poses) {
      data.poses = { default: createEmptyPose() }
    }
    
    // Update pose selector dropdown
    this._updatePoseSelector()
    
    // Load default pose
    this.selectPose('default', false)
  }

  /**
   * Update the pose selector dropdown with available poses
   */
  _updatePoseSelector() {
    if (!this._poseSelect || !this.data?.poses) return
    
    const currentValue = this._poseSelect.value
    this._poseSelect.innerHTML = ''
    
    for (const poseName of Object.keys(this.data.poses)) {
      const option = document.createElement('option')
      option.value = poseName
      option.textContent = poseName
      this._poseSelect.appendChild(option)
    }
    
    // Restore selection if still valid
    if (this.data.poses[currentValue]) {
      this._poseSelect.value = currentValue
    }
  }

  /**
   * Update display skeleton from bind pose + working pose
   */
  _updateDisplaySkeleton() {
    if (!this.data) {
      this.displaySkeleton = null
      updateTransforms(this.editorState, null)
      return
    }
    
    this.displaySkeleton = applyPose(this.data, this.workingPose)
    updateTransforms(this.editorState, this.displaySkeleton)
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

  // --- Pose Management ---

  /**
   * Select and load a pose by name
   * @param {string} poseName - Name of the pose to load
   * @param {boolean} checkDirty - Whether to check for unsaved changes
   */
  selectPose(poseName, checkDirty = true) {
    if (!this.data?.poses?.[poseName]) {
      console.warn(`Pose "${poseName}" not found`)
      return
    }
    
    // Check for unsaved changes
    if (checkDirty && this.isDirty) {
      const confirmed = confirm(`You have unsaved changes to "${this.currentPoseName}". Discard and switch to "${poseName}"?`)
      if (!confirmed) {
        // Restore selector to current pose
        if (this._poseSelect) {
          this._poseSelect.value = this.currentPoseName
        }
        return
      }
    }
    
    this.currentPoseName = poseName
    this.workingPose = clonePose(this.data.poses[poseName])
    this.isDirty = false
    
    // Update UI
    if (this._poseSelect) {
      this._poseSelect.value = poseName
    }
    
    this._updateDisplaySkeleton()
    this.contentBounds = this.calculateContentBounds(this.displaySkeleton)
    this.draw()
    
    // Emit pose changed event
    bus.emit('skeleton:pose:changed', { 
      poseName, 
      pose: this.workingPose,
      skeletonKey: this.skeletonKey 
    })
  }

  /**
   * Save current working pose to the currently selected pose slot
   */
  saveCurrentPose() {
    if (!this.data || !this.currentPoseName) return
    
    // Update pose in skeleton data
    if (!this.data.poses) {
      this.data.poses = {}
    }
    this.data.poses[this.currentPoseName] = clonePose(this.workingPose)
    this.isDirty = false
    
    console.log(`Saved pose "${this.currentPoseName}"`)
    
    // Emit event
    bus.emit('skeleton:pose:saved', { 
      poseName: this.currentPoseName,
      pose: this.workingPose 
    })
  }

  /**
   * Save current working pose as a new named pose
   */
  saveAsNewPose() {
    const name = prompt('Enter pose name:', `pose_${Object.keys(this.data?.poses || {}).length}`)
    if (!name) return
    
    // Check for existing pose
    if (this.data?.poses?.[name]) {
      const overwrite = confirm(`Pose "${name}" already exists. Overwrite?`)
      if (!overwrite) return
    }
    
    // Ensure poses object exists
    if (!this.data.poses) {
      this.data.poses = {}
    }
    
    // Save pose
    this.data.poses[name] = clonePose(this.workingPose)
    this.currentPoseName = name
    this.isDirty = false
    
    // Update selector
    this._updatePoseSelector()
    if (this._poseSelect) {
      this._poseSelect.value = name
    }
    
    console.log(`Created new pose "${name}"`)
    
    // Emit event
    bus.emit('skeleton:pose:created', { 
      poseName: name,
      pose: this.workingPose 
    })
  }

  /**
   * Reset working pose to saved state of current pose
   */
  resetToCurrentPose() {
    if (!this.data?.poses?.[this.currentPoseName]) return
    
    this.workingPose = clonePose(this.data.poses[this.currentPoseName])
    this.isDirty = false
    
    this._updateDisplaySkeleton()
    this.contentBounds = this.calculateContentBounds(this.displaySkeleton)
    this.draw()
    
    console.log(`Reset to pose "${this.currentPoseName}"`)
  }

  /**
   * Save skeleton to database (structure + all poses)
   */
  saveSkeleton() {
    if (!this.data) return
    
    // Save current working pose first if dirty
    if (this.isDirty) {
      this.saveCurrentPose()
    }
    
    // Emit save event to cache system
    bus.emit('cache:save', {
      selectQuery: this.getSelectQuery(),
      insertQueryFn: this.getInsertQueryFn()
    })
    
    console.log(`Saved skeleton "${this.skeletonKey}"`)
  }

  /**
   * Get current working pose (for timeline keyframe capture)
   * @returns {Object} Current working pose
   */
  getWorkingPose() {
    return clonePose(this.workingPose)
  }

  /**
   * Mark working pose as dirty (has unsaved changes)
   */
  _markDirty() {
    if (!this.isDirty) {
      this.isDirty = true
      // Could update UI to show dirty state
    }
  }

  // --- Pose Event Handlers ---

  /**
   * Handle animation preview pose
   */
  _onPosePreview = ({ pose }) => {
    this.isPreviewMode = true
    this.workingPose = clonePose(pose)
    this._updateDisplaySkeleton()
    this.draw()
  }

  /**
   * Stop animation preview mode
   */
  _onPosePreviewStop = () => {
    this.isPreviewMode = false
    // Restore to current pose
    if (this.data?.poses?.[this.currentPoseName]) {
      this.workingPose = clonePose(this.data.poses[this.currentPoseName])
    }
    this._updateDisplaySkeleton()
    this.draw()
  }

  /**
   * Respond to working pose request from timeline
   */
  _onWorkingPoseRequest = ({ requestId }) => {
    bus.emit('skeleton:workingpose:response', {
      requestId,
      pose: this.getWorkingPose(),
      skeletonKey: this.skeletonKey,
      displaySkeleton: this.displaySkeleton
    })
  }

  // --- Content Bounds ---

  calculateContentBounds(skeleton) {
    // Use displaySkeleton if no argument provided
    const data = skeleton || this.displaySkeleton
    
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
    // Use displaySkeleton for rendering (has working pose applied)
    const skeleton = this.displaySkeleton
    
    // Flip Y axis so Y increases upward
    ctx.save()
    ctx.scale(1, -1)

    // Draw grid
    const bounds = this.contentBounds
    renderGrid(ctx, bounds)

    if (skeleton && skeleton.bones) {
      // Draw skeleton with working pose applied
      renderSkeleton(ctx, skeleton, this.editorState.transforms, {
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
        renderLabels(ctx, skeleton, flippedTransforms, this.scale)
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
    if (!this.displaySkeleton) return
    
    // Don't allow editing in preview mode
    if (this.isPreviewMode) return

    const { worldX, worldY } = this._screenToWorld(e.clientX, e.clientY)

    // Alt+click to start creating child bone (structural change)
    // Check both tip (leaf bone) and joint (where child would attach to parent)
    if (e.altKey && this.editorState.hoveredBone !== null) {
      if (this.editorState.hoveredPart === 'tip' || this.editorState.hoveredPart === 'joint') {
        startCreateChild(this.editorState, this.displaySkeleton, this.editorState.hoveredBone, worldX, worldY)
        this.draw()
        return
      }
    }

    // Use displaySkeleton for interaction
    const result = handleMouseDown(this.editorState, this.displaySkeleton, worldX, worldY, e.shiftKey)

    // Emit selection event based on intent
    this._emitSelectionIntent(result.selectionIntent)

    if (result.changed) {
      // For structural changes (CREATE mode), update skeleton data
      // For pose changes (ROTATE, TRANSLATE), just update display
      this.displaySkeleton = result.skeleton
      this.canvas.style.cursor = getCursor(this.editorState)
      this.draw()
    }
  }

  onCanvasMouseMove(e) {
    if (!this.displaySkeleton) return

    const { worldX, worldY } = this._screenToWorld(e.clientX, e.clientY)

    if (this.editorState.isDragging) {
      // Don't allow editing in preview mode
      if (this.isPreviewMode) return
      
      const result = handleMouseMove(this.editorState, this.displaySkeleton, worldX, worldY)

      if (result.changed) {
        this.displaySkeleton = result.skeleton
        
        // Extract changes to working pose
        this._syncWorkingPoseFromDisplay()
        
        this.draw()
      }
    } else {
      // Update hover state
      const changed = updateHover(this.editorState, this.displaySkeleton, worldX, worldY)
      if (changed) {
        this.canvas.style.cursor = getCursor(this.editorState)
        this.draw()
      }
    }
  }

  onCanvasMouseUp(e) {
    if (!this.displaySkeleton) return

    const { worldX, worldY } = this._screenToWorld(e.clientX, e.clientY)
    const result = handleMouseUp(this.editorState, this.displaySkeleton, worldX, worldY)

    if (result.changed) {
      this.displaySkeleton = result.skeleton
      
      // Check if this was a structural change (bone creation)
      if (result.manipulationIntent?.type === 'create') {
        // Structural change - update skeleton data
        this._syncStructuralChanges(result.skeleton)
      } else {
        // Pose change - update working pose
        this._syncWorkingPoseFromDisplay()
      }
      
      this.contentBounds = this.calculateContentBounds(this.displaySkeleton)
    }

    // Emit selection event (e.g., selecting newly created bone)
    this._emitSelectionIntent(result.selectionIntent)

    this.canvas.style.cursor = getCursor(this.editorState)
    this.draw()
  }

  /**
   * Sync working pose from current display skeleton
   */
  _syncWorkingPoseFromDisplay() {
    if (!this.data || !this.displaySkeleton) return
    
    // Extract pose differences from bind pose
    this.workingPose = extractPose(this.data, this.displaySkeleton)
    this._markDirty()
    
    // Emit working pose changed for timeline
    bus.emit('skeleton:workingpose:changed', {
      pose: this.workingPose,
      skeletonKey: this.skeletonKey
    })
  }

  /**
   * Sync structural changes (new bones) to skeleton data
   */
  _syncStructuralChanges(newSkeleton) {
    if (!this.data) return
    
    // Copy structural changes to skeleton data (bones, props)
    this.data = {
      ...this.data,
      bones: newSkeleton.bones,
      props: newSkeleton.props
    }
    
    // Notify cache of structural change
    bus.emit(`cache:changed:${this.getSelectQuery()}`, this.data)
    
    // Also sync the pose
    this._syncWorkingPoseFromDisplay()
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
        // Deleting bones is a structural change
        const result = deleteSelectedBones(this.editorState, this.displaySkeleton)
        if (result.changed) {
          this.displaySkeleton = result.skeleton
          this._syncStructuralChanges(result.skeleton)
          this.contentBounds = this.calculateContentBounds(this.displaySkeleton)
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
    // Use displaySkeleton for hover info
    const skeleton = this.displaySkeleton
    
    // Note: worldY is already flipped by the base class
    // We need to flip it back for our coordinate system
    const flippedY = -worldY

    if (!skeleton || !skeleton.bones) return null

    const state = this.editorState
    if (state.hoveredBone === null) return null

    const bone = skeleton.bones[state.hoveredBone]
    const props = skeleton.props?.[state.hoveredBone]
    const name = props?.name || `bone_${state.hoveredBone}`
    const transform = state.transforms[state.hoveredBone]

    // Show if angle differs from bind pose
    const bindAngle = this.data?.bones?.[state.hoveredBone]?.a ?? bone.a
    const angleDiff = bone.a !== bindAngle ? ` (bind: ${bindAngle.toFixed(1)}°)` : ''

    return `
      <strong>${name}</strong><br>
      Angle: ${bone.a.toFixed(1)}°${angleDiff}<br>
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
    let newBone = null
    let newBoneProps = null

    if (!this.data) {
      // Create new skeleton
      newBone = { parent: null, a: 90, l: 50 }
      newBoneProps = { name: "root" }
      this.data = {
        name: this.skeletonKey,
        x: 0,
        y: 0,
        props: { "0": newBoneProps },
        bones: [newBone],
        poses: { default: createEmptyPose() }
      }
      newIndex = 0
      
      // Initialize pose system
      this._initializePoseSystem(this.data)
    } else if (this.editorState.selectedBones.size > 0) {
      // Add child to first selected bone
      const parentIndex = Array.from(this.editorState.selectedBones)[0]
      newIndex = this.data.bones.length

      newBone = { parent: parentIndex, a: 0, l: 50 }
      newBoneProps = { name: `bone_${newIndex}` }

      const newBones = [...this.data.bones, newBone]
      const newProps = { ...this.data.props }
      newProps[newIndex] = newBoneProps

      this.data = { ...this.data, bones: newBones, props: newProps }
    } else {
      // Add child to root
      const rootIndex = this.data.bones.findIndex(b => b.parent === null)
      if (rootIndex !== -1) {
        newIndex = this.data.bones.length

        newBone = { parent: rootIndex, a: 0, l: 50 }
        newBoneProps = { name: `bone_${newIndex}` }

        const newBones = [...this.data.bones, newBone]
        const newProps = { ...this.data.props }
        newProps[newIndex] = newBoneProps

        this.data = { ...this.data, bones: newBones, props: newProps }
      }
    }

    // Update display skeleton
    this._updateDisplaySkeleton()
    this.contentBounds = this.calculateContentBounds(this.displaySkeleton)
    
    // Update cache with new data (structural change)
    bus.emit(`cache:changed:${this.getSelectQuery()}`, this.data)

    // Select the new bone
    if (newIndex !== null) {
      bus.emit('skeleton:selection:clear', {})
      bus.emit('skeleton:bone:select', { boneIndex: newIndex })
    }

    this.draw()
  }
}

export default ViewSkeleton
