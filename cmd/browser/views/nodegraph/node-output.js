import { NodeBase } from './node-base.js'

/**
 * Output Node - Terminal node that displays results
 * 
 * Attributes:
 * - label: Display label (default: id)
 * - format: 'json' | 'text' | 'number' (default: 'text')
 * - inputs: Connection to source node: "value:sourceNode"
 * 
 * Example:
 * <node-output id="result" x="1000" y="100"
 *              label="Result"
 *              format="json"
 *              inputs="value:treegen">
 * </node-output>
 */
export class NodeOutput extends NodeBase {
  static get observedAttributes() {
    return [...super.observedAttributes, 'label', 'format']
  }

  constructor() {
    super()
    this.label = ''
    this.format = 'text'
  }

  connectedCallback() {
    super.connectedCallback()

    this.label = this.getAttribute('label') || this.id
    this.format = this.getAttribute('format') || 'text'
  }

  attributeChangedCallback(name, oldVal, newVal) {
    super.attributeChangedCallback(name, oldVal, newVal)

    if (oldVal === newVal) return

    switch (name) {
      case 'label':
        this.label = newVal || this.id
        this.requestRedraw()
        break
      case 'format':
        this.format = newVal || 'text'
        break
    }
  }

  getDisplayInfo() {
    const inputs = this.getInputPorts()
    const outputs = this.getOutputPorts()

    return {
      title: this.label,
      type: 'output',
      width: 200,
      height: 100,
      inputs,
      outputs
    }
  }

  getOutputPorts() {
    // Terminal node - no outputs
    return []
  }

  async execute() {
    this.state = 'running'
    this.requestRedraw()

    try {
      // Get input value
      const value = this.getInputValue('value')

      // Format for display/output
      this.outputValue = this.formatValue(value)

      // Log to console for now
      console.log(`Output [${this.label}]:`, this.outputValue)

      this.state = 'success'
      this.error = null

    } catch (error) {
      this.state = 'error'
      this.error = error.message
      console.error(`Output [${this.label}] failed:`, error)
    }

    this.requestRedraw()
  }

  formatValue(value) {
    if (value === null || value === undefined) {
      return 'null'
    }

    switch (this.format) {
      case 'json':
        try {
          if (value instanceof Uint8Array) {
            const text = new TextDecoder().decode(value)
            return JSON.stringify(JSON.parse(text), null, 2)
          }
          return JSON.stringify(value, null, 2)
        } catch {
          return String(value)
        }

      case 'number':
        return Number(value)

      case 'text':
      default:
        if (value instanceof Uint8Array) {
          return new TextDecoder().decode(value)
        }
        return String(value)
    }
  }
}

customElements.define('node-output', NodeOutput)
