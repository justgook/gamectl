import { ViewCanvasBase } from './view-canvas-base.js'
import { bus } from '../systems/event-bus.js'
import { toast } from '../systems/toast.js'

export class ViewTimeline extends ViewCanvasBase {
  static get observedAttributes() { return ['data-key', 'data-timeline'] }

  constructor() {
    super()

    // Timeline data
    this.timelineData = null
    this.currentTime = 0
    this.isPlaying = false
    this.playbackSpeed = 1.0
    this.loop = true

    // Editor state
    this.editorState = {
      mode: 'SELECT',      // SELECT | MOVE | SCALE
      selectedTrack: null,
      selectedKeyframes: new Set(),
      snapEnabled: true,
      snapTimeInterval: 0.1,  // seconds
      snapValueInterval: 5,    // degrees/units
      isRecording: false,     // Recording mode for auto-capturing keyframes
      clipboard: null         // Copied keyframes for paste functionality
    }

    // View settings
    this.viewSettings = {
      timeRange: { start: 0, end: 10 },
      trackHeight: 24,
      headerWidth: 150,
      keyframeSize: 8,
      rulerHeight: 30
    }

    // Animation loop
    this.animationFrame = null
    this.lastFrameTime = 0

    // Bind methods - handleWheel doesn't exist in this class, parent class handles it
    this.handleMouseDown = this.handleMouseDown.bind(this)
    this.handleMouseMove = this.handleMouseMove.bind(this)
    this.handleMouseUp = this.handleMouseUp.bind(this)
    this.handleKeyDown = this.handleKeyDown.bind(this)
  }

  connectedCallback() {
    super.connectedCallback()

    // Set up timeline-specific UI
    this.setupTimelineUI()

    // Subscribe to timeline events
    this.subscribeToEvents()

    // Load timeline data
    this.loadTimelineData()
  }

  disconnectedCallback() {
    super.disconnectedCallback()

    // Cleanup animation loop
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame)
    }

    // Unsubscribe from events
    if (this.eventUnsubscribe) {
      this.eventUnsubscribe()
    }
  }

  setupTimelineUI() {
    // Add timeline controls to header
    const controlsHTML = `
      <div class="timeline-controls">
        <button class="button-secondary" id="play-btn" title="Play (Space)">
          <span class="icon">▶</span>
        </button>
        <button class="button-secondary" id="pause-btn" title="Pause (Space)">
          <span class="icon">⏸</span>
        </button>
        <button class="button-secondary" id="stop-btn" title="Stop (Esc)">
          <span class="icon">⏹</span>
        </button>
        <button class="button-secondary" id="loop-btn" title="Toggle Loop">
          <span class="icon">🔁</span>
        </button>
        <div class="time-display">
          <span id="current-time">0.00s</span> / <span id="duration">0.00s</span>
        </div>
        <div class="playback-speed">
          <label>Speed:</label>
          <select id="speed-select">
            <option value="0.25">0.25x</option>
            <option value="0.5">0.5x</option>
            <option value="1" selected>1x</option>
            <option value="2">2x</option>
            <option value="4">4x</option>
          </select>
        </div>
      </div>
    `

    // Insert controls into header
    const header = this.querySelector('.view-header')
    if (header) {
      header.insertAdjacentHTML('beforeend', controlsHTML)
      this.setupControlListeners()
    } else {
      // If no header found, create one
      const headerHTML = `<div class="view-header">${controlsHTML}</div>`
      this.insertAdjacentHTML('afterbegin', headerHTML)
      this.setupControlListeners()
    }
  }

  setupControlListeners() {
    // Playback controls
    const playBtn = this.querySelector('#play-btn')
    const pauseBtn = this.querySelector('#pause-btn')
    const stopBtn = this.querySelector('#stop-btn')
    const loopBtn = this.querySelector('#loop-btn')
    const recordBtn = this.querySelector('#record-btn')
    const speedSelect = this.querySelector('#speed-select')
    
    if (playBtn) playBtn.addEventListener('click', () => this.play())
    if (pauseBtn) pauseBtn.addEventListener('click', () => this.pause())
    if (stopBtn) stopBtn.addEventListener('click', () => this.stop())
    if (loopBtn) loopBtn.addEventListener('click', () => this.toggleLoop())
    if (recordBtn) recordBtn.addEventListener('click', () => this.toggleRecording())

    // Speed control
    if (speedSelect) {
      speedSelect.addEventListener('change', (e) => {
        this.playbackSpeed = parseFloat(e.target.value)
      })
    }
  }

  subscribeToEvents() {
    // Subscribe to timeline data changes
    const timelineName = this.getAttribute('data-timeline') || 'default_timeline'
    const query = `SELECT data FROM timeline_storage WHERE name = '${timelineName}'`

    this.eventUnsubscribe = bus.on(`cache:changed:${query}`, (data) => {
      console.log('Timeline data received:', data)
      if (data && data.length > 0) {
        this.timelineData = JSON.parse(data[0].data)
        this.updateTimeRange()
        this.draw()
        console.log('Timeline loaded successfully:', this.timelineData.name)
      } else {
        console.log('No timeline data found, using built-in default timeline')
        // Create default timeline inline
        this.timelineData = {
          name: timelineName,
          duration: 2.0,
          frameRate: 30,
          loop: true,
          tracks: [
            {
              targetType: 'skeleton',
              targetId: 'humanoid',
              targetPath: 'bones.0.a',
              keyframes: [
                { time: 0.0, value: 90, easing: 'linear' },
                { time: 1.0, value: 45, easing: 'ease-in-out' },
                { time: 2.0, value: 90, easing: 'linear' }
              ]
            },
            {
              targetType: 'skeleton', 
              targetId: 'humanoid',
              targetPath: 'bones.1.a',
              keyframes: [
                { time: 0.0, value: 0, easing: 'linear' },
                { time: 0.5, value: 15, easing: 'ease-out' },
                { time: 1.5, value: -10, easing: 'ease-in' },
                { time: 2.0, value: 0, easing: 'linear' }
              ]
            }
          ],
          metadata: {
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
            author: 'system'
          }
        }
        this.updateTimeRange()
        this.draw()
      }
    })

    // Subscribe to keyframe events from skeleton editor
    bus.on('skeleton:bone-transformed', this.handleSkeletonTransform.bind(this))
    bus.on('timeline:add-keyframes', this.handleAddKeyframes.bind(this))
  }

  loadTimelineData() {
    const timelineName = this.getAttribute('data-timeline') || 'default_timeline'
    console.log('Loading timeline data for:', timelineName)
    bus.emit(`cache:load:SELECT data FROM timeline_storage WHERE name = '${timelineName}'`)
  }

  updateTimeRange() {
    if (!this.timelineData) return

    // Calculate duration from keyframes
    let maxTime = 0
    this.timelineData.tracks?.forEach(track => {
      track.keyframes?.forEach(kf => {
        maxTime = Math.max(maxTime, kf.time)
      })
    })

    this.timelineData.duration = maxTime || 2.0
    this.viewSettings.timeRange.end = Math.max(maxTime * 1.2, 2.0) // Add 20% padding

    // Update UI
    this.querySelector('#duration').textContent = `${this.timelineData.duration.toFixed(2)}s`
  }

  // Playback methods
  play() {
    if (this.isPlaying) return

    this.isPlaying = true
    this.lastFrameTime = performance.now()
    this.animate()

    this.querySelector('#play-btn').classList.add('active')
    this.querySelector('#pause-btn').classList.remove('active')
  }

  pause() {
    this.isPlaying = false
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame)
    }

    this.querySelector('#play-btn').classList.remove('active')
    this.querySelector('#pause-btn').classList.add('active')
  }

  stop() {
    this.pause()
    this.currentTime = 0
    this.updatePlayhead()
    this.emitCurrentValues()

    this.querySelector('#play-btn').classList.remove('active')
    this.querySelector('#pause-btn').classList.remove('active')
  }

  toggleLoop() {
    this.loop = !this.loop
    this.querySelector('#loop-btn').classList.toggle('active', this.loop)
  }

  toggleRecording() {
    this.editorState.isRecording = !this.editorState.isRecording
    const recordBtn = this.querySelector('#record-btn')
    if (recordBtn) {
      recordBtn.classList.toggle('active', this.editorState.isRecording)
      recordBtn.style.backgroundColor = this.editorState.isRecording ? '#ff4444' : ''
    }
    
    if (this.editorState.isRecording) {
      console.log('Recording started - bone transformations will be captured')
      toast.success('Recording started - manipulate bones to create keyframes')
    } else {
      console.log('Recording stopped')
      toast.success('Recording stopped')
    }
  }

  animate() {
    if (!this.isPlaying) return
    if (!this.timelineData) return  // Guard against null timeline data

    const now = performance.now()
    const deltaTime = (now - this.lastFrameTime) / 1000 * this.playbackSpeed
    this.lastFrameTime = now

    this.currentTime += deltaTime

    // Handle looping or stopping at end
    if (this.currentTime >= this.timelineData.duration) {
      if (this.loop) {
        this.currentTime = 0
      } else {
        this.currentTime = this.timelineData.duration
        this.pause()
        return
      }
    }

    this.updatePlayhead()
    this.emitCurrentValues()

    this.animationFrame = requestAnimationFrame(() => this.animate())
  }

  updatePlayhead() {
    // Update time display
    const currentTimeElement = this.querySelector('#current-time')
    if (currentTimeElement) {
      currentTimeElement.textContent = `${this.currentTime.toFixed(2)}s`
    }

    // Trigger re-render to update playhead position
    this.draw()
  }

  emitCurrentValues() {
    if (!this.timelineData) return

    // Calculate interpolated values for current time
    this.timelineData.tracks?.forEach(track => {
      const value = this.interpolateValue(track, this.currentTime)
      if (value !== null) {
        bus.emit('timeline:value-changed', {
          timelineId: this.timelineData.name,
          trackId: track.targetPath,
          value: value,
          time: this.currentTime
        })
      }
    })
  }

  interpolateValue(track, time) {
    if (!track.keyframes || track.keyframes.length === 0) return null

    // Find surrounding keyframes
    let prevKeyframe = null
    let nextKeyframe = null

    for (let i = 0; i < track.keyframes.length - 1; i++) {
      if (track.keyframes[i].time <= time && track.keyframes[i + 1].time >= time) {
        prevKeyframe = track.keyframes[i]
        nextKeyframe = track.keyframes[i + 1]
        break
      }
    }

    // Handle edge cases
    if (!prevKeyframe && !nextKeyframe) {
      // Time is before first keyframe
      return track.keyframes[0].value
    } else if (!nextKeyframe) {
      // Time is after last keyframe
      return track.keyframes[track.keyframes.length - 1].value
    }

    // Interpolate between keyframes
    const duration = nextKeyframe.time - prevKeyframe.time
    const progress = (time - prevKeyframe.time) / duration

    // Apply easing function
    const easedProgress = this.applyEasing(progress, prevKeyframe.easing)

    // Linear interpolation (extend for different value types)
    return prevKeyframe.value + (nextKeyframe.value - prevKeyframe.value) * easedProgress
  }

  applyEasing(t, easingType = 'linear') {
    const easings = {
      linear: (t) => t,
      'ease-in': (t) => t * t,
      'ease-out': (t) => 1 - (1 - t) * (1 - t),
      'ease-in-out': (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
      'ease-in-cubic': (t) => t * t * t,
      'ease-out-cubic': (t) => 1 - Math.pow(1 - t, 3),
      'ease-in-out-cubic': (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    }

    return (easings[easingType] || easings.linear)(t)
  }

  // Event handlers
  handleSkeletonTransform(data) {
    // Auto-record keyframes when in record mode (even when not playing)
    if (this.editorState.isRecording && this.timelineData) {
      console.log('Recording bone transformation:', data)
      bus.emit('timeline:add-keyframes', {
        timelineId: this.timelineData.name,
        trackId: `skeleton.${data.skeletonId}.bones.${data.boneIndex}`,
        time: this.currentTime,
        value: data.transform
      })
    }
  }

  handleAddKeyframes(data) {
    if (data.timelineId !== this.timelineData?.name) return

    // Find or create track
    let track = this.timelineData.tracks.find(t => t.targetPath === data.trackId)
    if (!track) {
      track = {
        targetType: 'skeleton',
        targetId: data.skeletonId,
        targetPath: data.trackId,
        keyframes: []
      }
      this.timelineData.tracks.push(track)
    }

    // Add keyframe
    const keyframe = {
      time: data.time,
      value: data.value,
      easing: 'linear'
    }

    // Insert at correct time position
    const insertIndex = track.keyframes.findIndex(kf => kf.time > data.time)
    if (insertIndex === -1) {
      track.keyframes.push(keyframe)
    } else {
      track.keyframes.splice(insertIndex, 0, keyframe)
    }

    this.saveTimelineData()
    this.draw()
  }

  // Canvas interaction methods
  handleMouseDown(e) {
    super.handleMouseDown(e)
    
    const rect = this.canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // Convert to timeline coordinates
    const time = this.pxToTime(x)
    const trackIndex = this.pxToTrack(y)
    
    if (e.button === 0) {
      // Left click - select or create keyframe
      const keyframe = this.getKeyframeAt(time, trackIndex)
      if (keyframe) {
        this.selectKeyframe(keyframe)
      } else if (trackIndex >= 0) {
        this.createKeyframe(time, trackIndex)
      }
    } else if (e.button === 2) {
      // Right click - show context menu
      e.preventDefault()
      this.showContextMenu(time, trackIndex, e.clientX, e.clientY)
    }
  }

  handleMouseMove(e) {
    super.handleMouseMove(e)

    if (this.isDragging) {
      // Handle keyframe dragging
      const rect = this.canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const time = this.pxToTime(x)

      if (this.editorState.snapEnabled) {
        time = Math.round(time / this.editorState.snapTimeInterval) * this.editorState.snapTimeInterval
      }

      this.moveSelectedKeyframes(time)
    }
  }

  handleMouseUp(e) {
    super.handleMouseUp(e)

    if (this.isDragging) {
      this.saveTimelineData()
      this.isDragging = false
    }
  }

  handleKeyDown(e) {
    super.handleKeyDown(e)
    
    switch (e.key) {
      case ' ':
        e.preventDefault()
        this.isPlaying ? this.pause() : this.play()
        break
      case 'Escape':
        this.stop()
        break
      case 'Delete':
        this.deleteSelectedKeyframes()
        break
      case 'c':
        if (e.ctrlKey) this.copySelectedKeyframes()
        break
      case 'v':
        if (e.ctrlKey) this.pasteKeyframes()
        break
      case 'r':
        if (e.ctrlKey) {
          e.preventDefault()
          this.toggleRecording()
        }
        break
    }
  }

  // Coordinate conversion methods
  timeToPx(time) {
    const range = this.viewSettings.timeRange.end - this.viewSettings.timeRange.start
    const visibleWidth = this.canvas.width - this.viewSettings.headerWidth
    return this.viewSettings.headerWidth + (time - this.viewSettings.timeRange.start) / range * visibleWidth
  }

  pxToTime(px) {
    const range = this.viewSettings.timeRange.end - this.viewSettings.timeRange.start
    const visibleWidth = this.canvas.width - this.viewSettings.headerWidth
    return this.viewSettings.timeRange.start + (px - this.viewSettings.headerWidth) / visibleWidth * range
  }

  pxToTrack(py) {
    const trackY = py - this.viewSettings.rulerHeight
    return Math.floor(trackY / this.viewSettings.trackHeight)
  }

  // Rendering methods
  drawContent(ctx) {
    if (!this.timelineData) return

    ctx.save()

    // Draw time ruler
    this.drawTimeRuler(ctx)

    // Draw tracks
    this.drawTracks(ctx)

    // Draw keyframes
    this.drawKeyframes(ctx)

    // Draw playhead
    this.drawPlayhead(ctx)

    // Draw selection
    this.drawSelection(ctx)

    ctx.restore()
  }

  drawTimeRuler(ctx) {
    const { rulerHeight, headerWidth } = this.viewSettings

    // Ruler background
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-bg-secondary')
    ctx.fillRect(0, 0, this.canvas.width, rulerHeight)

    // Time marks
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-text-secondary')
    ctx.lineWidth = 1

    const timeStep = this.getTimeStep()
    for (let time = this.viewSettings.timeRange.start; time <= this.viewSettings.timeRange.end; time += timeStep) {
      const x = this.timeToPx(time)

      // Time mark
      ctx.beginPath()
      ctx.moveTo(x, rulerHeight - 5)
      ctx.lineTo(x, rulerHeight)
      ctx.stroke()

      // Time label
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-text-primary')
      ctx.font = '12px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`${time.toFixed(1)}s`, x, rulerHeight - 8)
    }
  }

  drawTracks(ctx) {
    const { trackHeight, headerWidth, rulerHeight } = this.viewSettings

    this.timelineData.tracks?.forEach((track, index) => {
      const y = rulerHeight + index * trackHeight

      // Track background
      ctx.fillStyle = index % 2 === 0 ?
        getComputedStyle(document.documentElement).getPropertyValue('--color-bg-primary') :
        getComputedStyle(document.documentElement).getPropertyValue('--color-bg-secondary')
      ctx.fillRect(0, y, this.canvas.width, trackHeight)

      // Track header
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-bg-tertiary')
      ctx.fillRect(0, y, headerWidth, trackHeight)

      // Track label
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-text-primary')
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'

      const label = this.getTrackLabel(track)
      ctx.fillText(label, 8, y + trackHeight / 2)
    })
  }

  drawKeyframes(ctx) {
    const { keyframeSize, trackHeight, rulerHeight } = this.viewSettings

    this.timelineData.tracks?.forEach((track, trackIndex) => {
      const trackY = rulerHeight + trackIndex * trackHeight + trackHeight / 2

      track.keyframes?.forEach((keyframe, keyframeIndex) => {
        const x = this.timeToPx(keyframe.time)

        // Keyframe shape based on easing type
        ctx.fillStyle = this.getKeyframeColor(keyframe, trackIndex)

        if (keyframe.easing === 'linear') {
          // Diamond for linear
          this.drawDiamond(ctx, x, trackY, keyframeSize)
        } else {
          // Circle for eased
          ctx.beginPath()
          ctx.arc(x, trackY, keyframeSize / 2, 0, Math.PI * 2)
          ctx.fill()
        }

        // Selection highlight
        if (this.editorState.selectedKeyframes.has(this.getKeyframeId(trackIndex, keyframeIndex))) {
          ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-accent')
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(x, trackY, keyframeSize / 2 + 2, 0, Math.PI * 2)
          ctx.stroke()
        }
      })
    })
  }

  drawPlayhead(ctx) {
    const x = this.timeToPx(this.currentTime)

    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-accent')
    ctx.lineWidth = 2

    // Playhead line
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, this.canvas.height)
    ctx.stroke()

    // Playhead head
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-accent')
    ctx.beginPath()
    ctx.moveTo(x - 6, 0)
    ctx.lineTo(x + 6, 0)
    ctx.lineTo(x, 8)
    ctx.closePath()
    ctx.fill()
  }

  drawSelection(ctx) {
    // Draw selection rectangle if dragging
    if (this.selectionRect) {
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-accent')
      ctx.lineWidth = 1
      ctx.setLineDash([5, 5])
      ctx.strokeRect(
        this.selectionRect.x,
        this.selectionRect.y,
        this.selectionRect.width,
        this.selectionRect.height
      )
      ctx.setLineDash([])
    }
  }

  // Helper methods
  getTimeStep() {
    const range = this.viewSettings.timeRange.end - this.viewSettings.timeRange.start
    if (range <= 1) return 0.1
    if (range <= 5) return 0.5
    if (range <= 10) return 1.0
    return Math.ceil(range / 10)
  }

  getTrackLabel(track) {
    // Extract readable name from target path
    const path = track.targetPath
    if (path.startsWith('skeleton.')) {
      const parts = path.split('.')
      if (parts.length >= 4 && parts[2] === 'bones') {
        return `Bone ${parts[3]}`
      }
    }
    return path || 'Unknown'
  }

  getKeyframeColor(keyframe, trackIndex) {
    const baseColor = getComputedStyle(document.documentElement).getPropertyValue('--color-text-primary')
    return keyframe.easing === 'linear' ? baseColor : '#4CAF50'
  }

  drawDiamond(ctx, x, y, size) {
    ctx.beginPath()
    ctx.moveTo(x, y - size / 2)
    ctx.lineTo(x + size / 2, y)
    ctx.lineTo(x, y + size / 2)
    ctx.lineTo(x - size / 2, y)
    ctx.closePath()
    ctx.fill()
  }

  getKeyframeId(trackIndex, keyframeIndex) {
    return `${trackIndex}-${keyframeIndex}`
  }

  getKeyframeAt(time, trackIndex) {
    if (!this.timelineData || trackIndex >= this.timelineData.tracks.length) return null

    const track = this.timelineData.tracks[trackIndex]
    if (!track.keyframes) return null

    // Find closest keyframe within snap distance
    const snapDistance = 0.1 // seconds
    let closestKeyframe = null
    let closestDistance = Infinity

    track.keyframes.forEach((keyframe, index) => {
      const distance = Math.abs(keyframe.time - time)
      if (distance < closestDistance && distance < snapDistance) {
        closestDistance = distance
        closestKeyframe = { keyframe, trackIndex, keyframeIndex: index }
      }
    })

    return closestKeyframe
  }

  selectKeyframe(keyframeInfo) {
    const id = this.getKeyframeId(keyframeInfo.trackIndex, keyframeInfo.keyframeIndex)

    if (event.ctrlKey) {
      // Multi-select
      if (this.editorState.selectedKeyframes.has(id)) {
        this.editorState.selectedKeyframes.delete(id)
      } else {
        this.editorState.selectedKeyframes.add(id)
      }
    } else {
      // Single select
      this.editorState.selectedKeyframes.clear()
      this.editorState.selectedKeyframes.add(id)
    }

    this.draw()
  }

  createKeyframe(time, trackIndex) {
    if (!this.timelineData || trackIndex >= this.timelineData.tracks.length) return

    const track = this.timelineData.tracks[trackIndex]
    const keyframe = {
      time: time,
      value: 0, // Default value - should be determined from current state
      easing: 'linear'
    }

    // Insert at correct time position
    const insertIndex = track.keyframes.findIndex(kf => kf.time > time)
    if (insertIndex === -1) {
      track.keyframes.push(keyframe)
    } else {
      track.keyframes.splice(insertIndex, 0, keyframe)
    }

    this.saveTimelineData()
    this.draw()

    // Open keyframe editor
    this.editKeyframe(trackIndex, insertIndex === -1 ? track.keyframes.length - 1 : insertIndex)
  }

  editKeyframe(trackIndex, keyframeIndex) {
    const track = this.timelineData.tracks[trackIndex]
    const keyframe = track.keyframes[keyframeIndex]

    const editorContent = this.createKeyframeEditor(keyframe, (updatedKeyframe) => {
      track.keyframes[keyframeIndex] = updatedKeyframe
      this.saveTimelineData()
      this.draw()
      const popupManager = this.closest('popup-manager')
      if (popupManager) popupManager.closePopup()
    })

    const popupManager = this.closest('popup-manager')
    if (popupManager) {
      popupManager.showPopup({
        title: 'Edit Keyframe',
        content: editorContent,
        size: 'medium'
      })
    }
  }

  showContextMenu(time, trackIndex, clientX, clientY) {
    // Create context menu with timeline-specific options
    const menuItems = [
      {
        label: 'Add Keyframe',
        action: () => this.createKeyframe(time, trackIndex)
      },
      {
        label: 'Add Keyframe at Current Time',
        action: () => this.createKeyframe(this.currentTime, trackIndex)
      },
      {
        label: 'Split Track',
        action: () => this.splitTrack(trackIndex)
      }
    ]
    
    // Add track-specific options
    if (trackIndex >= 0 && this.timelineData?.tracks[trackIndex]) {
      menuItems.push(
        {
          label: 'Delete Track',
          action: () => this.deleteTrack(trackIndex)
        },
        {
          label: 'Rename Track',
          action: () => this.renameTrack(trackIndex)
        }
      )
    }
    
    // Show context menu using popup manager
    const menuElement = this.createContextMenu(menuItems, clientX, clientY)
    const popupManager = this.closest('popup-manager')
    if (popupManager) {
      popupManager.showPopup({
        title: 'Timeline Actions',
        content: menuElement,
        size: 'small'
      })
    }
  }

  createContextMenu(menuItems, x, y) {
    const menu = document.createElement('div')
    menu.className = 'timeline-context-menu'
    menu.style.cssText = `
      background: var(--color-semantic-bg-primary);
      border: 1px solid var(--color-semantic-border-default);
      border-radius: var(--border-radius-sm);
      padding: var(--spacing-scale-1);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      min-width: 150px;
    `
    
    menuItems.forEach(item => {
      const menuItem = document.createElement('div')
      menuItem.className = 'context-menu-item'
      menuItem.textContent = item.label
      menuItem.style.cssText = `
        padding: var(--spacing-scale-2) var(--spacing-scale-3);
        cursor: pointer;
        border-radius: var(--border-radius-sm);
        margin: var(--spacing-scale-1) 0;
        transition: background-color 0.2s;
      `
      
      menuItem.addEventListener('mouseenter', () => {
        menuItem.style.backgroundColor = 'var(--color-semantic-bg-secondary)'
      })
      
      menuItem.addEventListener('mouseleave', () => {
        menuItem.style.backgroundColor = 'transparent'
      })
      
      menuItem.addEventListener('click', () => {
        const popupManager = this.closest('popup-manager')
        if (popupManager) popupManager.closePopup()
        item.action()
      })
      
      menu.appendChild(menuItem)
    })
    
    return menu
  }

  createKeyframeEditor(keyframe, onApply) {
    const container = document.createElement('div')
    container.className = 'keyframe-editor'
    container.innerHTML = `
      <div class="form-group">
        <label>Time:</label>
        <input type="number" id="keyframe-time" value="${keyframe.time}" step="0.01" min="0" />
      </div>
      <div class="form-group">
        <label>Value:</label>
        <input type="number" id="keyframe-value" value="${keyframe.value}" step="0.1" />
      </div>
      <div class="form-group">
        <label>Easing:</label>
        <select id="keyframe-easing">
          <option value="linear" ${keyframe.easing === 'linear' ? 'selected' : ''}>Linear</option>
          <option value="ease-in" ${keyframe.easing === 'ease-in' ? 'selected' : ''}>Ease In</option>
          <option value="ease-out" ${keyframe.easing === 'ease-out' ? 'selected' : ''}>Ease Out</option>
          <option value="ease-in-out" ${keyframe.easing === 'ease-in-out' ? 'selected' : ''}>Ease In-Out</option>
        </select>
      </div>
      <div class="form-actions">
        <button class="button-primary" id="apply-btn">Apply</button>
        <button class="button-secondary" id="cancel-btn">Cancel</button>
      </div>
    `
    
    container.querySelector('#apply-btn').addEventListener('click', () => {
      const updatedKeyframe = {
        time: parseFloat(container.querySelector('#keyframe-time').value),
        value: parseFloat(container.querySelector('#keyframe-value').value),
        easing: container.querySelector('#keyframe-easing').value
      }
      onApply(updatedKeyframe)
    })
    
    container.querySelector('#cancel-btn').addEventListener('click', () => {
      const popupManager = this.closest('popup-manager')
      if (popupManager) popupManager.closePopup()
    })
    
    return container
  }

  deleteSelectedKeyframes() {
    if (this.editorState.selectedKeyframes.size === 0) return
    
    // Convert selected IDs to track/keyframe indices
    const toDelete = Array.from(this.editorState.selectedKeyframes).map(id => {
      const [trackIndex, keyframeIndex] = id.split('-').map(Number)
      return { trackIndex, keyframeIndex }
    })
    
    // Sort in reverse order to delete from end first
    toDelete.sort((a, b) => b.keyframeIndex - a.keyframeIndex)
    
    // Delete keyframes
    toDelete.forEach(({ trackIndex, keyframeIndex }) => {
      if (this.timelineData.tracks[trackIndex]) {
        this.timelineData.tracks[trackIndex].keyframes.splice(keyframeIndex, 1)
      }
    })
    
    this.editorState.selectedKeyframes.clear()
    this.saveTimelineData()
    this.draw()
    
    toast.success(`Deleted ${toDelete.length} keyframe(s)`)
  }

  copySelectedKeyframes() {
    if (this.editorState.selectedKeyframes.size === 0) {
      toast.warning('No keyframes selected to copy')
      return
    }
    
    // Convert selected IDs to actual keyframe data
    const copiedKeyframes = []
    this.editorState.selectedKeyframes.forEach(id => {
      const [trackIndex, keyframeIndex] = id.split('-').map(Number)
      if (this.timelineData.tracks[trackIndex] && this.timelineData.tracks[trackIndex].keyframes[keyframeIndex]) {
        copiedKeyframes.push({
          trackIndex,
          keyframe: { ...this.timelineData.tracks[trackIndex].keyframes[keyframeIndex] }
        })
      }
    })
    
    this.editorState.clipboard = copiedKeyframes
    toast.success(`Copied ${copiedKeyframes.length} keyframe(s)`)
  }

  pasteKeyframes() {
    if (!this.editorState.clipboard || this.editorState.clipboard.length === 0) {
      toast.warning('No keyframes in clipboard')
      return
    }
    
    const pasteTime = this.currentTime
    
    this.editorState.clipboard.forEach(({ trackIndex, keyframe }) => {
      if (this.timelineData.tracks[trackIndex]) {
        const newKeyframe = {
          ...keyframe,
          time: pasteTime + (keyframe.time - this.editorState.clipboard[0].keyframe.time) // Maintain relative timing
        }
        
        // Insert at correct time position
        const insertIndex = this.timelineData.tracks[trackIndex].keyframes.findIndex(kf => kf.time > newKeyframe.time)
        if (insertIndex === -1) {
          this.timelineData.tracks[trackIndex].keyframes.push(newKeyframe)
        } else {
          this.timelineData.tracks[trackIndex].keyframes.splice(insertIndex, 0, newKeyframe)
        }
      }
    })
    
    this.saveTimelineData()
    this.draw()
    toast.success(`Pasted ${this.editorState.clipboard.length} keyframe(s)`)
  }

  splitTrack(trackIndex) {
    if (!this.timelineData || !this.timelineData.tracks[trackIndex]) return
    
    const track = this.timelineData.tracks[trackIndex]
    const currentTime = this.currentTime
    
    // Find keyframes before and after current time
    const beforeKeyframes = track.keyframes.filter(kf => kf.time <= currentTime)
    const afterKeyframes = track.keyframes.filter(kf => kf.time > currentTime)
    
    // Create new track for after keyframes
    const newTrack = {
      targetType: track.targetType,
      targetId: track.targetId,
      targetPath: track.targetPath + '_split',
      keyframes: afterKeyframes.map(kf => ({...kf, time: kf.time - currentTime}))
    }
    
    // Update original track to only have before keyframes
    track.keyframes = beforeKeyframes
    
    // Add new track
    this.timelineData.tracks.splice(trackIndex + 1, 0, newTrack)
    
    this.saveTimelineData()
    this.draw()
    toast.success('Track split successfully')
  }

  deleteTrack(trackIndex) {
    if (!this.timelineData || !this.timelineData.tracks[trackIndex]) return
    
    const trackName = this.getTrackLabel(this.timelineData.tracks[trackIndex])
    this.timelineData.tracks.splice(trackIndex, 1)
    
    this.saveTimelineData()
    this.draw()
    toast.success(`Deleted track: ${trackName}`)
  }

  renameTrack(trackIndex) {
    if (!this.timelineData || !this.timelineData.tracks[trackIndex]) return
    
    const track = this.timelineData.tracks[trackIndex]
    const currentName = this.getTrackLabel(track)
    
    // Show rename dialog
    const newName = prompt(`Enter new name for track "${currentName}":`, currentName)
    if (newName && newName !== currentName) {
      // Update the target path to reflect new name
      track.targetPath = newName.toLowerCase().replace(/\s+/g, '_')
      this.saveTimelineData()
      this.draw()
      toast.success(`Renamed track to: ${newName}`)
    }
  }

  // Required ViewCanvasBase methods
  getSelectQuery() {
    const timelineName = this.getAttribute('data-timeline') || 'default_timeline'
    return `SELECT data FROM timeline_storage WHERE name = '${timelineName}'`
  }

  getInsertQueryFn() {
    return (name, data) => `INSERT OR REPLACE INTO timeline_storage (name, data) VALUES ('${name}', '${data}')`
  }

  calculateContentBounds() {
    if (!this.timelineData) {
      return { minX: 0, minY: 0, maxX: 100, maxY: 100 }
    }

    const trackCount = this.timelineData.tracks?.length || 0
    const { headerWidth, rulerHeight, trackHeight } = this.viewSettings
    const { timeRange } = this.viewSettings

    return {
      minX: 0,
      minY: 0,
      maxX: headerWidth + (timeRange.end - timeRange.start) * 100, // 100px per second
      maxY: rulerHeight + trackCount * trackHeight + 50
    }
  }

  saveTimelineData() {
    if (!this.timelineData) return

    const timelineName = this.getAttribute('data-timeline') || 'default_timeline'
    const data = JSON.stringify(this.timelineData)

    bus.emit('cache:save', {
      selectQuery: this.getSelectQuery(),
      insertQueryFn: this.getInsertQueryFn(),
      name: timelineName,
      data: data
    })
  }
}

customElements.define('view-timeline', ViewTimeline)
