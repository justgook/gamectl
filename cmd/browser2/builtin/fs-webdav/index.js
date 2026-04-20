import { FsAdapter } from './FsAdapter.js'

let fs = null
let pluginCallerSync = null

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function encodeOutput(str) {
  return encoder.encode(str)
}

function decodeInput(input) {
  if (typeof input === 'string') return input
  if (input instanceof Uint8Array) return decoder.decode(input)
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

function parseWebdavUrl(raw) {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return { url: '', authorization: '', displayUrl: '' }
  try {
    const parsed = new URL(trimmed)
    const username = decodeURIComponent(parsed.username || '')
    const password = decodeURIComponent(parsed.password || '')
    const hasCredentials = username.length > 0 || password.length > 0
    parsed.username = ''
    parsed.password = ''
    const url = parsed.toString().replace(/\/+$/, '')
    const authorization = hasCredentials ? `Basic ${btoa(`${username}:${password}`)}` : ''
    return { url, authorization, displayUrl: url }
  } catch {
    return { url: trimmed.replace(/\/+$/, ''), authorization: '', displayUrl: trimmed.replace(/\/+$/, '') }
  }
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
  id: 'fs.webdav',

  async init(ctx) {
    const raw = ctx?.config?.webdavUrl || ''
    const { url, authorization } = parseWebdavUrl(raw)
    fs = await FsAdapter.start({ url, authorization })
    pluginCallerSync = ctx?.callSync ? (moduleName, functionName, input) => ctx.callSync(moduleName, functionName, input) : null
  },

  methods: {
    read(path) {
      try {
        const input = decodeInput(path)
        if (input.startsWith('base64:')) return success(base64ToUint8Array(input.slice(7)))
        if (input.startsWith('data:')) {
          const commaIndex = input.indexOf(',')
          if (commaIndex === -1) return error('Invalid data URI: missing comma separator')
          const meta = input.slice(5, commaIndex)
          const data = input.slice(commaIndex + 1)
          return meta.endsWith(';base64') ? success(base64ToUint8Array(data)) : success(encoder.encode(decodeURIComponent(data)))
        }
        if (input.startsWith('local:')) {
          const url = new URL(input.slice(6), location.origin).href
          return success(fs.readHttpSync(url))
        }
        if (input.startsWith('image:')) return success(readImageProtocol(input))
        if (input.startsWith('http://') || input.startsWith('https://')) return success(fs.readHttpSync(input))
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
        if (nullIndex === -1) return error('Invalid format: missing null byte separator between path and data')
        const path = decoder.decode(bytes.slice(0, nullIndex))
        const data = bytes.slice(nullIndex + 1)
        fs.writeFileSync(path, data)
        return success('OK')
      } catch (e) {
        return error(e.message)
      }
    },

    remove(path) {
      try {
        fs.unlinkSync(decodeInput(path))
        return success('OK')
      } catch (e) {
        return error(e.message)
      }
    },

    exists(path) {
      try {
        const result = fs.existsSync(decodeInput(path))
        return success(result ? 'true' : 'false')
      } catch (e) {
        return error(e.message)
      }
    },

    list(path) {
      try {
        const dirPath = path ? decodeInput(path) : '/'
        return success(JSON.stringify(fs.readdirSync(dirPath)))
      } catch (e) {
        return error(e.message)
      }
    },

    mkdir(path) {
      try {
        fs.mkdirSync(decodeInput(path))
        return success('OK')
      } catch (e) {
        return error(e.message)
      }
    },

    rmdir(path) {
      try {
        fs.rmdirSync(decodeInput(path))
        return success('OK')
      } catch (e) {
        return error(e.message)
      }
    },

    stat(path) {
      try {
        const stats = fs.statSync(decodeInput(path))
        return success(JSON.stringify({ size: stats.size, type: stats.isDirectory() ? 'directory' : 'file' }))
      } catch (e) {
        return error(e.message)
      }
    },
  },
}

export default plugin
