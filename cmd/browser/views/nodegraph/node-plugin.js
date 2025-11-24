import { NodeBase } from './node-base.js'

/**
 * Plugin Node - Executes a WASM plugin function
 * 
 * Attributes:
 * - plugin: Plugin module name (e.g., 'treegen')
 * - function: Function name to call (e.g., 'gen')
 * - inputs: Comma-separated input port names
 * - outputs: Comma-separated output port names (default: 'output')
 * - input-{portName}: Connection to source node (e.g., input-nodeCount="n1")
 * 
 * Example:
 * <node-plugin id="treegen" x="400" y="100"
 *              plugin="treegen" 
 *              function="gen"
 *              inputs="nodeCount,maxDepth,maxBranching,rootBranches"
 *              outputs="tree"
 *              input-nodeCount="n1"
 *              input-maxDepth="n2">
 * </node-plugin>
 */
export class NodePlugin extends NodeBase {
  static get observedAttributes() {
    return [...super.observedAttributes, 'plugin', 'function', 'inputs', 'outputs']
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

    const inputsAttr = this.getAttribute('inputs') || ''
    this.inputPorts = inputsAttr ? inputsAttr.split(',').map(s => s.trim()) : []

    const outputsAttr = this.getAttribute('outputs') || 'output'
    this.outputPorts = outputsAttr.split(',').map(s => s.trim())
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
      case 'inputs':
        this.inputPorts = newVal ? newVal.split(',').map(s => s.trim()) : []
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
