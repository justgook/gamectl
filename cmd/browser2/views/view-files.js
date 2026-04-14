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
        <output data-element="status"></output>
      </footer>
    `

    this.tableElement = this.querySelector('[data-element="table"]')
    this.pathElement = this.querySelector('[data-element="path"]')
    this.statusElement = this.querySelector('[data-element="status"]')

    assert(this.tableElement instanceof HTMLTableElement, 'view-files missing table element')
    assert(this.pathElement instanceof HTMLOutputElement, 'view-files missing path output')
    assert(this.statusElement instanceof HTMLOutputElement, 'view-files missing status output')

    this._mountHeaderControls()

    const toolbar = this._headerControlsElement
    assert(toolbar instanceof HTMLElement, 'view-files missing header controls element')
    toolbar.querySelector('[data-action="refresh"]')?.addEventListener('click', () => this.refresh())

    this.addEventListener('keydown', (event) => this.handleKeyDown(event))

    this.setPath(this.rootPath)
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
      await this.loadDirectory(this.rootPath)
      await this.ensureExpandedDirectoriesLoaded()
      this.pruneSelection()
      this.render()
      this.setStatus(this.describeStatus(), 'success')
    } catch (error) {
      this.fileTree.clear()
      this.renderError(error)
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
    for (const path of this.expandedPaths) {
      if (this.fileTree.has(path)) continue
      await this.loadDirectory(path)
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
    row.addEventListener('keydown', (event) => this.handleRowKeyDown(event, entry))

    return row
  }

  isPathSelected(path) {
    if (this.multiSelect) return this.selectedPaths.has(path)
    return this.selectedPath === path
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
    this.pathElement.textContent = path
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
