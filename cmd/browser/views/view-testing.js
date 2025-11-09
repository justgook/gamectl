import { View } from "./view.js"
export class ViewTesting extends View {
  // static get observedAttributes() { return View.observedAttributes }
  // constructor() {
  //   super()
  // }
  connectedCallback() {
    super.connectedCallback()
    const template = document.getElementById('view-testing')
    const content = template.content.cloneNode(true)
    this.appendChild(content)
  }
}

