/**
 * FS Worker - Handles OPFS operations in a dedicated worker thread
 * 
 * This worker receives sync requests via SharedArrayBuffer/Atomics
 * and performs async OPFS operations, returning results synchronously
 * to the calling thread.
 * 
 * Message protocol (JSON):
 * Request:  { op: string, path?: string, data?: number[], ... }
 * Response: { ok: true, data?: any } | { ok: false, error: string }
 */

import { SyncMessenger } from './SyncMessenger.js'

let root = null
let messenger = null

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/**
 * Parse path string into segments
 * "/foo/bar/baz.txt" -> { dirs: ["foo", "bar"], name: "baz.txt" }
 */
function parsePath(pathStr) {
  // Normalize path
  const normalized = pathStr.replace(/\\/g, '/').replace(/\/+/g, '/')
  const parts = normalized.split('/').filter(p => p.length > 0)
  
  if (parts.length === 0) {
    return { dirs: [], name: '' }
  }
  
  return {
    dirs: parts.slice(0, -1),
    name: parts[parts.length - 1]
  }
}

/**
 * Get directory handle, creating intermediate directories if needed
 */
async function getDir(pathParts, create = false) {
  let current = root
  for (const name of pathParts) {
    current = await current.getDirectoryHandle(name, { create })
  }
  return current
}

/**
 * Get file handle
 */
async function getFile(pathStr, create = false) {
  const { dirs, name } = parsePath(pathStr)
  if (!name) throw new Error('Invalid file path')
  
  const dir = await getDir(dirs, create)
  return await dir.getFileHandle(name, { create })
}

/**
 * Operation handlers
 */
const handlers = {
  async readFile(path) {
    const fileHandle = await getFile(path, false)
    const file = await fileHandle.getFile()
    const buffer = await file.arrayBuffer()
    return { ok: true, data: Array.from(new Uint8Array(buffer)) }
  },

  async writeFile(path, data) {
    // Ensure parent directories exist
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
        // Checking if directory exists
        return { ok: true, data: true }
      }
      
      // Try file first
      try {
        await parentDir.getFileHandle(name)
        return { ok: true, data: true }
      } catch {
        // Try directory
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
      // Path includes a final component, treat it as directory name
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
      // Root or directory path without name
      return { ok: true, data: { type: 'directory', size: 0 } }
    }
    
    // Try as file first
    try {
      const fileHandle = await parentDir.getFileHandle(name)
      const file = await fileHandle.getFile()
      return { ok: true, data: { type: 'file', size: file.size } }
    } catch {
      // Try as directory
      try {
        await parentDir.getDirectoryHandle(name)
        return { ok: true, data: { type: 'directory', size: 0 } }
      } catch (err) {
        throw new Error(`Path not found: ${path}`)
      }
    }
  }
}

/**
 * Process incoming request
 */
async function handleRequest(requestBytes) {
  try {
    const request = JSON.parse(decoder.decode(requestBytes))
    const { op, ...params } = request
    
    const handler = handlers[op]
    if (!handler) {
      return encoder.encode(JSON.stringify({ ok: false, error: `Unknown operation: ${op}` }))
    }
    
    const result = await handler(params.path, params.data)
    return encoder.encode(JSON.stringify(result))
  } catch (err) {
    return encoder.encode(JSON.stringify({ ok: false, error: err.message }))
  }
}

/**
 * Message handler for initialization
 */
self.onmessage = async (e) => {
  const msg = e.data
  
  if (Array.isArray(msg) && msg[0] === 'init') {
    const [, sab, rootHandle] = msg
    
    root = rootHandle
    messenger = new SyncMessenger(sab)
    
    // Signal ready
    self.postMessage(['ready'])
    
    // Start serving requests
    messenger.serveAsync(handleRequest)
  }
}
