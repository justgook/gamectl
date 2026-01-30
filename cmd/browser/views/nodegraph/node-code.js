import { NodeBase } from './node-base.js'
import { bytes } from "../../util/dataview.js"

/**
 * NodeCode - Custom JavaScript transformation node
 * 
 * Code is stored as textContent (DOM as state).
 * Uses $in and $out aliases for input/output access.
 * 
 * Attributes:
 * - inputs: Port definitions with connections (standard NodeBase)
 * - outputs: Comma-separated output port names (standard NodeBase)
 * - title: Display title for the node
 * 
 * Example:
 * <node-code id="transform" x="100" y="100"
 *            title="Parse CSV"
 *            inputs="raw"
 *            outputs="rows,count">
 * $out.rows = $in.raw.split('\n').map(r => r.split(','));
 * $out.count = $out.rows.length;
 * </node-code>
 */
export class NodeCode extends NodeBase {
  getDisplayInfo() {
    const inputs = this.getInputPorts()
    const outputs = this.getOutputPorts()

    return {
      title: this.title || 'Code',
      type: 'code',
      width: 200,
      height: Math.max(120, 50 + Math.max(inputs.length, outputs.length) * 24),
      inputs,
      outputs
    }
  }

  async executeNode(resolvers) {
    this.state = 'running'
    this.requestRedraw()

    try {
      // Collect inputs
      const $in = {}
      for (const [name] of this._parsedInputs) {
        $in[name] = await this.getInputValue(name)
      }


      // Get user code from textContent
      const userCode = this.textContent.trim()
      if (!userCode) {
        throw new Error('No code provided')
      }

      // Wrap user code: declare $out at start, return it at end
      // This allows user to reassign $out or just update properties
      const wrappedCode = `let $out = {};\n${userCode}\nreturn $out;`

      // Use AsyncFunction for await support
      const AsyncFunction = Object.getPrototypeOf(async function() { }).constructor
      const fn = new AsyncFunction('$in', "bytes", wrappedCode)
      const $out = await fn($in, bytes)

      // Resolve outputs
      for (const outputName of this._parsedOutputs) {
        if (resolvers.has(outputName)) {
          resolvers.get(outputName).resolve($out[outputName])
        }
      }

      this.state = 'success'
      this.error = null
      console.log(`Code node ${this.id} completed`)

    } catch (error) {
      this.state = 'error'
      this.error = error.message
      console.error(`Code node ${this.id} failed:`, error)

      for (const [, { reject }] of resolvers) {
        reject(error)
      }
    }

    this.requestRedraw()
  }

  /**
   * Open code editor popup using template from index.html
   */
  async openEditPopup() {
    const popupManager = this.closest('popup-manager') ||
      document.querySelector('popup-manager')
    if (!popupManager) {
      console.error('popup-manager not found')
      return
    }

    // Get the template from the document
    const template = document.getElementById('popup-node-code')
    if (!template) {
      console.error('popup-node-code template not found in document')
      return
    }

    // Create popup
    const popup = document.createElement('view-popup')
    popup.setAttribute('size', 'large')

    // Create title element for slot
    const titleElement = document.createElement('h2')
    titleElement.slot = 'title'
    titleElement.className = 'popup-title'
    titleElement.textContent = `Edit Code: ${this.title || this.id}`
    popup.appendChild(titleElement)

    // Clone template content
    const content = template.content.cloneNode(true)

    // Populate the info section
    const inputsInfo = content.querySelector('[data-element="inputs-info"]')
    const outputsInfo = content.querySelector('[data-element="outputs-info"]')
    if (inputsInfo) {
      inputsInfo.textContent = Array.from(this._parsedInputs.keys()).join(', ') || 'none'
    }
    if (outputsInfo) {
      outputsInfo.textContent = this._parsedOutputs.join(', ') || 'none'
    }

    // Populate the textarea with current code
    const textarea = content.querySelector('[data-element="code-editor"]')
    if (textarea) {
      textarea.value = this.textContent.trim()
    }

    // Get error display element
    const errorDiv = content.querySelector('[data-element="error-display"]')

    // Setup button handlers
    const cancelBtn = content.querySelector('[data-action="cancel"]')
    const saveBtn = content.querySelector('[data-action="save"]')

    if (cancelBtn) {
      cancelBtn.onclick = () => popup.close()
    }

    if (saveBtn) {
      saveBtn.onclick = () => {
        const code = textarea.value.trim()

        // Syntax validation
        try {
          new Function('$in', "bytes", '$out', code)
          if (errorDiv) {
            errorDiv.style.display = 'none'
          }
        } catch (e) {
          if (errorDiv) {
            errorDiv.textContent = `Syntax error: ${e.message}`
            errorDiv.style.display = 'block'
          }
          return // Don't close on error
        }

        // Save to textContent
        this.textContent = code

        // Reset node state
        this.state = 'idle'
        this.error = null
        this.isExecuting = false
        this.executionPromise = null
        this.outputPromises.clear()
        this.resetDownstreamNodes()
        this.requestRedraw()

        popup.close()
      }
    }

    popup.appendChild(content)
    popupManager.appendChild(popup)

    // Focus textarea after popup is added
    setTimeout(() => {
      if (textarea) textarea.focus()
    }, 100)
  }
}

customElements.define('node-code', NodeCode)
