import { NodeBase } from './node-base.js'

/**
 * NodeToString - Converts any input to string
 * 
 * Attributes:
 * - inputs: "input:sourceNode" - The data to convert
 * 
 * Handles:
 * - Uint8Array (buffer) → decode to string
 * - Objects → JSON stringify
 * - Other types → String conversion
 * 
 * Example:
 * <node-tostring id="toString" x="400" y="100"
 *                inputs="input:plugin.result">
 * </node-tostring>
 */
export class NodeToString extends NodeBase {
  getDisplayInfo() {
    const inputs = this.getInputPorts()
    const outputs = this.getOutputPorts()

    return {
      title: 'ToString',
      type: 'helper',
      width: 200,
      height: Math.max(120, 50 + Math.max(inputs.length, outputs.length) * 24),
      inputs,
      outputs
    }
  }

  async executeNode(resolvers) {
    this.state = 'running'
    this.requestRedraw()

    try {
      const input = await this.getInputValue('input')
      let result

      if (input instanceof Uint8Array) {
        // Decode buffer to string
        result = new TextDecoder().decode(input)
      } else if (typeof input === 'object' && input !== null) {
        // JSON stringify objects
        result = JSON.stringify(input)
      } else {
        // Convert to string
        result = String(input)
      }

      // Resolve all outputs with the string result
      for (const outputName of this._parsedOutputs) {
        resolvers.get(outputName).resolve(result)
      }

      this.state = 'success'
      console.log(`✓ ToString completed: ${result.substring(0, 50)}...`)

    } catch (error) {
      this.state = 'error'
      this.error = error.message
      console.error(`✗ ToString failed:`, error)

      // Reject all outputs
      for (const outputName of this._parsedOutputs) {
        resolvers.get(outputName).reject(error)
      }
    }

    this.requestRedraw()
  }
}

customElements.define('node-tostring', NodeToString)
