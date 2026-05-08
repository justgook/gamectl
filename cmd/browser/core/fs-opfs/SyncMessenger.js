const HEADER_SIZE = 16

function sleepUntil(condition, timeoutMs = 30000) {
  const start = Date.now()
  while (!condition()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('SyncMessenger timeout')
    }
  }
}

export class SyncMessenger {
  constructor(sab) {
    this.sab = sab
    this.int32 = new Int32Array(sab)
    this.uint8 = new Uint8Array(sab)
    this.dataSize = sab.byteLength - HEADER_SIZE
  }

  callSync(request) {
    if (request.length > this.dataSize) {
      throw new Error(`Request too large: ${request.length} > ${this.dataSize}`)
    }

    const int32 = this.int32
    int32[1] = 0
    int32[2] = request.length
    this.uint8.set(request, HEADER_SIZE)
    Atomics.notify(int32, 0)
    sleepUntil(() => int32[1] === 1)
    const responseLength = int32[2]
    return this.uint8.slice(HEADER_SIZE, HEADER_SIZE + responseLength)
  }

  serveAsync(callback) {
    const int32 = this.int32

    const processNext = async () => {
      try {
        const result = Atomics.wait(int32, 0, 0)
        if (result !== 'ok') {
          setTimeout(() => processNext(), 0)
          return
        }

        const requestLength = int32[2]
        const request = this.uint8.slice(HEADER_SIZE, HEADER_SIZE + requestLength)
        const response = await callback(request)

        if (response.length > this.dataSize) {
          throw new Error(`Response too large: ${response.length} > ${this.dataSize}`)
        }

        int32[2] = response.length
        this.uint8.set(response, HEADER_SIZE)
        int32[1] = 1
        Atomics.store(int32, 0, 0)
      } catch (err) {
        console.error('SyncMessenger error:', err)
        const errorJson = JSON.stringify({ error: err.message })
        const errorBytes = new TextEncoder().encode(errorJson)
        int32[2] = errorBytes.length
        this.uint8.set(errorBytes, HEADER_SIZE)
        int32[1] = 1
        Atomics.store(int32, 0, 0)
      }

      processNext()
    }

    processNext()
  }
}
