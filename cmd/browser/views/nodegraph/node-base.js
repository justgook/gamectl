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
    
    // Promise-based output system
    this.outputPromises = new Map() // Map<portName, Promise>
    this.executionPromise = null    // Promise for the node's execution
    this.isExecuting = false
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
      if (portName) {
        if (source) {
          // Connected: "portName:sourceNode.sourcePort"
          const [sourceNodeId, sourcePort = 'output'] = source.split('.')
          this._parsedInputs.set(portName, { sourceNodeId, sourcePort })
        } else {
          // Disconnected: "portName" (no source)
          this._parsedInputs.set(portName, null)
        }
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

    for (const [port, connection] of this._parsedInputs) {
      if (connection) {
        // Only include connected ports
        connections.push({ 
          port, 
          sourceNodeId: connection.sourceNodeId, 
          sourcePort: connection.sourcePort 
        })
      }
    }

    return connections
  }

  /**
   * Get input value from a connected source node (Promise-based)
   * @param {string} port - Input port name
   * @returns {Promise<any>} Value from source node, or null if not connected
   */
  async getInputValue(port) {
    if (!this._parsedInputs.has(port)) return null

    const connection = this._parsedInputs.get(port)
    if (!connection) return null // Port exists but is disconnected

    const { sourceNodeId, sourcePort } = connection
    const sourceNode = this.graph?.nodes.get(sourceNodeId)

    if (!sourceNode) return null

    // This naturally blocks until source is ready
    return await sourceNode.getOutputValue(sourcePort)
  }

  /**
   * Get output value for a specific port (Promise-based)
   * @param {string} port - Output port name
   * @param {boolean} forceRerun - Force re-execution even if already completed
   * @returns {Promise<any>}
   */
  getOutputValue(port = 'output', forceRerun = false) {
    if (!this.outputPromises.has(port) || forceRerun) {
      // Lazy execution - create Promise when first accessed or force rerun
      this.startExecution(forceRerun)
    }
    return this.outputPromises.get(port)
  }

  /**
   * Check if this node can execute (all inputs ready)
   * Note: With Promise-based system, this is less critical as dependencies
   * are automatically resolved via await in getInputValue
   * @returns {boolean}
   */
  canExecute() {
    // With Promise-based system, execution will naturally wait for dependencies
    // This method is kept for compatibility and UI feedback
    return !this.isExecuting
  }

  /**
   * Start execution and create output promises
   * @param {boolean} forceRerun - Force re-execution even if already completed
   * @returns {Promise<void>}
   */
  async startExecution(forceRerun = false) {
    // If already executing, return existing promise
    if (this.isExecuting && !forceRerun) {
      return this.executionPromise
    }

    // If forcing rerun or first run, reset state
    if (forceRerun || !this.executionPromise) {
      this.isExecuting = true
      this.state = 'idle'
      this.error = null

      // Create new output promises
      const resolvers = new Map()
      for (const outputName of this._parsedOutputs) {
        const { promise, resolve, reject } = this.createPromise()
        this.outputPromises.set(outputName, promise)
        resolvers.set(outputName, { resolve, reject })
      }

      // Execute and resolve outputs
      this.executionPromise = this.executeNode(resolvers)
      
      // Reset execution flag when done
      this.executionPromise.finally(() => {
        this.isExecuting = false
      })
    }

    return this.executionPromise
  }

  /**
   * Create a new Promise with exposed resolve/reject
   * @returns {object} {promise, resolve, reject}
   */
  createPromise() {
    let resolve, reject
    const promise = new Promise((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }

  /**
   * Execute this node (override in subclasses)
   * @param {Map} resolvers - Map of output name to {resolve, reject}
   * @returns {Promise<void>}
   */
  async executeNode(resolvers) {
    throw new Error(`${this.constructor.name} must implement executeNode()`)
  }

  /**
   * Legacy execute method - now calls startExecution
   * @returns {Promise<void>}
   */
  async execute() {
    return this.startExecution()
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
