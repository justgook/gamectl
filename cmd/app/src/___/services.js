import { require2 } from "/util/require.js"
// import { runtime } from "/core/runtime.js"

console.log("INIT LAYOUT")
function createConfiguredViewRegistry(config, runtime) {
  const entries = config.ui.views
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) throw new Error('gams config ui.views is required')
  return new Map(Object.entries(entries).map(([tag, viewConfig]) => {
    if (!viewConfig || typeof viewConfig !== 'object' || Array.isArray(viewConfig)) throw new Error(`gams config ui.views.${tag} must be an object`)
    return [tag, {
      label: viewConfig.label || tag,
      group: viewConfig.group || '',
      internal: viewConfig.internal === true,
      async load() {
        if (customElements.get(tag)) return
        if (typeof viewConfig.url !== 'string' || viewConfig.url.length === 0) throw new Error(`gams config ui.views.${tag}.url is required`)
        await require(viewConfig.url)
        if (!customElements.get(tag)) throw new Error(`view '${tag}' did not register custom element '${tag}'`)
      },

      async create(options = {}) {
        await this.load()
        const el = document.createElement(tag)
        el.runtime = runtime
        el.viewConfig = viewConfig
        if (viewConfig.config !== undefined) el.config = viewConfig.config
        if (viewConfig.defaultSource !== undefined && !Object.hasOwn(options.attrs || {}, 'data-source')) el.setAttribute('data-source', viewConfig.defaultSource)
        if (tag === 'view-ai') el.openConfig = structuredClone(viewConfig.config)
        return el
      },
    }]
  }))
}

function doInit() {
  Promise.all([require2("ui-plugins/layout3.js"), require2("ui-plugins/toast.js")])
}

export async function init() {
  const DEFAULT_LAYOUT = `
  <view-markov data-source="Basic" />
  <view-tilemap data-source="/edge_rules.map.json" setup="0:v:50" />
  <view-ng setup="1:h:50" />
  <view-animation setup="1:v:50" />
`
  void doInit()
  console.log(DEFAULT_LAYOUT)
  const layout = document.createElement('ui-layout')
  // layout.setViewRegistry([])

  const fragment = new DocumentFragment();
  fragment.appendChild(layout)

  const toast = document.createElement('toast-manager')
  fragment.appendChild(toast)
  // runtime.register({ id: 'ui.toast', methods: toast.api })

  return fragment
  // runtime.register({ id: 'ui.layout', methods: layout.api })
  // await layout.bindRuntime(runtime)
  // await layout.load(DEFAULT_LAYOUT)
}



