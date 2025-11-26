import { NodeBase } from './node-base.js'

/**
 * NodeFromJson - Parses JSON string to object
 * 
 * Attributes:
 * - inputs: "input:sourceNode" - The JSON string to parse
 * 
 * Handles:
 * - String input → JSON.parse()
 * - Uint8Array (buffer) → decode then parse
 * 
 * Example:
 * <node-fromjson id="parseJson" x="400" y="100"
 *                inputs="input:toString.output">
 * </node-fromjson>
 */
export class NodeFromJson extends NodeBase {
  getDisplayInfo() {
    const inputs = this.getInputPorts()
    const outputs = this.getOutputPorts()

    return {
      title: 'FromJSON',
      type: 'helper',
      width: 150,
      height: Math.max(100, 50 + Math.max(inputs.length, outputs.length) * 24),
      inputs,
      outputs
    }
  }

  async executeNode(resolvers) {
    this.state = 'running'
    this.requestRedraw()
    
    try {
      const input = await this.getInputValue('input')
      let jsonString

      if (input instanceof Uint8Array) {
        jsonString = new TextDecoder().decode(input)
      } else {
        jsonString = String(input)
      }

      const parsed = JSON.parse(jsonString)

      // Resolve all outputs with the parsed object
      for (const outputName of this._parsedOutputs) {
        resolvers.get(outputName).resolve(parsed)
      }
      
      this.state = 'success'
      console.log(`✓ FromJSON completed:`, parsed)

    } catch (error) {
      this.state = 'error'
      this.error = `Invalid JSON: ${error.message}`
      console.error(`✗ FromJSON failed:`, error)
      
      // Reject all outputs
      for (const outputName of this._parsedOutputs) {
        resolvers.get(outputName).reject(new Error(this.error))
      }
    }

    this.requestRedraw()
  }
}

customElements.define('node-fromjson', NodeFromJson)