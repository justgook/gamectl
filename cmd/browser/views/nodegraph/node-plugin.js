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
    return [...super.observedAttributes, 'plugin', 'function', 'outputs']
  }

  constructor() {
    super()
    this.plugin = ''
    this.functionName = ''
    this.inputPorts = []
    this.outputPorts = ['output']
    this.outputValues = {} // Multiple outputs support
  }

  connectedCallback() {
    super.connectedCallback()

    // Parse plugin-specific attributes
    this.plugin = this.getAttribute('plugin') || ''
    this.functionName = this.getAttribute('function') || ''

    // Parse input ports from the inputs attribute
    this._updateInputPorts()

    const outputsAttr = this.getAttribute('outputs') || 'output'
    this.outputPorts = outputsAttr.split(',').map(s => s.trim())
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

    // Detect format by checking if it contains ':' (new format) or ',' (old format)
    if (inputsAttr.includes(':')) {
      // New format: "port1:source1;port2:source2"
      // Parent has already parsed into this._parsedInputs
      // Extract port names from the parsed connections
      this.inputPorts = Array.from(this._parsedInputs.keys())
      console.log(`[${this.id}] Updated inputPorts from new format:`, this.inputPorts)
    } else {
      // Old format: "port1,port2,port3"
      this.inputPorts = inputsAttr.split(',').map(s => s.trim()).filter(Boolean)
      console.log(`[${this.id}] Updated inputPorts from old format:`, this.inputPorts)
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
        this.outputPorts = newVal ? newVal.split(',').map(s => s.trim()) : ['output']
        this.requestRedraw()
        break
    }
  }

  getDisplayInfo() {
    return {
      title: `${this.plugin}.${this.functionName}`,
      type: 'plugin',
      width: 200,
      height: Math.max(120, 50 + Math.max(this.inputPorts.length, this.outputPorts.length) * 24),
      inputs: this.inputPorts.map(name => ({
        name,
        type: 'any',
        label: name
      })),
      outputs: this.outputPorts.map(name => ({
        name,
        type: 'any',
        label: name
      }))
    }
  }

  getInputPorts() {
    return this.inputPorts.map(name => ({
      name,
      type: 'any',
      label: name
    }))
  }

  getOutputPorts() {
    return this.outputPorts.map(name => ({
      name,
      type: 'any',
      label: name
    }))
  }

  getOutputValue(port) {
    // Support multiple outputs
    if (this.outputPorts.length === 1) {
      return this.outputValue
    }
    return this.outputValues[port]
  }

  async execute() {
    if (!this.plugin || !this.functionName) {
      this.state = 'error'
      this.error = 'Plugin or function not specified'
      return
    }

    // Check if pluginManager is available globally
    if (typeof pluginManager === 'undefined') {
      this.state = 'error'
      this.error = 'PluginManager not available'
      return
    }

    this.state = 'running'
    this.requestRedraw()

    try {
      // Collect inputs from connected nodes
      const inputs = {}
      for (const portName of this.inputPorts) {
        const value = this.getInputValue(portName)
        if (value === null) {
          // TODO: Decide if null inputs are allowed
          // For now, we'll allow them
        }
        inputs[portName] = value
      }

      console.log(`Executing ${this.plugin}.${this.functionName} with inputs:`, inputs)

      // Call the plugin
      const result = await pluginManager.call(
        this.plugin,
        this.functionName,
        JSON.stringify(inputs)
      )

      // Store output(s)
      if (this.outputPorts.length === 1) {
        this.outputValue = result.output
      } else {
        // Parse multiple outputs (assuming JSON response with named outputs)
        try {
          const parsed = JSON.parse(new TextDecoder().decode(result.output))
          this.outputValues = parsed
        } catch {
          // If not JSON, store as single output
          this.outputValue = result.output
        }
      }

      this.state = 'success'
      this.error = null

      console.log(`✓ ${this.plugin}.${this.functionName} completed`, result)

    } catch (error) {
      this.state = 'error'
      this.error = error.message
      console.error(`✗ ${this.plugin}.${this.functionName} failed:`, error)
    }

    this.requestRedraw()
  }
}

customElements.define('node-plugin', NodePlugin)
