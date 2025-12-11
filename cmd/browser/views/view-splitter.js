export class ViewSplitter extends HTMLElement {
  connectedCallback() {
    this.style.display = 'block'
    this.style.width = '100%'
    this.style.height = '100%'
    
    const template = document.getElementById('view-splitter')
    const content = template.content.cloneNode(true)
    this.appendChild(content)
    
    this.querySelector('[data-action="split-vertical"]')?.addEventListener("click", () => {
      console.log("CLICK", this)
    })
    this.querySelector('[data-action="split-horizontal"]')?.addEventListener("click", () => {
      console.log("CLICK", this.closest('view-chrome')?.layout)
    })
  }
}

