import { runtime } from '../core/runtime.js'

const decoder = new TextDecoder()

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function decodeOutput(result) {
  return decoder.decode(result?.output || new Uint8Array())
}

function normalizePath(path) {
  const raw = String(path || '/').trim()
  if (!raw || raw === '/') return '/'
  const parts = raw.split('/').filter(Boolean)
  return `/${parts.join('/')}`
}

function joinPath(basePath, name) {
  const base = normalizePath(basePath)
  if (base === '/') return `/${name}`
  return `${base}/${name}`
}

function formatSize(size, type) {
  if (type === 'directory') return '--'
  if (!Number.isFinite(size) || size < 0) return '--'
  if (size < 1024) return `${size} B`

  const units = ['KB', 'MB', 'GB', 'TB']
  let value = size / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(digits)} ${units[unitIndex]}`
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1
    if (a.type !== 'directory' && b.type === 'directory') return 1
    return a.name.localeCompare(b.name)
  })
}

function indentText(depth) {
  return '\u00a0\u00a0\u00a0\u00a0'.repeat(depth)
}

function getExtension(path) {
  const name = String(path || '').split('/').pop() || ''
  const parts = name.split('.')
  if (parts.length <= 1) return ''
  return parts.pop().toLowerCase()
}

function resolveFileEditorTag(path) {
  const ext = getExtension(path)
  if (ext) {
    const extTag = `files-${ext}`
    if (customElements.get(extTag)) return extTag
  }
  return 'files-default'
}

export class ViewFiles extends HTMLElement {
  static get observedAttributes() {
    return ['data-root', 'data-mode', 'data-filter', 'data-select-folders', 'data-multi-select', 'data-default-name']
  }

  constructor() {
    super()
    this.rootPath = normalizePath(this.getAttribute('data-root') || '/')
    this.mode = this.getAttribute('data-mode') || 'browser'
    this.filter = this.getAttribute('data-filter') || ''
    this.selectFolders = this.getAttribute('data-select-folders') === 'true'
    this.multiSelect = this.getAttribute('data-multi-select') === 'true'
    this.defaultName = this.getAttribute('data-default-name') || ''
    this.expandedPaths = new Set()
    this.selectedPath = null
    this.selectedPaths = new Set()
    this.fileTree = new Map()
    this.tableElement = null
    this.pathElement = null
    this.statusElement = null
    this.targetElement = null
    this._headerControlsElement = null
  }

  connectedCallback() {
    if (this.dataset.ready) return
    this.dataset.ready = '1'

    this.style.display = 'contents'

    this.innerHTML = `
      <article>
        <table data-element="table"></table>
      </article>
      <footer>
        <output data-element="path"></output>
        <output data-element="target"></output>
        <output data-element="status"></output>
      </footer>
    `

    this.tableElement = this.querySelector('[data-element="table"]')
    this.pathElement = this.querySelector('[data-element="path"]')
    this.targetElement = this.querySelector('[data-element="target"]')
    this.statusElement = this.querySelector('[data-element="status"]')

    assert(this.tableElement instanceof HTMLTableElement, 'view-files missing table element')
    assert(this.pathElement instanceof HTMLOutputElement, 'view-files missing path output')
    assert(this.targetElement instanceof HTMLOutputElement, 'view-files missing target output')
    assert(this.statusElement instanceof HTMLOutputElement, 'view-files missing status output')

    this._mountHeaderControls()

    const toolbar = this._headerControlsElement
    assert(toolbar instanceof HTMLElement, 'view-files missing header controls element')
    toolbar.querySelector('[data-action="refresh"]')?.addEventListener('click', () => this.refresh())
    toolbar.querySelector('[data-action="new-file"]')?.addEventListener('click', () => this.openCreatePopup('file'))
    toolbar.querySelector('[data-action="new-folder"]')?.addEventListener('click', () => this.openCreatePopup('directory'))
    toolbar.querySelector('[data-action="rename"]')?.addEventListener('click', () => this.openRenamePopup())
    toolbar.querySelector('[data-action="delete"]')?.addEventListener('click', () => this.deleteSelected())

    this.addEventListener('keydown', (event) => this.handleKeyDown(event))

    this.setPath(this.rootPath)
    this.updateTargetPath()
    this.updateHeaderControlsUI()
    this.refresh()
  }

  disconnectedCallback() {
    this._unmountHeaderControls()
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return

    if (name === 'data-root') {
      this.rootPath = normalizePath(newValue || '/')
      this.selectedPath = null
      this.selectedPaths.clear()
      this.fileTree.clear()
      this.expandedPaths.clear()
      if (this.dataset.ready) {
        this.setPath(this.rootPath)
        this.updateTargetPath()
        void this.refresh()
      }
      return
    }

    if (name === 'data-mode') {
      this.mode = newValue || 'browser'
      if (this.dataset.ready) this.render()
      return
    }

    if (name === 'data-filter') {
      this.filter = newValue || ''
      if (this.dataset.ready) this.render()
      return
    }

    if (name === 'data-select-folders') {
      this.selectFolders = newValue === 'true'
      if (this.dataset.ready) this.render()
      return
    }

    if (name === 'data-multi-select') {
      this.multiSelect = newValue === 'true'
      if (!this.multiSelect && this.selectedPaths.size > 1) {
        const [first] = this.selectedPaths
        this.selectedPaths = new Set(first ? [first] : [])
        this.selectedPath = first || null
      }
      if (this.dataset.ready) this.render()
      return
    }

    if (name === 'data-default-name') {
      this.defaultName = newValue || ''
    }
  }

  createHeaderControlsElement() {
    const toolbar = document.createElement('div')
    toolbar.dataset.element = 'toolbar'
    toolbar.setAttribute('slot', 'header-controls')
    toolbar.innerHTML = `
      <button data-action="refresh" aria-label="Reload" title="Reload"><i aria-hidden="true">refresh</i></button>
      <button data-action="new-file" aria-label="Create file" title="Create file"><i aria-hidden="true">note_add</i></button>
      <button data-action="new-folder" aria-label="Create folder" title="Create folder"><i aria-hidden="true">create_new_folder</i></button>
      <button data-action="rename" aria-label="Rename" title="Rename"><i aria-hidden="true">drive_file_rename_outline</i></button>
      <button data-action="delete" aria-label="Delete" title="Delete"><i aria-hidden="true">delete</i></button>
    `
    return toolbar
  }

  _mountHeaderControls() {
    if (!this.parentElement || this._headerControlsElement) return

    const headerControls = this.createHeaderControlsElement()
    this._headerControlsElement = headerControls
    this.parentElement.appendChild(headerControls)
  }

  _unmountHeaderControls() {
    if (this._headerControlsElement?.parentElement) {
      this._headerControlsElement.remove()
    }
    this._headerControlsElement = null
  }

  updateHeaderControlsUI() {
    if (!this._headerControlsElement) return
    const renameButton = this._headerControlsElement.querySelector('[data-action="rename"]')
    if (renameButton instanceof HTMLButtonElement) {
      renameButton.disabled = !this.selectedPath
    }

    this.updateTargetPath()

    const deleteButton = this._headerControlsElement.querySelector('[data-action="delete"]')
    if (deleteButton instanceof HTMLButtonElement) {
      deleteButton.disabled = !this.selectedPath
    }
  }

  async callFs(method, input) {
    const result = await runtime.call('fs', method, input)
    if (result.returnCode !== 0) {
      throw new Error(decodeOutput(result) || `fs.${method} failed: ${result.returnCode}`)
    }
    return result
  }

  async refresh() {
    this.setStatus(`Loading ${this.rootPath}...`, 'info')
    this.setPath(this.rootPath)

    try {
      this.fileTree.clear()
      await this.loadDirectory(this.rootPath)
      await this.ensureExpandedDirectoriesLoaded()
      this.pruneSelection()
      this.render()
      this.updateHeaderControlsUI()
      this.setStatus(this.describeStatus(), 'success')
    } catch (error) {
      this.fileTree.clear()
      this.renderError(error)
      this.updateHeaderControlsUI()
      this.setStatus(`Error: ${error?.message || error}`, 'danger')
      console.error('view-files refresh failed:', error)
    }
  }

  async loadDirectory(path) {
    const normalizedPath = normalizePath(path)
    const listResult = await this.callFs('list', normalizedPath)
    const names = JSON.parse(decodeOutput(listResult))
    assert(Array.isArray(names), 'fs.list must return an array of entry names')

    const entries = []
    for (const name of names) {
      const fullPath = joinPath(normalizedPath, name)
      const statResult = await this.callFs('stat', fullPath)
      const stat = JSON.parse(decodeOutput(statResult))
      assert(stat && typeof stat === 'object', `fs.stat returned invalid payload for '${fullPath}'`)
      assert(typeof stat.type === 'string', `fs.stat missing type for '${fullPath}'`)

      entries.push({
        name,
        path: fullPath,
        type: stat.type,
        size: Number.isFinite(stat.size) ? stat.size : Number(stat.size || 0),
      })
    }

    this.fileTree.set(normalizedPath, sortEntries(entries))
  }

  async ensureExpandedDirectoriesLoaded() {
    const pending = [...this.expandedPaths]
    const loaded = new Set()

    while (pending.length > 0) {
      const path = pending.shift()
      if (loaded.has(path)) continue
      loaded.add(path)

      await this.loadDirectory(path)

      const entries = this.fileTree.get(path) || []
      for (const entry of entries) {
        if (entry.type !== 'directory') continue
        if (!this.expandedPaths.has(entry.path)) continue
        pending.push(entry.path)
      }
    }
  }

  pruneSelection() {
    const validPaths = new Set()
    const walk = (path) => {
      const entries = this.fileTree.get(path) || []
      for (const entry of entries) {
        validPaths.add(entry.path)
        if (entry.type === 'directory' && this.fileTree.has(entry.path)) {
          walk(entry.path)
        }
      }
    }
    walk(this.rootPath)

    if (this.selectedPath && !validPaths.has(this.selectedPath)) {
      this.selectedPath = null
    }

    for (const path of [...this.selectedPaths]) {
      if (!validPaths.has(path)) {
        this.selectedPaths.delete(path)
      }
    }

    if (!this.multiSelect && this.selectedPath) {
      this.selectedPaths = new Set([this.selectedPath])
    }
  }

  describeStatus() {
    const rootEntries = this.fileTree.get(this.rootPath) || []
    const noun = rootEntries.length === 1 ? 'entry' : 'entries'
    return `${rootEntries.length} ${noun} at ${this.rootPath}`
  }

  render() {
    assert(this.tableElement instanceof HTMLTableElement, 'view-files table element is not initialized')

    this.tableElement.innerHTML = ''

    const thead = document.createElement('thead')
    thead.innerHTML = '<tr><th>Name</th><th>Type</th><th>Size</th></tr>'
    this.tableElement.appendChild(thead)

    const tbody = document.createElement('tbody')
    this.tableElement.appendChild(tbody)

    const rootEntries = this.fileTree.get(this.rootPath) || []
    if (rootEntries.length === 0) {
      const row = document.createElement('tr')
      const cell = document.createElement('td')
      cell.colSpan = 3
      cell.textContent = 'Folder is empty.'
      row.appendChild(cell)
      tbody.appendChild(row)
      return
    }

    this.renderRows(tbody, rootEntries, 0)
  }

  renderRows(tbody, entries, depth) {
    for (const entry of entries) {
      tbody.appendChild(this.createEntryRow(entry, depth))

      if (entry.type === 'directory' && this.expandedPaths.has(entry.path)) {
        const childEntries = this.fileTree.get(entry.path) || []
        this.renderRows(tbody, childEntries, depth + 1)
      }
    }
  }

  renderError(error) {
    assert(this.tableElement instanceof HTMLTableElement, 'view-files table element is not initialized')

    this.tableElement.innerHTML = ''
    const tbody = document.createElement('tbody')
    const row = document.createElement('tr')
    const cell = document.createElement('td')
    cell.textContent = `Failed to load folder: ${error?.message || error}`
    row.appendChild(cell)
    tbody.appendChild(row)
    this.tableElement.appendChild(tbody)
  }

  createEntryRow(entry, depth) {
    const row = document.createElement('tr')
    row.dataset.element = 'entry-row'
    row.dataset.path = entry.path
    row.dataset.type = entry.type
    row.setAttribute('tabindex', '0')
    row.setAttribute('aria-selected', this.isPathSelected(entry.path) ? 'true' : 'false')

    const nameCell = document.createElement('td')
    if (depth > 0) {
      nameCell.appendChild(document.createTextNode(indentText(depth)))
    }

    if (entry.type === 'directory') {
      const icon = document.createElement('i')
      icon.setAttribute('aria-hidden', 'true')
      icon.textContent = this.expandedPaths.has(entry.path) ? 'folder_open' : 'folder'
      nameCell.appendChild(icon)
      nameCell.appendChild(document.createTextNode(' '))
    } else {
      const icon = document.createElement('i')
      icon.setAttribute('aria-hidden', 'true')
      icon.textContent = 'description'
      nameCell.appendChild(icon)
      nameCell.appendChild(document.createTextNode(' '))
    }

    nameCell.appendChild(document.createTextNode(entry.name))

    const typeCell = document.createElement('td')
    typeCell.textContent = entry.type === 'directory' ? 'Folder' : 'File'

    const sizeCell = document.createElement('td')
    sizeCell.textContent = formatSize(entry.size, entry.type)

    row.appendChild(nameCell)
    row.appendChild(typeCell)
    row.appendChild(sizeCell)

    row.addEventListener('click', async () => {
      if (entry.type === 'directory') {
        this.selectRow(entry.path)
        await this.toggleDirectory(entry.path)
        return
      }
      this.selectRow(entry.path)
    })
    row.addEventListener('dblclick', async () => {
      if (entry.type === 'file') {
        await this.openFile(entry.path)
      }
    })
    row.addEventListener('keydown', (event) => this.handleRowKeyDown(event, entry))

    return row
  }

  isPathSelected(path) {
    if (this.multiSelect) return this.selectedPaths.has(path)
    return this.selectedPath === path
  }

  getEntry(path, directoryPath = this.rootPath) {
    const entries = this.fileTree.get(directoryPath) || []
    for (const entry of entries) {
      if (entry.path === path) return entry
      if (entry.type === 'directory' && this.fileTree.has(entry.path)) {
        const found = this.getEntry(path, entry.path)
        if (found) return found
      }
    }
    return null
  }

  getTargetDirectoryPath() {
    if (!this.selectedPath) return this.rootPath
    const selectedEntry = this.getEntry(this.selectedPath)
    if (!selectedEntry) return this.rootPath

    if (selectedEntry.type === 'directory') {
      if (this.expandedPaths.has(selectedEntry.path)) {
        return selectedEntry.path
      }
      const slashIndex = selectedEntry.path.lastIndexOf('/')
      return slashIndex <= 0 ? '/' : selectedEntry.path.slice(0, slashIndex)
    }

    const slashIndex = this.selectedPath.lastIndexOf('/')
    return slashIndex <= 0 ? '/' : this.selectedPath.slice(0, slashIndex)
  }

  async openCreatePopup(kind) {
    const parentPath = this.getTargetDirectoryPath()
    const title = kind === 'directory' ? 'Create Folder' : 'Create File'
    const result = await runtime.call('ui.popup', 'open', {
      title,
      size: 'medium',
      tag: 'file-rename',
      props: {
        mode: 'create',
        kind,
        parentPath,
      },
    })

    const payload = JSON.parse(decodeOutput(result) || 'null')
    if (payload?.reload) {
      if (payload.revealPath && payload.revealPath !== this.rootPath) {
        this.expandedPaths.add(payload.revealPath)
      }
      await this.refresh()
      if (payload.selectedPath) this.selectRow(payload.selectedPath)
    }
  }

  async openRenamePopup() {
    if (!this.selectedPath) return
    const entry = this.getEntry(this.selectedPath)
    assert(entry, `view-files selected path not found: ${this.selectedPath}`)

    const sourcePath = entry.path
    const result = await runtime.call('ui.popup', 'open', {
      title: entry.type === 'directory' ? 'Rename Folder' : 'Rename File',
      size: 'medium',
      tag: 'file-rename',
      props: {
        mode: 'rename',
        kind: entry.type,
        targetPath: entry.path,
      },
    })

    const payload = JSON.parse(decodeOutput(result) || 'null')
    if (payload?.reload) {
      if (entry.type === 'directory' && payload.selectedPath) {
        this.rewriteExpandedPaths(sourcePath, payload.selectedPath)
      }
      if (payload.revealPath && payload.revealPath !== this.rootPath) {
        this.expandedPaths.add(payload.revealPath)
      }
      this.selectedPath = null
      this.selectedPaths.clear()
      await this.refresh()
      if (payload.selectedPath) this.selectRow(payload.selectedPath)
    }
  }

  async confirmDelete(entry) {
    const result = await runtime.call('ui.toast', 'confirm', {
      message: entry.type === 'directory'
        ? `Delete folder "${entry.name}" and all its contents?`
        : `Delete file "${entry.name}"?`,
      type: 'warning',
      confirmText: 'Delete',
      cancelText: 'Cancel',
    })
    return JSON.parse(decodeOutput(result) || 'false') === true
  }

  async deletePathRecursive(path) {
    const statResult = await this.callFs('stat', path)
    const stat = JSON.parse(decodeOutput(statResult))
    assert(stat && typeof stat.type === 'string', `fs.stat missing type for '${path}'`)

    if (stat.type === 'directory') {
      const listResult = await this.callFs('list', path)
      const names = JSON.parse(decodeOutput(listResult))
      assert(Array.isArray(names), 'fs.list must return an array of entry names')

      for (const name of names) {
        await this.deletePathRecursive(joinPath(path, name))
      }

      await this.callFs('rmdir', path)
      return
    }

    await this.callFs('remove', path)
  }

  async deleteSelected() {
    if (!this.selectedPath) return
    const entry = this.getEntry(this.selectedPath)
    assert(entry, `view-files selected path not found: ${this.selectedPath}`)

    const confirmed = await this.confirmDelete(entry)
    if (!confirmed) return

    this.setStatus(`Deleting ${entry.path}...`, 'info')
    await this.deletePathRecursive(entry.path)

    this.selectedPath = null
    this.selectedPaths.clear()
    this.fileTree.clear()
    this.removeExpandedPathTree(entry.path)
    await this.refresh()
  }

  async openFile(path) {
    const entry = this.getEntry(path)
    assert(entry, `view-files file path not found: ${path}`)
    assert(entry.type === 'file', `view-files openFile expected file path: ${path}`)

    const result = await runtime.call('ui.popup', 'open', {
      title: entry.name,
      size: 'large',
      tag: resolveFileEditorTag(entry.path),
      props: {
        path: entry.path,
      },
    })

    const payload = JSON.parse(decodeOutput(result) || 'null')
    if (payload?.reload) {
      await this.refresh()
      if (payload.selectedPath) this.selectRow(payload.selectedPath)
    }
  }

  rewriteExpandedPaths(sourcePath, targetPath) {
    const source = normalizePath(sourcePath)
    const target = normalizePath(targetPath)
    const next = new Set()

    for (const path of this.expandedPaths) {
      if (path === source) {
        next.add(target)
        continue
      }
      if (path.startsWith(`${source}/`)) {
        next.add(`${target}${path.slice(source.length)}`)
        continue
      }
      next.add(path)
    }

    this.expandedPaths = next
  }

  removeExpandedPathTree(pathToRemove) {
    const target = normalizePath(pathToRemove)
    const next = new Set()

    for (const path of this.expandedPaths) {
      if (path === target) continue
      if (path.startsWith(`${target}/`)) continue
      next.add(path)
    }

    this.expandedPaths = next
  }

  selectRow(path) {
    this.selectedPath = path
    if (this.multiSelect) {
      if (this.selectedPaths.has(path)) this.selectedPaths.delete(path)
      else this.selectedPaths.add(path)
    } else {
      this.selectedPaths = new Set([path])
    }
    this.updateSelectionUI()
    this.updateHeaderControlsUI()
  }

  updateSelectionUI() {
    this.querySelectorAll('[data-element="entry-row"]').forEach((row) => {
      row.setAttribute('aria-selected', this.isPathSelected(row.dataset.path) ? 'true' : 'false')
    })
  }

  async handleRowKeyDown(event, entry) {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (entry.type === 'directory') {
        this.selectRow(entry.path)
        await this.toggleDirectory(entry.path)
      } else {
        this.selectRow(entry.path)
        await this.openFile(entry.path)
      }
      return
    }

    if (event.key === ' ') {
      event.preventDefault()
      this.selectRow(entry.path)
    }
  }

  handleKeyDown(event) {
    if (event.key === 'F5') {
      event.preventDefault()
      void this.refresh()
      return
    }

    if (event.key === 'F2') {
      event.preventDefault()
      void this.openRenamePopup()
      return
    }

    if (event.key === 'Delete') {
      event.preventDefault()
      void this.deleteSelected()
    }
  }

  async toggleDirectory(path) {
    const normalizedPath = normalizePath(path)
    if (this.expandedPaths.has(normalizedPath)) {
      this.expandedPaths.delete(normalizedPath)
      this.render()
      this.setStatus(this.describeStatus(), 'success')
      return
    }

    this.setStatus(`Loading ${normalizedPath}...`, 'info')
    if (!this.fileTree.has(normalizedPath)) {
      await this.loadDirectory(normalizedPath)
    }
    this.expandedPaths.add(normalizedPath)
    this.render()
    this.setStatus(this.describeStatus(), 'success')
  }

  setPath(path) {
    assert(this.pathElement instanceof HTMLOutputElement, 'view-files path output is not initialized')
    this.pathElement.textContent = `Root: ${path}`
  }

  updateTargetPath() {
    assert(this.targetElement instanceof HTMLOutputElement, 'view-files target output is not initialized')
    this.targetElement.textContent = `Create in: ${this.getTargetDirectoryPath()}`
  }

  setStatus(text, tone = null) {
    assert(this.statusElement instanceof HTMLOutputElement, 'view-files status output is not initialized')
    this.statusElement.textContent = text
    this.statusElement.classList.remove('accent', 'success', 'warning', 'danger', 'info')
    if (tone) {
      this.statusElement.classList.add(tone)
    }
  }
}

if (!customElements.get('view-files')) {
  customElements.define('view-files', ViewFiles)
}
