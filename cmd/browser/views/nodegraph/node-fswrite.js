import { NodeBase } from './node-base.js'
import * as fs from '/plugins/fs/index.js'

/**
 * File Write Node - Writes data to the filesystem
 * 
 * Attributes:
 * - inputs: "filename:sourceNode,data:sourceNode" - connections for filename and data
 * - outputs: "success" - outputs boolean indicating success
 * 
 * Data type detection and handling:
 * - string: saved as text file
 * - object/array: saved as JSON (with pretty formatting)
 * - ArrayBuffer/Uint8Array: saved as binary bytes
 * 
 * Example:
 * <node-fswrite id="writefile" x="400" y="100"
 *               inputs="filename:inputNode,data:dataNode"
 *               outputs="success">
 * </node-fswrite>
 */
export class NodeFsWrite extends NodeBase {
  static get observedAttributes() {
    return [...super.observedAttributes]
  }

  constructor() {
    super()
    this.encoder = new TextEncoder()
    this.decoder = new TextDecoder()
  }

  connectedCallback() {
    super.connectedCallback()

    // Ensure we have the required input ports
    if (!this._parsedInputs.has('filename')) {
      this._parsedInputs.set('filename', null)
    }
    if (!this._parsedInputs.has('data')) {
      this._parsedInputs.set('data', null)
    }

    // Ensure we have the success output
    if (!this._parsedOutputs.includes('success')) {
      this._parsedOutputs = ['success']
    }
  }

  getDisplayInfo() {
    return {
      title: this.getAttribute('title') || 'File Write',
      type: 'fswrite',
      width: 200,
      height: 100,
      inputs: this.getInputPorts(),
      outputs: this.getOutputPorts()
    }
  }

  getInputPorts() {
    return [
      { name: 'filename', type: 'string', label: 'Filename' },
      { name: 'data', type: 'any', label: 'Data' }
    ]
  }

  getOutputPorts() {
    return [
      { name: 'success', type: 'boolean', label: 'Success' }
    ]
  }

  /**
   * Detect data type and return type string
   * @param {any} data
   * @returns {'text' | 'json' | 'bytes'}
   */
  detectDataType(data) {
    if (data === null || data === undefined) {
      return 'text'
    }

    // Binary types
    if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
      return 'bytes'
    }

    // Check for typed arrays
    if (ArrayBuffer.isView(data)) {
      return 'bytes'
    }

    // Objects and arrays -> JSON
    if (typeof data === 'object') {
      return 'json'
    }

    // Everything else is text (string, number, boolean)
    return 'text'
  }

  /**
   * Convert data to Uint8Array based on its type
   * @param {any} data
   * @param {'text' | 'json' | 'bytes'} dataType
   * @returns {Uint8Array}
   */
  convertToBytes(data, dataType) {
    switch (dataType) {
      case 'bytes':
        if (data instanceof Uint8Array) {
          return data
        }
        if (data instanceof ArrayBuffer) {
          return new Uint8Array(data)
        }
        if (ArrayBuffer.isView(data)) {
          return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
        }
        throw new Error('Invalid binary data type')

      case 'json':
        const jsonStr = JSON.stringify(data, null, 2)
        return this.encoder.encode(jsonStr)

      case 'text':
      default:
        const textStr = data === null || data === undefined 
          ? '' 
          : String(data)
        return this.encoder.encode(textStr)
    }
  }

  /**
   * Validate that the data is appropriate for writing
   * @param {any} data
   * @param {'text' | 'json' | 'bytes'} dataType
   * @throws {Error} if validation fails
   */
  validateData(data, dataType) {
    if (data === undefined) {
      throw new Error('Data is undefined - nothing to write')
    }

    if (dataType === 'json') {
      // Test that JSON serialization works
      try {
        JSON.stringify(data)
      } catch (e) {
        throw new Error(`Data cannot be serialized to JSON: ${e.message}`)
      }
    }

    if (dataType === 'bytes') {
      if (!(data instanceof ArrayBuffer) && 
          !(data instanceof Uint8Array) && 
          !ArrayBuffer.isView(data)) {
        throw new Error('Binary data must be ArrayBuffer, Uint8Array, or typed array')
      }
    }
  }

  async executeNode(resolvers) {
    this.state = 'running'
    this.requestRedraw()

    try {
      // Get inputs
      const filename = await this.getInputValue('filename')
      const data = await this.getInputValue('data')

      if (!filename) {
        throw new Error('Filename is required')
      }

      // Ensure filename is a string
      const filePath = typeof filename === 'string' 
        ? filename 
        : filename.toString()

      // Detect and validate data type
      const dataType = this.detectDataType(data)
      this.validateData(data, dataType)

      console.log(`[FsWrite] Writing file: ${filePath} (type: ${dataType})`)

      // Convert data to bytes
      const dataBytes = this.convertToBytes(data, dataType)

      // Build the write payload: path + null byte + data
      const pathBytes = this.encoder.encode(filePath)
      const payload = new Uint8Array(pathBytes.length + 1 + dataBytes.length)
      payload.set(pathBytes, 0)
      payload[pathBytes.length] = 0 // null byte separator
      payload.set(dataBytes, pathBytes.length + 1)

      // Write using fs plugin
      const result = fs.write(payload)

      if (result.returnCode !== 0) {
        const errorMsg = this.decoder.decode(result.output)
        throw new Error(`Failed to write file: ${errorMsg}`)
      }

      console.log(`[FsWrite] Successfully wrote file: ${filePath} (${dataBytes.length} bytes, type: ${dataType})`)

      // Resolve output with success
      resolvers.get('success').resolve(true)

      this.state = 'success'
      this.error = null
      this.outputValue = true

    } catch (error) {
      this.state = 'error'
      this.error = error.message
      console.error(`[FsWrite] Error:`, error)

      // Resolve with false on error (not reject, so downstream can handle)
      resolvers.get('success').resolve(false)
      this.outputValue = false
    }

    this.requestRedraw()
  }
}

customElements.define('node-fswrite', NodeFsWrite)
