import { NodeBase } from './node-base.js'
import * as fs from '/plugins/fs/index.js'

/**
 * File Read Node - Reads file content from the filesystem
 * 
 * Attributes:
 * - inputs: "filename:sourceNode" - connection for filename input
 * - outputs: "content" - outputs file content (text or ArrayBuffer for binary)
 * 
 * The node automatically detects binary vs text files and outputs:
 * - For text files: string content
 * - For binary files: ArrayBuffer
 * 
 * Example:
 * <node-fsread id="readfile" x="400" y="100"
 *              inputs="filename:inputNode"
 *              outputs="content">
 * </node-fsread>
 */
export class NodeFsRead extends NodeBase {
  static get observedAttributes() {
    return [...super.observedAttributes]
  }

  constructor() {
    super()
    this.decoder = new TextDecoder()
  }

  connectedCallback() {
    super.connectedCallback()

    // Ensure we have the filename input port
    if (!this._parsedInputs.has('filename')) {
      this._parsedInputs.set('filename', null)
    }

    // Ensure we have the content output
    if (!this._parsedOutputs.includes('content')) {
      this._parsedOutputs = ['content']
    }
  }

  getDisplayInfo() {
    return {
      title: this.getAttribute('title') || 'File Read',
      type: 'fsread',
      width: 200,
      height: 80,
      inputs: this.getInputPorts(),
      outputs: this.getOutputPorts()
    }
  }

  getInputPorts() {
    return [
      { name: 'filename', type: 'string', label: 'Filename' }
    ]
  }

  getOutputPorts() {
    return [
      { name: 'content', type: 'any', label: 'Content' }
    ]
  }

  /**
   * Check if data is likely binary (contains non-printable characters)
   * @param {Uint8Array} data
   * @returns {boolean}
   */
  isBinary(data) {
    // Check first 8KB for binary characters
    const checkLength = Math.min(data.length, 8192)
    for (let i = 0; i < checkLength; i++) {
      const byte = data[i]
      // Allow tab, newline, carriage return, and printable ASCII
      if (byte < 9 || (byte > 13 && byte < 32) || byte === 127) {
        // Exception for common text encoding markers
        if (byte === 0 && i > 0) {
          // Could be UTF-16, check pattern
          continue
        }
        return true
      }
    }
    return false
  }

  async executeNode(resolvers) {
    this.state = 'running'
    this.requestRedraw()

    try {
      // Get filename from input
      const filename = await this.getInputValue('filename')

      if (!filename) {
        throw new Error('Filename is required')
      }

      // Ensure filename is a string
      const filePath = typeof filename === 'string' 
        ? filename 
        : filename.toString()

      console.log(`[FsRead] Reading file: ${filePath}`)

      // Read the file using fs plugin
      const result = fs.read(filePath)

      if (result.returnCode !== 0) {
        const errorMsg = this.decoder.decode(result.output)
        throw new Error(`Failed to read file: ${errorMsg}`)
      }

      const data = result.output

      // Determine if binary or text and output accordingly
      let content
      if (this.isBinary(data)) {
        // Return as ArrayBuffer for binary data
        content = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
        console.log(`[FsRead] Read binary file: ${filePath} (${data.length} bytes)`)
      } else {
        // Return as string for text data
        content = this.decoder.decode(data)
        console.log(`[FsRead] Read text file: ${filePath} (${content.length} chars)`)
      }

      // Resolve output
      resolvers.get('content').resolve(content)

      this.state = 'success'
      this.error = null
      this.outputValue = content

    } catch (error) {
      this.state = 'error'
      this.error = error.message
      console.error(`[FsRead] Error:`, error)

      // Reject all outputs
      for (const [, resolver] of resolvers) {
        resolver.reject(error)
      }
    }

    this.requestRedraw()
  }
}

customElements.define('node-fsread', NodeFsRead)
