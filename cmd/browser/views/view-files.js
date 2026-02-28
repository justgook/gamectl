import { bus } from "../systems/event-bus.js"
import { toast } from "../systems/toast.js"
import { createWriteInput } from "../util/fs.js"
import { getHandler, getAllHandlers } from './files/file-handlers.js'

// Import handlers to register them (must be after file-handlers.js)
import './files/handlers/default-handler.js'
import './files/handlers/text-handler.js'
import './files/handlers/image-handler.js'
import './files/handlers/qoi-handler.js'

/**
 * ViewFiles - macOS Finder-style file browser with tree view
 * 
 * Uses window.pluginManager.call("fs", ...) for filesystem operations.
 * This allows the fs implementation to be swapped (JS host -> WASM plugin) in the future.
 * 
 * Usage:
 * <view-files
 *   data-root="/"              <!-- Starting directory (default: "/") -->
 *   data-show-hidden="false"   <!-- Show hidden files starting with . -->
 * ></view-files>
 * 
 * Features:
 * - Tree-style expandable folders (like Finder List view)
 * - File metadata columns (name, date modified, size, kind)
 * - File operations: create, delete, rename
 * - Pluggable file type handlers for preview/edit
 */
export class ViewFiles extends HTMLElement {
  static get viewMeta() { return { displayName: 'File Browser', category: 'Utilities' } }

  static observedAttributes = ['data-root', 'data-show-hidden', 'data-mode', 'data-filter', 'data-select-folders', 'data-multi-select', 'data-default-name']

  constructor() {
    super()

    // State
    this.rootPath = '/'
    this.showHidden = false
    this.expandedPaths = new Set()
    this.selectedPath = null
    this.editingPath = null
    this.draggedPath = null

    // Chooser mode state
    this.mode = 'browser' // 'browser' | 'chooser' | 'saver' | 'folder-select'
    this.filter = null // e.g., "*.png,*.qoi,*.jpg"
    this.selectFolders = false
    this.multiSelect = false
    this.chooserSelection = new Set() // For multi-select mode

    // Saver mode state
    this.defaultName = '' // Default filename for saver mode
    this.currentDirectory = '/' // Currently selected directory for saving
    this.filenameInput = null // Reference to filename input element

    // File tree data: Map<path, {name, type, size, children: []}>
    this.fileTree = new Map()

    // Containers
    this.toolbar = null
    this.treeContainer = null
    this.statusBar = null
    this.chooserActions = null

    // Decoder for fs plugin responses
    this.decoder = new TextDecoder()
  }

  connectedCallback() {
    this.style.display = 'flex'
    this.style.flexDirection = 'column'
    this.style.flex = '1'
    this.setAttribute('tabindex', '0')

    // Get template
    const template = document.getElementById('view-files')
    if (template) {
      const content = template.content.cloneNode(true)
      this.appendChild(content)
    } else {
      // Fallback inline structure
      this.innerHTML = `
        <div data-element="toolbar">
          <button data-action="refresh" title="Refresh">Refresh</button>
          <button data-action="new-file" title="New File">+ File</button>
          <button data-action="new-folder" title="New Folder">+ Folder</button>
          <button data-action="delete" title="Delete">Delete</button>
          <button data-action="upload" title="Upload File">Upload</button>
          <button data-action="download" title="Download File">Download</button>
          <span data-element="path-display">/</span>
        </div>
        <div data-element="tree-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Date Modified</th>
                <th>Size</th>
                <th>Kind</th>
              </tr>
            </thead>
            <tbody data-element="tree-body"></tbody>
          </table>
        </div>
        <div data-element="status"></div>
      `
    }

    // Cache element references
    this.toolbar = this.querySelector('[data-element="toolbar"]')
    this.treeContainer = this.querySelector('[data-element="tree-container"]')
    this.treeBody = this.querySelector('[data-element="tree-body"]')
    this.statusBar = this.querySelector('[data-element="status"]')
    this.pathDisplay = this.querySelector('[data-element="path-display"]')

    // Parse attributes
    this.rootPath = this.getAttribute('data-root') || '/'
    this.showHidden = this.getAttribute('data-show-hidden') === 'true'
    this.mode = this.getAttribute('data-mode') || 'browser'
    this.filter = this.getAttribute('data-filter') || null
    this.selectFolders = this.getAttribute('data-select-folders') === 'true'
    this.multiSelect = this.getAttribute('data-multi-select') === 'true'

    // Apply chooser mode if set
    if (this.mode === 'chooser') {
      this.setupChooserMode()
    } else if (this.mode === 'saver') {
      this.setupSaverMode()
    } else if (this.mode === 'folder-select') {
      this.setupFolderSelectMode()
    }

    // Setup event handlers
    this.setupEventHandlers()

    // Focus management
    this.addEventListener('focusin', () => {
      bus.emit('view:focus', { view: 'view-files', mode: 'files' })
    })
    this.addEventListener('focusout', () => {
      bus.emit('view:blur', { view: 'view-files', mode: 'files' })
    })

    // Keyboard navigation
    this.addEventListener('keydown', (e) => this.handleKeyDown(e))

    // Initial load
    this.refresh()
  }

  disconnectedCallback() {
    // Cleanup if needed
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue && this.treeContainer) {
      if (name === 'data-root') {
        this.rootPath = newValue || '/'
        this.expandedPaths.clear()
        this.refresh()
      } else if (name === 'data-show-hidden') {
        this.showHidden = newValue === 'true'
        this.refresh()
      } else if (name === 'data-mode') {
        this.mode = newValue || 'browser'
        if (this.mode === 'chooser') {
          this.setupChooserMode()
        }
      } else if (name === 'data-filter') {
        this.filter = newValue || null
        this.render()
      } else if (name === 'data-select-folders') {
        this.selectFolders = newValue === 'true'
      } else if (name === 'data-multi-select') {
        this.multiSelect = newValue === 'true'
        this.chooserSelection.clear()
        this.render()
      } else if (name === 'data-default-name') {
        this.defaultName = newValue || ''
        if (this.filenameInput) {
          this.filenameInput.value = this.defaultName
        }
      }
    }
  }

  /**
   * Setup chooser mode UI modifications
   */
  setupChooserMode() {
    // Hide file operation buttons in chooser mode
    const hideActions = ['new-file', 'new-folder', 'delete', 'upload', 'download']
    hideActions.forEach(action => {
      const btn = this.toolbar?.querySelector(`[data-action="${action}"]`)
      if (btn) btn.hidden = true
    })

    // Add chooser action bar if not already present
    if (!this.chooserActions) {
      this.chooserActions = document.createElement('div')
      this.chooserActions.innerHTML = `
        <span data-element="chooser-selection-info" ></span>
        <div>
          <button data-action="cancel">Cancel</button>
          <button data-action="select" disabled>Select</button>
        </div>
      `
      this.appendChild(this.chooserActions)

      // Bind chooser action buttons
      this.chooserActions.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('chooser-cancel', { bubbles: true }))
      })

      this.chooserActions.querySelector('[data-action="select"]')?.addEventListener('click', () => {
        const selection = this.getSelection()
        this.dispatchEvent(new CustomEvent('chooser-select', {
          bubbles: true,
          detail: { selection }
        }))
      })
    }

    this.updateChooserUI()
  }

  /**
   * Setup saver mode UI modifications
   * Saver mode allows navigating folders, creating new folders, and entering a filename
   */
  setupSaverMode() {
    // Hide file operation buttons except new-folder
    const hideActions = ['new-file', 'delete', 'upload', 'download']
    hideActions.forEach(action => {
      const btn = this.toolbar?.querySelector(`[data-action="${action}"]`)
      if (btn) btn.hidden = true
    })

    // Set initial directory
    this.currentDirectory = this.rootPath

    // Add saver action bar if not already present
    if (!this.chooserActions) {
      this.chooserActions = document.createElement('div')
      this.chooserActions.innerHTML = `
        <div>
          <span>Save to:</span>
          <span data-element="saver-path">${this.currentDirectory}</span>
        </div>
        <div>
          <span>Filename:</span>
          <input type="text" data-element="filename-input" placeholder="Enter filename..." value="${this.defaultName || ''}">
        </div>
        <div>
          <button data-action="cancel">Cancel</button>
          <button data-action="save" ${!this.defaultName ? 'disabled' : ''}>Save</button>
        </div>
      `
      this.appendChild(this.chooserActions)

      // Cache filename input reference
      this.filenameInput = this.chooserActions.querySelector('[data-element="filename-input"]')
      this.saverPathDisplay = this.chooserActions.querySelector('[data-element="saver-path"]')

      // Bind events
      this.chooserActions.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('saver-cancel', { bubbles: true }))
      })

      this.chooserActions.querySelector('[data-action="save"]')?.addEventListener('click', () => {
        this.confirmSave()
      })

      // Update save button state on filename change
      this.filenameInput?.addEventListener('input', () => {
        this.updateSaverUI()
      })

      // Enter key confirms save
      this.filenameInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          this.confirmSave()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          this.dispatchEvent(new CustomEvent('saver-cancel', { bubbles: true }))
        }
      })
    }

    this.updateSaverUI()
  }

  /**
   * Setup folder-select mode UI modifications
   * Similar to chooser but only folders are selectable
   */
  setupFolderSelectMode() {
    // Hide all file operation buttons except new-folder
    const hideActions = ['new-file', 'delete', 'upload', 'download']
    hideActions.forEach(action => {
      const btn = this.toolbar?.querySelector(`[data-action="${action}"]`)
      if (btn) btn.hidden = true
    })

    this.selectFolders = true
    this.currentDirectory = this.rootPath

    // Add folder select action bar if not already present
    if (!this.chooserActions) {
      this.chooserActions = document.createElement('div')
      this.chooserActions.innerHTML = `
        <div>
          <span>Selected folder:</span>
          <span data-element="saver-path">${this.currentDirectory}</span>
        </div>
        <div>
          <button data-action="cancel">Cancel</button>
          <button data-action="select">Select Folder</button>
        </div>
      `
      this.appendChild(this.chooserActions)

      this.saverPathDisplay = this.chooserActions.querySelector('[data-element="saver-path"]')

      // Bind folder select action buttons
      this.chooserActions.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('chooser-cancel', { bubbles: true }))
      })

      this.chooserActions.querySelector('[data-action="select"]')?.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('chooser-select', {
          bubbles: true,
          detail: { selection: { path: this.currentDirectory, name: this.getPathName(this.currentDirectory), type: 'directory' } }
        }))
      })
    }

    this.updateFolderSelectUI()
  }

  /**
   * Get the name portion of a path
   */
  getPathName(path) {
    if (path === '/') return '/'
    const parts = path.split('/')
    return parts[parts.length - 1] || '/'
  }

  /**
   * Update saver UI state
   */
  updateSaverUI() {
    if (!this.chooserActions) return

    const saveBtn = this.chooserActions.querySelector('[data-action="save"]')
    const filename = this.filenameInput?.value?.trim() || ''

    // Update path display
    if (this.saverPathDisplay) {
      this.saverPathDisplay.textContent = this.currentDirectory
    }

    // Enable save button only if filename is provided
    if (saveBtn) {
      saveBtn.disabled = !filename
    }
  }

  /**
   * Update folder select UI state
   */
  updateFolderSelectUI() {
    if (!this.chooserActions) return

    // Update path display
    if (this.saverPathDisplay) {
      this.saverPathDisplay.textContent = this.currentDirectory
    }
  }

  /**
   * Confirm save action in saver mode
   */
  confirmSave() {
    const filename = this.filenameInput?.value?.trim()
    if (!filename) return

    const fullPath = this.currentDirectory === '/'
      ? `/${filename}`
      : `${this.currentDirectory}/${filename}`

    this.dispatchEvent(new CustomEvent('saver-save', {
      bubbles: true,
      detail: {
        path: fullPath,
        name: filename,
        directory: this.currentDirectory
      }
    }))
  }

  /**
   * Update chooser UI state (selection info, button state)
   */
  updateChooserUI() {
    if (!this.chooserActions) return

    const selectBtn = this.chooserActions.querySelector('[data-action="select"]')
    const selectionInfo = this.chooserActions.querySelector('[data-element="chooser-selection-info"]')

    if (this.multiSelect) {
      const count = this.chooserSelection.size
      selectionInfo.textContent = count > 0 ? `${count} item${count > 1 ? 's' : ''} selected` : ''
      selectBtn.disabled = count === 0
    } else {
      selectionInfo.textContent = this.selectedPath ? this.findItem(this.selectedPath)?.name || '' : ''
      const canSelect = this.selectedPath && this.isSelectable(this.selectedPath)
      selectBtn.disabled = !canSelect
    }

    // Emit selection-changed event
    this.dispatchEvent(new CustomEvent('selection-changed', {
      bubbles: true,
      detail: { selection: this.getSelection() }
    }))
  }

  /**
   * Check if a path is selectable based on current filter and settings
   */
  isSelectable(path) {
    const item = this.findItem(path)
    if (!item) return false

    // Check folder selection
    if (item.type === 'directory') {
      return this.selectFolders
    }

    // Check file filter
    return this.matchesFilter(item.name)
  }

  /**
   * Check if filename matches the current filter
   */
  matchesFilter(filename) {
    if (!this.filter) return true

    const patterns = this.filter.split(',').map(p => p.trim().toLowerCase())
    const filenameLower = filename.toLowerCase()

    return patterns.some(pattern => {
      // Convert glob pattern to regex: *.png -> \.png$
      const regexStr = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
      const regex = new RegExp(regexStr + '$', 'i')
      return regex.test(filenameLower)
    })
  }

  /**
   * Get current selection (single item or array for multi-select)
   */
  getSelection() {
    if (this.multiSelect) {
      return Array.from(this.chooserSelection).map(path => {
        const item = this.findItem(path)
        return item ? { path: item.path, name: item.name, type: item.type } : null
      }).filter(Boolean)
    } else {
      const item = this.findItem(this.selectedPath)
      if (item && this.isSelectable(this.selectedPath)) {
        return { path: item.path, name: item.name, type: item.type }
      }
      return null
    }
  }

  /**
   * Toggle selection for multi-select mode
   */
  toggleChooserSelection(path) {
    if (!this.isSelectable(path)) return

    if (this.chooserSelection.has(path)) {
      this.chooserSelection.delete(path)
    } else {
      this.chooserSelection.add(path)
    }
    this.render()
    this.updateChooserUI()
  }

  setupEventHandlers() {
    // Toolbar buttons
    this.toolbar?.querySelector('[data-action="refresh"]')?.addEventListener('click', () => this.refresh())
    this.toolbar?.querySelector('[data-action="new-file"]')?.addEventListener('click', () => this.createFile())
    this.toolbar?.querySelector('[data-action="new-folder"]')?.addEventListener('click', () => this.createFolder())
    this.toolbar?.querySelector('[data-action="delete"]')?.addEventListener('click', () => this.deleteSelected())
    this.toolbar?.querySelector('[data-action="upload"]')?.addEventListener('click', () => this.uploadFile())
    this.toolbar?.querySelector('[data-action="download"]')?.addEventListener('click', () => this.downloadSelected())

    // Tree clicks delegated
    this.treeBody?.addEventListener('click', (e) => this.handleTreeClick(e))
    this.treeBody?.addEventListener('dblclick', (e) => this.handleTreeDoubleClick(e))

    // Drag and drop for internal file moving
    this.treeBody?.addEventListener('dragstart', (e) => this.handleDragStart(e))
    this.treeBody?.addEventListener('dragover', (e) => this.handleDragOver(e))
    this.treeBody?.addEventListener('dragleave', (e) => this.handleDragLeave(e))
    this.treeBody?.addEventListener('drop', (e) => this.handleDrop(e))
    this.treeBody?.addEventListener('dragend', (e) => this.handleDragEnd(e))

    // External file drop (from desktop)
    this.treeContainer?.addEventListener('dragover', (e) => this.handleExternalDragOver(e))
    this.treeContainer?.addEventListener('dragleave', (e) => this.handleExternalDragLeave(e))
    this.treeContainer?.addEventListener('drop', (e) => this.handleExternalDrop(e))
  }

  handleKeyDown(e) {
    // Handle rename mode
    if (this.editingPath) {
      if (e.key === 'Escape') {
        this.cancelRename()
        e.preventDefault()
      } else if (e.key === 'Enter') {
        this.commitRename()
        e.preventDefault()
      }
      return
    }

    // Navigation and actions
    switch (e.key) {
      case 'F2':
        if (this.selectedPath) {
          this.startRename(this.selectedPath)
        }
        e.preventDefault()
        break
      case 'Delete':
        if (this.selectedPath) {
          this.deleteSelected()
        }
        e.preventDefault()
        break
      case 'Enter':
        if (this.selectedPath) {
          this.openSelected()
        }
        e.preventDefault()
        break
      case 'ArrowRight':
        if (this.selectedPath) {
          this.expandPath(this.selectedPath)
        }
        e.preventDefault()
        break
      case 'ArrowLeft':
        if (this.selectedPath) {
          this.collapsePath(this.selectedPath)
        }
        e.preventDefault()
        break
      case 'ArrowDown':
        this.selectNext()
        e.preventDefault()
        break
      case 'ArrowUp':
        this.selectPrevious()
        e.preventDefault()
        break
    }
  }

  // --- File System Operations via Plugin Manager ---

  /**
   * Call fs plugin through pluginManager
   * @param {string} fn - Function name (list, stat, read, write, mkdir, rmdir, delete, exists)
   * @param {string} input - Input string (usually path)
   * @returns {Promise<{returnCode: number, output: Uint8Array}>}
   */
  async fsCall(fn, input) {
    return await window.pluginManager.call('fs', fn, input)
  }

  async refresh() {
    this.setStatus('Loading...')
    try {
      await this.loadDirectory(this.rootPath)
      this.render()
      this.updatePathDisplay()
      this.updateStatus()
    } catch (error) {
      toast.error(error.message)
      console.error('ViewFiles refresh error:', error)
    }
  }

  async loadDirectory(dirPath) {
    const result = await this.fsCall('list', dirPath)
    if (result.returnCode !== 0) {
      throw new Error(this.decoder.decode(result.output))
    }

    const entries = JSON.parse(this.decoder.decode(result.output))
    const children = []

    for (const name of entries) {
      // Skip hidden files if not showing them
      if (!this.showHidden && name.startsWith('.')) continue

      const fullPath = dirPath === '/' ? `/${name}` : `${dirPath}/${name}`
      const statResult = await this.fsCall('stat', fullPath)

      let info = { name, path: fullPath, type: 'file', size: 0 }
      if (statResult.returnCode === 0) {
        const stat = JSON.parse(this.decoder.decode(statResult.output))
        info.type = stat.type
        info.size = stat.size
      }

      children.push(info)

      // If this path was expanded, recursively load its children
      if (info.type === 'directory' && this.expandedPaths.has(fullPath)) {
        try {
          info.children = await this.loadDirectoryChildren(fullPath)
        } catch (e) {
          console.warn(`Failed to load ${fullPath}:`, e)
          info.children = []
        }
      }
    }

    // Sort: folders first, then alphabetically
    children.sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1
      if (a.type !== 'directory' && b.type === 'directory') return 1
      return a.name.localeCompare(b.name)
    })

    this.fileTree.set(dirPath, children)
    return children
  }

  async loadDirectoryChildren(dirPath) {
    const result = await this.fsCall('list', dirPath)
    if (result.returnCode !== 0) {
      return []
    }

    const entries = JSON.parse(this.decoder.decode(result.output))
    const children = []

    for (const name of entries) {
      if (!this.showHidden && name.startsWith('.')) continue

      const fullPath = `${dirPath}/${name}`
      const statResult = await this.fsCall('stat', fullPath)

      let info = { name, path: fullPath, type: 'file', size: 0 }
      if (statResult.returnCode === 0) {
        const stat = JSON.parse(this.decoder.decode(statResult.output))
        info.type = stat.type
        info.size = stat.size
      }

      children.push(info)

      // Recursively load expanded paths
      if (info.type === 'directory' && this.expandedPaths.has(fullPath)) {
        info.children = await this.loadDirectoryChildren(fullPath)
      }
    }

    children.sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1
      if (a.type !== 'directory' && b.type === 'directory') return 1
      return a.name.localeCompare(b.name)
    })

    return children
  }

  // --- Rendering ---

  render() {
    if (!this.treeBody) return

    this.treeBody.innerHTML = ''
    const rootChildren = this.fileTree.get(this.rootPath) || []
    this.renderItems(rootChildren, 0)
  }

  renderItems(items, depth) {
    for (const item of items) {
      this.renderRow(item, depth)

      // Render children if expanded
      if (item.type === 'directory' && this.expandedPaths.has(item.path) && item.children) {
        this.renderItems(item.children, depth + 1)
      }
    }
  }

  renderRow(item, depth) {
    const tr = document.createElement('tr')
    tr.dataset.element = 'file-row'
    tr.dataset.path = item.path
    tr.dataset.type = item.type
    tr.draggable = this.mode !== 'chooser' // Disable drag in chooser mode

    // Check if selectable in chooser mode
    const isSelectable = this.mode === 'chooser' ? this.isSelectable(item.path) : true
    const isChooserSelected = this.multiSelect && this.chooserSelection.has(item.path)

    this.applyRowStateStyle(tr, {
      selected: item.path === this.selectedPath,
      chooserSelected: isChooserSelected,
      chooserDisabled: this.mode === 'chooser' && !isSelectable
    })

    const isExpanded = this.expandedPaths.has(item.path)
    const handler = getHandler(item.name)

    // Name column with indent, chevron, and icon
    const tdName = document.createElement('td')

    const indent = document.createElement('span')
    indent.style.display = 'inline-block'
    indent.style.width = `${depth * 20}px`
    tdName.appendChild(indent)

    // Multi-select checkbox
    if (this.mode === 'chooser' && this.multiSelect && isSelectable) {
      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.checked = isChooserSelected
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation()
        this.toggleChooserSelection(item.path)
      })
      tdName.appendChild(checkbox)
    }

    if (item.type === 'directory') {
      const chevron = this.createIconElement(isExpanded ? 'expand_more' : 'chevron_right')
      chevron.dataset.action = 'toggle'
      tdName.appendChild(chevron)
    } else {
      // Spacer for files
      const spacer = document.createElement('span')
      spacer.textContent = ' '
      tdName.appendChild(spacer)
    }

    const icon = this.createIconElement(item.type === 'directory' ? 'folder' : handler.icon)
    tdName.appendChild(icon)
    tdName.appendChild(document.createTextNode(' '))

    const nameSpan = document.createElement('span')
    nameSpan.dataset.element = 'file-name'
    nameSpan.textContent = item.name
    tdName.appendChild(nameSpan)

    tr.appendChild(tdName)

    // Date Modified column (placeholder - fs doesn't provide mtime)
    const tdModified = document.createElement('td')
    tdModified.textContent = '--'
    tr.appendChild(tdModified)

    // Size column
    const tdSize = document.createElement('td')
    tdSize.textContent = item.type === 'directory' ? '--' : this.formatSize(item.size)
    tr.appendChild(tdSize)

    // Kind column
    const tdKind = document.createElement('td')
    tdKind.textContent = item.type === 'directory' ? 'Folder' : handler.kind
    tr.appendChild(tdKind)

    this.treeBody.appendChild(tr)
  }

  createIconElement(name) {
    const icon = document.createElement('i')
    icon.textContent = name
    return icon
  }

  applyRowStateStyle(row, state = {}) {
    row.dataset.selected = state.selected ? 'true' : 'false'
    row.dataset.chooserSelected = state.chooserSelected ? 'true' : 'false'
    row.dataset.chooserDisabled = state.chooserDisabled ? 'true' : 'false'
  }

  // --- Event Handlers ---

  handleTreeClick(e) {
    const row = e.target.closest('[data-element="file-row"]')
    if (!row) return

    const path = row.dataset.path
    const type = row.dataset.type

    // Check if clicking on chevron
    if (e.target.dataset.action === 'toggle') {
      this.toggleExpand(path)
      return
    }

    // Saver mode: clicking on folder sets it as target, clicking on file pre-fills filename
    if (this.mode === 'saver') {
      if (type === 'directory') {
        this.currentDirectory = path
        this.updateSaverUI()
        this.selectPath(path)
      } else {
        // Clicking on a file pre-fills the filename
        const item = this.findItem(path)
        if (item && this.filenameInput) {
          this.filenameInput.value = item.name
          this.updateSaverUI()
        }
        this.selectPath(path)
      }
      return
    }

    // Folder-select mode: clicking on folder sets it as target
    if (this.mode === 'folder-select') {
      if (type === 'directory') {
        this.currentDirectory = path
        this.updateFolderSelectUI()
        this.selectPath(path)
      }
      return
    }

    // Chooser mode: handle selection differently
    if (this.mode === 'chooser') {
      if (this.multiSelect) {
        // Multi-select: toggle selection on click
        if (this.isSelectable(path)) {
          this.toggleChooserSelection(path)
        } else if (type === 'directory') {
          // Allow expanding non-selectable folders
          this.toggleExpand(path)
        }
      } else {
        // Single select: just select the item
        this.selectPath(path)
        this.updateChooserUI()
      }
      return
    }

    // Browser mode: Select the row
    this.selectPath(path)
  }

  handleTreeDoubleClick(e) {
    const row = e.target.closest('[data-element="file-row"]')
    if (!row) return

    const path = row.dataset.path
    const type = row.dataset.type

    // Saver mode: double-click expands folders, double-click on file confirms save with that name
    if (this.mode === 'saver') {
      if (type === 'directory') {
        this.toggleExpand(path)
        this.currentDirectory = path
        this.updateSaverUI()
      } else {
        // Double-click on file: use its name and confirm save
        const item = this.findItem(path)
        if (item && this.filenameInput) {
          this.filenameInput.value = item.name
          this.currentDirectory = path.substring(0, path.lastIndexOf('/')) || '/'
          this.updateSaverUI()
          this.confirmSave()
        }
      }
      return
    }

    // Folder-select mode: double-click expands/collapses or confirms selection
    if (this.mode === 'folder-select') {
      if (type === 'directory') {
        // If already selected, confirm selection
        if (this.currentDirectory === path) {
          this.dispatchEvent(new CustomEvent('chooser-select', {
            bubbles: true,
            detail: { selection: { path: this.currentDirectory, name: this.getPathName(this.currentDirectory), type: 'directory' } }
          }))
        } else {
          // Otherwise expand and select
          this.toggleExpand(path)
          this.currentDirectory = path
          this.updateFolderSelectUI()
        }
      }
      return
    }

    // Chooser mode: double-click confirms selection (single mode) or expands folders
    if (this.mode === 'chooser') {
      if (type === 'directory') {
        this.toggleExpand(path)
      } else if (this.isSelectable(path) && !this.multiSelect) {
        // Confirm single selection on double-click
        this.selectPath(path)
        const selection = this.getSelection()
        this.dispatchEvent(new CustomEvent('chooser-select', {
          bubbles: true,
          detail: { selection }
        }))
      }
      return
    }

    // Browser mode: Check if clicking on name (for rename)
    if (e.target.dataset.element === 'file-name') {
      this.startRename(path)
      return
    }

    // Open/expand
    if (type === 'directory') {
      this.toggleExpand(path)
    } else {
      this.openFile(path)
    }
  }

  // --- Selection ---

  selectPath(path) {
    this.selectedPath = path

    // Update UI
    this.treeBody?.querySelectorAll('[data-element="file-row"]').forEach(row => {
      this.applyRowStateStyle(row, {
        selected: row.dataset.path === path,
        chooserSelected: row.dataset.chooserSelected === 'true',
        chooserDisabled: row.dataset.chooserDisabled === 'true'
      })
    })

    this.updateStatus()
  }

  selectNext() {
    const rows = Array.from(this.treeBody?.querySelectorAll('[data-element="file-row"]') || [])
    if (rows.length === 0) return

    const currentIndex = rows.findIndex(r => r.dataset.path === this.selectedPath)
    const nextIndex = currentIndex < rows.length - 1 ? currentIndex + 1 : 0
    this.selectPath(rows[nextIndex].dataset.path)
    rows[nextIndex].scrollIntoView({ block: 'nearest' })
  }

  selectPrevious() {
    const rows = Array.from(this.treeBody?.querySelectorAll('[data-element="file-row"]') || [])
    if (rows.length === 0) return

    const currentIndex = rows.findIndex(r => r.dataset.path === this.selectedPath)
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : rows.length - 1
    this.selectPath(rows[prevIndex].dataset.path)
    rows[prevIndex].scrollIntoView({ block: 'nearest' })
  }

  // --- Expand/Collapse ---

  async toggleExpand(path) {
    if (this.expandedPaths.has(path)) {
      this.collapsePath(path)
    } else {
      await this.expandPath(path)
    }
  }

  async expandPath(path) {
    // Find the item in tree
    const item = this.findItem(path)
    if (!item || item.type !== 'directory') return

    this.expandedPaths.add(path)

    // Load children if not already loaded
    if (!item.children) {
      try {
        item.children = await this.loadDirectoryChildren(path)
      } catch (e) {
        console.warn(`Failed to load ${path}:`, e)
        item.children = []
      }
    }

    this.render()
  }

  collapsePath(path) {
    this.expandedPaths.delete(path)
    this.render()
  }

  findItem(path, items = null) {
    if (!items) {
      items = this.fileTree.get(this.rootPath) || []
    }

    for (const item of items) {
      if (item.path === path) return item
      if (item.children) {
        const found = this.findItem(path, item.children)
        if (found) return found
      }
    }
    return null
  }

  // --- File Operations ---

  async createFile() {
    const name = await this.promptForName('New File', 'Enter file name')
    if (!name) return

    const parentPath = this.selectedPath && this.findItem(this.selectedPath)?.type === 'directory'
      ? this.selectedPath
      : this.rootPath

    const filePath = parentPath === '/' ? `/${name}` : `${parentPath}/${name}`

    try {
      // Create empty file
      const payload = createWriteInput(filePath, '')
      const result = await this.fsCall('write', payload)
      if (result.returnCode !== 0) {
        throw new Error(this.decoder.decode(result.output))
      }

      toast.success(`Created ${name}`)

      // Expand parent and refresh
      if (parentPath !== this.rootPath) {
        this.expandedPaths.add(parentPath)
      }
      await this.refresh()
      this.selectPath(filePath)
    } catch (error) {
      toast.error(error.message)
      console.error('Create file error:', error)
    }
  }

  async createFolder() {
    const name = await this.promptForName('New Folder', 'Enter folder name')
    if (!name) return

    const parentPath = this.selectedPath && this.findItem(this.selectedPath)?.type === 'directory'
      ? this.selectedPath
      : this.rootPath

    const folderPath = parentPath === '/' ? `/${name}` : `${parentPath}/${name}`

    try {
      const result = await this.fsCall('mkdir', folderPath)
      if (result.returnCode !== 0) {
        throw new Error(this.decoder.decode(result.output))
      }

      toast.success(`Created folder ${name}`)

      // Expand parent and refresh
      if (parentPath !== this.rootPath) {
        this.expandedPaths.add(parentPath)
      }
      await this.refresh()
      this.selectPath(folderPath)
    } catch (error) {
      toast.error(error.message)
      console.error('Create folder error:', error)
    }
  }

  async deleteSelected() {
    if (!this.selectedPath) {
      toast.warning('Nothing selected')
      return
    }

    const item = this.findItem(this.selectedPath)
    if (!item) return

    const isFolder = item.type === 'directory'
    const confirmMsg = isFolder
      ? `Delete folder "${item.name}" and all its contents?`
      : `Delete file "${item.name}"?`

    const confirmed = await toast.confirm(confirmMsg)
    if (!confirmed) return

    try {
      if (isFolder) {
        // For folders, we need to recursively delete
        await this.deleteRecursive(this.selectedPath)
      } else {
        const result = await this.fsCall('delete', this.selectedPath)
        if (result.returnCode !== 0) {
          throw new Error(this.decoder.decode(result.output))
        }
      }

      toast.success(`Deleted ${item.name}`)
      this.selectedPath = null
      await this.refresh()
    } catch (error) {
      toast.error(error.message)
      console.error('Delete error:', error)
    }
  }

  async deleteRecursive(path) {
    const statResult = await this.fsCall('stat', path)
    if (statResult.returnCode !== 0) return

    const stat = JSON.parse(this.decoder.decode(statResult.output))

    if (stat.type === 'directory') {
      // List and delete children first
      const listResult = await this.fsCall('list', path)
      if (listResult.returnCode === 0) {
        const entries = JSON.parse(this.decoder.decode(listResult.output))
        for (const name of entries) {
          await this.deleteRecursive(`${path}/${name}`)
        }
      }
      // Then delete empty directory
      await this.fsCall('rmdir', path)
    } else {
      await this.fsCall('delete', path)
    }
  }

  // --- Upload ---

  async uploadFile() {
    // Create hidden file input
    const input = document.createElement('input')
    input.type = 'file'
    input.hidden = true

    // Determine destination directory
    let destDir = this.rootPath
    if (this.selectedPath) {
      const item = this.findItem(this.selectedPath)
      if (item?.type === 'directory') {
        destDir = this.selectedPath
      } else if (item) {
        // If a file is selected, use its parent directory
        destDir = this.selectedPath.substring(0, this.selectedPath.lastIndexOf('/')) || '/'
      }
    }

    input.addEventListener('change', async () => {
      const file = input.files?.[0]
      if (!file) return

      try {
        const arrayBuffer = await file.arrayBuffer()
        const content = new Uint8Array(arrayBuffer)

        const filePath = destDir === '/' ? `/${file.name}` : `${destDir}/${file.name}`

        const payload = createWriteInput(filePath, content)
        const result = await this.fsCall('write', payload)
        if (result.returnCode !== 0) {
          throw new Error(this.decoder.decode(result.output))
        }

        toast.success(`Uploaded ${file.name}`)

        // Expand destination if not root
        if (destDir !== this.rootPath) {
          this.expandedPaths.add(destDir)
        }
        await this.refresh()
        this.selectPath(filePath)
      } catch (error) {
        toast.error(error.message)
        console.error('Upload error:', error)
      } finally {
        input.remove()
      }
    })

    document.body.appendChild(input)
    input.click()
  }

  // --- Download ---

  async downloadSelected() {
    if (!this.selectedPath) {
      toast.warning('Nothing selected')
      return
    }

    const item = this.findItem(this.selectedPath)
    if (!item) return

    if (item.type === 'directory') {
      toast.warning('Cannot download folders')
      return
    }

    try {
      const result = await this.fsCall('read', this.selectedPath)
      if (result.returnCode !== 0) {
        throw new Error(this.decoder.decode(result.output))
      }

      // Create blob from the file content
      const blob = new Blob([result.output])
      const url = URL.createObjectURL(blob)

      // Create temporary download link and click it
      const a = document.createElement('a')
      a.href = url
      a.download = item.name
      document.body.appendChild(a)
      a.click()

      // Cleanup
      setTimeout(() => {
        URL.revokeObjectURL(url)
        a.remove()
      }, 100)

      toast.success(`Downloaded ${item.name}`)
    } catch (error) {
      toast.error(error.message)
      console.error('Download error:', error)
    }
  }

  // --- Drag and Drop (Internal - Move Files) ---

  handleDragStart(e) {
    const row = e.target.closest('[data-element="file-row"]')
    if (!row) return

    this.draggedPath = row.dataset.path
    row.dataset.dragging = 'true'

    // Set drag data
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', row.dataset.path)
  }

  handleDragOver(e) {
    // Only handle if we're dragging an internal file
    if (!this.draggedPath) return

    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    const row = e.target.closest('[data-element="file-row"]')
    if (!row) return

    // Don't allow dropping on self
    if (row.dataset.path === this.draggedPath) return

    // Determine target folder: the row itself if it's a folder, or the parent folder if it's a file
    let targetDir
    if (row.dataset.type === 'directory') {
      targetDir = row.dataset.path
    } else {
      // Get parent folder of the file
      targetDir = row.dataset.path.substring(0, row.dataset.path.lastIndexOf('/')) || '/'
    }

    // Don't allow dropping into a child of self (for folders)
    if (targetDir.startsWith(this.draggedPath + '/')) return

    // Don't highlight if already in the same folder
    const sourceParent = this.draggedPath.substring(0, this.draggedPath.lastIndexOf('/')) || '/'
    if (targetDir === sourceParent) return

    // Clear previous drop target
    this.treeBody?.querySelectorAll('[data-drop-target="true"]').forEach(el => {
      el.dataset.dropTarget = 'false'
    })
    row.dataset.dropTarget = 'true'
  }

  handleDragLeave(e) {
    const row = e.target.closest('[data-element="file-row"]')
    if (row && !row.contains(e.relatedTarget)) {
      row.dataset.dropTarget = 'false'
    }
  }

  handleDragEnd(e) {
    // Clean up drag state
    this.draggedPath = null
    this.treeBody?.querySelectorAll('[data-element="file-row"]').forEach(el => {
      el.dataset.dragging = 'false'
      el.dataset.dropTarget = 'false'
    })
  }

  async handleDrop(e) {
    e.preventDefault()

    const row = e.target.closest('[data-element="file-row"]')
    if (!row || !this.draggedPath) return

    // Don't allow dropping on self
    if (row.dataset.path === this.draggedPath) {
      this.draggedPath = null
      return
    }

    // Determine target folder: the row itself if it's a folder, or the parent folder if it's a file
    let targetDir
    if (row.dataset.type === 'directory') {
      targetDir = row.dataset.path
    } else {
      // Get parent folder of the file
      targetDir = row.dataset.path.substring(0, row.dataset.path.lastIndexOf('/')) || '/'
    }

    const sourcePath = this.draggedPath

    // Don't allow dropping into a child of self
    if (targetDir.startsWith(sourcePath + '/')) {
      this.draggedPath = null
      return
    }

    // Don't move if already in the same folder
    const sourceParent = sourcePath.substring(0, sourcePath.lastIndexOf('/')) || '/'
    if (targetDir === sourceParent) {
      this.draggedPath = null
      row.dataset.dropTarget = 'false'
      return
    }

    // Clean up UI
    row.dataset.dropTarget = 'false'
    this.draggedPath = null

    await this.moveFile(sourcePath, targetDir)
  }

  // --- Drag and Drop (Container - Root drop zone for internal + external) ---

  handleExternalDragOver(e) {
    const row = e.target.closest('[data-element="file-row"]')

    // Internal drag - allow dropping on empty area (root)
    if (this.draggedPath) {
      // If over any row, let the row handler deal with it
      if (row) return

      // Dropping on empty area = move to root
      // But only if not already in root
      const sourceParent = this.draggedPath.substring(0, this.draggedPath.lastIndexOf('/')) || '/'
      if (sourceParent === this.rootPath) return

      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      this.treeBody?.querySelectorAll('[data-drop-target="true"]').forEach(el => {
        el.dataset.dropTarget = 'false'
      })
      return
    }

    // External file drag
    if (!e.dataTransfer.types.includes('Files')) return

    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'

    // Highlight row if hovering over one (will upload to that folder, or file's parent folder)
    if (row) {
      this.treeBody?.querySelectorAll('[data-drop-target="true"]').forEach(el => {
        el.dataset.dropTarget = 'false'
      })
      row.dataset.dropTarget = 'true'
    }
  }

  handleExternalDragLeave(e) {
    // Only remove if leaving the container entirely
    if (!this.treeContainer?.contains(e.relatedTarget)) {
      this.treeBody?.querySelectorAll('[data-drop-target="true"]').forEach(el => {
        el.dataset.dropTarget = 'false'
      })
    }
  }

  async handleExternalDrop(e) {
    e.preventDefault()
    this.treeBody?.querySelectorAll('[data-drop-target="true"]').forEach(el => {
      el.dataset.dropTarget = 'false'
    })

    const row = e.target.closest('[data-element="file-row"]')

    // Internal drag - move to root (only when dropped on empty area)
    if (this.draggedPath) {
      // If dropped on any row, let the row handler deal with it
      if (row) return

      // Move to root
      const sourcePath = this.draggedPath
      this.draggedPath = null

      // Don't move if already in root
      const parentPath = sourcePath.substring(0, sourcePath.lastIndexOf('/')) || '/'
      if (parentPath === this.rootPath) {
        return
      }

      await this.moveFile(sourcePath, this.rootPath)
      return
    }

    // External file drag
    if (!e.dataTransfer.files.length) return

    // Determine destination directory
    // If dropped on a folder, use that folder
    // If dropped on a file, use that file's parent folder
    // Otherwise use root
    let destDir = this.rootPath
    if (row) {
      if (row.dataset.type === 'directory') {
        destDir = row.dataset.path
      } else {
        destDir = row.dataset.path.substring(0, row.dataset.path.lastIndexOf('/')) || '/'
      }
    }

    // Upload all dropped files
    const files = Array.from(e.dataTransfer.files)
    let successCount = 0

    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const content = new Uint8Array(arrayBuffer)

        const filePath = destDir === '/' ? `/${file.name}` : `${destDir}/${file.name}`

        const payload = createWriteInput(filePath, content)
        const result = await this.fsCall('write', payload)
        if (result.returnCode !== 0) {
          throw new Error(this.decoder.decode(result.output))
        }
        successCount++
      } catch (error) {
        toast.error(`Failed to upload ${file.name}: ${error.message}`)
        console.error('Upload error:', error)
      }
    }

    if (successCount > 0) {
      toast.success(`Uploaded ${successCount} file${successCount > 1 ? 's' : ''}`)
      if (destDir !== this.rootPath) {
        this.expandedPaths.add(destDir)
      }
      await this.refresh()
    }
  }

  // --- Move File ---

  async moveFile(sourcePath, targetDir) {
    const item = this.findItem(sourcePath)
    if (!item) return

    const fileName = item.name
    const newPath = targetDir === '/' ? `/${fileName}` : `${targetDir}/${fileName}`

    // Check if destination already exists
    const existsResult = await this.fsCall('exists', newPath)
    if (existsResult.returnCode === 0) {
      const exists = this.decoder.decode(existsResult.output) === 'true'
      if (exists) {
        const confirmed = await toast.confirm(`"${fileName}" already exists in destination. Replace it?`)
        if (!confirmed) return
      }
    }

    try {
      if (item.type === 'file') {
        // Read source file
        const readResult = await this.fsCall('read', sourcePath)
        if (readResult.returnCode !== 0) {
          throw new Error(this.decoder.decode(readResult.output))
        }

        // Write to new location
        const payload = createWriteInput(newPath, readResult.output)
        const writeResult = await this.fsCall('write', payload)
        if (writeResult.returnCode !== 0) {
          throw new Error(this.decoder.decode(writeResult.output))
        }

        // Delete original
        await this.fsCall('delete', sourcePath)
      } else {
        // For directories, create new and move contents recursively
        await this.fsCall('mkdir', newPath)
        await this.moveDirectoryContents(sourcePath, newPath)
        await this.fsCall('rmdir', sourcePath)
      }

      toast.success(`Moved ${fileName}`)
      this.expandedPaths.add(targetDir)
      await this.refresh()
      this.selectPath(newPath)
    } catch (error) {
      toast.error(error.message)
      console.error('Move error:', error)
    }
  }

  async moveDirectoryContents(sourceDir, targetDir) {
    const listResult = await this.fsCall('list', sourceDir)
    if (listResult.returnCode !== 0) return

    const entries = JSON.parse(this.decoder.decode(listResult.output))

    for (const name of entries) {
      const sourcePath = `${sourceDir}/${name}`
      const targetPath = `${targetDir}/${name}`

      const statResult = await this.fsCall('stat', sourcePath)
      if (statResult.returnCode !== 0) continue

      const stat = JSON.parse(this.decoder.decode(statResult.output))

      if (stat.type === 'directory') {
        await this.fsCall('mkdir', targetPath)
        await this.moveDirectoryContents(sourcePath, targetPath)
        await this.fsCall('rmdir', sourcePath)
      } else {
        const readResult = await this.fsCall('read', sourcePath)
        if (readResult.returnCode === 0) {
          const payload = createWriteInput(targetPath, readResult.output)
          await this.fsCall('write', payload)
          await this.fsCall('delete', sourcePath)
        }
      }
    }
  }

  // --- Rename ---

  startRename(path) {
    const item = this.findItem(path)
    if (!item) return

    this.editingPath = path
    const row = this.treeBody?.querySelector(`[data-path="${CSS.escape(path)}"]`)
    if (!row) return

    const nameSpan = row.querySelector('[data-element="file-name"]')
    if (!nameSpan) return

    const nameCell = nameSpan.closest('td')
    const cellRect = nameCell?.getBoundingClientRect()
    const nameRect = nameSpan.getBoundingClientRect()
    const availableWidth = cellRect
      ? Math.max(80, Math.floor(cellRect.right - nameRect.left - 8))
      : 160

    const input = document.createElement('input')
    input.type = 'text'
    input.dataset.element = 'rename-input'
    input.style.width = `${availableWidth}px`
    input.style.maxWidth = '100%'
    input.style.minWidth = '0'
    input.style.boxSizing = 'border-box'
    input.value = item.name

    nameSpan.textContent = ''
    nameSpan.appendChild(input)
    input.focus()
    input.select()

    // Store original name for cancel
    input.dataset.originalName = item.name
  }

  cancelRename() {
    if (!this.editingPath) return

    const row = this.treeBody?.querySelector(`[data-path="${CSS.escape(this.editingPath)}"]`)
    const input = row?.querySelector('[data-element="rename-input"]')
    if (input) {
      const nameSpan = input.parentElement
      nameSpan.textContent = input.dataset.originalName
    }

    this.editingPath = null
  }

  async commitRename() {
    if (!this.editingPath) return

    const row = this.treeBody?.querySelector(`[data-path="${CSS.escape(this.editingPath)}"]`)
    const input = row?.querySelector('[data-element="rename-input"]')
    if (!input) {
      this.editingPath = null
      return
    }

    const newName = input.value.trim()
    const originalName = input.dataset.originalName

    if (!newName || newName === originalName) {
      this.cancelRename()
      return
    }

    const item = this.findItem(this.editingPath)
    if (!item) {
      this.cancelRename()
      return
    }

    // Calculate new path
    const parentPath = this.editingPath.substring(0, this.editingPath.lastIndexOf('/')) || '/'
    const newPath = parentPath === '/' ? `/${newName}` : `${parentPath}/${newName}`

    try {
      // Read old content
      if (item.type === 'file') {
        const readResult = await this.fsCall('read', this.editingPath)
        if (readResult.returnCode !== 0) {
          throw new Error(this.decoder.decode(readResult.output))
        }

        // Write to new path
        const payload = createWriteInput(newPath, readResult.output)
        const writeResult = await this.fsCall('write', payload)
        if (writeResult.returnCode !== 0) {
          throw new Error(this.decoder.decode(writeResult.output))
        }

        // Delete old file
        await this.fsCall('delete', this.editingPath)
      } else {
        // For directories, we need to recreate the structure
        // This is a limitation - for now just create new and delete old
        await this.fsCall('mkdir', newPath)
        // Copy contents would be complex, skip for now
        await this.fsCall('rmdir', this.editingPath)
      }

      toast.success(`Renamed to ${newName}`)
      this.editingPath = null
      await this.refresh()
      this.selectPath(newPath)
    } catch (error) {
      toast.error(error.message)
      console.error('Rename error:', error)
      this.cancelRename()
    }
  }

  // --- File Open/Preview ---

  async openFile(path) {
    const item = this.findItem(path)
    if (!item || item.type === 'directory') return

    const handler = getHandler(item.name)
    if (!handler.canPreview && !handler.canEdit) {
      toast(`No preview available for ${item.name}`)
      return
    }

    try {
      // Read file content
      const result = await this.fsCall('read', path)
      if (result.returnCode !== 0) {
        throw new Error(this.decoder.decode(result.output))
      }

      const content = result.output
      this.showModal(item, content, handler)
    } catch (error) {
      toast.error(error.message)
      console.error('Open file error:', error)
    }
  }

  openSelected() {
    if (!this.selectedPath) return

    const item = this.findItem(this.selectedPath)
    if (!item) return

    if (item.type === 'directory') {
      this.toggleExpand(this.selectedPath)
    } else {
      this.openFile(this.selectedPath)
    }
  }

  // --- Modal (using view-popup) ---

  showModal(fileInfo, content, handler) {
    const popupManager = document.querySelector('popup-manager')
    if (!popupManager) {
      toast.error('Popup manager not found')
      return
    }

    const popup = document.createElement('view-popup')
    popup.setAttribute('size', 'large')

    // Title
    const titleEl = document.createElement('h2')
    titleEl.slot = 'title'
    titleEl.textContent = fileInfo.name
    popup.appendChild(titleEl)

    // Content container
    const contentContainer = document.createElement('div')

    if (handler.canEdit) {
      const saveCallback = handler.edit(content, contentContainer, fileInfo)

      // Handle Ctrl+S from text-handler
      contentContainer.addEventListener('save-requested', async () => {
        try {
          const newContent = saveCallback()
          await this.saveFile(fileInfo.path, newContent)
          toast.success(`Saved ${fileInfo.name}`)
          popup.close()
          await this.refresh()
        } catch (error) {
          toast.error(error.message)
        }
      })

      // Button container
      const buttonContainer = document.createElement('div')

      const cancelBtn = document.createElement('button')
      cancelBtn.textContent = 'Cancel'
      cancelBtn.onclick = () => popup.close()

      const saveBtn = document.createElement('button')
      saveBtn.textContent = 'Save'
      saveBtn.onclick = async () => {
        try {
          const newContent = saveCallback()
          await this.saveFile(fileInfo.path, newContent)
          toast.success(`Saved ${fileInfo.name}`)
          popup.close()
          await this.refresh()
        } catch (error) {
          toast.error(error.message)
        }
      }

      buttonContainer.appendChild(cancelBtn)
      buttonContainer.appendChild(saveBtn)

      popup.appendChild(contentContainer)
      popup.appendChild(buttonContainer)
    } else if (handler.canPreview) {
      handler.preview(content, contentContainer, fileInfo)

      const buttonContainer = document.createElement('div')

      const closeBtn = document.createElement('button')
      closeBtn.textContent = 'Close'
      closeBtn.onclick = () => popup.close()

      buttonContainer.appendChild(closeBtn)
      popup.appendChild(contentContainer)
      popup.appendChild(buttonContainer)
    }

    popupManager.appendChild(popup)
  }

  async saveFile(path, content) {
    const payload = createWriteInput(path, content)
    const result = await this.fsCall('write', payload)
    if (result.returnCode !== 0) {
      throw new Error(this.decoder.decode(result.output))
    }
  }

  /**
   * Show a popup dialog to get a name from the user
   * @param {string} title - Dialog title
   * @param {string} placeholder - Input placeholder text
   * @returns {Promise<string|null>} The entered name or null if cancelled
   */
  async promptForName(title, placeholder = '') {
    return new Promise((resolve) => {
      const popupManager = document.querySelector('popup-manager')
      if (!popupManager) {
        toast.error('Popup manager not found')
        resolve(null)
        return
      }

      const popup = document.createElement('view-popup')
      popup.setAttribute('size', 'small')

      // Title
      const titleEl = document.createElement('h3')
      titleEl.slot = 'title'
      titleEl.textContent = title
      popup.appendChild(titleEl)

      // Input container
      const container = document.createElement('div')

      const input = document.createElement('input')
      input.type = 'text'
      input.placeholder = placeholder
      container.appendChild(input)

      // Buttons
      const buttonContainer = document.createElement('div')

      const cancelBtn = document.createElement('button')
      cancelBtn.textContent = 'Cancel'
      cancelBtn.onclick = () => { popup.close(); resolve(null) }

      const createBtn = document.createElement('button')
      createBtn.textContent = 'Create'
      createBtn.onclick = () => {
        const value = input.value.trim()
        popup.close()
        resolve(value || null)
      }

      // Enter key submits, Escape cancels
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          createBtn.click()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          cancelBtn.click()
        }
      })

      buttonContainer.appendChild(cancelBtn)
      buttonContainer.appendChild(createBtn)
      container.appendChild(buttonContainer)
      popup.appendChild(container)
      popupManager.appendChild(popup)

      setTimeout(() => input.focus(), 100)
    })
  }

  // --- UI Helpers ---

  updatePathDisplay() {
    if (this.pathDisplay) {
      this.pathDisplay.textContent = `Path: ${this.rootPath}`
    }
  }

  updateStatus() {
    const rootChildren = this.fileTree.get(this.rootPath) || []
    const totalItems = this.countItems(rootChildren)

    let statusText = `${totalItems} item${totalItems !== 1 ? 's' : ''}`

    if (this.selectedPath) {
      const item = this.findItem(this.selectedPath)
      if (item && item.type !== 'directory') {
        statusText += ` | Selected: ${item.name} (${this.formatSize(item.size)})`
      } else if (item) {
        statusText += ` | Selected: ${item.name}`
      }
    }

    this.setStatus(statusText)
  }

  countItems(items) {
    let count = items.length
    for (const item of items) {
      if (item.children) {
        count += this.countItems(item.children)
      }
    }
    return count
  }

  setStatus(text) {
    if (this.statusBar) {
      this.statusBar.textContent = text
    }
  }

  formatSize(bytes) {
    if (bytes === 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    const size = bytes / Math.pow(1024, i)
    return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
  }

  // --- Static API for File Chooser ---

  /**
   * Open file chooser in a popup
   * @param {Object} options
   * @param {string} options.root - Starting directory (default: "/")
   * @param {string} options.filter - File filter pattern (e.g., "*.png,*.qoi")
   * @param {boolean} options.selectFolders - Allow folder selection (default: false)
   * @param {boolean} options.multiSelect - Allow multiple selection (default: false)
   * @param {string} options.title - Popup title (default: "Select File")
   * @returns {Promise<{path, name, type}|Array|null>} Selected file(s) or null if cancelled
   */
  static async choose(options = {}) {
    return new Promise((resolve) => {
      const popupManager = document.querySelector('popup-manager')
      if (!popupManager) {
        console.error('ViewFiles.choose: popup-manager not found')
        resolve(null)
        return
      }

      const popup = document.createElement('view-popup')
      popup.setAttribute('size', 'large')

      // Title
      const title = document.createElement('h2')
      title.slot = 'title'
      title.textContent = options.title || 'Select File'
      popup.appendChild(title)

      // Container for file browser
      const container = document.createElement('div')

      // File browser in chooser mode
      const files = document.createElement('view-files')
      files.setAttribute('data-mode', 'chooser')
      files.setAttribute('data-root', options.root || '/')
      if (options.filter) files.setAttribute('data-filter', options.filter)
      if (options.selectFolders) files.setAttribute('data-select-folders', 'true')
      if (options.multiSelect) files.setAttribute('data-multi-select', 'true')

      container.appendChild(files)
      popup.appendChild(container)
      popupManager.appendChild(popup)

      let resolved = false

      // Handle selection
      files.addEventListener('chooser-select', (e) => {
        if (resolved) return
        resolved = true
        popup.close()
        resolve(e.detail.selection)
      })

      // Handle cancel
      files.addEventListener('chooser-cancel', () => {
        if (resolved) return
        resolved = true
        popup.close()
        resolve(null)
      })

      // Handle popup close (via X button or Escape)
      popup.addEventListener('popup-closing', () => {
        if (resolved) return
        resolved = true
        resolve(null)
      })
    })
  }

  /**
   * Open save dialog in a popup
   * @param {Object} options
   * @param {string} options.root - Starting directory (default: "/")
   * @param {string} options.defaultName - Default filename to pre-fill
   * @param {string} options.title - Popup title (default: "Save File")
   * @returns {Promise<{path, name, directory}|null>} Save destination or null if cancelled
   */
  static async save(options = {}) {
    return new Promise((resolve) => {
      const popupManager = document.querySelector('popup-manager')
      if (!popupManager) {
        console.error('ViewFiles.save: popup-manager not found')
        resolve(null)
        return
      }

      const popup = document.createElement('view-popup')
      popup.setAttribute('size', 'large')

      // Title
      const title = document.createElement('h2')
      title.slot = 'title'
      title.textContent = options.title || 'Save File'
      popup.appendChild(title)

      // Container for file browser
      const container = document.createElement('div')

      // File browser in saver mode
      const files = document.createElement('view-files')
      files.setAttribute('data-mode', 'saver')
      files.setAttribute('data-root', options.root || '/')
      if (options.defaultName) files.setAttribute('data-default-name', options.defaultName)

      container.appendChild(files)
      popup.appendChild(container)
      popupManager.appendChild(popup)

      let resolved = false

      // Handle save
      files.addEventListener('saver-save', (e) => {
        if (resolved) return
        resolved = true
        popup.close()
        resolve(e.detail)
      })

      // Handle cancel
      files.addEventListener('saver-cancel', () => {
        if (resolved) return
        resolved = true
        popup.close()
        resolve(null)
      })

      // Handle popup close (via X button or Escape)
      popup.addEventListener('popup-closing', () => {
        if (resolved) return
        resolved = true
        resolve(null)
      })

      // Focus filename input after a short delay
      setTimeout(() => {
        const input = files.querySelector('[data-element="filename-input"]')
        if (input) {
          input.focus()
          input.select()
        }
      }, 100)
    })
  }

  /**
   * Open folder selection dialog in a popup
   * @param {Object} options
   * @param {string} options.root - Starting directory (default: "/")
   * @param {string} options.title - Popup title (default: "Select Folder")
   * @returns {Promise<{path, name, type}|null>} Selected folder or null if cancelled
   */
  static async selectFolder(options = {}) {
    return new Promise((resolve) => {
      const popupManager = document.querySelector('popup-manager')
      if (!popupManager) {
        console.error('ViewFiles.selectFolder: popup-manager not found')
        resolve(null)
        return
      }

      const popup = document.createElement('view-popup')
      popup.setAttribute('size', 'large')

      // Title
      const title = document.createElement('h2')
      title.slot = 'title'
      title.textContent = options.title || 'Select Folder'
      popup.appendChild(title)

      // Container for file browser
      const container = document.createElement('div')

      // File browser in folder-select mode
      const files = document.createElement('view-files')
      files.setAttribute('data-mode', 'folder-select')
      files.setAttribute('data-root', options.root || '/')

      container.appendChild(files)
      popup.appendChild(container)
      popupManager.appendChild(popup)

      let resolved = false

      // Handle selection
      files.addEventListener('chooser-select', (e) => {
        if (resolved) return
        resolved = true
        popup.close()
        resolve(e.detail.selection)
      })

      // Handle cancel
      files.addEventListener('chooser-cancel', () => {
        if (resolved) return
        resolved = true
        popup.close()
        resolve(null)
      })

      // Handle popup close (via X button or Escape)
      popup.addEventListener('popup-closing', () => {
        if (resolved) return
        resolved = true
        resolve(null)
      })
    })
  }
}

export default ViewFiles
