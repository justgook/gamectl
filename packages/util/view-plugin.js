import { runtime } from '/core/runtime.js'

function toResult(value) {
  if (value && typeof value === 'object' && Object.hasOwn(value, 'ok')) return value
  if (value && typeof value === 'object' && Object.hasOwn(value, 'err')) return value
  return { ok: value ?? true }
}

function viewTypeForElement(view) {
  const tag = view.tagName.toLowerCase()
  if (!tag) throw new Error('view plugin registration requires a custom element tag')
  return tag.replace(/^view-/, '').replaceAll('-', '.')
}

async function callViewMethod(view, methodNames, input) {
  for (const methodName of methodNames) {
    if (typeof view[methodName] !== 'function') continue
    const value = await view[methodName](input)
    return toResult(value)
  }
  throw new Error(`${view.pluginId} does not implement ${methodNames[0]}`)
}

async function noop() {
  return { ok: true }
}

export function registerViewPlugin(view, methods = {}) {
  if (!(view instanceof HTMLElement)) throw new Error('registerViewPlugin requires an HTMLElement')
  if (typeof view.pluginId === 'string' && view.pluginId.length > 0) return view.pluginId

  const pluginId = `view.${viewTypeForElement(view)}.${crypto.randomUUID()}`
  view.pluginId = pluginId
  runtime.register({
    id: pluginId,
    methods: {
      ping: async () => ({ ok: { id: pluginId } }),
      save: async (input) => callViewMethod(view, ['save', 'saveGraph'], input),
      saveAs: async (input) => callViewMethod(view, ['saveAs', 'saveGraphAs'], input),
      new: async (input) => callViewMethod(view, ['new', 'newGraph', 'newTree', 'newTilemap'], input),
      open: async (input) => callViewMethod(view, ['open', 'showLoadGraphPopup', 'openTree', 'openTilemap'], input),
      run: async (input) => callViewMethod(view, ['run', 'runGraph'], input),
      reload: async (input) => callViewMethod(view, ['reload', 'reloadGraph'], input),
      zoomIn: async (input) => callViewMethod(view, ['zoomIn'], input),
      zoomOut: async (input) => callViewMethod(view, ['zoomOut'], input),
      zoomFit: async (input) => callViewMethod(view, ['zoomFit', 'fitToContent'], input),
      clearSelection: async (input) => callViewMethod(view, ['clearSelection'], input),
      tool_1: noop,
      tool_2: noop,
      tool_3: noop,
      tool_4: noop,
      tool_5: noop,
      tool_6: noop,
      ...methods,
    },
  })
  void runtime.call('ui.context.activateView', pluginId)

  return pluginId
}

export async function unregisterViewPlugin(view) {
  if (!(view instanceof HTMLElement)) throw new Error('unregisterViewPlugin requires an HTMLElement')
  const pluginId = view.pluginId
  if (typeof pluginId !== 'string' || pluginId.length === 0) return
  view.pluginId = ''
  await runtime.unregister(pluginId)
}

export function viewOk(value = true) {
  return toResult(value)
}
