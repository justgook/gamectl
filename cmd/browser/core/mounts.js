function normalizeMountPath(path) {
  const normalized = String(path || '').replace(/^\/+/, '').replace(/\/+/g, '/')
  if (!normalized || normalized === '.' || normalized.includes('/../') || normalized.startsWith('../') || normalized.endsWith('/..')) {
    throw new Error(`Invalid mount path '${path}'`)
  }
  return normalized
}

function normalizeInputPath(path) {
  return String(path || '').replace(/^\/+/, '').replace(/\/+/g, '/')
}

function normalizeMountName(name) {
  const normalized = normalizeMountPath(name)
  const valid = normalized.split('/').every((part) => /^[A-Za-z][A-Za-z0-9._-]*$/.test(part))
  if (!valid) {
    throw new Error(`Invalid mount name '${name}'`)
  }
  return normalized
}

function childMountEntries(registry, dir) {
  const prefix = dir === '' ? '' : `${dir}/`
  const entries = new Set()
  for (const name of registry.keys()) {
    if (!name.startsWith(prefix)) continue
    const rest = name.slice(prefix.length)
    if (rest === '') continue
    entries.add(rest.split('/')[0])
  }
  return entries
}

function resolveMountPrefix(registry, input) {
  const raw = normalizeInputPath(input)
  if (raw === '' || raw === '.') return null

  let bestName = ''
  for (const name of registry.keys()) {
    if ((raw === name || raw.startsWith(`${name}/`)) && name.length > bestName.length) {
      bestName = name
    }
  }
  if (!bestName) return null

  const rest = raw === bestName ? '' : raw.slice(bestName.length + 1)
  return { raw, mountName: bestName, mount: registry.get(bestName), path: rest }
}

export function createMountRegistry(config) {
  const mounts = config?.mount || {}
  if (!mounts || typeof mounts !== 'object' || Array.isArray(mounts)) {
    throw new Error('fs.mount must be an object keyed by mount name')
  }

  const registry = new Map()
  for (const [rawName, mount] of Object.entries(mounts)) {
    const name = normalizeMountName(rawName)
    if (registry.has(name)) {
      throw new Error(`Duplicate mount name '${name}'`)
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
  const resolved = resolveMountPrefix(registry, input)
  if (!resolved || resolved.path === '') return null
  return { ...resolved, path: normalizeMountPath(resolved.path) }
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
  const raw = normalizeInputPath(input)
  if (registry.has(raw)) return true
  if (childMountEntries(registry, raw).size > 0) return true
  const resolved = resolveMountedPath(registry, input)
  if (!resolved) return null
  return resolved.mount.files.has(resolved.path) || resolved.mount.dirs.has(resolved.path)
}

export function listMountedPath(registry, input) {
  const raw = normalizeInputPath(input)
  if (raw === '' || raw === '.') return Array.from(childMountEntries(registry, '')).sort()

  const virtualEntries = childMountEntries(registry, raw)
  const exactMount = registry.get(raw)
  if (exactMount) {
    return Array.from(new Set([...(exactMount.dirs.get('') || []), ...virtualEntries])).sort()
  }

  const resolved = resolveMountedPath(registry, input)
  if (resolved) {
    const entries = resolved.mount.dirs.get(resolved.path)
    if (!entries) throw new Error(`Mounted directory not found: ${raw}`)
    return Array.from(new Set([...entries, ...virtualEntries])).sort()
  }

  if (virtualEntries.size > 0) return Array.from(virtualEntries).sort()
  return null
}

export function statMountedPath(registry, input) {
  const raw = normalizeInputPath(input)
  if (registry.has(raw) || childMountEntries(registry, raw).size > 0) return { size: 0, type: 'directory' }
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
