/**
 * WebDAV Backend
 * 
 * Provides filesystem operations backed by a WebDAV server.
 * All operations use fetch() with standard WebDAV HTTP methods:
 * 
 *   readFile  → GET
 *   writeFile → PUT (auto-creates parent dirs via MKCOL)
 *   remove    → DELETE
 *   exists    → HEAD (200 = true, 404 = false)
 *   readdir   → PROPFIND depth 1 (parse multistatus XML)
 *   mkdir     → MKCOL
 *   rmdir     → DELETE
 *   stat      → PROPFIND depth 0
 *   readHttp  → GET (any URL, passthrough)
 * 
 * Config: { url: 'https://webdav.example.com/files' }
 * 
 * @module backends/webdav
 */

let baseUrl = ''

/**
 * Initialize the WebDAV backend
 * @param {Object} config
 * @param {string} config.url - Base URL of the WebDAV server (no trailing slash)
 */
export async function init(config) {
  if (!config || !config.url) {
    throw new Error('WebDAV backend requires config.url')
  }
  // Strip trailing slash for consistent path joining
  baseUrl = config.url.replace(/\/+$/, '')
}

/**
 * Build full URL from a relative path
 * @param {string} path - e.g. "/foo/bar.txt"
 * @returns {string} - e.g. "https://server.com/files/foo/bar.txt"
 */
function buildUrl(path) {
  // Normalize: ensure path starts with /
  const normalized = path.startsWith('/') ? path : '/' + path
  return baseUrl + normalized
}

/**
 * Ensure a directory path ends with / for WebDAV conventions
 * @param {string} path
 * @returns {string}
 */
function ensureTrailingSlash(path) {
  return path.endsWith('/') ? path : path + '/'
}

/**
 * Extract parent directory path from a file path
 * "/foo/bar/baz.txt" -> "/foo/bar/"
 * @param {string} path
 * @returns {string|null}
 */
function parentDir(path) {
  const normalized = path.replace(/\/+$/, '')
  const lastSlash = normalized.lastIndexOf('/')
  if (lastSlash <= 0) return null
  return normalized.slice(0, lastSlash + 1)
}

/**
 * Recursively create parent directories via MKCOL
 * WebDAV requires each directory level to exist before creating children.
 * @param {string} dirPath - directory path (with trailing slash)
 */
async function mkdirRecursive(dirPath) {
  const normalized = ensureTrailingSlash(dirPath)
  const url = buildUrl(normalized)

  // Check if it already exists
  const check = await fetch(url, { method: 'HEAD' })
  if (check.ok) return

  // Ensure parent exists first
  const parent = parentDir(normalized.replace(/\/+$/, ''))
  if (parent) {
    await mkdirRecursive(parent)
  }

  // Create this directory
  const resp = await fetch(url, { method: 'MKCOL' })
  // 201 Created, 405 Method Not Allowed (already exists) are both ok
  if (!resp.ok && resp.status !== 405) {
    throw new Error(`MKCOL ${normalized} failed: ${resp.status} ${resp.statusText}`)
  }
}

/**
 * Parse a WebDAV multistatus XML response to extract entries
 * @param {string} xml - The XML response body
 * @param {string} basePath - The requested directory path (to filter self-entry)
 * @returns {Array<{name: string, isDirectory: boolean, size: number}>}
 */
function parseMultistatus(xml, basePath) {
  const entries = []
  const normalizedBase = ensureTrailingSlash(basePath)

  // Match each <D:response> or <d:response> block
  const responseRegex = /<(?:D|d):response>([\s\S]*?)<\/(?:D|d):response>/g
  let match

  while ((match = responseRegex.exec(xml)) !== null) {
    const block = match[1]

    // Extract href
    const hrefMatch = block.match(/<(?:D|d):href>([^<]+)<\/(?:D|d):href>/)
    if (!hrefMatch) continue

    const href = decodeURIComponent(hrefMatch[1])

    // Skip the directory itself (self-entry)
    // The self-entry's href ends with the basePath or is exactly the basePath
    if (href === normalizedBase || href === normalizedBase.replace(/\/$/, '')) continue

    // Also check against the full URL form
    const fullBase = buildUrl(normalizedBase)
    const fullBaseNoSlash = fullBase.replace(/\/$/, '')
    if (href === fullBase || href === fullBaseNoSlash) continue

    // Determine if it's a directory (has <D:collection/> in resourcetype)
    const isDirectory = /<(?:D|d):collection\s*\/?>/.test(block)

    // Extract name from href — last path segment
    const cleanHref = href.replace(/\/+$/, '')
    const segments = cleanHref.split('/').filter(s => s.length > 0)
    const name = segments[segments.length - 1]
    if (!name) continue

    // Extract content length if available
    const sizeMatch = block.match(/<(?:D|d):getcontentlength>(\d+)<\/(?:D|d):getcontentlength>/)
    const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 0

    entries.push({ name, isDirectory, size })
  }

  return entries
}

/**
 * Operation handlers — same interface as all backends
 * Each handler receives (path, data?) and returns { ok, data?, error? }
 */
export const handlers = {
  async readFile(path) {
    const url = buildUrl(path)
    const response = await fetch(url, { method: 'GET' })

    if (!response.ok) {
      throw new Error(`GET ${path} failed: ${response.status} ${response.statusText}`)
    }

    const buffer = await response.arrayBuffer()
    return { ok: true, data: Array.from(new Uint8Array(buffer)) }
  },

  async writeFile(path, data) {
    // Ensure parent directories exist
    const parent = parentDir(path)
    if (parent) {
      await mkdirRecursive(parent)
    }

    const url = buildUrl(path)
    const response = await fetch(url, {
      method: 'PUT',
      body: new Uint8Array(data),
      headers: {
        'Content-Type': 'application/octet-stream'
      }
    })

    if (!response.ok) {
      throw new Error(`PUT ${path} failed: ${response.status} ${response.statusText}`)
    }

    return { ok: true }
  },

  async remove(path) {
    const url = buildUrl(path)
    const response = await fetch(url, { method: 'DELETE' })

    if (!response.ok && response.status !== 404) {
      throw new Error(`DELETE ${path} failed: ${response.status} ${response.statusText}`)
    }

    return { ok: true }
  },

  async exists(path) {
    const url = buildUrl(path)
    try {
      const response = await fetch(url, { method: 'HEAD' })
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
      headers: {
        'Depth': '1',
        'Content-Type': 'application/xml; charset=utf-8'
      },
      body: '<?xml version="1.0" encoding="utf-8"?>' +
        '<D:propfind xmlns:D="DAV:">' +
        '<D:prop><D:resourcetype/><D:getcontentlength/></D:prop>' +
        '</D:propfind>'
    })

    if (!response.ok && response.status !== 207) {
      throw new Error(`PROPFIND ${dirPath} failed: ${response.status} ${response.statusText}`)
    }

    const xml = await response.text()
    const entries = parseMultistatus(xml, dirPath)
    return { ok: true, data: entries.map(e => e.name) }
  },

  async mkdir(path) {
    await mkdirRecursive(path)
    return { ok: true }
  },

  async rmdir(path) {
    const dirPath = ensureTrailingSlash(path)
    const url = buildUrl(dirPath)
    const response = await fetch(url, { method: 'DELETE' })

    if (!response.ok && response.status !== 404) {
      throw new Error(`DELETE ${dirPath} failed: ${response.status} ${response.statusText}`)
    }

    return { ok: true }
  },

  async stat(path) {
    const url = buildUrl(path)

    const response = await fetch(url, {
      method: 'PROPFIND',
      headers: {
        'Depth': '0',
        'Content-Type': 'application/xml; charset=utf-8'
      },
      body: '<?xml version="1.0" encoding="utf-8"?>' +
        '<D:propfind xmlns:D="DAV:">' +
        '<D:prop><D:resourcetype/><D:getcontentlength/></D:prop>' +
        '</D:propfind>'
    })

    if (!response.ok && response.status !== 207) {
      throw new Error(`PROPFIND ${path} failed: ${response.status} ${response.statusText}`)
    }

    const xml = await response.text()

    // Check if it's a collection (directory)
    const isDirectory = /<(?:D|d):collection\s*\/?>/.test(xml)
    const sizeMatch = xml.match(/<(?:D|d):getcontentlength>(\d+)<\/(?:D|d):getcontentlength>/)
    const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 0

    return {
      ok: true,
      data: {
        type: isDirectory ? 'directory' : 'file',
        size
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
  }
}
