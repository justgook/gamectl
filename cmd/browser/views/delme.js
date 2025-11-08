export class ChildBox extends HTMLElement {
  static get observedAttributes() { return ['x', 'y']; }
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._x = 0;
    this._y = 0;
    this.shadowRoot.innerHTML = `
          <style>
            :host {
              position: absolute;
              width: 50px;
              height: 50px;
              border-radius: 6px;
              background: #66c;
              color: white;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 14px;
              transition: transform 0.3s ease, background 0.3s ease;
            }
            :host(:hover) {
              background: #99f;
              transform: scale(1.1);
            }
          </style>
          <div id="label"></div>
        `;
    this._label = this.shadowRoot.querySelector('#label');
  }

  connectedCallback() {
    this._updatePosition();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'x') this._x = parseFloat(newVal);
    if (name === 'y') this._y = parseFloat(newVal);
    this._updatePosition();
  }

  set x(v) { this._x = v; this._updatePosition(); }
  set y(v) { this._y = v; this._updatePosition(); }
  get x() { return this._x; }
  get y() { return this._y; }

  _updatePosition() {
    this.style.left = this._x + 'px';
    this.style.top = this._y + 'px';
    this._label.textContent = `(${this._x},${this._y})`;
  }
}
