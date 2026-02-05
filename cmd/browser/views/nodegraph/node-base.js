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
    this.title = this.getAttribute('title') || ""

    // Parse inputs attribute
    const inputsAttr = this.getAttribute('inputs')
    if (inputsAttr) {
      this._parseInputsAttribute(inputsAttr)
    }

    // Parse outputs attribute (no defaults - only what's explicitly specified)
    const outputsAttr = this.getAttribute('outputs')
    this._parseOutputsAttribute(outputsAttr)
  }

  disconnectedCallback() {
    // Unregister from parent graph
    if (this.graph) {
      this.graph.unregisterNode(this)
    }
  }

  connectedMoveCallback() {
    this.requestRedraw()
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
      case 'title':
        this.title = newVal
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
   * Parse inputs attribute: "port1:source1,port2:source2.outputPort,port3:source3"
   * @private
   */
  _parseInputsAttribute(value) {
    this._parsedInputs.clear()

    if (!value) return

    const pairs = value.split(',').map(s => s.trim()).filter(Boolean)

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
      // Input and ToString nodes should have a default 'output', other nodes should have no outputs
      if (this.constructor.name === 'NodeInput' || this.constructor.name === 'NodeToString') {
        this._parsedOutputs = ['output']
      } else {
        this._parsedOutputs = []
      }
      return
    }

    this._parsedOutputs = value.split(',').map(s => s.trim()).filter(Boolean)
  }

  /**
   * Request the parent graph to redraw the canvas
   */
  requestRedraw() {
    if (this.graph) {
      this.graph.draw("NodeBase::requestRedraw")
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
    // If this node has no outputs, just execute it and return the execution promise
    if (this._parsedOutputs.length === 0) {
      return this.startExecution(forceRerun)
    }

    // If requesting a port that doesn't exist, use the first available port or default
    if (!this._parsedOutputs.includes(port)) {
      if (this._parsedOutputs.length > 0) {
        port = this._parsedOutputs[0] // Use first available port
      } else {
        // No outputs at all - this shouldn't happen due to check above, but just in case
        return this.startExecution(forceRerun)
      }
    }

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

      // Reset downstream nodes AFTER this node completes execution (plugin nodes only)
      if (forceRerun && this.constructor.name === 'NodePlugin') {
        this.executionPromise.finally(() => {
          this.resetDownstreamNodes()
        })
      }

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
   * Reset all downstream nodes to idle state when this node starts execution
   * This ensures that downstream nodes will re-execute when this node's output changes
   */
  resetDownstreamNodes() {
    if (!this.graph) return

    // Find all nodes that depend on this node's output
    const downstreamNodes = this.findDownstreamNodes()

    for (const node of downstreamNodes) {
      // Skip if node is already idle or not yet executed
      if (node.state === 'idle' && !node.executionPromise) {
        continue
      }

      console.log(`[${this.id}] Resetting downstream node: ${node.id}`)

      // Reset the node state
      node.state = 'idle'
      node.error = null
      node.isExecuting = false

      // Clear execution promises to force re-execution
      node.executionPromise = null
      node.outputPromises.clear()

      // Request redraw to update visual state
      node.requestRedraw()
    }
  }

  /**
   * Find all nodes downstream from this node (recursive)
   * @returns {Set<NodeBase>} Set of downstream nodes
   */
  findDownstreamNodes() {
    const downstream = new Set()
    const visited = new Set()

    const traverse = (nodeId) => {
      if (visited.has(nodeId)) return
      visited.add(nodeId)

      // Find all connections from this node
      for (const connection of this.graph.connectionIndex) {
        if (connection.fromNodeId === nodeId) {
          const targetNode = this.graph.nodes.get(connection.toNodeId)
          if (targetNode) {
            downstream.add(targetNode)
            // Recursively find downstream nodes
            traverse(connection.toNodeId)
          }
        }
      }
    }

    traverse(this.id)
    return downstream
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
    const inputs = this.getInputPorts()
    const outputs = this.getOutputPorts()

    return {
      title: this.title || this.id || 'Node',
      type: this.constructor.name.replace('Node', '').toLowerCase(),
      width: 200,
      height: Math.max(80, 50 + Math.max(inputs.length, outputs.length) * 24),
      inputs,
      outputs,
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

  /**
   * Serialize the node to HTML string for persistence
   * Override in subclasses for custom serialization behavior
   * @returns {string} HTML string representation of the node
   */
  serialize() {
    const clone = this.cloneNode(true)
    // Remove transient UI state attributes
    clone.removeAttribute('focused')
    return clone.outerHTML
  }
}

customElements.define('node-base', NodeBase)
