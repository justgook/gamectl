import { NodeBase } from './node-base.js'

/**
 * Popup Node - Interactive input/output node with custom popup UI
 * 
 * IMPORTANT: Content must be wrapped in a <template> tag to prevent
 * premature rendering (especially for View components like view-tree).
 * 
 * Attributes:
 * - inputs: Port definitions with connections (standard NodeBase)
 * - outputs: Comma-separated output port names (standard NodeBase) 
 * - values: Stored output values "outputName:value,outputName2:value2"
 * - data-input-target: Map inputs to element attributes "input:selector@attr"
 * - onopen: JavaScript to execute when popup opens (has content, inputs, outputs)
 * 
 * Data Attributes in template HTML:
 * - data-input="inputName": Element shows value from connected input
 * - data-output="outputName": Element value becomes node output
 * 
 * Example:
 * <node-popup id="input1" x="100" y="100" 
 *                outputs="value,enabled"
 *                values="value:42,enabled:true">
 *   <template>
 *     <input type="number" data-output="value" value="0">
 *     <input type="checkbox" data-output="enabled"> Enabled
 *   </template>
 * </node-popup>
 */
export class NodePopup extends NodeBase {
  static get observedAttributes() {
    return [...super.observedAttributes, 'values', 'data-input-target', 'onopen']
  }

  constructor() {
    super()
    this.storedValues = new Map() // Parsed from values attribute
  }

  connectedCallback() {
    super.connectedCallback()

    // Validate that content is wrapped in <template>
    this._validateTemplateStructure()

    // Parse values attribute
    const valuesAttr = this.getAttribute('values')
    if (valuesAttr) {
      this._parseValuesAttribute(valuesAttr)
    }
  }

  /**
   * Validate that node-popup has exactly one <template> child
   * @private
   */
  _validateTemplateStructure() {
    const children = Array.from(this.children)

    // Filter out text nodes (whitespace)
    const elementChildren = children.filter(child => child.nodeType === Node.ELEMENT_NODE)

    if (elementChildren.length === 0) {
      // Empty is OK - might have text content only
      return
    }

    if (elementChildren.length !== 1) {
      throw new Error(
        `node-popup (${this.id}) must have exactly one <template> child element, found ${elementChildren.length}`
      )
    }

    if (elementChildren[0].tagName !== 'TEMPLATE') {
      throw new Error(
        `node-popup (${this.id}) child must be a <template> element, found <${elementChildren[0].tagName.toLowerCase()}>`
      )
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

  /**
   * Parse data-input-target attribute: "inputName:selector@attr,input2:sel2@attr2"
   * @private
   */
  _parseInputTargets(value) {
    const targets = []
    if (!value) return targets

    const mappings = value.split(',').map(s => s.trim()).filter(Boolean)

    for (const mapping of mappings) {
      // Parse format: "inputName:selector@attribute"
      const colonIndex = mapping.indexOf(':')
      if (colonIndex < 0) continue

      const inputName = mapping.substring(0, colonIndex).trim()
      const rest = mapping.substring(colonIndex + 1)
      const atIndex = rest.indexOf('@')

      if (atIndex < 0) continue

      const selector = rest.substring(0, atIndex).trim()
      const attribute = rest.substring(atIndex + 1).trim()

      targets.push({ inputName, selector, attribute })
    }

    return targets
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
    popup.setAttribute('size', 'large')

    // Extract content from <template> element
    const templateElement = this.querySelector('template')
    if (!templateElement) {
      console.error(`node-popup (${this.id}) has no <template> child`)
      return
    }

    // Clone template content for editing
    const content = document.createElement('div')
    const templateContent = templateElement.content.cloneNode(true)
    content.appendChild(templateContent)
    content.style.padding = 'var(--spacing-scale-3)'

    // Apply current input values from connected nodes
    await this.applyInputsToPopup(content)

    // Apply stored output values  
    this.applyOutputsToPopup(content)

    // Execute onopen handler if defined
    const onOpenAttr = this.getAttribute('onopen')
    if (onOpenAttr) {
      try {
        // Create context object with access to inputs and content
        const inputValues = {}
        for (const inputName of this._parsedInputs || []) {
          try {
            inputValues[inputName] = await this.getInputValue(inputName)
          } catch (e) {
            inputValues[inputName] = null
          }
        }

        const outputValues = Object.fromEntries(this.storedValues)

        // Execute the inline handler
        const handler = new Function('content', 'inputs', 'outputs', onOpenAttr)
        handler.call(this, content, inputValues, outputValues)
      } catch (error) {
        console.error('Error executing onopen handler:', error)
      }
    }

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

    // Initialize View elements AFTER popup is in DOM
    // Popup acts as a layout manager, setting x/y/w/h like LayoutParent does
    setTimeout(() => {
      const viewElements = popup.querySelectorAll('view-tree, view-tilemap')
      for (const view of viewElements) {
        let width = 0
        let height = 0

        // Try to get dimensions from inline style attribute (before computed styles mess it up)
        const styleAttr = view.getAttribute('style')
        if (styleAttr) {
          const widthMatch = styleAttr.match(/width:\s*(\d+)px/)
          const heightMatch = styleAttr.match(/height:\s*(\d+)px/)
          if (widthMatch) width = parseInt(widthMatch[1])
          if (heightMatch) height = parseInt(heightMatch[1])
        }

        // If no explicit size in style, use popup content area size
        if (!width || width < 100) { // Sanity check (< 100px is probably wrong)
          const popupContent = popup.querySelector('.popup-content')
          if (popupContent) {
            const contentRect = popupContent.getBoundingClientRect()
            width = Math.max(contentRect.width - 32, 600) // Min 600px
            height = Math.max(contentRect.height - 100, 400) // Min 400px
          } else {
            width = 800 // Fallback
            height = 600
          }
        }

        // Position at 0,0 within popup content, use computed dimensions
        view.setAttribute('x', '0')
        view.setAttribute('y', '0')
        view.setAttribute('w', width.toString())
        view.setAttribute('h', height.toString())
      }
    }, 0)

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

    // Handle data-input-target mappings
    const inputTargetAttr = this.getAttribute('data-input-target')
    if (inputTargetAttr) {
      const targets = this._parseInputTargets(inputTargetAttr)

      for (const { inputName, selector, attribute } of targets) {
        try {
          const value = await this.getInputValue(inputName)
          if (value !== null && value !== undefined) {
            const targetElement = popupContent.querySelector(selector)
            if (targetElement) {
              targetElement.setAttribute(attribute, value)
            } else {
              console.warn(`Target element not found: ${selector}`)
            }
          }
        } catch (error) {
          console.warn(`Failed to apply input target ${inputName}:`, error)
        }
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
