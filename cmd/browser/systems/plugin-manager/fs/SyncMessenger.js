/**
 * SyncMessenger - Enables synchronous communication between main thread and worker
 * using SharedArrayBuffer and Atomics.
 * 
 * The sync mechanism works by:
 * 1. Main thread writes request to shared buffer
 * 2. Main thread notifies worker via Atomics.notify()
 * 3. Main thread spin-waits until worker sets completion flag
 * 4. Worker receives notification via Atomics.wait()
 * 5. Worker processes request asynchronously
 * 6. Worker writes response and sets completion flag
 * 
 * Buffer layout (header = 16 bytes):
 * - int32[0]: Atomics notification slot
 * - int32[1]: Completion flag (0 = pending, 1 = done)  
 * - int32[2]: Payload length
 * - int32[3]: Reserved
 * - Remaining bytes: Request/Response data
 */

const HEADER_SIZE = 16 // 4 x Int32

/**
 * Spin-wait until condition is true
 * @param {() => boolean} condition
 * @param {number} timeoutMs
 */
function sleepUntil(condition, timeoutMs = 30000) {
  const start = Date.now()
  while (!condition()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('SyncMessenger timeout')
    }
  }
}

export class SyncMessenger {
  /**
   * @param {SharedArrayBuffer} sab - Shared buffer (recommended: 10MB+ for large files)
   */
  constructor(sab) {
    this.sab = sab
    this.int32 = new Int32Array(sab)
    this.uint8 = new Uint8Array(sab)
    this.dataSize = sab.byteLength - HEADER_SIZE
  }

  /**
   * Send a synchronous request from main thread (or calling worker)
   * BLOCKS until response is received
   * @param {Uint8Array} request
   * @returns {Uint8Array} response
   */
  callSync(request) {
    if (request.length > this.dataSize) {
      throw new Error(`Request too large: ${request.length} > ${this.dataSize}`)
    }

    const int32 = this.int32

    // Reset state
    int32[1] = 0 // completion flag = pending
    int32[2] = request.length

    // Write request data
    this.uint8.set(request, HEADER_SIZE)

    // Wake up worker
    Atomics.notify(int32, 0)

    // Spin-wait for completion (this is the unavoidable sync part)
    sleepUntil(() => int32[1] === 1)

    // Read response
    const responseLength = int32[2]
    return this.uint8.slice(HEADER_SIZE, HEADER_SIZE + responseLength)
  }

  /**
   * Start serving async requests in worker thread
   * This runs indefinitely, processing one request at a time
   * @param {(request: Uint8Array) => Promise<Uint8Array>} callback
   */
  serveAsync(callback) {
    const int32 = this.int32

    const processNext = async () => {
      try {
        // Wait for notification from main thread
        const result = Atomics.wait(int32, 0, 0)
        if (result !== 'ok') {
          // Retry on spurious wakeup
          setTimeout(() => processNext(), 0)
          return
        }

        // Read request
        const requestLength = int32[2]
        const request = this.uint8.slice(HEADER_SIZE, HEADER_SIZE + requestLength)

        // Process asynchronously
        const response = await callback(request)

        if (response.length > this.dataSize) {
          throw new Error(`Response too large: ${response.length} > ${this.dataSize}`)
        }

        // Write response
        int32[2] = response.length
        this.uint8.set(response, HEADER_SIZE)

        // Signal completion
        int32[1] = 1

        // Reset notification slot for next call
        Atomics.store(int32, 0, 0)
      } catch (err) {
        console.error('SyncMessenger error:', err)
        // Write error response
        const errorJson = JSON.stringify({ error: err.message })
        const errorBytes = new TextEncoder().encode(errorJson)
        int32[2] = errorBytes.length
        this.uint8.set(errorBytes, HEADER_SIZE)
        int32[1] = 1
        Atomics.store(int32, 0, 0)
      }

      // Process next request
      processNext()
    }

    processNext()
  }
}
