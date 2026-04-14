import { runtime } from '../core/runtime.js'
import { createWriteInput } from '../util/fs.js'

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

function getBaseName(path) {
  const normalized = normalizePath(path)
  if (normalized === '/') return '/'
  const parts = normalized.split('/').filter(Boolean)
  return parts[parts.length - 1]
}

function getParentPath(path) {
  const normalized = normalizePath(path)
  if (normalized === '/') return '/'
  const parts = normalized.split('/').filter(Boolean)
  parts.pop()
  return parts.length === 0 ? '/' : `/${parts.join('/')}`
}

function joinPath(basePath, name) {
  const base = normalizePath(basePath)
  if (base === '/') return `/${name}`
  return `${base}/${name}`
}

async function callFs(method, input) {
  const result = await runtime.call('fs', method, input)
  if (result.returnCode !== 0) {
    throw new Error(decodeOutput(result) || `fs.${method} failed: ${result.returnCode}`)
  }
  return result
}

async function pathExists(path) {
  const result = await callFs('exists', path)
  return decodeOutput(result) === 'true'
}

async function renameFile(sourcePath, targetPath) {
  const readResult = await callFs('read', sourcePath)
  await callFs('write', createWriteInput(targetPath, readResult.output))
  await callFs('remove', sourcePath)
}

async function renameDirectory(sourcePath, targetPath) {
  await callFs('mkdir', targetPath)

  const listResult = await callFs('list', sourcePath)
  const names = JSON.parse(decodeOutput(listResult))
  assert(Array.isArray(names), 'fs.list must return an array of entry names')

  for (const name of names) {
    const sourceChildPath = joinPath(sourcePath, name)
    const targetChildPath = joinPath(targetPath, name)
    const statResult = await callFs('stat', sourceChildPath)
    const stat = JSON.parse(decodeOutput(statResult))
    assert(stat && typeof stat.type === 'string', `fs.stat missing type for '${sourceChildPath}'`)

    if (stat.type === 'directory') {
      await renameDirectory(sourceChildPath, targetChildPath)
    } else {
      await renameFile(sourceChildPath, targetChildPath)
    }
  }

  await callFs('rmdir', sourcePath)
}

export class FileRename extends HTMLElement {
  constructor() {
    super()
    this.popupProps = this.popupProps || {}
    this.formElement = null
    this.nameInput = null
    this.locationOutput = null
    this.statusOutput = null
  }

  connectedCallback() {
    if (this.dataset.ready) return
    this.dataset.ready = '1'

    this.style.display = 'contents'

    const mode = this.popupProps?.mode || 'create'
    const kind = this.popupProps?.kind || 'file'
    const initialName = mode === 'rename' ? getBaseName(this.popupProps?.targetPath || '') : (this.popupProps?.initialName || '')

    this.innerHTML = `
      <form data-element="form" novalidate>
        <label for="file-rename-name">${kind === 'directory' ? 'Folder name' : 'File name'}</label>
        <input id="file-rename-name" type="text" data-field="name" autocomplete="off" value="${escapeAttribute(initialName)}">
        <label>Location</label>
        <output data-element="location"></output>
        <footer>
          <output data-element="status"></output>
          <button type="button" data-action="cancel">Cancel</button>
          <button type="submit" data-action="save" class="accent">${mode === 'rename' ? 'Rename' : kind === 'directory' ? 'Create folder' : 'Create file'}</button>
        </footer>
      </form>
    `

    this.formElement = this.querySelector('[data-element="form"]')
    this.nameInput = this.querySelector('[data-field="name"]')
    this.locationOutput = this.querySelector('[data-element="location"]')
    this.statusOutput = this.querySelector('[data-element="status"]')

    assert(this.formElement instanceof HTMLFormElement, 'file-rename missing form element')
    assert(this.nameInput instanceof HTMLInputElement, 'file-rename missing name input')
    assert(this.locationOutput instanceof HTMLOutputElement, 'file-rename missing location output')
    assert(this.statusOutput instanceof HTMLOutputElement, 'file-rename missing status output')

    this.locationOutput.textContent = this.getLocationPath()

    this.querySelector('[data-action="cancel"]')?.addEventListener('click', async () => {
      await runtime.call('ui.popup', 'close', { reload: false, cancelled: true })
    })

    this.formElement.addEventListener('submit', async (event) => {
      event.preventDefault()
      await this.save()
    })

    queueMicrotask(() => {
      this.nameInput.focus()
      this.nameInput.select()
    })
  }

  get mode() {
    return this.popupProps?.mode || 'create'
  }

  get kind() {
    return this.popupProps?.kind || 'file'
  }

  getLocationPath() {
    if (this.mode === 'rename') {
      return getParentPath(this.popupProps?.targetPath || '/')
    }
    return normalizePath(this.popupProps?.parentPath || '/')
  }

  getTargetPath(name) {
    return joinPath(this.getLocationPath(), name)
  }

  setStatus(text, tone = null) {
    this.statusOutput.textContent = text
    this.statusOutput.classList.remove('accent', 'success', 'warning', 'danger', 'info')
    if (tone) this.statusOutput.classList.add(tone)
  }

  validateName(name) {
    if (!name) {
      throw new Error(`${this.kind === 'directory' ? 'Folder' : 'File'} name is required`)
    }
    if (name === '.' || name === '..') {
      throw new Error('Reserved name is not allowed')
    }
    if (name.includes('/')) {
      throw new Error('Name must not contain /')
    }
  }

  async save() {
    const name = this.nameInput.value.trim()

    try {
      this.validateName(name)
      this.nameInput.classList.remove('danger')

      if (this.mode === 'rename') {
        await this.rename(name)
        return
      }

      await this.create(name)
    } catch (error) {
      this.nameInput.classList.add('danger')
      this.nameInput.focus()
      this.setStatus(`Error: ${error?.message || error}`, 'danger')
      console.error('file-rename save failed:', error)
    }
  }

  async create(name) {
    const targetPath = this.getTargetPath(name)
    if (await pathExists(targetPath)) {
      throw new Error(`Path already exists: ${targetPath}`)
    }

    this.setStatus(this.kind === 'directory' ? 'Creating folder...' : 'Creating file...', 'info')

    if (this.kind === 'directory') {
      await callFs('mkdir', targetPath)
    } else {
      await callFs('write', createWriteInput(targetPath, new Uint8Array()))
    }

    await runtime.call('ui.popup', 'close', {
      reload: true,
      mode: this.mode,
      kind: this.kind,
      selectedPath: targetPath,
      revealPath: this.getLocationPath(),
    })
  }

  async rename(name) {
    const sourcePath = normalizePath(this.popupProps?.targetPath || '')
    assert(sourcePath !== '/', 'file-rename cannot rename root path')

    const parentPath = getParentPath(sourcePath)
    const targetPath = joinPath(parentPath, name)

    if (targetPath === sourcePath) {
      await runtime.call('ui.popup', 'close', {
        reload: false,
        mode: this.mode,
        kind: this.kind,
        selectedPath: sourcePath,
      })
      return
    }

    if (await pathExists(targetPath)) {
      throw new Error(`Path already exists: ${targetPath}`)
    }

    this.setStatus('Renaming...', 'info')

    if (this.kind === 'directory') {
      await renameDirectory(sourcePath, targetPath)
    } else {
      await renameFile(sourcePath, targetPath)
    }

    await runtime.call('ui.popup', 'close', {
      reload: true,
      mode: this.mode,
      kind: this.kind,
      selectedPath: targetPath,
      revealPath: parentPath,
    })
  }
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

if (!customElements.get('file-rename')) {
  customElements.define('file-rename', FileRename)
}
