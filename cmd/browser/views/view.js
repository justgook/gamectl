export class View extends HTMLElement {
  static get observedAttributes() { return ['x', 'y', 'w', 'h']; }
  constructor() {
    super();
    this._x = 0;
    this._y = 0;
    this._w = 0;
    this._h = 0;
  }

  connectedCallback() {
    this.style.position = "absolute"
    this._updatePosition();
    this.addChrome()
  }

  attributeChangedCallback(name, _oldVal, newVal) {
    if (name === 'x') this._x = parseFloat(newVal);
    if (name === 'y') this._y = parseFloat(newVal);
    if (name === 'w') this._w = parseFloat(newVal);
    if (name === 'h') this._h = parseFloat(newVal);
    this._updatePosition();
  }

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
    this.style.width = "100%"
    this.style.height = "100%"
    this.style.zIndex = "100"

      ;["ne", "se", "sw", "nw"].map(dir => {
        const corner = elm.querySelector(`[data-action="${dir}"]`)
        corner.addEventListener("dragstart", this._cornerDragStart)
        corner.addEventListener("drag", this._cornerDrag)
        corner.addEventListener("dragend", this._cornerDragEnd)
      })

    this.addEventListener("dragover", (event) => { event.preventDefault() })
    this.addEventListener("drop", (event) => {
      event.preventDefault()

      console.log("this.dragDirection could be wrong or empty if drag from other panel", this.dragDirection)
      if (!this.dragDirection) {
        const plainText2 = event.dataTransfer.getData('text/plain')
        const plainText = this.view.getAttribute("panel")
        console.log(`it came from ${plainText}`, this.view.getAttribute("panel"))
        const result = this.view.layout.layout.join(plainText2, plainText)
        if (result) {
          const child = this.view.layout.querySelector(`[panel="${plainText}"]`)
          this.view.layout.removeChild(child)
          this.view.layout.reset()
        }
        console.log(result)
        return
      }

      const child = document.createElement("view-splitter")
      child.setAttribute("nesw", this.dragDirection)
      child.setAttribute("p", this.dragDirection === "n" || this.dragDirection === "s" ? event.clientY : event.clientX)
      child.setAttribute("from", this.view.getAttribute("panel"))
      this.view.layout.appendChild(child)
    })

    this.appendChild(elm)
  }

  _cornerDragEnd = () => {
    this.dragStartX = 0
    this.dragStartY = 0
    this.dragDirection = null
  }

  _cornerDragStart = (event) => {
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.dragDirection = null; // Reset on new drag
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData('text/plain', this.view.getAttribute("panel"))
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
        this.dragDirection = rawDeltaX > 0 ? "e" : "w"; // "e" (right) or "w" (left)
      }
      else {
        this.dragDirection = rawDeltaY > 0 ? "s" : "n"; // "s" (down) or "n" (up)
      }
    }
  }
}



customElements.define('view--chrome', ViewChrome)


