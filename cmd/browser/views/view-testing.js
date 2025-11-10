import { View } from "./view.js"
export class ViewTesting extends View {
  // static get observedAttributes() { return View.observedAttributes }
  // constructor() {
  //   super()
  // }
  constructor() {
    super('view-testing')
  }
  connectedCallback() {
    super.connectedCallback('view-testing')
  }
}

