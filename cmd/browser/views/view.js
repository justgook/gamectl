import { panelJoin } from "../systems/split-layout-join.js"
import { bus } from "../systems/event-bus.js"

const defaultView = "view-empty"
export class View extends HTMLElement {
  static get observedAttributes() { return ['x', 'y', 'w', 'h', 'panel']; }
  constructor(contentTag = defaultView) {
    super();
    this._x = 0
    this._y = 0
    this._w = 0
    this._h = 0
    this.content = contentTag
    
    // Bind focus/blur handlers
    this._handleFocusIn = this._handleFocusIn.bind(this)
    this._handleFocusOut = this._handleFocusOut.bind(this)
  }

  connectedCallback() {
    // Only use absolute positioning and chrome when in LayoutParent
    const inLayout = this.parentElement?.tagName === 'LAYOUT-PARENT' ||
      this.closest('layout-parent')

    if (inLayout) {
      this.style.position = "absolute"
      this._updatePosition()
      this.appendChild(this.mounedContent)
      this.addChrome()
    } else {
      // In popup or standalone - use relative positioning
      this.style.position = "relative"
      this.style.display = "block"
      this.appendChild(this.mounedContent)
      // Still need to update dimensions if they're set
      this._updatePosition()
    }
    
    // Add focus/blur event listeners for keybinding context
    this.addEventListener('focusin', this._handleFocusIn)
    this.addEventListener('focusout', this._handleFocusOut)
  }
  
  disconnectedCallback() {
    // Clean up event listeners
    this.removeEventListener('focusin', this._handleFocusIn)
    this.removeEventListener('focusout', this._handleFocusOut)
  }
  
  _handleFocusIn() {
    // Get view type from tag name or content template
    const viewType = this.getViewMode()
    if (viewType) {
      bus.emit('view:focus', { view: this.tagName.toLowerCase(), mode: viewType })
    }
  }
  
  _handleFocusOut() {
    const viewType = this.getViewMode()
    if (viewType) {
      bus.emit('view:blur', { view: this.tagName.toLowerCase(), mode: viewType })
    }
  }
  
  /**
   * Get the mode/context name for this view
   * Override in subclasses to provide specific mode names
   */
  getViewMode() {
    // Default: use tag name without 'view-' prefix
    const tagName = this.tagName.toLowerCase()
    if (tagName.startsWith('view-')) {
      return tagName.substring(5) // Remove 'view-' prefix
    }
    return 'global'
  }

  attributeChangedCallback(name, _oldVal, newVal) {
    if (name === 'x') this._x = parseFloat(newVal);
    if (name === 'y') this._y = parseFloat(newVal);
    if (name === 'w') this._w = parseFloat(newVal);
    if (name === 'h') this._h = parseFloat(newVal);
    if (name === 'panel') {
      this.panel = newVal
      if (this.debug) this.debug.textContent = newVal
    }
    this._updatePosition()
  }


  set content(tag = defaultView) {
    const haveMount = this.mounedContent
    this._content = tag
    const template = document.getElementById(tag)
    const content = template.content.cloneNode(true)
    this.mounedContent = document.createElement("div")
    this.mounedContent.style.display = "content"
    this.mounedContent.appendChild(content)
    this.mounedContent.template = tag

    if (!this.isConnected) return
    if (haveMount) this.replaceChild(this.mounedContent, haveMount)
    else this.appendChild(this.mounedContent)
  }

  get content() { return this.mounedContent }

  set x(v) { this._x = v; this._updatePosition(); }
  set y(v) { this._y = v; this._updatePosition(); }
  get x() { return this._x; }
  get y() { return this._y; }

  set w(v) { this._w = v; this._updatePosition(); }
  set h(v) { this._h = v; this._updatePosition(); }
  get w() { return this._w; }
  get h() { return this._h; }

  _updatePosition() {
    this.style.left = this._x + 'px';
    this.style.top = this._y + 'px';
    this.style.width = this._w + 'px';
    this.style.height = this._h + 'px';
  }

  addChrome() {
    const chrome = new ViewChrome(this)
    this.appendChild(chrome)
    //TODO: delete DEBUG STUFF
    this.debug = document.createElement("div")
    this.debug.textContent = this.getAttribute("panel")
    this.debug.style.position = "absolute"
    this.debug.style.top = 0
    this.debug.style.right = 25
    this.appendChild(this.debug)
  }
}


class ViewChrome extends HTMLElement {
  constructor(view) {
    super()
    this.view = view
  }

  connectedCallback() {
    const template = document.getElementById('view-chrome')
    const elm = template.content.cloneNode(true)
    this.style.position = "absolute"
    this.style.inset = 0
    this.style.zIndex = "100"

      ;["ne", "se", "sw", "nw"].map(dir => {
        const corner = elm.querySelector(`[data-action="${dir}"]`)
        corner.addEventListener("dragstart", this._cornerDragStart)
        corner.addEventListener("drag", this._cornerDrag)
        corner.addEventListener("dragend", this._cornerDragEnd)
      })

    const select = elm.querySelector(`[data-action="select-view"]`)
    // Only set value if view content is mounted
    if (this.view.content && this.view.content.template) {
      select.value = this.view.content.template
    }
    select.addEventListener("change", (event) => {
      this._switchView(event.target.value)
    })

    // Only allow drop when drag direction is detected or drag comes from another panel
    this.addEventListener("dragover", this._onDragOver)
    this.addEventListener("drop", this._onDrop)

    this.appendChild(elm)
  }

  _cornerDragEnd = () => {
    // Restore pointer-events to none on ALL chromes
    document.querySelectorAll('view--chrome').forEach(chrome => {
      chrome.style.pointerEvents = ''
    })

    this.dragStartX = 0
    this.dragStartY = 0
    this.dragDirection = null
    this._isDraggingFromThisPanel = false
    this.removeAttribute('data-split-direction')
  }

  _cornerDragStart = (event) => {
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.dragDirection = null; // Reset on new drag
    this._isDraggingFromThisPanel = true // Mark that drag started from this panel
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData('text/plain', this.view.getAttribute("panel"))
    event.dataTransfer.setData('panelId', this.view.getAttribute("panel")) // Also store as specific key

    // Enable pointer events on ALL chromes so they can receive drop events
    document.querySelectorAll('view--chrome').forEach(chrome => {
      chrome.style.pointerEvents = 'auto'
    })
  }

  _cornerDrag = (event) => {
    const threshold = 20; // Your 20px threshold
    if (this.dragDirection) return
    // event.clientX/Y can be 0 on the last event, so ignore
    if (event.clientX === 0 && event.clientY === 0) return;

    const rawDeltaX = event.clientX - this.dragStartX;
    const rawDeltaY = event.clientY - this.dragStartY;
    const absDeltaX = Math.abs(rawDeltaX);
    const absDeltaY = Math.abs(rawDeltaY);
    if (absDeltaX > threshold || absDeltaY > threshold) {
      if (absDeltaX > absDeltaY) {
        this.dragDirection = rawDeltaX > 0 ? "w" : "e"; // Drag right -> new panel on left (west); drag left -> new panel on right (east)
      }
      else {
        this.dragDirection = rawDeltaY > 0 ? "n" : "s"; // Drag down -> new panel above (north); drag up -> new panel below (south)
      }
      // Add visual feedback
      this.setAttribute('data-split-direction', this.dragDirection)
    }
  }

  _onDragOver = (event) => {
    // Always allow drop during a drag operation
    // We'll validate the direction in _onDrop
    event.preventDefault()
  }
  _switchView(viewTag) {
    // Create a new custom element instance
    const newView = document.createElement(viewTag)

    // Copy panel attribute and position from old view
    const panel = this.view.getAttribute("panel")
    newView.setAttribute("panel", panel)

    // Copy position/size using attributes to trigger attributeChangedCallback
    newView.setAttribute("x", this.view._x)
    newView.setAttribute("y", this.view._y)
    newView.setAttribute("w", this.view._w)
    newView.setAttribute("h", this.view._h)
    newView.layout = this.view.layout

    // Replace the view in the DOM
    this.view.parentNode.replaceChild(newView, this.view)
  }

  _onDrop = (event) => {
    event.preventDefault()

    // If no direction detected and dragging from this panel's corner, cancel the drop
    if (!this.dragDirection && this._isDraggingFromThisPanel) {
      return
    }

    if (!this.dragDirection) { //Comes from other panal - so we merge
      const toPanel = event.dataTransfer.getData('text/plain')
      const fromPanel = this.view.getAttribute("panel")
      panelJoin.call(this.view.layout.layout, fromPanel, toPanel)

      const allPanels = this.view.layout.layout.getPanels().map(({ id }) => id)

      const childsToRemove = []
      for (const child of this.view.layout.children) {
        if (child instanceof View) {
          const childPanel = child.getAttribute("panel")
          if (!allPanels.includes(childPanel)) {
            childsToRemove.push(child)
          }
          const index = allPanels.indexOf(childPanel)
          if (index !== -1) {
            allPanels.splice(index, 1);
          }
        }
      }

      childsToRemove.map((a) => a.parentNode.removeChild(a))
      this.view.layout.reset()

      return
    }

    // Convert viewport coordinates to layout-relative coordinates
    const rect = this.view.layout.getBoundingClientRect()
    const relativeX = event.clientX - rect.left
    const relativeY = event.clientY - rect.top

    const child = document.createElement(this.view.content.template)
    child.setAttribute("nesw", this.dragDirection)
    child.setAttribute("p", this.dragDirection === "n" || this.dragDirection === "s" ? relativeY : relativeX)
    child.setAttribute("from", this.view.getAttribute("panel"))
    this.view.layout.appendChild(child)
  }
}


customElements.define('view--chrome', ViewChrome)


