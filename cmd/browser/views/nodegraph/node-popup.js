import { NodeBase } from './node-base.js'

/**
 * Popup Node - Interactive input/output node with custom popup UI
 * 
 * Attributes:
 * - inputs: Port definitions with connections (standard NodeBase)
 * - outputs: Comma-separated output port names (standard NodeBase) 
 * - values: Stored output values "outputName:value,outputName2:value2"
 * 
 * Data Attributes in template HTML:
 * - data-input="inputName": Element shows value from connected input
 * - data-output="outputName": Element value becomes node output
 * 
 * Example:
 * <node-popup id="input1" x="100" y="100" 
 *                outputs="value,enabled"
 *                values="value:42,enabled:true">
 *   <input type="number" data-output="value" value="0">
 *   <input type="checkbox" data-output="enabled"> Enabled
 * </node-popup>
 */
export class NodePopup extends NodeBase {
  static get observedAttributes() {
    return [...super.observedAttributes, 'values']
  }

  constructor() {
    super()
    this.storedValues = new Map() // Parsed from values attribute
  }

  connectedCallback() {
    super.connectedCallback()

    // Parse values attribute
    const valuesAttr = this.getAttribute('values')
    if (valuesAttr) {
      this._parseValuesAttribute(valuesAttr)
    }
  }

  attributeChangedCallback(name, oldVal, newVal) {
    super.attributeChangedCallback(name, oldVal, newVal)

    if (oldVal === newVal) return

    switch (name) {
      case 'values':
        this._parseValuesAttribute(newVal)
        this.requestRedraw()
        break
      case 'inputs':
        // Input connections changed - reset this node
        if (oldVal !== newVal) {
          this.resetNodeState()
        }
        break
    }
  }

  /**
   * Parse values attribute: "output1:value1,output2:value2"
   * @private
   */
  _parseValuesAttribute(value) {
    this.storedValues.clear()

    if (!value) return

    const pairs = value.split(',').map(s => s.trim()).filter(Boolean)

    for (const pair of pairs) {
      const colonIndex = pair.indexOf(':')
      if (colonIndex > 0) {
        const outputName = pair.substring(0, colonIndex).trim()
        const outputValue = pair.substring(colonIndex + 1).trim()
        this.storedValues.set(outputName, outputValue)
      }
    }
  }

  getDisplayInfo() {
    const base = super.getDisplayInfo()
    const outputs = base.outputs

    // Create display values for outputs
    const outputsWithValues = outputs.map(output => ({
      ...output,
      value: this.storedValues.get(output.name) || '',
      hasValue: this.storedValues.has(output.name)
    }))

    return Object.assign(base, {
      type: 'template',
      outputs: outputsWithValues,
      values: this.storedValues
    })
  }

  /**
   * Execute this template node - resolve outputs with stored values
   */
  async executeNode(resolvers) {
    this.state = 'running'
    this.requestRedraw()

    try {
      // Wait a brief moment to show running state
      await new Promise(resolve => setTimeout(resolve, 50))

      // Resolve each output with its stored value
      for (const outputName of this._parsedOutputs) {
        const value = this.storedValues.get(outputName)

        if (resolvers.has(outputName)) {
          // Convert stored string values to appropriate types
          let resolvedValue = value
          if (value === 'true') resolvedValue = true
          else if (value === 'false') resolvedValue = false
          else if (value && !isNaN(value)) resolvedValue = Number(value)

          resolvers.get(outputName).resolve(resolvedValue)
        }
      }

      this.state = 'success'
      this.error = null

    } catch (error) {
      this.state = 'error'
      this.error = error.message
      console.error(`Template node ${this.id} failed:`, error)

      // Reject all outputs
      for (const [, { reject }] of resolvers) {
        reject(error)
      }
    }

    this.requestRedraw()
  }

  /**
   * Reset node state when inputs or outputs change
   */
  resetNodeState() {
    this.state = 'idle'
    this.error = null
    this.isExecuting = false
    this.executionPromise = null
    this.outputPromises.clear()
    this.requestRedraw()
  }

  /**
   * Open edit popup for this template
   */
  async openEditPopup() {
    // Find popup manager
    const popupManager = this.closest('popup-manager') ||
      document.querySelector('popup-manager')
    if (!popupManager) {
      console.error('popup-manager not found')
      return
    }

    // Create popup with template's inner content
    const popup = document.createElement('view-popup')
    popup.setAttribute('title', `Edit ${this.title}(${this.id})`)
    popup.setAttribute('size', 'medium')

    // Clone our inner HTML for editing
    const content = document.createElement('div')
    content.innerHTML = this.innerHTML
    content.style.padding = 'var(--spacing-scale-3)'

    // Apply current input values from connected nodes
    await this.applyInputsToPopup(content)

    // Apply stored output values  
    this.applyOutputsToPopup(content)

    // Add save/cancel buttons
    const buttonContainer = document.createElement('div')
    buttonContainer.style.cssText = `
      display: flex; 
      gap: var(--spacing-scale-2); 
      justify-content: flex-end; 
      margin-top: var(--spacing-scale-3);
      padding-top: var(--spacing-scale-3);
      border-top: 1px solid var(--color-semantic-border-default);
    `

    const saveBtn = document.createElement('button')
    saveBtn.className = 'button-primary'
    saveBtn.textContent = 'Save'
    saveBtn.onclick = () => {
      this.saveFromPopup(content)
      popup.close()
    }

    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'button-secondary'
    cancelBtn.textContent = 'Cancel'
    cancelBtn.onclick = () => popup.close()

    buttonContainer.appendChild(cancelBtn)
    buttonContainer.appendChild(saveBtn)

    content.appendChild(buttonContainer)
    popup.appendChild(content)
    popupManager.appendChild(popup)

    // Focus first input
    const firstInput = content.querySelector('input, textarea, select')
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 100)
    }
  }

  /**
   * Apply input values from connected nodes to popup elements
   */
  async applyInputsToPopup(popupContent) {
    const inputElements = popupContent.querySelectorAll('[data-input]')

    for (const element of inputElements) {
      const inputName = element.getAttribute('data-input')
      try {
        const value = await this.getInputValue(inputName)
        if (value !== null && value !== undefined) {
          this.setElementValue(element, value)
        }
      } catch (error) {
        console.warn(`Failed to get input ${inputName}:`, error)
        this.setElementValue(element, '') // Clear on error
      }
    }
  }

  /**
   * Apply stored output values to popup elements
   */
  applyOutputsToPopup(popupContent) {
    const outputElements = popupContent.querySelectorAll('[data-output]')

    outputElements.forEach(element => {
      const outputName = element.getAttribute('data-output')
      if (this.storedValues.has(outputName)) {
        const value = this.storedValues.get(outputName)
        this.setElementValue(element, value)
      }
    })
  }

  /**
   * Set value on an element based on its type
   */
  setElementValue(element, value) {
    if (element.type === 'checkbox') {
      element.checked = value === 'true' || value === true
    } else if (element.type === 'radio') {
      element.checked = element.value === value
    } else if (element.tagName === 'SELECT') {
      element.value = value
    } else if (element.hasAttribute('data-input')) {
      // For input elements, also update textContent for read-only display
      if (element.tagName === 'SPAN' || element.tagName === 'DIV') {
        element.textContent = value
      } else {
        element.value = value
      }
    } else {
      element.value = value
    }
  }

  /**
   * Get value from an element based on its type
   */
  getElementValue(element) {
    if (element.type === 'checkbox') {
      return element.checked
    } else if (element.type === 'radio') {
      return element.checked ? element.value : null
    } else if (element.tagName === 'SELECT') {
      return element.value
    } else {
      return element.value
    }
  }

  /**
   * Save values from popup back to node
   */
  saveFromPopup(popupContent) {
    // Collect values from output elements
    const values = []
    const outputElements = popupContent.querySelectorAll('[data-output]')

    outputElements.forEach(element => {
      const outputName = element.getAttribute('data-output')
      const value = this.getElementValue(element)

      if (value !== null) {
        values.push(`${outputName}:${value}`)
      }
    })

    // Update values attribute
    const newValues = values.join(',')
    const oldValues = this.getAttribute('values') || ''

    if (newValues !== oldValues) {
      this.setAttribute('values', newValues)

      // Reset this node and downstream nodes
      this.resetNodeState()
      this.resetDownstreamNodes()

      console.log(`Template ${this.id} values updated:`, newValues)
    }
  }
}

customElements.define('node-popup', NodePopup)
