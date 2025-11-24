/**
 * Base class for all node types in the node graph editor.
 * Nodes are HTML custom elements that store their state as attributes.
 * 
 * Connection Model: Input ← Output (reverse reference)
 * - Nodes declare their input sources via the inputs attribute
 * - Format: inputs="port1:source1;port2:source2;port3:source3"
 * - This makes dependency resolution and execution straightforward
 * - Connections are drawn by scanning all nodes and building a reverse index
 * 
 * Lifecycle:
 * 1. Node is created and added to DOM
 * 2. connectedCallback registers with parent ViewNodeGraph
 * 3. Attributes control position, state, and connections
 * 4. attributeChangedCallback triggers redraw when attributes change
 */
export class NodeBase extends HTMLElement {
  static get observedAttributes() {
    return ['x', 'y', 'state', 'selected', 'inputs', 'outputs']
  }

  constructor() {
    super()
    this.position = { x: 0, y: 0 }
    this.state = 'idle' // idle, ready, running, success, error
    this.selected = false
    this.outputValue = null // Result of node execution
    this.error = null
    this._parsedInputs = new Map() // Parsed from inputs attribute
    this._parsedOutputs = [] // Parsed from outputs attribute
  }

  connectedCallback() {
    // Register with parent graph
    this.graph = this.closest('view-nodegraph')
    if (this.graph) {
      this.graph.registerNode(this)
    }

    // Parse initial attributes
    this.position.x = parseFloat(this.getAttribute('x')) || 0
    this.position.y = parseFloat(this.getAttribute('y')) || 0
    this.state = this.getAttribute('state') || 'idle'
    this.selected = this.hasAttribute('selected')

    // Parse inputs attribute
    const inputsAttr = this.getAttribute('inputs')
    if (inputsAttr) {
      this._parseInputsAttribute(inputsAttr)
    }

    // Parse outputs attribute (default to 'output' if not specified)
    const outputsAttr = this.getAttribute('outputs') || 'output'
    this._parseOutputsAttribute(outputsAttr)
  }

  disconnectedCallback() {
    // Unregister from parent graph
    if (this.graph) {
      this.graph.unregisterNode(this)
    }
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal) return

    switch (name) {
      case 'x':
        this.position.x = parseFloat(newVal) || 0
        this.requestRedraw()
        break
      case 'y':
        this.position.y = parseFloat(newVal) || 0
        this.requestRedraw()
        break
      case 'state':
        this.state = newVal
        this.requestRedraw()
        break
      case 'selected':
        this.selected = newVal !== null
        this.requestRedraw()
        break
      case 'inputs':
        this._parseInputsAttribute(newVal)
        this.requestRedraw()
        break
      case 'outputs':
        this._parseOutputsAttribute(newVal)
        this.requestRedraw()
        break
    }
  }

  /**
   * Parse inputs attribute: "port1:source1;port2:source2.outputPort;port3:source3"
   * @private
   */
  _parseInputsAttribute(value) {
    this._parsedInputs.clear()

    if (!value) return

    const pairs = value.split(';').map(s => s.trim()).filter(Boolean)

    for (const pair of pairs) {
      const [portName, source] = pair.split(':').map(s => s.trim())
      if (portName && source) {
        const [sourceNodeId, sourcePort = 'output'] = source.split('.')
        this._parsedInputs.set(portName, { sourceNodeId, sourcePort })
      }
    }
  }

  /**
   * Parse outputs attribute: "output1,output2,output3"
   * @private
   */
  _parseOutputsAttribute(value) {
    if (!value) {
      this._parsedOutputs = ['output']
      return
    }

    this._parsedOutputs = value.split(',').map(s => s.trim()).filter(Boolean)
  }

  /**
   * Request the parent graph to redraw the canvas
   */
  requestRedraw() {
    if (this.graph) {
      this.graph.draw()
    }
  }

  /**
   * Get all input connections for this node
   * @returns {Array<{port: string, sourceNodeId: string, sourcePort: string}>}
   */
  getInputConnections() {
    const connections = []

    for (const [port, { sourceNodeId, sourcePort }] of this._parsedInputs) {
      connections.push({ port, sourceNodeId, sourcePort })
    }

    return connections
  }

  /**
   * Get input value from a connected source node
   * @param {string} port - Input port name
   * @returns {any} Value from source node, or null if not connected
   */
  getInputValue(port) {
    if (!this._parsedInputs.has(port)) return null

    const { sourceNodeId, sourcePort } = this._parsedInputs.get(port)
    const sourceNode = this.graph?.nodes.get(sourceNodeId)

    if (!sourceNode) return null

    // For nodes with named outputs, get specific port value
    // Otherwise get the default outputValue
    return sourceNode.getOutputValue(sourcePort)
  }

  /**
   * Get output value for a specific port
   * Default implementation returns the single output value
   * Override in subclasses with multiple outputs
   * @param {string} port - Output port name
   * @returns {any}
   */
  getOutputValue(_port) {
    return this.outputValue
  }

  /**
   * Check if this node can execute (all inputs ready)
   * @returns {boolean}
   */
  canExecute() {
    const connections = this.getInputConnections()

    for (const { sourceNodeId } of connections) {
      const sourceNode = this.graph?.nodes.get(sourceNodeId)
      if (!sourceNode || sourceNode.state !== 'success') {
        return false
      }
    }

    return true
  }

  /**
   * Execute this node (override in subclasses)
   * @returns {Promise<void>}
   */
  async execute() {
    throw new Error(`${this.constructor.name} must implement execute()`)
  }

  /**
   * Get node display info for rendering
   * Override in subclasses to customize appearance
   * @returns {object}
   */
  getDisplayInfo() {
    return {
      title: this.id || 'Node',
      type: this.constructor.name.replace('Node', '').toLowerCase(),
      width: 200,
      height: 100,
      inputs: this.getInputPorts(),
      outputs: this.getOutputPorts()
    }
  }

  /**
   * Get input port definitions
   * Default: extracts from _parsedInputs
   * @returns {Array<{name: string, type: string, label: string}>}
   */
  getInputPorts() {
    return Array.from(this._parsedInputs.keys()).map(name => ({
      name,
      type: 'any',
      label: name
    }))
  }

  /**
   * Get output port definitions
   * Default: uses _parsedOutputs
   * @returns {Array<{name: string, type: string, label: string}>}
   */
  getOutputPorts() {
    return this._parsedOutputs.map(name => ({
      name,
      type: 'any',
      label: name
    }))
  }
}

customElements.define('node-base', NodeBase)
