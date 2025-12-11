export class ViewEmpty extends HTMLElement {
  connectedCallback() {
    this.style.display = 'block'
    this.style.width = '100%'
    this.style.height = '100%'
    
    const template = document.getElementById('view-empty')
    const content = template.content.cloneNode(true)
    this.appendChild(content)
  }
}
