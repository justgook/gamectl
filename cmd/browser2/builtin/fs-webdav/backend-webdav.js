let baseUrl = ''
let authorization = ''

export async function init(config) {
  if (!config || !config.url) {
    throw new Error('WebDAV backend requires config.url')
  }
  baseUrl = config.url.replace(/\/+$/, '')
  authorization = config.authorization || ''
}

function withAuthHeaders(headers = {}) {
  if (!authorization) return headers
  return { ...headers, Authorization: authorization }
}

function buildUrl(path) {
  const normalized = path.startsWith('/') ? path : '/' + path
  return baseUrl + normalized
}

function ensureTrailingSlash(path) {
  return path.endsWith('/') ? path : path + '/'
}

function parentDir(path) {
  const normalized = path.replace(/\/+$/, '')
  const lastSlash = normalized.lastIndexOf('/')
  if (lastSlash <= 0) return null
  return normalized.slice(0, lastSlash + 1)
}

async function mkdirRecursive(dirPath) {
  const normalized = ensureTrailingSlash(dirPath)
  const url = buildUrl(normalized)
  const check = await fetch(url, { method: 'HEAD', headers: withAuthHeaders() })
  if (check.ok) return
  const parent = parentDir(normalized.replace(/\/+$/, ''))
  if (parent) {
    await mkdirRecursive(parent)
  }
  const resp = await fetch(url, { method: 'MKCOL', headers: withAuthHeaders() })
  if (!resp.ok && resp.status !== 405) {
    throw new Error(`MKCOL ${normalized} failed: ${resp.status} ${resp.statusText}`)
  }
}

function extractPath(href) {
  let path = href
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try { path = new URL(path).pathname } catch {}
  }
  const baseUrlPath = baseUrl.startsWith('http')
    ? new URL(baseUrl).pathname.replace(/\/+$/, '')
    : baseUrl.replace(/\/+$/, '')
  if (baseUrlPath && path.startsWith(baseUrlPath)) {
    path = path.slice(baseUrlPath.length)
  }
  return path.replace(/^\/+|\/+$/g, '')
}

function pathDepth(normalizedPath) {
  if (!normalizedPath) return 0
  return normalizedPath.split('/').filter(s => s.length > 0).length
}

function parseMultistatus(xml, basePath, depth = Infinity) {
  const entries = []
  const baseNorm = extractPath(basePath)
  const baseDepth = pathDepth(baseNorm)
  const responseRegex = /<(?:D|d):response>([\s\S]*?)<\/(?:D|d):response>/g
  let match

  while ((match = responseRegex.exec(xml)) !== null) {
    const block = match[1]
    const hrefMatch = block.match(/<(?:D|d):href>([^<]+)<\/(?:D|d):href>/)
    if (!hrefMatch) continue

    const href = decodeURIComponent(hrefMatch[1])
    const entryNorm = extractPath(href)
    const entryDepth = pathDepth(entryNorm)
    const isSelf = entryNorm === baseNorm

    if (depth === 0) {
      if (!isSelf) continue
    } else if (depth === 1) {
      if (isSelf) continue
      if (entryDepth !== baseDepth + 1) continue
      if (baseNorm && !entryNorm.startsWith(baseNorm + '/')) continue
    } else {
      if (isSelf) continue
    }

    const isDirectory = /<(?:D|d):collection[\s\S]*?\/?>/.test(block)
    const cleanHref = href.replace(/\/+$/, '')
    const segments = cleanHref.split('/').filter(s => s.length > 0)
    const name = segments[segments.length - 1]
    if (!name) continue
    const sizeMatch = block.match(/<(?:D|d):getcontentlength>(\d+)<\/(?:D|d):getcontentlength>/)
    const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 0
    entries.push({ name, isDirectory, size })
  }

  return entries
}

export const handlers = {
  async readFile(path) {
    const url = buildUrl(path)
    const response = await fetch(url, { method: 'GET', headers: withAuthHeaders() })
    if (!response.ok) {
      throw new Error(`GET ${path} failed: ${response.status} ${response.statusText}`)
    }
    const buffer = await response.arrayBuffer()
    return { ok: true, data: Array.from(new Uint8Array(buffer)) }
  },

  async writeFile(path, data) {
    const parent = parentDir(path)
    if (parent) {
      await mkdirRecursive(parent)
    }
    const url = buildUrl(path)
    const response = await fetch(url, {
      method: 'PUT',
      body: new Uint8Array(data),
      headers: withAuthHeaders({ 'Content-Type': 'application/octet-stream' }),
    })
    if (!response.ok) {
      throw new Error(`PUT ${path} failed: ${response.status} ${response.statusText}`)
    }
    return { ok: true }
  },

  async remove(path) {
    const url = buildUrl(path)
    const response = await fetch(url, { method: 'DELETE', headers: withAuthHeaders() })
    if (!response.ok && response.status !== 404) {
      throw new Error(`DELETE ${path} failed: ${response.status} ${response.statusText}`)
    }
    return { ok: true }
  },

  async exists(path) {
    const url = buildUrl(path)
    try {
      const response = await fetch(url, { method: 'HEAD', headers: withAuthHeaders() })
      return { ok: true, data: response.ok }
    } catch {
      return { ok: true, data: false }
    }
  },

  async readdir(path) {
    const dirPath = ensureTrailingSlash(path || '/')
    const url = buildUrl(dirPath)
    const response = await fetch(url, {
      method: 'PROPFIND',
      headers: withAuthHeaders({
        Depth: '1',
        'Content-Type': 'application/xml; charset=utf-8',
      }),
      body: '<?xml version="1.0" encoding="utf-8"?>' +
        '<D:propfind xmlns:D="DAV:">' +
        '<D:prop><D:resourcetype/><D:getcontentlength/></D:prop>' +
        '</D:propfind>',
    })
    if (!response.ok && response.status !== 207) {
      throw new Error(`PROPFIND ${dirPath} failed: ${response.status} ${response.statusText}`)
    }
    const xml = await response.text()
    const entries = parseMultistatus(xml, dirPath, 1)
    return { ok: true, data: entries.map(e => e.name) }
  },

  async mkdir(path) {
    await mkdirRecursive(path)
    return { ok: true }
  },

  async rmdir(path) {
    const dirPath = ensureTrailingSlash(path)
    const url = buildUrl(dirPath)
    const response = await fetch(url, { method: 'DELETE', headers: withAuthHeaders() })
    if (!response.ok && response.status !== 404) {
      throw new Error(`DELETE ${dirPath} failed: ${response.status} ${response.statusText}`)
    }
    return { ok: true }
  },

  async stat(path) {
    const url = buildUrl(path)
    const response = await fetch(url, {
      method: 'PROPFIND',
      headers: withAuthHeaders({
        Depth: '0',
        'Content-Type': 'application/xml; charset=utf-8',
      }),
      body: '<?xml version="1.0" encoding="utf-8"?>' +
        '<D:propfind xmlns:D="DAV:">' +
        '<D:prop><D:resourcetype/><D:getcontentlength/></D:prop>' +
        '</D:propfind>',
    })
    if (!response.ok && response.status !== 207) {
      throw new Error(`PROPFIND ${path} failed: ${response.status} ${response.statusText}`)
    }
    const xml = await response.text()
    const entries = parseMultistatus(xml, path, 0)
    if (entries.length > 0) {
      const self = entries[0]
      return { ok: true, data: { type: self.isDirectory ? 'directory' : 'file', size: self.size } }
    }
    const firstBlock = xml.match(/<(?:D|d):response>([\s\S]*?)<\/(?:D|d):response>/)
    const block = firstBlock ? firstBlock[1] : xml
    const isDirectory = /<(?:D|d):collection[\s\S]*?\/?>/.test(block)
    const sizeMatch = block.match(/<(?:D|d):getcontentlength>(\d+)<\/(?:D|d):getcontentlength>/)
    const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 0
    return { ok: true, data: { type: isDirectory ? 'directory' : 'file', size } }
  },

  async readHttp(url) {
    const response = await fetch(url, { headers: withAuthHeaders() })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    const buffer = await response.arrayBuffer()
    return { ok: true, data: Array.from(new Uint8Array(buffer)) }
  },
}
