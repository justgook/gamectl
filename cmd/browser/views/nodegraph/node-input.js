import { NodeBase } from './node-base.js'

/**
 * Input Node - Provides user-configurable input values
 * 
 * Attributes:
 * - type: 'number' | 'text' | 'range' (default: 'number')
 * - value: The current value
 * - label: Display label (default: id)
 * - min, max, step: For range/number inputs
 * 
 * Example:
 * <node-input id="nodeCount" x="100" y="100" 
 *             type="number" value="10" label="Node Count">
 * </node-input>
 */
export class NodeInput extends NodeBase {
  static get observedAttributes() {
    return [...super.observedAttributes, 'type', 'value', 'label', 'min', 'max', 'step']
  }

  constructor() {
    super()
    this.inputType = 'number'
    this.value = 0
    this.label = ''
    this.min = 0
    this.max = 100
    this.step = 1
  }

  connectedCallback() {
    super.connectedCallback()

    // Parse input-specific attributes
    this.inputType = this.getAttribute('type') || 'number'
    this.value = this.parseValue(this.getAttribute('value'))
    this.label = this.getAttribute('label') || this.id
    this.min = parseFloat(this.getAttribute('min')) || 0
    this.max = parseFloat(this.getAttribute('max')) || 100
    this.step = parseFloat(this.getAttribute('step')) || 1

    // Set initial output value
    this.outputValue = this.value
    this.state = 'success' // Input nodes are always "ready"
  }

  attributeChangedCallback(name, oldVal, newVal) {
    super.attributeChangedCallback(name, oldVal, newVal)

    if (oldVal === newVal) return

    switch (name) {
      case 'type':
        this.inputType = newVal || 'number'
        break
      case 'value':
        this.value = this.parseValue(newVal)
        this.outputValue = this.value
        this.propagateChange()
        break
      case 'label':
        this.label = newVal || this.id
        this.requestRedraw()
        break
      case 'min':
        this.min = parseFloat(newVal) || 0
        break
      case 'max':
        this.max = parseFloat(newVal) || 100
        break
      case 'step':
        this.step = parseFloat(newVal) || 1
        break
    }
  }

  parseValue(val) {
    if (this.inputType === 'number' || this.inputType === 'range') {
      return parseFloat(val) || 0
    }
    return val || ''
  }

  /**
   * Notify downstream nodes that value changed
   */
  propagateChange() {
    if (!this.graph) return

    // Find all nodes that depend on this node
    for (const node of this.graph.nodes.values()) {
      const connections = node.getInputConnections()
      const dependsOnThis = connections.some(c => c.sourceNodeId === this.id)

      if (dependsOnThis) {
        // Reset downstream node state (they need to re-execute)
        if (node.state === 'success') {
          node.setAttribute('state', 'ready')
        }
      }
    }

    this.requestRedraw()
  }

  getDisplayInfo() {
    return {
      title: this.label,
      type: 'input',
      width: 200,
      height: 100,
      inputs: [], // No inputs
      outputs: [
        { name: 'output', type: this.inputType, label: 'Value' }
      ]
    }
  }

  getInputPorts() {
    return [] // No inputs
  }

  getOutputPorts() {
    return [
      { name: 'output', type: this.inputType, label: 'Value' }
    ]
  }

  async execute() {
    // Input nodes don't execute, they just provide values
    this.state = 'success'
    this.outputValue = this.value
  }

  canExecute() {
    return true // Always ready
  }
}

customElements.define('node-input', NodeInput)
