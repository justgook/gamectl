export class TilemapMenu extends HTMLDetailsElement {
  constructor() {
    super()
    this._data = null
  }

  connectedCallback() {
    this.className = "tree"
    this.style.position = "absolute"
    this.style.top = 32
    this.innerHTML = "<summary>loading..</summary>"
  }

  get data() {
    return this._data
  }

  set data(input) {
    this._data = input
    this.renderData(this)
  }

  renderData() {
    this.innerHTML = `<summary>${this.title}</summary>`
    this.data.layers.forEach((layer, i) => {
      const layerName = layer.meta?.name || `layer_${i}`
      if (!layer.meta) {
        const div = document.createElement("div")
        div.innerText = layerName
        this.appendChild(div)

        return
      }
      const details = document.createElement("details")
      const summary = document.createElement("summary")
      summary.innerText = layerName
      details.appendChild(summary)
      Object.entries(layer.meta).forEach(([k, v]) => {
        const div = document.createElement("div")
        div.innerText = `${k}:${truncateWithEllipses(v, 25)}`
        details.appendChild(div)

      })
      this.appendChild(details)
    })
    console.log("rendering data")
  }
}
function truncateWithEllipses(text, max) {
  return text.substr(0, max - 1) + (text.length > max ? '...' : '');
}


customElements.define('tilemap-menu', TilemapMenu, { extends: "details" })

