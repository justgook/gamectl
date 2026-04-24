import { FsAdapter } from './FsAdapter.js'
import { createMountRegistry, listMountedPath, mountedPathExists, readMountedPath, resolveMountedPath, statMountedPath } from '../mounts.js'

let fs = null
let mounts = null
let pluginCallerSync = null

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function encodeOutput(str) {
  return encoder.encode(str)
}

function decodeInput(input) {
  if (typeof input === 'string') {
    return input
  }
  if (input instanceof Uint8Array) {
    return decoder.decode(input)
  }
  if (ArrayBuffer.isView(input)) {
    return decoder.decode(new Uint8Array(input.buffer, input.byteOffset, input.byteLength))
  }
  return String(input ?? '')
}

function success(output = '') {
  const data = typeof output === 'string' ? encodeOutput(output) : output
  return { returnCode: 0, output: data }
}

function error(message) {
  return { returnCode: 1, output: encodeOutput(message) }
}

function base64ToUint8Array(base64) {
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function parseImageProtocol(input) {
  const match = /^image:(\d+)(?:\?(.*))?$/.exec(input)
  if (!match) throw new Error('Invalid image protocol: expected image:<handle>?format=png|qoi')
  const handle = Number.parseInt(match[1], 10)
  if (!Number.isSafeInteger(handle) || handle <= 0) {
    throw new Error('Invalid image protocol: handle must be a positive integer')
  }
  const params = new URLSearchParams(match[2] || '')
  const format = params.get('format') || 'qoi'
  if (format !== 'png' && format !== 'qoi') {
    throw new Error('Invalid image protocol: format must be png or qoi')
  }
  return { handle, format }
}

function readImageProtocol(input) {
  if (!pluginCallerSync) {
    throw new Error('Image protocol unavailable: plugin caller is not configured')
  }
  const { handle, format } = parseImageProtocol(input)
  const payload = JSON.stringify({ src: handle, format })
  const result = pluginCallerSync('image', 'export', payload)
  if (!result || result.returnCode !== 0) {
    const message = result?.output ? decoder.decode(result.output) : 'unknown image export failure'
    throw new Error(`Image protocol failed: ${message}`)
  }
  return result.output instanceof Uint8Array ? result.output : new Uint8Array(result.output)
}

const plugin = {
  id: 'fs.opfs',

  async init(ctx) {
    fs = await FsAdapter.start({})
    mounts = createMountRegistry(ctx?.config?.fs || {})
    pluginCallerSync = ctx?.callSync ? (moduleName, functionName, input) => ctx.callSync(moduleName, functionName, input) : null
  },

  methods: {
    read(path) {
      try {
        const input = decodeInput(path)
        if (input.startsWith('base64:')) {
          return success(base64ToUint8Array(input.slice(7)))
        }
        if (input.startsWith('data:')) {
          const commaIndex = input.indexOf(',')
          if (commaIndex === -1) return error('Invalid data URI: missing comma separator')
          const meta = input.slice(5, commaIndex)
          const data = input.slice(commaIndex + 1)
          return meta.endsWith(';base64') ? success(base64ToUint8Array(data)) : success(encoder.encode(decodeURIComponent(data)))
        }
        const mounted = readMountedPath(mounts, input, (url) => fs.readHttpSync(url))
        if (mounted) return success(mounted)
        if (input.startsWith('image:')) {
          return success(readImageProtocol(input))
        }
        if (input.startsWith('http://') || input.startsWith('https://')) {
          return success(fs.readHttpSync(input))
        }
        return success(fs.readFileSync(input))
      } catch (e) {
        return error(e.message)
      }
    },

    write(input) {
      try {
        const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
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
        const pathBytes = bytes.slice(0, nullIndex)
        const path = decoder.decode(pathBytes)
        if (resolveMountedPath(mounts, path)) return error(`Mounted path is read-only: ${path}`)
        const data = bytes.slice(nullIndex + 1)
        fs.writeFileSync(path, data)
        return success('OK')
      } catch (e) {
        return error(e.message)
      }
    },

    remove(path) {
      try {
        const input = decodeInput(path)
        if (resolveMountedPath(mounts, input)) return error(`Mounted path is read-only: ${input}`)
        fs.unlinkSync(input)
        return success('OK')
      } catch (e) {
        return error(e.message)
      }
    },

    exists(path) {
      try {
        const input = decodeInput(path)
        const mounted = mountedPathExists(mounts, input)
        const result = mounted ?? fs.existsSync(input)
        return success(result ? 'true' : 'false')
      } catch (e) {
        return error(e.message)
      }
    },

    list(path) {
      try {
        const dirPath = path ? decodeInput(path) : '/'
        const mounted = listMountedPath(mounts, dirPath)
        if (dirPath === '/') {
          return success(JSON.stringify([...new Set([...fs.readdirSync(dirPath), ...mounted])].sort()))
        }
        return success(JSON.stringify(mounted ?? fs.readdirSync(dirPath)))
      } catch (e) {
        return error(e.message)
      }
    },

    mkdir(path) {
      try {
        const input = decodeInput(path)
        if (resolveMountedPath(mounts, input)) return error(`Mounted path is read-only: ${input}`)
        fs.mkdirSync(input)
        return success('OK')
      } catch (e) {
        return error(e.message)
      }
    },

    rmdir(path) {
      try {
        const input = decodeInput(path)
        if (resolveMountedPath(mounts, input)) return error(`Mounted path is read-only: ${input}`)
        fs.rmdirSync(input)
        return success('OK')
      } catch (e) {
        return error(e.message)
      }
    },

    stat(path) {
      try {
        const input = decodeInput(path)
        const mounted = statMountedPath(mounts, input)
        if (mounted) return success(JSON.stringify(mounted))
        const stats = fs.statSync(input)
        return success(JSON.stringify({ size: stats.size, type: stats.isDirectory() ? 'directory' : 'file' }))
      } catch (e) {
        return error(e.message)
      }
    },
  },
}

export default plugin
