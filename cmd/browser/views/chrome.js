import { panelJoin } from "../systems/split-layout-join.js"
import { bus } from "../systems/event-bus.js"
import { viewLoader } from "../systems/view-loader.js"

export class ViewChrome extends HTMLElement {
  static get observedAttributes() { return ['x', 'y', 'w', 'h', 'panel'] }

  constructor() {
    super();
    this._x = 0;
    this._y = 0;
    this._w = 0;
    this._h = 0;
    this.panel = null;
    this.layout = null; // Set by layout parent

    // Drag state for corner handles
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragDirection = null;
    this._isDraggingFromThisPanel = false;

    // The shadow DOM
    let template = document.getElementById("chrome-template")
    const shadowRoot = this.attachShadow({ mode: "open" })
    shadowRoot.appendChild(document.importNode(template.content, true))
  }

  connectedCallback() {
    const content = this.shadowRoot
    this._setupCornerHandles(content)
    this._setupViewSelector(content)

    // Set position style
    this.style.position = "absolute"
    this._updatePosition()
    // Setup drag/drop for merging panels
    this.addEventListener("dragover", this._onDragOver);
    this.addEventListener("drop", this._onDrop);

  }

  disconnectedCallback() {
    this.removeEventListener("dragover", this._onDragOver);
    this.removeEventListener("drop", this._onDrop);
  }

  attributeChangedCallback(name, _oldVal, newVal) {
    if (name === 'x') this._x = parseFloat(newVal);
    if (name === 'y') this._y = parseFloat(newVal);
    if (name === 'w') this._w = parseFloat(newVal);
    if (name === 'h') this._h = parseFloat(newVal);
    if (name === 'panel') {
      this.panel = newVal;
    }

    this._updatePosition();
  }

  set x(v) { this.setAttribute('x', v); }
  set y(v) { this.setAttribute('y', v); }
  set w(v) { this.setAttribute('w', v); }
  set h(v) { this.setAttribute('h', v); }
  get x() { return this._x; }
  get y() { return this._y; }
  get w() { return this._w; }
  get h() { return this._h; }

  _updatePosition() {
    this.style.left = this._x + 'px';
    this.style.top = this._y + 'px';
    this.style.width = this._w + 'px';
    this.style.height = this._h + 'px';
  }

  /**
   * Switch to a different view type
   * @param {string} viewTag - Tag name of new view (e.g., 'view-nodegraph')
   */
  switchView(viewTag) {
    const currentView = this.shadowRoot.querySelector('slot:not([name])').assignedElements()[0] || null

    // Create new view
    const newView = document.createElement(viewTag)

    // Replace in DOM
    if (currentView) {
      this.replaceChild(newView, currentView)
    } else {
      this.appendChild(newView)
    }
  }

  // --- Corner Drag Handles ---

  _setupCornerHandles(content) {
    ["ne", "se", "sw", "nw"].forEach(dir => {
      const corner = content.querySelector(`[data-action="${dir}"]`);
      corner.addEventListener("dragstart", (e) => this._cornerDragStart(e));
      corner.addEventListener("drag", (e) => this._cornerDrag(e));
      corner.addEventListener("dragend", () => this._cornerDragEnd());
    });
  }

  _cornerDragStart(event) {
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.dragDirection = null;
    this._isDraggingFromThisPanel = true;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData('text/plain', this.panel);
    event.dataTransfer.setData('panelId', this.panel);

    // Enable pointer events on ALL chromes so they can receive drop events
    document.querySelectorAll('view-chrome').forEach(chrome => {
      chrome.style.pointerEvents = 'auto';
    });
  }

  _cornerDrag(event) {
    const threshold = 20;
    if (this.dragDirection) return;
    if (event.clientX === 0 && event.clientY === 0) return;

    const rawDeltaX = event.clientX - this.dragStartX;
    const rawDeltaY = event.clientY - this.dragStartY;
    const absDeltaX = Math.abs(rawDeltaX);
    const absDeltaY = Math.abs(rawDeltaY);

    if (absDeltaX > threshold || absDeltaY > threshold) {
      if (absDeltaX > absDeltaY) {
        this.dragDirection = rawDeltaX > 0 ? "w" : "e";
      } else {
        this.dragDirection = rawDeltaY > 0 ? "n" : "s";
      }
      this.setAttribute('data-split-direction', this.dragDirection);
    }
  }

  _cornerDragEnd() {
    // Restore pointer-events on all chromes
    document.querySelectorAll('view-chrome').forEach(chrome => {
      chrome.style.pointerEvents = '';
    });

    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragDirection = null;
    this._isDraggingFromThisPanel = false;
    this.removeAttribute('data-split-direction');
  }


  _setupViewSelector(content) {
    const select = content.querySelector('[data-action="select-view"]');

    // Populate from view registry if ready, otherwise wait for the event
    if (viewLoader.registry.size > 0) {
      this._populateViewSelector(select)
    }

    bus.on('views:registry-ready', () => {
      this._populateViewSelector(select)
    })

    select.addEventListener("change", (event) => {
      this.switchView(event.target.value);
    });
  }

  /**
   * Populate the view selector dropdown from the ViewLoader registry
   * Groups views by category into optgroup elements
   */
  _populateViewSelector(select) {
    const currentView = this.shadowRoot.querySelector('slot:not([name]').assignedElements()[0] || null
    const currentTag = currentView ? currentView.tagName.toLowerCase() : null

    // Clear existing options
    select.innerHTML = ''

    // Get grouped views from the registry
    const groups = viewLoader.getGroupedViews()

    // Define a preferred category order
    const categoryOrder = ['Canvas', 'OPR', 'Data', 'Utilities', 'Sprites', 'Tiles', 'Animation', 'System']

    // Sort groups: known categories first in order, then any others alphabetically
    const sortedCategories = [...groups.keys()].sort((a, b) => {
      const ia = categoryOrder.indexOf(a)
      const ib = categoryOrder.indexOf(b)
      if (ia !== -1 && ib !== -1) return ia - ib
      if (ia !== -1) return -1
      if (ib !== -1) return 1
      return a.localeCompare(b)
    })

    for (const category of sortedCategories) {
      const views = groups.get(category)
      const optgroup = document.createElement('optgroup')
      optgroup.label = category

      for (const view of views) {
        const option = document.createElement('option')
        option.value = view.tag
        option.textContent = view.displayName
        optgroup.appendChild(option)
      }

      select.appendChild(optgroup)
    }

    // Restore current selection
    if (currentTag) {
      select.value = currentTag
    }
  }

  // --- Drag & Drop for Panel Merging ---

  _onDragOver = (event) => {
    event.preventDefault();
  }

  _onDrop = (event) => {
    event.preventDefault();

    // If no direction detected and dragging from this panel's corner, cancel
    if (!this.dragDirection && this._isDraggingFromThisPanel) {
      return;
    }

    if (!this.dragDirection) {
      // Comes from other panel - merge panels
      const toPanel = event.dataTransfer.getData('text/plain');
      const fromPanel = this.panel;

      if (!this.layout) {
        console.error('Chrome has no layout reference');
        return;
      }

      panelJoin.call(this.layout.layout, fromPanel, toPanel);

      const allPanels = this.layout.layout.getPanels().map(({ id }) => id);

      // Remove chromes for deleted panels
      const chromesToRemove = [];
      for (const child of this.layout.children) {
        if (child.tagName === 'VIEW-CHROME') {
          const childPanel = child.getAttribute("panel");
          if (!allPanels.includes(childPanel)) {
            chromesToRemove.push(child);
          }
        }
      }

      chromesToRemove.forEach(chrome => chrome.parentNode.removeChild(chrome));
      this.layout.reset();
      return;
    }

    // Split panel - convert viewport coords to layout-relative coords
    const rect = this.layout.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;
    const relativeY = event.clientY - rect.top;

    // Get current view tag to create same type in new panel
    const currentView = this.shadowRoot.querySelector('slot:not([name]').assignedElements()[0] || null
    const viewTag = currentView ? currentView.tagName.toLowerCase() : 'view-empty';

    // Create new chrome with new view
    const newChrome = document.createElement('view-chrome');
    newChrome.setAttribute("nesw", this.dragDirection);
    newChrome.setAttribute("p", this.dragDirection === "n" || this.dragDirection === "s" ? relativeY : relativeX);
    newChrome.setAttribute("from", this.panel);

    // Create view inside chrome
    const newView = document.createElement(viewTag);
    newChrome.appendChild(newView);

    this.layout.appendChild(newChrome);
  }
}

customElements.define('view-chrome', ViewChrome);
