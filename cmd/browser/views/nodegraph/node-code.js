import { NodeBase } from './node-base.js'
import { bytes } from "../../util/dataview.js"
import { parseCSVWithHeaders } from '../../util/csv.js'

/**
 * NodeCode - Custom JavaScript transformation node
 * 
 * Code is stored as textContent (DOM as state) OR loaded from external file.
 * Uses $in and $out aliases for input/output access.
 * 
 * Attributes:
 * - inputs: Port definitions with connections (standard NodeBase)
 * - outputs: Comma-separated output port names (standard NodeBase)
 * - title: Display title for the node
 * - src: External file path (OPFS or HTTP URL) to load code from
 * 
 * When src is set:
 * - Code is loaded lazily on first execution or when opening editor
 * - textContent is used as a temporary runtime cache
 * - Edits in popup are temporary (until page refresh)
 * - textContent is NOT persisted to database (excluded from serialize())
 * 
 * Example with inline code:
 * <node-code id="transform" x="100" y="100"
 *            title="Parse CSV"
 *            inputs="raw"
 *            outputs="rows,count">
 * $out.rows = $in.raw.split('\n').map(r => r.split(','));
 * $out.count = $out.rows.length;
 * </node-code>
 * 
 * Example with external file:
 * <node-code id="transform" x="100" y="100"
 *            title="Parse CSV"
 *            inputs="raw"
 *            outputs="rows,count"
 *            src="/scripts/parse-csv.js">
 * </node-code>
 */
export class NodeCode extends NodeBase {
  static get observedAttributes() {
    return [...super.observedAttributes, 'src']
  }

  constructor() {
    super()
    this._codeLoaded = false  // Whether external code has been loaded
    this._loadError = null    // Error from loading external code
  }
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

  /**
   * Check if this node uses an external file source
   * @returns {boolean}
   */
  hasExternalSource() {
    return !!this.getAttribute('src')
  }

  /**
   * Load code from external file (OPFS or HTTP)
   * Sets textContent as runtime cache
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  loadExternalCode = async () => {
    const src = this.getAttribute('src')
    if (!src) {
      return { success: true }  // No external source, use inline code
    }

    try {
      const result = await window.pluginManager.call('fs', 'read', src)

      if (result.returnCode !== 0) {
        const errorMsg = new TextDecoder().decode(result.output)
        this._loadError = `Failed to load ${src}: ${errorMsg}`
        this._codeLoaded = false
        return { success: false, error: this._loadError }
      }

      // Decode and cache in textContent
      const code = new TextDecoder().decode(result.output)
      this.textContent = code
      this._codeLoaded = true
      this._loadError = null
      return { success: true }
    } catch (e) {
      this._loadError = `Failed to load ${src}: ${e.message}`
      this._codeLoaded = false
      return { success: false, error: this._loadError }
    }
  }

  /**
   * Reload code from external file, discarding any local changes
   * @returns {Promise<{success: boolean, error?: string}>}
   */


  async reloadFromFile() {
    this._codeLoaded = false
    return await this.loadExternalCode()
  }

  async executeNode(resolvers) {
    this.state = 'running'
    this.requestRedraw()

    try {
      // If using external source and not yet loaded, load it now
      if (this.hasExternalSource() && !this._codeLoaded) {
        const loadResult = await this.loadExternalCode()
        if (!loadResult.success) {
          throw new Error(loadResult.error)
        }
      }

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
      const fn = new AsyncFunction('$in', "bytes", "fromCSV", wrappedCode)
      const $out = await fn($in, bytes, parseCSVWithHeaders)

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
   * Serialize the node to HTML string for persistence
   * If src is set, exclude textContent (it's a runtime cache from external file)
   * @returns {string} HTML string representation of the node
   */
  serialize() {
    const clone = this.cloneNode(true)
    clone.removeAttribute('focused')

    // If using external source, clear textContent (don't persist cached code)
    if (this.hasExternalSource()) {
      clone.textContent = ''
    }

    return clone.outerHTML
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

    // If using external source and not yet loaded, load it now
    const isExternal = this.hasExternalSource()
    if (isExternal && !this._codeLoaded) {
      const loadResult = await this.loadExternalCode()
      if (!loadResult.success) {
        console.error(loadResult.error)
        // Continue anyway to show the error in the popup
      }
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

    // Show load error if any
    if (this._loadError && errorDiv) {
      errorDiv.textContent = this._loadError
      errorDiv.style.display = 'block'
    }

    // Get button container to add reload button if external
    const buttonContainer = content.querySelector('[data-element="button-container"]')

    // Setup button handlers
    const cancelBtn = content.querySelector('[data-action="cancel"]')
    const saveBtn = content.querySelector('[data-action="save"]')

    if (cancelBtn) {
      cancelBtn.onclick = () => popup.close()
    }

    // Add external file indicator and reload button if using external source
    if (isExternal && buttonContainer) {
      const src = this.getAttribute('src')

      // Create indicator
      const indicator = document.createElement('div')
      indicator.className = 'external-file-indicator'
      indicator.style.cssText = `
        flex: 1;
        font-size: var(--font-size-sm);
        color: var(--color-semantic-text-secondary);
        display: flex;
        align-items: center;
        gap: var(--spacing-scale-2);
      `
      indicator.innerHTML = `
        <span style="color: var(--color-semantic-warning);">External:</span>
        <code style="font-size: var(--font-size-xs); opacity: 0.8;">${src}</code>
        <span style="opacity: 0.6;">(changes are temporary)</span>
      `

      // Create reload button
      const reloadBtn = document.createElement('button')
      reloadBtn.className = 'button-secondary'
      reloadBtn.textContent = 'Reload'
      reloadBtn.title = 'Reload code from external file'
      reloadBtn.onclick = async () => {
        const result = await this.reloadFromFile()
        if (result.success) {
          textarea.value = this.textContent.trim()
          if (errorDiv) {
            errorDiv.style.display = 'none'
          }
        } else {
          if (errorDiv) {
            errorDiv.textContent = result.error
            errorDiv.style.display = 'block'
          }
        }
      }

      // Insert at the beginning of button container
      buttonContainer.insertBefore(indicator, buttonContainer.firstChild)
      buttonContainer.insertBefore(reloadBtn, cancelBtn)
    }

    if (saveBtn) {
      saveBtn.onclick = () => {
        const code = textarea.value.trim()

        // Syntax validation
        try {
          const AsyncFunction = Object.getPrototypeOf(async function() { }).constructor
          new AsyncFunction('$in', "bytes", "fromCSV", '$out', code)
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

        // Save to textContent (temporary for external files)
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
