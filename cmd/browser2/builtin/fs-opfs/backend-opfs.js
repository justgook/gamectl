let root = null

export async function init(_config) {
  root = await navigator.storage.getDirectory()
}

function parsePath(pathStr) {
  const normalized = String(pathStr || '').replace(/\\/g, '/').replace(/\/+/g, '/')
  const parts = normalized.split('/').filter(p => p.length > 0)
  if (parts.length === 0) {
    return { dirs: [], name: '' }
  }
  return {
    dirs: parts.slice(0, -1),
    name: parts[parts.length - 1],
  }
}

async function getDir(pathParts, create = false) {
  let current = root
  for (const name of pathParts) {
    current = await current.getDirectoryHandle(name, { create })
  }
  return current
}

async function getFile(pathStr, create = false) {
  const { dirs, name } = parsePath(pathStr)
  if (!name) throw new Error('Invalid file path')
  const dir = await getDir(dirs, create)
  return await dir.getFileHandle(name, { create })
}

export const handlers = {
  async readFile(path) {
    const fileHandle = await getFile(path, false)
    const file = await fileHandle.getFile()
    const buffer = await file.arrayBuffer()
    return { ok: true, data: Array.from(new Uint8Array(buffer)) }
  },

  async writeFile(path, data) {
    const { dirs } = parsePath(path)
    if (dirs.length > 0) {
      await getDir(dirs, true)
    }
    const fileHandle = await getFile(path, true)
    const writable = await fileHandle.createWritable()
    await writable.write(new Uint8Array(data))
    await writable.close()
    return { ok: true }
  },

  async remove(path) {
    const { dirs, name } = parsePath(path)
    const parentDir = dirs.length > 0 ? await getDir(dirs, false) : root
    await parentDir.removeEntry(name)
    return { ok: true }
  },

  async exists(path) {
    try {
      const { dirs, name } = parsePath(path)
      const parentDir = dirs.length > 0 ? await getDir(dirs, false) : root
      if (!name) {
        return { ok: true, data: true }
      }
      try {
        await parentDir.getFileHandle(name)
        return { ok: true, data: true }
      } catch {
        try {
          await parentDir.getDirectoryHandle(name)
          return { ok: true, data: true }
        } catch {
          return { ok: true, data: false }
        }
      }
    } catch {
      return { ok: true, data: false }
    }
  },

  async readdir(path) {
    const { dirs, name } = parsePath(path)
    let targetDir
    if (name) {
      targetDir = await getDir([...dirs, name], false)
    } else if (dirs.length > 0) {
      targetDir = await getDir(dirs, false)
    } else {
      targetDir = root
    }
    const entries = []
    for await (const entry of targetDir.values()) {
      entries.push(entry.name)
    }
    return { ok: true, data: entries }
  },

  async mkdir(path) {
    const { dirs, name } = parsePath(path)
    const allDirs = name ? [...dirs, name] : dirs
    await getDir(allDirs, true)
    return { ok: true }
  },

  async rmdir(path) {
    const { dirs, name } = parsePath(path)
    const parentDir = dirs.length > 0 ? await getDir(dirs, false) : root
    await parentDir.removeEntry(name, { recursive: true })
    return { ok: true }
  },

  async stat(path) {
    const { dirs, name } = parsePath(path)
    const parentDir = dirs.length > 0 ? await getDir(dirs, false) : root
    if (!name) {
      return { ok: true, data: { type: 'directory', size: 0 } }
    }
    try {
      const fileHandle = await parentDir.getFileHandle(name)
      const file = await fileHandle.getFile()
      return { ok: true, data: { type: 'file', size: file.size } }
    } catch {
      try {
        await parentDir.getDirectoryHandle(name)
        return { ok: true, data: { type: 'directory', size: 0 } }
      } catch {
        throw new Error(`Path not found: ${path}`)
      }
    }
  },

  async readHttp(url) {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    const buffer = await response.arrayBuffer()
    return { ok: true, data: Array.from(new Uint8Array(buffer)) }
  },
}
