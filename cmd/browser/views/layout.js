import { ChildBox } from "./delme.js"
export class LayoutParent extends HTMLElement {
  constructor() {
    super();
    this._observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node instanceof ChildBox) {
            this._onChildAdded(node);
          }
        }
      }
    });
  }

  connectedCallback() {
    this._observer.observe(this, { childList: true });
  }

  disconnectedCallback() {
    this._observer.disconnect();
  }

  _onChildAdded(child) {
    // Example: randomize position within layout
    const maxX = this.clientWidth - 50;
    const maxY = this.clientHeight - 50;
    child.x = Math.floor(Math.random() * maxX);
    child.y = Math.floor(Math.random() * maxY);
  }
}

