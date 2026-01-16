import { bus } from "../systems/event-bus.js"
import { getHandler, getAllHandlers } from './files/file-handlers.js'

// Import handlers to register them (must be after file-handlers.js)
import './files/handlers/default-handler.js'
import './files/handlers/text-handler.js'
import './files/handlers/image-handler.js'

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
  static observedAttributes = ['data-root', 'data-show-hidden']

  constructor() {
    super()
    
    // State
    this.rootPath = '/'
    this.showHidden = false
    this.expandedPaths = new Set()
    this.selectedPath = null
    this.editingPath = null
    
    // File tree data: Map<path, {name, type, size, children: []}>
    this.fileTree = new Map()
    
    // Containers
    this.toolbar = null
    this.treeContainer = null
    this.statusBar = null
    this.modal = null
    
    // Decoder for fs plugin responses
    this.decoder = new TextDecoder()
  }

  connectedCallback() {
    this.style.display = 'flex'
    this.style.flexDirection = 'column'
    this.style.width = '100%'
    this.style.height = '100%'
    this.setAttribute('tabindex', '0')

    // Get template
    const template = document.getElementById('view-files')
    if (template) {
      const content = template.content.cloneNode(true)
      this.appendChild(content)
    } else {
      // Fallback inline structure
      this.innerHTML = `
        <div data-element="toolbar" class="files-toolbar">
          <button data-action="refresh" class="button-secondary" title="Refresh">Refresh</button>
          <button data-action="new-file" class="button-secondary" title="New File">+ File</button>
          <button data-action="new-folder" class="button-secondary" title="New Folder">+ Folder</button>
          <button data-action="delete" class="button-secondary" title="Delete">Delete</button>
          <span class="files-path" data-element="path-display">/</span>
        </div>
        <div data-element="tree-container" class="files-tree-container">
          <table class="files-tree">
            <thead>
              <tr>
                <th class="files-col-name">Name</th>
                <th class="files-col-modified">Date Modified</th>
                <th class="files-col-size">Size</th>
                <th class="files-col-kind">Kind</th>
              </tr>
            </thead>
            <tbody data-element="tree-body"></tbody>
          </table>
        </div>
        <div data-element="status" class="files-status"></div>
        <div data-element="modal" class="files-modal" style="display: none;">
          <div class="files-modal-backdrop"></div>
          <div class="files-modal-content">
            <div class="files-modal-header">
              <span class="files-modal-title" data-element="modal-title">File</span>
              <button class="files-modal-close" data-action="modal-close">&times;</button>
            </div>
            <div class="files-modal-body" data-element="modal-body"></div>
            <div class="files-modal-footer" data-element="modal-footer"></div>
          </div>
        </div>
      `
    }

    // Cache element references
    this.toolbar = this.querySelector('[data-element="toolbar"]')
    this.treeContainer = this.querySelector('[data-element="tree-container"]')
    this.treeBody = this.querySelector('[data-element="tree-body"]')
    this.statusBar = this.querySelector('[data-element="status"]')
    this.pathDisplay = this.querySelector('[data-element="path-display"]')
    this.modal = this.querySelector('[data-element="modal"]')
    this.modalTitle = this.querySelector('[data-element="modal-title"]')
    this.modalBody = this.querySelector('[data-element="modal-body"]')
    this.modalFooter = this.querySelector('[data-element="modal-footer"]')

    // Parse attributes
    this.rootPath = this.getAttribute('data-root') || '/'
    this.showHidden = this.getAttribute('data-show-hidden') === 'true'

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
      }
    }
  }

  setupEventHandlers() {
    // Toolbar buttons
    this.toolbar?.querySelector('[data-action="refresh"]')?.addEventListener('click', () => this.refresh())
    this.toolbar?.querySelector('[data-action="new-file"]')?.addEventListener('click', () => this.createFile())
    this.toolbar?.querySelector('[data-action="new-folder"]')?.addEventListener('click', () => this.createFolder())
    this.toolbar?.querySelector('[data-action="delete"]')?.addEventListener('click', () => this.deleteSelected())

    // Modal close
    this.modal?.querySelector('[data-action="modal-close"]')?.addEventListener('click', () => this.closeModal())
    this.modal?.querySelector('.files-modal-backdrop')?.addEventListener('click', () => this.closeModal())

    // Tree clicks delegated
    this.treeBody?.addEventListener('click', (e) => this.handleTreeClick(e))
    this.treeBody?.addEventListener('dblclick', (e) => this.handleTreeDoubleClick(e))
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
      case 'Escape':
        if (this.modal?.style.display !== 'none') {
          this.closeModal()
          e.preventDefault()
        }
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
      this.setStatus(`Error: ${error.message}`)
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
    tr.className = 'files-row'
    tr.dataset.path = item.path
    tr.dataset.type = item.type

    if (item.path === this.selectedPath) {
      tr.classList.add('selected')
    }

    const isExpanded = this.expandedPaths.has(item.path)
    const handler = getHandler(item.name)

    // Name column with indent, chevron, and icon
    const tdName = document.createElement('td')
    tdName.className = 'files-col-name'
    
    const indent = document.createElement('span')
    indent.className = 'files-indent'
    indent.style.width = `${depth * 20}px`
    tdName.appendChild(indent)

    if (item.type === 'directory') {
      const chevron = document.createElement('span')
      chevron.className = `files-chevron ${isExpanded ? 'expanded' : ''}`
      chevron.textContent = isExpanded ? 'v' : '>'
      chevron.dataset.action = 'toggle'
      tdName.appendChild(chevron)
    } else {
      // Spacer for files
      const spacer = document.createElement('span')
      spacer.className = 'files-chevron-spacer'
      tdName.appendChild(spacer)
    }

    const icon = document.createElement('span')
    icon.className = 'files-icon'
    icon.textContent = item.type === 'directory' ? '📁' : handler.icon
    tdName.appendChild(icon)

    const nameSpan = document.createElement('span')
    nameSpan.className = 'files-name'
    nameSpan.textContent = item.name
    tdName.appendChild(nameSpan)

    tr.appendChild(tdName)

    // Date Modified column (placeholder - fs doesn't provide mtime)
    const tdModified = document.createElement('td')
    tdModified.className = 'files-col-modified'
    tdModified.textContent = '--'
    tr.appendChild(tdModified)

    // Size column
    const tdSize = document.createElement('td')
    tdSize.className = 'files-col-size'
    tdSize.textContent = item.type === 'directory' ? '--' : this.formatSize(item.size)
    tr.appendChild(tdSize)

    // Kind column
    const tdKind = document.createElement('td')
    tdKind.className = 'files-col-kind'
    tdKind.textContent = item.type === 'directory' ? 'Folder' : handler.kind
    tr.appendChild(tdKind)

    this.treeBody.appendChild(tr)
  }

  // --- Event Handlers ---

  handleTreeClick(e) {
    const row = e.target.closest('.files-row')
    if (!row) return

    const path = row.dataset.path
    const type = row.dataset.type

    // Check if clicking on chevron
    if (e.target.dataset.action === 'toggle') {
      this.toggleExpand(path)
      return
    }

    // Select the row
    this.selectPath(path)
  }

  handleTreeDoubleClick(e) {
    const row = e.target.closest('.files-row')
    if (!row) return

    const path = row.dataset.path
    const type = row.dataset.type

    // Check if clicking on name (for rename)
    if (e.target.classList.contains('files-name')) {
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
    this.treeBody?.querySelectorAll('.files-row').forEach(row => {
      row.classList.toggle('selected', row.dataset.path === path)
    })

    this.updateStatus()
  }

  selectNext() {
    const rows = Array.from(this.treeBody?.querySelectorAll('.files-row') || [])
    if (rows.length === 0) return

    const currentIndex = rows.findIndex(r => r.dataset.path === this.selectedPath)
    const nextIndex = currentIndex < rows.length - 1 ? currentIndex + 1 : 0
    this.selectPath(rows[nextIndex].dataset.path)
    rows[nextIndex].scrollIntoView({ block: 'nearest' })
  }

  selectPrevious() {
    const rows = Array.from(this.treeBody?.querySelectorAll('.files-row') || [])
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
    const name = prompt('Enter file name:')
    if (!name) return

    const parentPath = this.selectedPath && this.findItem(this.selectedPath)?.type === 'directory'
      ? this.selectedPath
      : this.rootPath

    const filePath = parentPath === '/' ? `/${name}` : `${parentPath}/${name}`

    try {
      // Create empty file using write with path + null byte + empty content
      const pathBytes = new TextEncoder().encode(filePath)
      const payload = new Uint8Array(pathBytes.length + 1) // +1 for null byte
      payload.set(pathBytes, 0)
      payload[pathBytes.length] = 0 // null byte, no content after

      const result = await this.fsCall('write', payload)
      if (result.returnCode !== 0) {
        throw new Error(this.decoder.decode(result.output))
      }

      this.setStatus(`Created ${name}`)
      
      // Expand parent and refresh
      if (parentPath !== this.rootPath) {
        this.expandedPaths.add(parentPath)
      }
      await this.refresh()
      this.selectPath(filePath)
    } catch (error) {
      this.setStatus(`Error: ${error.message}`)
      console.error('Create file error:', error)
    }
  }

  async createFolder() {
    const name = prompt('Enter folder name:')
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

      this.setStatus(`Created folder ${name}`)
      
      // Expand parent and refresh
      if (parentPath !== this.rootPath) {
        this.expandedPaths.add(parentPath)
      }
      await this.refresh()
      this.selectPath(folderPath)
    } catch (error) {
      this.setStatus(`Error: ${error.message}`)
      console.error('Create folder error:', error)
    }
  }

  async deleteSelected() {
    if (!this.selectedPath) {
      this.setStatus('Nothing selected')
      return
    }

    const item = this.findItem(this.selectedPath)
    if (!item) return

    const isFolder = item.type === 'directory'
    const confirmMsg = isFolder 
      ? `Delete folder "${item.name}" and all its contents?`
      : `Delete file "${item.name}"?`

    if (!confirm(confirmMsg)) return

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

      this.setStatus(`Deleted ${item.name}`)
      this.selectedPath = null
      await this.refresh()
    } catch (error) {
      this.setStatus(`Error: ${error.message}`)
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

  // --- Rename ---

  startRename(path) {
    const item = this.findItem(path)
    if (!item) return

    this.editingPath = path
    const row = this.treeBody?.querySelector(`[data-path="${CSS.escape(path)}"]`)
    if (!row) return

    const nameSpan = row.querySelector('.files-name')
    if (!nameSpan) return

    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'files-rename-input'
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
    const input = row?.querySelector('.files-rename-input')
    if (input) {
      const nameSpan = input.parentElement
      nameSpan.textContent = input.dataset.originalName
    }

    this.editingPath = null
  }

  async commitRename() {
    if (!this.editingPath) return

    const row = this.treeBody?.querySelector(`[data-path="${CSS.escape(this.editingPath)}"]`)
    const input = row?.querySelector('.files-rename-input')
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
        const pathBytes = new TextEncoder().encode(newPath)
        const payload = new Uint8Array(pathBytes.length + 1 + readResult.output.length)
        payload.set(pathBytes, 0)
        payload[pathBytes.length] = 0
        payload.set(readResult.output, pathBytes.length + 1)

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

      this.setStatus(`Renamed to ${newName}`)
      this.editingPath = null
      await this.refresh()
      this.selectPath(newPath)
    } catch (error) {
      this.setStatus(`Error: ${error.message}`)
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
      this.setStatus(`No preview available for ${item.name}`)
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
      this.setStatus(`Error: ${error.message}`)
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

  // --- Modal ---

  showModal(fileInfo, content, handler) {
    if (!this.modal) return

    this.modalTitle.textContent = fileInfo.name
    this.modalBody.innerHTML = ''
    this.modalFooter.innerHTML = ''

    // Let handler render content
    if (handler.canEdit) {
      const saveCallback = handler.edit(content, this.modalBody, fileInfo)
      
      // Add save button
      const saveBtn = document.createElement('button')
      saveBtn.className = 'button-primary'
      saveBtn.textContent = 'Save'
      saveBtn.onclick = async () => {
        try {
          const newContent = saveCallback()
          await this.saveFile(fileInfo.path, newContent)
          this.setStatus(`Saved ${fileInfo.name}`)
          this.closeModal()
          await this.refresh()
        } catch (error) {
          this.setStatus(`Error: ${error.message}`)
        }
      }
      this.modalFooter.appendChild(saveBtn)

      const cancelBtn = document.createElement('button')
      cancelBtn.className = 'button-secondary'
      cancelBtn.textContent = 'Cancel'
      cancelBtn.onclick = () => this.closeModal()
      this.modalFooter.appendChild(cancelBtn)
    } else if (handler.canPreview) {
      handler.preview(content, this.modalBody, fileInfo)
      
      const closeBtn = document.createElement('button')
      closeBtn.className = 'button-secondary'
      closeBtn.textContent = 'Close'
      closeBtn.onclick = () => this.closeModal()
      this.modalFooter.appendChild(closeBtn)
    }

    this.modal.style.display = 'flex'
  }

  closeModal() {
    if (this.modal) {
      this.modal.style.display = 'none'
      this.modalBody.innerHTML = ''
      this.modalFooter.innerHTML = ''
    }
  }

  async saveFile(path, content) {
    const pathBytes = new TextEncoder().encode(path)
    const contentBytes = typeof content === 'string' 
      ? new TextEncoder().encode(content)
      : content

    const payload = new Uint8Array(pathBytes.length + 1 + contentBytes.length)
    payload.set(pathBytes, 0)
    payload[pathBytes.length] = 0
    payload.set(contentBytes, pathBytes.length + 1)

    const result = await this.fsCall('write', payload)
    if (result.returnCode !== 0) {
      throw new Error(this.decoder.decode(result.output))
    }
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
}

customElements.define('view-files', ViewFiles)
