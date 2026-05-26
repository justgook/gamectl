function forEachLayer(layers, callback) {
  layers.forEach((layer) => {
    callback(layer)
    if (layer.kind === "group") forEachLayer(layer.children, callback)
  })
}

function createMockTimelineModel() {
  const state = {
    activeLayerId: "body",
    activeFrame: 0,
    frameCount: 6,
    showFrames: true,
    firstFrameNumber: 1,
    layers: [
      {
        id: "shadow",
        name: "Shadow",
        kind: "layer",
        visible: true,
        locked: false,
        continuous: true,
        cels: [
          { frame: 0 },
          { frame: 1 },
          { frame: 2 },
          { frame: 3 },
          { frame: 4 },
          { frame: 5 },
        ],
      },
      {
        id: "character",
        name: "Character",
        kind: "group",
        visible: true,
        locked: false,
        collapsed: false,
        children: [
          {
            id: "gun",
            name: "Gun",
            kind: "layer",
            visible: true,
            locked: false,
            continuous: true,
            cels: [{ frame: 0 }, { frame: 2 }, { frame: 3 }],
          },
          {
            id: "body",
            name: "Body",
            kind: "layer",
            visible: true,
            locked: false,
            continuous: true,
            cels: [
              { frame: 0 },
              { frame: 1 },
              { frame: 2 },
              { frame: 3 },
              { frame: 4 },
            ],
          },
        ],
      },
      {
        id: "background",
        name: "Background",
        kind: "layer",
        visible: true,
        locked: false,
        continuous: true,
        cels: [
          { frame: 0 },
          { frame: 1 },
          { frame: 2 },
          { frame: 3 },
          { frame: 4 },
          { frame: 5 },
        ],
      },
    ],
  }

  return {
    get activeLayerId() {
      return state.activeLayerId
    },
    set activeLayerId(layerId) {
      state.activeLayerId = layerId
    },
    get activeFrame() {
      return state.activeFrame
    },
    set activeFrame(frame) {
      state.activeFrame = frame
    },
    get frameCount() {
      return state.frameCount
    },
    get showFrames() {
      return state.showFrames
    },
    get firstFrameNumber() {
      return state.firstFrameNumber
    },
    get layers() {
      return state.layers
    },

    setLayerVisible(layerId, visible) {
      let found = false
      forEachLayer(state.layers, (layer) => {
        if (layer.id !== layerId) return
        layer.visible = visible
        found = true
      })
      if (!found) throw new Error(`unknown layer ${layerId}`)
    },

    setAllLayersVisible(visible) {
      forEachLayer(state.layers, (layer) => {
        layer.visible = visible
      })
    },

    addLayer() {
      const id = `layer-${Date.now()}`
      state.layers.unshift({
        id,
        name: "Layer",
        kind: "layer",
        visible: true,
        locked: false,
        continuous: true,
        cels: [],
      })
      state.activeLayerId = id
    },

    addFrame() {
      state.frameCount += 1
      state.activeFrame = state.frameCount - 1
    },

    selectCel({ layerId, frame }) {
      state.activeLayerId = layerId
      state.activeFrame = frame
    },
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function validateLayer(layer, path) {
  if (!layer || typeof layer !== "object" || Array.isArray(layer))
    throw new Error(`${path} must be an object`)
  if (typeof layer.id !== "string" || layer.id.length === 0)
    throw new Error(`${path}.id is required`)
  if (typeof layer.name !== "string")
    throw new Error(`${path}.name is required`)
  if (layer.kind !== "layer" && layer.kind !== "group")
    throw new Error(`${path}.kind must be layer or group`)
  if (typeof layer.visible !== "boolean")
    throw new Error(`${path}.visible is required`)
  if (typeof layer.locked !== "boolean")
    throw new Error(`${path}.locked is required`)

  if (layer.kind === "group") {
    if (!Array.isArray(layer.children))
      throw new Error(`${path}.children is required for groups`)
    layer.children.forEach((child, index) =>
      validateLayer(child, `${path}.children[${index}]`),
    )
    return
  }

  if (Object.hasOwn(layer, "children"))
    throw new Error(`${path}.children is invalid for non-group layers`)
  if (typeof layer.continuous !== "boolean")
    throw new Error(`${path}.continuous is required for layers`)
}

function flattenLayers(layers, depth = 0, rows = []) {
  layers.forEach((layer) => {
    rows.push({ layer, depth })
    if (layer.kind === "group" && !layer.collapsed)
      flattenLayers(layer.children, depth + 1, rows)
  })
  return rows
}

function hasCel(layer, frame) {
  if (!Array.isArray(layer.cels)) return false
  return layer.cels.some((cel) => cel.frame === frame)
}

function allLayersVisible(layers) {
  let allVisible = true
  forEachLayer(layers, (layer) => {
    if (!layer.visible) allVisible = false
  })
  return allVisible
}

export class WidgetTimeline extends HTMLElement {
  constructor() {
    super()
    this._model = createMockTimelineModel()
    this._playing = false
  }

  connectedCallback() {
    this.render()
  }

  get model() {
    return this._model
  }

  set model(model) {
    this._model = model
    if (this.isConnected) this.render()
  }

  render() {
    const model = this._model
    this._validateModel(model)
    const rows = flattenLayers(model.layers)
    const frames = Array.from({ length: model.frameCount }, (_, index) => index)
    const globalVisible = allLayersVisible(model.layers)

    this.innerHTML = `
      <article data-element="timeline">
        <table data-element="timeline-table">
          <thead data-element="frame-header">
            <tr data-element="timeline-topbar">
              <th colspan="2">
                <span role="buttongroup" data-element="playback-actions">
                  <button data-action="start" aria-label="First frame" title="First frame"><i aria-hidden="true">first_page</i></button>
                  <button data-action="back" aria-label="Previous frame" title="Previous frame"><i aria-hidden="true">chevron_left</i></button>
                  <button data-action="play-pause" aria-label="Play or pause" title="Play or pause"><i aria-hidden="true">${this._playing ? "pause" : "play_arrow"}</i></button>
                  <button data-action="forward" aria-label="Next frame" title="Next frame"><i aria-hidden="true">chevron_right</i></button>
                  <button data-action="end" aria-label="Last frame" title="Last frame"><i aria-hidden="true">last_page</i></button>
                </span>
              </th>
              ${model.showFrames ? `<th colspan="${frames.length}"><output data-element="timeline-tags">Tags</output></th>` : ""}
            </tr>
            <tr data-element="timeline-index-row">
              <th>
                <button data-action="toggle-all-visible" aria-pressed="${globalVisible ? "true" : "false"}" aria-label="Show or hide all layers" title="Show or hide all layers"><i aria-hidden="true">${globalVisible ? "visibility" : "visibility_off"}</i></button>
              </th>
              <th>
                <span role="buttongroup" data-element="timeline-add-actions">
                  <button data-action="add-layer" aria-label="Add layer" title="Add layer"><i aria-hidden="true">add</i></button>
                  <button data-action="add-frame" aria-label="Add frame" title="Add frame"><i aria-hidden="true">note_add</i></button>
                </span>
              </th>
              ${model.showFrames ? frames.map((frame) => `<th>${model.firstFrameNumber + frame}</th>`).join("") : ""}
            </tr>
          </thead>
          <tbody data-element="layer-rows">
            ${rows.map(({ layer, depth }) => this._renderLayerRow(layer, depth, frames)).join("")}
          </tbody>
        </table>
      </article>
    `

    this._bindEvents(model)
  }

  _bindEvents(model) {
    this.querySelector('[data-action="start"]').addEventListener(
      "click",
      () => {
        model.activeFrame = 0
        this.render()
      },
    )

    this.querySelector('[data-action="back"]').addEventListener("click", () => {
      model.activeFrame = Math.max(0, model.activeFrame - 1)
      this.render()
    })

    this.querySelector('[data-action="play-pause"]').addEventListener(
      "click",
      () => {
        this._playing = !this._playing
        this.render()
      },
    )

    this.querySelector('[data-action="forward"]').addEventListener(
      "click",
      () => {
        model.activeFrame = Math.min(
          model.frameCount - 1,
          model.activeFrame + 1,
        )
        this.render()
      },
    )

    this.querySelector('[data-action="end"]').addEventListener("click", () => {
      model.activeFrame = model.frameCount - 1
      this.render()
    })

    this.querySelector('[data-action="toggle-all-visible"]').addEventListener(
      "click",
      () => {
        if (typeof model.setAllLayersVisible !== "function")
          throw new Error(
            "widget-timeline.model.setAllLayersVisible is required",
          )
        model.setAllLayersVisible(!allLayersVisible(model.layers))
        this.render()
      },
    )

    this.querySelector('[data-action="add-layer"]').addEventListener(
      "click",
      () => {
        if (typeof model.addLayer !== "function")
          throw new Error("widget-timeline.model.addLayer is required")
        model.addLayer({
          parentId: null,
          kind: "layer",
          afterLayerId: model.activeLayerId,
        })
        this.render()
      },
    )

    this.querySelector('[data-action="add-frame"]').addEventListener(
      "click",
      () => {
        if (typeof model.addFrame !== "function")
          throw new Error("widget-timeline.model.addFrame is required")
        model.addFrame({ afterFrame: model.activeFrame })
        this.render()
      },
    )

    this.querySelectorAll("[data-layer-id]").forEach((row) => {
      row.addEventListener("click", () => {
        model.activeLayerId = row.getAttribute("data-layer-id")
        this.render()
      })
    })

    this.querySelectorAll('[data-action="toggle-layer-visible"]').forEach(
      (button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation()
          if (typeof model.setLayerVisible !== "function")
            throw new Error("widget-timeline.model.setLayerVisible is required")
          model.setLayerVisible(
            button.getAttribute("data-layer-id"),
            button.getAttribute("aria-pressed") !== "true",
          )
          this.render()
        })
      },
    )

    this.querySelectorAll('[data-action="select-cel"]').forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation()
        model.activeLayerId = button.getAttribute("data-layer-id")
        model.activeFrame = Number(button.getAttribute("data-frame"))
        if (typeof model.selectCel === "function") {
          model.selectCel({
            layerId: model.activeLayerId,
            frame: model.activeFrame,
          })
        }
        this.render()
      })
    })
  }

  _renderLayerRow(layer, depth, frames) {
    const active = layer.id === this._model.activeLayerId
    const groupPrefix =
      layer.kind === "group" ? (layer.collapsed ? "▸ " : "▾ ") : ""
    const indent = "&nbsp;".repeat(depth * 4)
    return `
      <tr data-layer-id="${escapeHtml(layer.id)}" aria-selected="${active ? "true" : "false"}">
        <td>
          <button data-action="toggle-layer-visible" data-layer-id="${escapeHtml(layer.id)}" aria-pressed="${layer.visible ? "true" : "false"}" aria-label="Toggle layer visibility" title="Toggle layer visibility"><i aria-hidden="true">${layer.visible ? "visibility" : "visibility_off"}</i></button>
        </td>
        <td>${indent}${groupPrefix}${escapeHtml(layer.name)}</td>
        ${
          this._model.showFrames
            ? frames
                .map(
                  (frame) => `
          <td>
            <button data-action="select-cel" data-layer-id="${escapeHtml(layer.id)}" data-frame="${frame}" aria-pressed="${active && this._model.activeFrame === frame ? "true" : "false"}">${hasCel(layer, frame) ? "●" : "○"}</button>
          </td>
        `,
                )
                .join("")
            : ""
        }
      </tr>
    `
  }

  _validateModel(model) {
    if (!model || typeof model !== "object" || Array.isArray(model))
      throw new Error("widget-timeline.model must be an object")
    if (typeof model.activeLayerId !== "string")
      throw new Error("widget-timeline.model.activeLayerId is required")
    if (!Number.isInteger(model.activeFrame) || model.activeFrame < 0)
      throw new Error(
        "widget-timeline.model.activeFrame must be a non-negative integer",
      )
    if (!Number.isInteger(model.frameCount) || model.frameCount < 1)
      throw new Error(
        "widget-timeline.model.frameCount must be a positive integer",
      )
    if (typeof model.showFrames !== "boolean")
      throw new Error("widget-timeline.model.showFrames is required")
    if (!Number.isInteger(model.firstFrameNumber))
      throw new Error("widget-timeline.model.firstFrameNumber is required")
    if (!Array.isArray(model.layers))
      throw new Error("widget-timeline.model.layers is required")
    model.layers.forEach((layer, index) =>
      validateLayer(layer, `widget-timeline.model.layers[${index}]`),
    )
  }
}

if (!customElements.get("widget-timeline")) {
  customElements.define("widget-timeline", WidgetTimeline)
}
