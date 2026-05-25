import { require } from "/util/require.js"
import { runtime } from "/core/runtime.js"

let currentThemeStylesheetObjectUrl = ''

// const DEFAULT_LAYOUT = `<view-ng data-source="pipe/testing.ng.json" />`
const DEFAULT_LAYOUT = `<view-issues />`

function doInit(viewConfig) {
  Promise.all([
    require("ui-plugins/context.js"),
    require("ui-plugins/keys.js"),
    require("ui-plugins/layout.js"),
    require("ui-plugins/toast.js"),
    require("ui-plugins/popup.js"),
  ]).then(([{ createUiContext }, { createUiKeys }]) => {
    runtime.register(createUiContext())
    runtime.register(createUiKeys(viewConfig))

    const viewRegistry = createConfiguredViewRegistry(viewConfig)

    const layout = document.querySelector("ui-layout")
    layout.setViewRegistry(viewRegistry)
    layout.load(DEFAULT_LAYOUT)

    const toast = document.querySelector("toast-manager")
    runtime.register({ id: 'ui.toast', methods: toast.api })
    const popup = document.querySelector("popup-manager")
    runtime.register({ id: 'ui.popup', methods: popup.api })
    popup.setViewRegistry(viewRegistry)


    window.onerror = function (_message, _source, _lineno, _colno, error) {
      runtime.call("ui.toast.error", errorParse(error))
      return false // prevents default logging (optional)
    }

    window.addEventListener("unhandledrejection", (e) => {
      runtime.call("ui.toast.error", errorParse(e))
    })
  })
}

export async function init(config) {
  void applyThemeStylesheet(config)
  const fragment = new DocumentFragment()
  fragment.appendChild(document.createElement('ui-layout'))
  fragment.appendChild(document.createElement('popup-manager'))
  fragment.appendChild(document.createElement('toast-manager'))

  void doInit(config)
  document.body.appendChild(fragment)
}



function errorParse(error) {
  const e = error.reason || error
  console.trace(e)
  return `${e.plugin ? "[" + e.plugin + "]: " : ""}${e.message || e}`
}

function createConfiguredViewRegistry(config) {
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
        // el.runtime = runtime
        el.viewConfig = viewConfig
        if (viewConfig.config !== undefined) el.config = viewConfig.config
        if (viewConfig.defaultSource !== undefined && !Object.hasOwn(options.attrs || {}, 'data-source')) el.setAttribute('data-source', viewConfig.defaultSource)
        return el
      },
    }]
  }))
}


async function applyThemeStylesheet(config) {
  const themePath = config?.ui?.theme?.path
  if (typeof themePath !== 'string' || themePath.length === 0) throw new Error('gams config ui.theme.path is required')
  const readResult = unwrapResult(await runtime.invoke("fs/fs::read-file", themePath), "theme read")

  const blob = new Blob([new Uint8Array(readResult)], { type: 'text/css' })
  const themeHref = URL.createObjectURL(blob)
  const previousUrl = currentThemeStylesheetObjectUrl
  currentThemeStylesheetObjectUrl = themeHref

  const link = document.getElementById('theme-stylesheet')
  link.setAttribute('href', themeHref)
  window.__currentThemePath = themePath
  window.__currentThemeStylesheetHref = themeHref

  document.querySelectorAll('view-area, view-popup').forEach((el) => {
    const shadowLink = el.shadowRoot?.querySelector('link[data-theme-stylesheet]')
    if (shadowLink) shadowLink.setAttribute('href', themeHref)
  })

  if (previousUrl) URL.revokeObjectURL(previousUrl)
}

function unwrapResult(result, label) {
  if (result && Object.prototype.hasOwnProperty.call(result, "ok")) return result.ok
  if (result && Object.prototype.hasOwnProperty.call(result, "err")) throw new Error(`${label}: ${result.err}`)
  throw new Error(`${label}: expected WIT result object`)
}
