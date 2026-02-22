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
    this._panel = 0;

    // The shadow DOM
    let template = document.getElementById("chrome-template")
    const shadowRoot = this.attachShadow({ mode: "open" })
    shadowRoot.appendChild(document.importNode(template.content, true))
  }

  connectedCallback() {
    const content = this.shadowRoot
    if (typeof window.__syncThemeStylesheetToRoot === 'function') {
      window.__syncThemeStylesheetToRoot(this.shadowRoot)
    }
    this._setupViewSelector(content)

    // Set position style
    this.style.position = "absolute"
    this._updatePosition()
  }

  disconnectedCallback() {
  }

  attributeChangedCallback(name, _oldVal, newVal) {
    if (name === 'x') this._x = parseFloat(newVal)
    if (name === 'y') this._y = parseFloat(newVal)
    if (name === 'w') this._w = parseFloat(newVal)
    if (name === 'h') this._h = parseFloat(newVal)
    if (name === 'panel') this._panel = parseFloat(newVal)


    this._updatePosition();
  }

  set x(v) { this.setAttribute('x', v); }
  set y(v) { this.setAttribute('y', v); }
  set w(v) { this.setAttribute('w', v); }
  set h(v) { this.setAttribute('h', v); }
  set panel(v) { this.setAttribute('panel', v); }

  get x() { return this._x; }
  get y() { return this._y; }
  get w() { return this._w; }
  get h() { return this._h; }
  get panel() { return this._panel; }

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
    const currentView = this.shadowRoot.querySelector('slot:not([name])').assignedElements()[0] || null
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

}

customElements.define('view-chrome', ViewChrome);
