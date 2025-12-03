import { NodeBase } from './node-base.js'

/**
 * Plugin Node - Executes a WASM plugin function
 * 
 * Attributes:
 * - plugin: Plugin module name (e.g., 'treegen')
 * - function: Function name to call (e.g., 'gen')
 * - inputs: Port definitions with connections: "nodeCount:n1;maxDepth:n2;maxBranching:n3"
 * - outputs: Comma-separated output port names (default: 'output')
 * 
 * Example:
 * <node-plugin id="treegen" x="400" y="100"
 *              plugin="treegen" 
 *              function="gen"
 *              inputs="nodeCount:n1;maxDepth:n2;maxBranching:n3"
 *              outputs="tree">
 * </node-plugin>
 */
export class NodePlugin extends NodeBase {
  static get observedAttributes() {
    return [...super.observedAttributes, 'plugin', 'function']
  }

  constructor() {
    super()
    this.plugin = ''
    this.functionName = ''
  }

  connectedCallback() {
    super.connectedCallback()

    // Parse plugin-specific attributes
    this.plugin = this.getAttribute('plugin') || ''
    this.functionName = this.getAttribute('function') || ''
  }

  attributeChangedCallback(name, oldVal, newVal) {
    super.attributeChangedCallback(name, oldVal, newVal)

    if (oldVal === newVal) return

    switch (name) {
      case 'plugin':
        this.plugin = newVal || ''
        this.requestRedraw()
        break
      case 'function':
        this.functionName = newVal || ''
        this.requestRedraw()
        break
    }
  }

  connectedCallback() {
    super.connectedCallback()

    // Parse plugin-specific attributes
    this.plugin = this.getAttribute('plugin') || ''
    this.functionName = this.getAttribute('function') || ''

    // Parse input ports from the inputs attribute
    this._updateInputPorts()
  }

  /**
   * Update inputPorts array based on inputs attribute format
   * Called after parent has parsed the inputs attribute
   * @private
   */
  _updateInputPorts() {
    const inputsAttr = this.getAttribute('inputs') || ''

    if (!inputsAttr) {
      this.inputPorts = []
      return
    }

    // Detect format by checking if it contains ':' (connected format) or not (port list format)
    if (inputsAttr.includes(':')) {
      // Connected format: "port1:source1,port2:source2" or "port1:source1;port2:source2"
      // Parent has already parsed into this._parsedInputs
      // Extract port names from the parsed connections
      this.inputPorts = Array.from(this._parsedInputs.keys())
      console.log(`[${this.id}] Updated inputPorts from connected format:`, this.inputPorts)
    } else {
      // Port list format: "port1,port2,port3" (unconnected ports)
      this.inputPorts = inputsAttr.split(',').map(s => s.trim()).filter(Boolean)
      console.log(`[${this.id}] Updated inputPorts from port list format:`, this.inputPorts)
    }
  }

  attributeChangedCallback(name, oldVal, newVal) {
    super.attributeChangedCallback(name, oldVal, newVal)

    if (oldVal === newVal) return

    switch (name) {
      case 'plugin':
        this.plugin = newVal || ''
        this.requestRedraw()
        break
      case 'function':
        this.functionName = newVal || ''
        this.requestRedraw()
        break
      case 'outputs':
        // Let parent handle outputs parsing
        this.requestRedraw()
        break
    }
  }

  getDisplayInfo() {
    const base = super.getDisplayInfo()

    return Object.assign(base, {
      type: 'plugin',
    })
  }

  async executeNode(resolvers) {
    if (!this.plugin || !this.functionName) {
      const error = new Error('Plugin or function not specified')
      this.state = 'error'
      this.error = error.message
      // Reject all outputs
      for (const [, { reject }] of resolvers) {
        reject(error)
      }
      this.requestRedraw()
      return
    }

    // For testing: simulate plugin execution if pluginManager not available
    if (typeof window.pluginManager === 'undefined') {
      console.log(`🔧 Simulating plugin execution: ${this.plugin}.${this.functionName}`)

      // Simulate async work
      await new Promise(resolve => setTimeout(resolve, 500))

      // Create mock result
      const mockResult = {
        returnCode: 0,
        output: new Uint8Array(new TextEncoder().encode(`Mock result from ${this.plugin}.${this.functionName}`))
      }

      // Resolve all outputs with mock result
      for (const outputName of this._parsedOutputs) {
        resolvers.get(outputName).resolve(mockResult)
      }

      this.state = 'success'
      console.log(`✓ Mock ${this.plugin}.${this.functionName} completed`)
      this.requestRedraw()
      return
    }

    this.state = 'running'
    this.requestRedraw()

    try {
      // Collect inputs from connected nodes (this naturally waits for dependencies)
      const inputs = {}
      const inputPorts = this.getInputPorts()

      for (const port of inputPorts) {
        inputs[port.name] = await this.getInputValue(port.name)
      }

      console.log(`Executing ${this.plugin}.${this.functionName} with inputs:`, inputs)

      // Call the plugin
      const result = await window.pluginManager.call(
        this.plugin,
        this.functionName,
        JSON.stringify(inputs)
      )

      // Simple: resolve all outputs with the raw result
      for (const outputName of this._parsedOutputs) {
        if (outputName === 'result' || outputName === 'output') {
          resolvers.get(outputName).resolve(result)
        } else {
          // For custom outputs, could add field extraction here later
          resolvers.get(outputName).resolve(result)
        }
      }

      this.state = 'success'
      this.error = null

      console.log(`✓ ${this.plugin}.${this.functionName} completed`, result)

    } catch (error) {
      this.state = 'error'
      this.error = error.message
      console.error(`✗ ${this.plugin}.${this.functionName} failed:`, error)

      // Reject all outputs
      for (const [, { reject }] of resolvers) {
        reject(error)
      }
    }

    this.requestRedraw()
  }
}

customElements.define('node-plugin', NodePlugin)
