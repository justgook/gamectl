/**
 * Filesystem Plugin API
 * 
 * Provides synchronous filesystem operations for WASM plugins
 * using OPFS (Origin Private File System) as the backend.
 * 
 * Supports multiple read sources:
 * - OPFS paths: "/path/to/file" (default)
 * - Base64 data: "base64:SGVsbG8gV29ybGQ="
 * - HTTP URLs: "http://..." or "https://..."
 * 
 * All functions return: { returnCode: number, output: Uint8Array }
 * - returnCode 0 = success
 * - returnCode 1 = error (output contains error message)
 */

import { FsAdapter } from './FsAdapter.js'

let fs = null

const encoder = new TextEncoder()
const decoder = new TextDecoder()

// Helper to encode string to Uint8Array
function encodeOutput(str) {
  return encoder.encode(str)
}

// Helper to decode input (handles both string and Uint8Array)
function decodeInput(input) {
  if (typeof input === 'string') {
    return input
  }
  return decoder.decode(input)
}

// Helper to create success response
function success(output = '') {
  const data = typeof output === 'string' ? encodeOutput(output) : output
  return { returnCode: 0, output: data }
}

// Helper to create error response
function error(message) {
  return { returnCode: 1, output: encodeOutput(message) }
}

/**
 * Initialize the filesystem
 * Uses OPFS (Origin Private File System) as the storage backend
 * @returns {Promise<FsAdapter>}
 */
export async function create() {
  // Worker will obtain OPFS root internally to avoid handle cloning issues (Safari)
  fs = await FsAdapter.start()
  return fs
}

/**
 * Decode base64 string to Uint8Array
 * @param {string} base64 - base64 encoded string
 * @returns {Uint8Array}
 */
function base64ToUint8Array(base64) {
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Read file contents from various sources
 * 
 * Supported schemes:
 * - OPFS path (default): "/path/to/file"
 * - Base64 data: "base64:SGVsbG8gV29ybGQ="
 * - Data URI: "data:image/png;base64,iVBORw0KGgo..."
 * - HTTP URL: "http://example.com/file" or "https://example.com/file"
 * - Local web: "local:/path" (fetches from current origin)
 * 
 * @param {string|Uint8Array} path - path, URL, or base64 data
 * @returns {{returnCode: number, output: Uint8Array}} - file contents as bytes
 */
export function read(path) {
  try {
    const input = decodeInput(path)

    // Base64 data: "base64:..."
    if (input.startsWith('base64:')) {
      const base64Data = input.slice(7) // Remove "base64:" prefix
      const data = base64ToUint8Array(base64Data)
      return success(data)
    }

    // Data URI: "data:[<mediatype>][;base64],<data>"
    if (input.startsWith('data:')) {
      const commaIndex = input.indexOf(',')
      if (commaIndex === -1) {
        return error('Invalid data URI: missing comma separator')
      }
      const meta = input.slice(5, commaIndex) // Between "data:" and ","
      const data = input.slice(commaIndex + 1)

      if (meta.endsWith(';base64')) {
        // Base64 encoded data URI
        return success(base64ToUint8Array(data))
      } else {
        // URL-encoded data (plain text)
        return success(encoder.encode(decodeURIComponent(data)))
      }
    }

    // Local web (same origin): "local:/path"
    if (input.startsWith('local:')) {
      const url = new URL(input.slice(6), location.origin).href
      const data = fs.readHttpSync(url)
      return success(data)
    }

    // HTTP/HTTPS URL
    if (input.startsWith('http://') || input.startsWith('https://')) {
      const data = fs.readHttpSync(input)
      return success(data)
    }

    // Default: OPFS path
    const data = fs.readFileSync(input)
    return success(data)
  } catch (e) {
    return error(e.message)
  }
}

/**
 * Write file (create/overwrite)
 * 
 * Binary format: [path bytes][null byte][data bytes]
 * - Path is a UTF-8 string terminated by a null byte (0x00)
 * - Data is raw binary data following the null byte
 * 
 * @param {Uint8Array} input - binary data: null-terminated path followed by file data
 * @returns {{returnCode: number, output: Uint8Array}} - "OK" on success
 */
export function write(input) {
  try {
    // Ensure input is Uint8Array
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)

    // Find the null byte separator
    let nullIndex = -1
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0) {
        nullIndex = i
        break
      }
    }

    if (nullIndex === -1) {
      return error('Invalid format: missing null byte separator between path and data')
    }

    // Extract path (before null byte)
    const pathBytes = bytes.slice(0, nullIndex)
    const path = decoder.decode(pathBytes)

    // Extract data (after null byte)
    const data = bytes.slice(nullIndex + 1)

    fs.writeFileSync(path, data)
    return success('OK')
  } catch (e) {
    return error(e.message)
  }
}

/**
 * Delete file
 * @param {string|Uint8Array} path - absolute path to file
 * @returns {{returnCode: number, output: Uint8Array}} - "OK" on success
 */
export function remove(path) {
  try {
    const filePath = decodeInput(path)
    fs.unlinkSync(filePath)
    return success('OK')
  } catch (e) {
    return error(e.message)
  }
}

/**
 * Check if file exists
 * @param {string|Uint8Array} path - absolute path to file
 * @returns {{returnCode: number, output: Uint8Array}} - "true" or "false"
 */
export function exists(path) {
  try {
    const filePath = decodeInput(path)
    const result = fs.existsSync(filePath)
    return success(result ? 'true' : 'false')
  } catch (e) {
    return error(e.message)
  }
}

/**
 * List directory contents
 * @param {string|Uint8Array} path - absolute path to directory (defaults to "/")
 * @returns {{returnCode: number, output: Uint8Array}} - JSON array of entry names
 */
export function list(path) {
  try {
    const dirPath = path ? decodeInput(path) : '/'
    const entries = fs.readdirSync(dirPath)
    return success(JSON.stringify(entries))
  } catch (e) {
    return error(e.message)
  }
}

/**
 * Create directory
 * @param {string|Uint8Array} path - absolute path to directory
 * @returns {{returnCode: number, output: Uint8Array}} - "OK" on success
 */
export function mkdir(path) {
  try {
    const dirPath = decodeInput(path)
    fs.mkdirSync(dirPath, { recursive: true })
    return success('OK')
  } catch (e) {
    return error(e.message)
  }
}

/**
 * Remove directory
 * @param {string|Uint8Array} path - absolute path to directory
 * @returns {{returnCode: number, output: Uint8Array}} - "OK" on success
 */
export function rmdir(path) {
  try {
    const dirPath = decodeInput(path)
    fs.rmdirSync(dirPath)
    return success('OK')
  } catch (e) {
    return error(e.message)
  }
}

/**
 * Get file/directory info
 * @param {string|Uint8Array} path - absolute path to file or directory
 * @returns {{returnCode: number, output: Uint8Array}} - JSON with {size, type}
 */
export function stat(path) {
  try {
    const filePath = decodeInput(path)
    const stats = fs.statSync(filePath)
    const result = {
      size: stats.size,
      type: stats.isDirectory() ? 'directory' : 'file'
    }
    return success(JSON.stringify(result))
  } catch (e) {
    return error(e.message)
  }
}

// Export all functions as default for convenient importing
export default {
  create,
  read,
  write,
  remove,
  exists,
  list,
  mkdir,
  rmdir,
  stat
}
