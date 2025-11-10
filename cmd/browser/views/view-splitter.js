import { View } from "./view.js"
export class ViewSplitter extends View {
  constructor() {
    super('view-splitter')
    this.content.querySelector('[data-action="split-vertical"]').addEventListener("click", () => {
      console.log("CLICK", this)
    })
    this.content.querySelector('[data-action="split-horizontal"]').addEventListener("click", () => {
      console.log("CLICK", this.layout)

      const child = new ViewSplitter()
      this.layout.insertBefore(child, this)
    })
  }
}

