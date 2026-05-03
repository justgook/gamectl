const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

function encodeResult(value) {
  return {
    returnCode: 0,
    output: textEncoder.encode(JSON.stringify(value ?? null)),
  }
}

function decodeOutput(result) {
  return textDecoder.decode(result?.output || new Uint8Array())
}

function normalizeKeyEvent(event) {
  const parts = []
  if (event.ctrlKey || event.metaKey) parts.push('mod')
  if (event.shiftKey) parts.push('shift')
  if (event.altKey) parts.push('alt')

  const key = normalizeKeyName(event.key)
  if (key === 'control' || key === 'meta' || key === 'shift' || key === 'alt') return ''
  parts.push(key)
  return parts.join('+')
}

function normalizeConfiguredKey(key) {
  const parts = String(key).trim().toLowerCase().split('+').map((part) => part.trim()).filter(Boolean)
  const modifiers = []
  if (parts.includes('mod') || parts.includes('cmdorctrl')) modifiers.push('mod')
  if (parts.includes('ctrl') || parts.includes('control')) modifiers.push('ctrl')
  if (parts.includes('cmd') || parts.includes('meta')) modifiers.push('meta')
  if (parts.includes('shift')) modifiers.push('shift')
  if (parts.includes('alt') || parts.includes('option')) modifiers.push('alt')
  const keyPart = [...parts].reverse().find((part) => !['mod', 'cmdorctrl', 'ctrl', 'control', 'cmd', 'meta', 'shift', 'alt', 'option'].includes(part))
  if (!keyPart) throw new Error(`ui.keys key '${key}' is missing a non-modifier key`)
  if (modifiers.includes('ctrl') || modifiers.includes('meta')) {
    throw new Error(`ui.keys key '${key}' must use 'mod' instead of ctrl/cmd for browser shortcuts`)
  }
  return [...modifiers, normalizeKeyName(keyPart)].join('+')
}

function normalizeKeyName(key) {
  const text = String(key).toLowerCase()
  if (text === ' ') return 'space'
  if (text === 'esc') return 'escape'
  if (text === 'arrowup') return 'up'
  if (text === 'arrowdown') return 'down'
  if (text === 'arrowleft') return 'left'
  if (text === 'arrowright') return 'right'
  return text
}

function isTextInputEvent(event) {
  for (const item of event.composedPath()) {
    if (!(item instanceof HTMLElement)) continue
    if (item instanceof HTMLInputElement) return true
    if (item instanceof HTMLTextAreaElement) return true
    if (item.isContentEditable) return true
  }
  return false
}

function assertOk(result, label) {
  if (Number(result?.returnCode || 0) !== 0) {
    throw new Error(`${label} failed: ${decodeOutput(result)}`)
  }
}

function luaStringLiteral(value) {
  return JSON.stringify(String(value))
}

function resolveContextPath(ctx, path) {
  const parts = String(path).split('.')
  let value = ctx
  for (const part of parts) {
    if (!part) throw new Error(`ui.keys invalid context path '${path}'`)
    value = value[part]
    if (value == null) throw new Error(`ui.keys context path '${path}' resolved to ${value}`)
  }
  return value
}

function parseBindings(config) {
  const keys = config?.ui?.keys || []
  if (!Array.isArray(keys)) throw new Error('gams config ui.keys must be an array')
  return keys.map((binding, index) => {
    if (!binding || typeof binding !== 'object' || Array.isArray(binding)) throw new Error(`ui.keys[${index}] must be an object`)
    if (typeof binding.key !== 'string' || binding.key.trim().length === 0) throw new Error(`ui.keys[${index}].key is required`)
    if (binding.call == null && binding.script == null) throw new Error(`ui.keys[${index}] requires call or script`)
    if (binding.call != null && binding.script != null) throw new Error(`ui.keys[${index}] cannot define both call and script`)
    if (binding.call != null) {
      if (!Array.isArray(binding.call) || binding.call.length !== 3) throw new Error(`ui.keys[${index}].call must be [plugin, method, input]`)
      if (typeof binding.call[0] !== 'string' || typeof binding.call[1] !== 'string') throw new Error(`ui.keys[${index}].call plugin and method must be strings`)
    }
    if (binding.script != null && typeof binding.script !== 'string') throw new Error(`ui.keys[${index}].script must be a string`)
    return {
      ...binding,
      normalizedKey: normalizeConfiguredKey(binding.key),
      allowInput: binding.allowInput === true,
    }
  })
}

export function createUiKeys(runtime, config) {
  const bindings = parseBindings(config)
  const byKey = new Map()
  for (const binding of bindings) {
    if (!byKey.has(binding.normalizedKey)) byKey.set(binding.normalizedKey, [])
    byKey.get(binding.normalizedKey).push(binding)
  }

  async function snapshotContext() {
    const result = await runtime.call('ui.context', 'snapshot', '{}')
    assertOk(result, 'ui.context.snapshot')
    return JSON.parse(decodeOutput(result))
  }

  async function runBinding(binding) {
    const ctx = await snapshotContext()
    if (binding.call) {
      const pluginId = resolveContextPath(ctx, binding.call[0])
      const result = await runtime.call(String(pluginId), binding.call[1], binding.call[2])
      assertOk(result, `shortcut call ${pluginId}.${binding.call[1]}`)
      return
    }

    const readResult = await runtime.call('fs', 'read', binding.script)
    assertOk(readResult, `read shortcut script '${binding.script}'`)
    const source = `_G.ctx = json.decode(${luaStringLiteral(JSON.stringify(ctx))})\n${decodeOutput(readResult)}`
    const runResult = await runtime.call('lua', 'run', source)
    assertOk(runResult, `run shortcut script '${binding.script}'`)
  }

  const onKeyDown = (event) => {
    const normalizedKey = normalizeKeyEvent(event)
    const matches = byKey.get(normalizedKey)
    if (!matches || matches.length === 0) return
    const inTextInput = isTextInputEvent(event)
    const binding = matches.find((entry) => entry.allowInput || !inTextInput)
    if (!binding) return
    event.preventDefault()
    event.stopPropagation()
    void runBinding(binding)
  }

  window.addEventListener('keydown', onKeyDown, { capture: true })

  return {
    id: 'ui.keys',
    dispose() {
      window.removeEventListener('keydown', onKeyDown, { capture: true })
    },
    methods: {
      ping: async () => encodeResult({ ok: true, bindings: bindings.length }),
    },
  }
}
