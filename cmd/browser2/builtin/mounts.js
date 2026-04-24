function normalizeMountPath(path) {
  const normalized = String(path || '').replace(/^\/+/, '').replace(/\/+/g, '/')
  if (!normalized || normalized === '.' || normalized.includes('/../') || normalized.startsWith('../') || normalized.endsWith('/..')) {
    throw new Error(`Invalid mount path '${path}'`)
  }
  return normalized
}

export function createMountRegistry(config) {
  const mounts = config?.mount || {}
  if (!mounts || typeof mounts !== 'object' || Array.isArray(mounts)) {
    throw new Error('fs.mount must be an object keyed by mount name')
  }

  const registry = new Map()
  for (const [name, mount] of Object.entries(mounts)) {
    if (!/^[A-Za-z][A-Za-z0-9._-]*$/.test(name)) {
      throw new Error(`Invalid mount name '${name}'`)
    }
    if (!mount || typeof mount !== 'object' || Array.isArray(mount)) {
      throw new Error(`fs.mount.${name} must be an object`)
    }
    if (mount.driver !== 'http') {
      throw new Error(`fs.mount.${name}.driver must be 'http'`)
    }
    if (!Array.isArray(mount.files)) {
      throw new Error(`fs.mount.${name}.files must be an array`)
    }

    const files = new Map()
    const dirs = new Map([['', new Set()]])
    for (const file of mount.files) {
      if (!file || typeof file !== 'object' || Array.isArray(file)) {
        throw new Error(`fs.mount.${name}.files entries must be objects`)
      }
      const path = normalizeMountPath(file.path)
      if (typeof file.url !== 'string' || file.url.length === 0) {
        throw new Error(`fs.mount.${name}.files '${path}' must define url`)
      }
      if (files.has(path)) {
        throw new Error(`Duplicate mounted file '${name}/${path}'`)
      }
      files.set(path, file.url)

      const parts = path.split('/')
      for (let i = 0; i < parts.length; i++) {
        const dir = parts.slice(0, i).join('/')
        const child = parts[i]
        if (!dirs.has(dir)) dirs.set(dir, new Set())
        dirs.get(dir).add(child)
        const childPath = parts.slice(0, i + 1).join('/')
        if (i < parts.length - 1 && !dirs.has(childPath)) dirs.set(childPath, new Set())
      }
    }

    registry.set(name, { files, dirs })
  }

  return registry
}

export function resolveMountedPath(registry, input) {
  const raw = String(input || '').replace(/^\/+/, '')
  const slashIndex = raw.indexOf('/')
  if (slashIndex <= 0) return null

  const mountName = raw.slice(0, slashIndex)
  const mount = registry.get(mountName)
  if (!mount) return null

  const path = normalizeMountPath(raw.slice(slashIndex + 1))
  return { mountName, mount, path }
}

export function readMountedPath(registry, input, readHttpSync) {
  const resolved = resolveMountedPath(registry, input)
  if (!resolved) return null
  const url = resolved.mount.files.get(resolved.path)
  if (!url) throw new Error(`Mounted file not found: ${resolved.mountName}/${resolved.path}`)
  const baseUrl = globalThis.location?.origin || 'http://localhost'
  return readHttpSync(new URL(url, baseUrl).href)
}

export function mountedPathExists(registry, input) {
  const raw = String(input || '').replace(/^\/+/, '').replace(/\/+/g, '/')
  if (registry.has(raw)) return true
  const resolved = resolveMountedPath(registry, input)
  if (!resolved) return null
  return resolved.mount.files.has(resolved.path) || resolved.mount.dirs.has(resolved.path)
}

export function listMountedPath(registry, input) {
  const raw = String(input || '').replace(/^\/+/, '').replace(/\/+/g, '/')
  if (raw === '' || raw === '.') return Array.from(registry.keys()).sort()

  const slashIndex = raw.indexOf('/')
  const mountName = slashIndex === -1 ? raw : raw.slice(0, slashIndex)
  const mount = registry.get(mountName)
  if (!mount) return null
  const path = slashIndex === -1 ? '' : normalizeMountPath(raw.slice(slashIndex + 1))
  const entries = mount.dirs.get(path)
  if (!entries) throw new Error(`Mounted directory not found: ${raw}`)
  return Array.from(entries).sort()
}

export function statMountedPath(registry, input) {
  const raw = String(input || '').replace(/^\/+/, '').replace(/\/+/g, '/')
  if (registry.has(raw)) return { size: 0, type: 'directory' }
  const resolved = resolveMountedPath(registry, input)
  if (!resolved) return null
  if (resolved.mount.files.has(resolved.path)) {
    return { size: 0, type: 'file' }
  }
  if (resolved.mount.dirs.has(resolved.path)) {
    return { size: 0, type: 'directory' }
  }
  throw new Error(`Mounted path not found: ${resolved.mountName}/${resolved.path}`)
}
