import { SyncMessenger } from './SyncMessenger.js'

const BUFFER_SIZE = 12 * 1024 * 1024
const RESPONSE_JSON = 0x4a
const RESPONSE_BINARY = 0x42
const encoder = new TextEncoder()
const decoder = new TextDecoder()

export class FsAdapter {
  constructor(messenger) {
    this.messenger = messenger
  }

  static async start(backendConfig = {}) {
    if (typeof SharedArrayBuffer === 'undefined') {
      throw new Error('SharedArrayBuffer not available. Ensure COOP/COEP headers are set.')
    }

    const sab = new SharedArrayBuffer(BUFFER_SIZE)
    const messenger = new SyncMessenger(sab)
    const workerUrl = new URL('./worker-opfs.js', import.meta.url)
    const worker = new Worker(workerUrl, { type: 'module' })

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('OPFS worker init timeout')), 5000)

      worker.onmessage = (e) => {
        if (Array.isArray(e.data) && e.data[0] === 'ready') {
          clearTimeout(timeout)
          resolve()
        }
      }

      worker.onerror = (err) => {
        clearTimeout(timeout)
        reject(err)
      }

      worker.postMessage(['init', sab, backendConfig])
    })

    return new FsAdapter(messenger)
  }

  _call(op, params = {}) {
    const request = encoder.encode(JSON.stringify({ op, ...params }))
    const responseBytes = this.messenger.callSync(request)
    const responseType = responseBytes[0]
    const payload = responseBytes.slice(1)

    if (responseType === RESPONSE_BINARY) {
      return payload
    }

    if (responseType !== RESPONSE_JSON) {
      throw new Error(`Unknown fs response type: ${responseType}`)
    }

    const response = JSON.parse(decoder.decode(payload))
    if (!response.ok) {
      throw new Error(response.error)
    }

    return response.data
  }

  readFileSync(path) {
    return this._call('readFile', { path })
  }

  writeFileSync(path, data) {
    const dataArray = data instanceof Uint8Array ? Array.from(data) : data
    this._call('writeFile', { path, data: dataArray })
  }

  unlinkSync(path) {
    this._call('remove', { path })
  }

  existsSync(path) {
    return this._call('exists', { path })
  }

  readdirSync(path) {
    return this._call('readdir', { path })
  }

  mkdirSync(path) {
    this._call('mkdir', { path })
  }

  rmdirSync(path) {
    this._call('rmdir', { path })
  }

  statSync(path) {
    const data = this._call('stat', { path })
    return {
      size: data.size,
      isDirectory: () => data.type === 'directory',
      isFile: () => data.type === 'file',
    }
  }

  readHttpSync(path) {
    return this._call('readHttp', { path })
  }
}
