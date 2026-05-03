import { runtime } from '../core/runtime.js'

function encodeResult(value) {
  return {
    returnCode: 0,
    output: new TextEncoder().encode(JSON.stringify(value ?? null)),
  }
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
    return encodeResult(value ?? { ok: true })
  }
  throw new Error(`${view.pluginId} does not implement ${methodNames[0]}`)
}

export function registerViewPlugin(view, methods = {}) {
  if (!(view instanceof HTMLElement)) throw new Error('registerViewPlugin requires an HTMLElement')
  if (typeof view.pluginId === 'string' && view.pluginId.length > 0) return view.pluginId

  const pluginId = `view.${viewTypeForElement(view)}.${crypto.randomUUID()}`
  view.pluginId = pluginId
  runtime.register({
    id: pluginId,
    methods: {
      ping: async () => encodeResult({ ok: true, id: pluginId }),
      save: async (input) => callViewMethod(view, ['save'], input),
      run: async (input) => callViewMethod(view, ['run', 'runGraph'], input),
      reload: async (input) => callViewMethod(view, ['reload', 'reloadGraph'], input),
      clearSelection: async (input) => callViewMethod(view, ['clearSelection'], input),
      ...methods,
    },
  })
  void runtime.call('ui.context', 'activateView', { id: pluginId })
  return pluginId
}

export async function unregisterViewPlugin(view) {
  if (!(view instanceof HTMLElement)) throw new Error('unregisterViewPlugin requires an HTMLElement')
  const pluginId = view.pluginId
  if (typeof pluginId !== 'string' || pluginId.length === 0) return
  view.pluginId = ''
  await runtime.unregister(pluginId)
}

export function viewOk(value = { ok: true }) {
  return encodeResult(value)
}
