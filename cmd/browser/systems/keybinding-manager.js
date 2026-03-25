import { parseCSVLines } from '../util/csv.js'
import { LayoutManager } from '../views/view-layout.js'

const SEQUENCE_TIMEOUT = 1000
const DEBUG = false
const decoder = new TextDecoder()

const BUILTIN_SOURCES = new Map([
  ['layout', {
    name: 'layout',
    url: 'internal:layout',
    enabled: true,
    displayName: 'Layout',
    tag: 'layout-manager'
  }]
])

class KeybindingManager {
  constructor() {
    this.enabled = true
    this.keySequence = []
    this.sequenceTimeout = null
    this.sequenceSource = null
    this.catalog = []
    this.bindingsById = new Map()
    this.bindingsBySource = new Map()
    this.sources = new Map(BUILTIN_SOURCES)
    this.activePresses = new Map()

    this.handleKeyDown = this.handleKeyDown.bind(this)
    this.handleKeyUp = this.handleKeyUp.bind(this)
    this.handleWindowBlur = this.handleWindowBlur.bind(this)
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this)
    this.handleFocusIn = this.handleFocusIn.bind(this)
  }

  async init() {
    await this.loadBindings()
    document.addEventListener('keydown', this.handleKeyDown)
    document.addEventListener('keyup', this.handleKeyUp)
    document.addEventListener('focusin', this.handleFocusIn)
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
    window.addEventListener('blur', this.handleWindowBlur)

    if (DEBUG) {
      console.log('[KeybindingManager] Initialized with sources:', Array.from(this.bindingsBySource.keys()))
    }
  }

  async reloadBindings() {
    this.releaseActiveBindings()
    this.clearSequence()
    await this.loadBindings()
  }

  async loadBindings() {
    try {
      const viewSources = await this.loadViewSources()
      const defaultBindings = await this.loadDefaultBindings(viewSources)
      const overrides = await this.loadOverrides()
      this.buildEffectiveBindings(defaultBindings, overrides, viewSources)
    } catch (error) {
      console.error('[KeybindingManager] Failed to load bindings:', error)
      this.catalog = []
      this.bindingsById.clear()
      this.bindingsBySource.clear()
    }
  }

  async loadViewSources() {
    const sources = new Map(BUILTIN_SOURCES)

    try {
      const result = await window.pluginManager.call(
        'sql',
        'query',
        'SELECT name, url, enabled FROM views ORDER BY rowid'
      )

      const lines = parseCSVLines(decoder.decode(result.output).trim())
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i]
        if (row.length < 3) continue

        const name = row[0]
        const url = row[1]
        const enabled = row[2] === '1'
        const tag = `view-${name}`

        sources.set(name, {
          name,
          url,
          enabled,
          tag,
          displayName: name
        })
      }
    } catch (error) {
      console.error('[KeybindingManager] Failed to read views registry:', error)
    }

    this.sources = sources
    return sources
  }

  async loadDefaultBindings(sources) {
    const bindings = []

    for (const source of sources.values()) {
      try {
        const entryBindings = await this.loadBindingsFromSource(source)
        bindings.push(...entryBindings)
      } catch (error) {
        console.error(`[KeybindingManager] Failed loading source '${source.name}':`, error)
      }
    }

    return bindings
  }

  async loadBindingsFromSource(source) {
    let ViewClass = null

    if (source.name === 'layout') {
      ViewClass = LayoutManager
    } else {
      const mod = await this.importModule(source.url)
      ViewClass = mod?.default || null
    }

    if (!ViewClass) return []

    const viewMeta = ViewClass.viewMeta || {}
    if (viewMeta.displayName) {
      source.displayName = viewMeta.displayName
    }

    const defs = this.collectKeybindingDefinitions(ViewClass)
    return defs
      .filter(def => def && def.eventName)
      .map((def, index) => {
        const localId = String(def.id || def.eventName || `binding-${index}`)
        return {
          bindingId: `${source.name}.${localId}`,
          localId,
          source: source.name,
          sourceTag: source.tag,
          sourceDisplayName: source.displayName,
          sourceEnabled: source.enabled,
          eventName: def.eventName,
          description: def.description || '',
          eventType: this.normalizeEventType(def.eventType),
          defaultKeys: def.defaultKeys || '',
          keys: def.defaultKeys || '',
          enabled: true
        }
      })
  }

  normalizeEventType(eventType) {
    if (eventType === 'keyup' || eventType === 'both') {
      return eventType
    }
    return 'keydown'
  }

  collectKeybindingDefinitions(ViewClass) {
    const inheritanceChain = []
    let current = ViewClass
    while (current && current !== Function.prototype) {
      inheritanceChain.unshift(current)
      current = Object.getPrototypeOf(current)
    }

    const merged = new Map()
    const anonymous = []

    for (const clazz of inheritanceChain) {
      if (!Object.prototype.hasOwnProperty.call(clazz, 'keybindings')) {
        continue
      }

      const defs = clazz.keybindings
      if (!Array.isArray(defs)) {
        continue
      }

      for (const def of defs) {
        if (!def || typeof def !== 'object') continue
        if (def.id) {
          merged.set(def.id, def)
        } else {
          anonymous.push(def)
        }
      }
    }

    return [...merged.values(), ...anonymous]
  }

  async importModule(url) {
    if (!url) throw new Error('Missing module URL')

    if (url.startsWith('local:')) {
      const path = url.slice(6)
      return import(path)
    }

    if (url.startsWith('http://') || url.startsWith('https://')) {
      return import(url)
    }

    const result = await window.pluginManager.call('fs', 'read', url)
    if (result.returnCode !== 0) {
      const errMsg = decoder.decode(result.output)
      throw new Error(`FS read failed: ${errMsg}`)
    }

    const blob = new Blob([result.output], { type: 'application/javascript' })
    const blobUrl = URL.createObjectURL(blob)
    try {
      return await import(blobUrl)
    } finally {
      URL.revokeObjectURL(blobUrl)
    }
  }

  async loadOverrides() {
    const overrides = new Map()

    try {
      const result = await window.pluginManager.call(
        'sql',
        'query',
        'SELECT binding_id, keys, enabled FROM keybinding_overrides'
      )

      const lines = parseCSVLines(decoder.decode(result.output).trim())
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i]
        if (row.length < 3) continue

        const rawKeys = row[1]
        const rawEnabled = row[2]
        overrides.set(row[0], {
          keys: rawKeys === 'NULL' ? undefined : rawKeys,
          enabled: rawEnabled === '1' ? true : (rawEnabled === '0' ? false : undefined)
        })
      }
    } catch (error) {
      console.warn('[KeybindingManager] Could not load keybinding overrides:', error)
    }

    return overrides
  }

  buildEffectiveBindings(defaultBindings, overrides, sources) {
    this.catalog = []
    this.bindingsById.clear()
    this.bindingsBySource.clear()

    for (const base of defaultBindings) {
      const source = sources.get(base.source)
      const override = overrides.get(base.bindingId)
      const effective = {
        ...base,
        sourceEnabled: source ? source.enabled : true,
        keys: override && override.keys !== undefined ? override.keys : base.defaultKeys,
        enabled: override && override.enabled !== undefined ? override.enabled : true
      }

      this.catalog.push(effective)
      this.bindingsById.set(effective.bindingId, effective)

      if (!effective.sourceEnabled || !effective.enabled || !effective.keys) {
        continue
      }

      if (!this.bindingsBySource.has(effective.source)) {
        this.bindingsBySource.set(effective.source, new Map())
      }

      const sourceBindings = this.bindingsBySource.get(effective.source)
      if (!sourceBindings.has(effective.eventType)) {
        sourceBindings.set(effective.eventType, new Map())
      }

      sourceBindings.get(effective.eventType).set(effective.keys, effective)
    }

    this.catalog.sort((a, b) => {
      if (a.source === b.source) {
        return a.eventName.localeCompare(b.eventName)
      }
      return a.source.localeCompare(b.source)
    })
  }

  getKeybindingCatalog() {
    return this.catalog.map(binding => ({ ...binding }))
  }

  getSourceStates() {
    return Array.from(this.sources.values()).map(source => ({
      name: source.name,
      tag: source.tag,
      enabled: source.enabled,
      displayName: source.displayName || source.name
    }))
  }

  async saveOverrides(changes) {
    const entries = Array.isArray(changes)
      ? changes
      : Array.from(changes || []).map(([bindingId, value]) => ({ bindingId, ...value }))

    for (const entry of entries) {
      if (!entry?.bindingId) continue

      const bindingId = entry.bindingId.replace(/'/g, "''")
      const keys = entry.keys !== undefined
        ? `'${String(entry.keys).replace(/'/g, "''")}'`
        : 'NULL'
      const enabled = entry.enabled === undefined
        ? 'NULL'
        : (entry.enabled ? '1' : '0')

      await window.pluginManager.call(
        'sql',
        'exec',
        `INSERT INTO keybinding_overrides (binding_id, keys, enabled)
         VALUES ('${bindingId}', ${keys}, ${enabled})
         ON CONFLICT(binding_id) DO UPDATE SET
           keys = COALESCE(excluded.keys, keybinding_overrides.keys),
           enabled = COALESCE(excluded.enabled, keybinding_overrides.enabled)`
      )
    }

    await this.reloadBindings()
  }

  handleKeyDown(event) {
    if (!this.enabled) return
    if (this.isEditableEventTarget(event)) {
      return
    }

    const key = this.normalizeKey(event)
    if (!key) return

    const pressKey = this.getPressKey(event)
    if (this.activePresses.has(pressKey)) {
      event.preventDefault()
      return
    }

    const focused = this.resolveFocusedSource(event)
    const primarySource = focused?.source || 'layout'

    if (this.sequenceSource && this.sequenceSource !== primarySource) {
      this.clearSequence()
    }

    this.sequenceSource = primarySource
    this.keySequence.push(key)

    if (this.sequenceTimeout) {
      clearTimeout(this.sequenceTimeout)
      this.sequenceTimeout = null
    }

    const sequenceStr = this.keySequence.join('')
    const fallbackSource = primarySource === 'layout' ? null : 'layout'
    const popupOpen = this.hasOpenPopup()

    let matched = this.matchBinding(primarySource, sequenceStr, 'keydown')
    let executionTarget = focused?.element || this.getSourceElement(primarySource)

    if (!matched && fallbackSource) {
      matched = this.matchBinding(fallbackSource, sequenceStr, 'keydown')
      if (matched) {
        executionTarget = this.getSourceElement(fallbackSource)
      }
    }

    if (matched) {
      if (popupOpen && !this.isBindingAllowedWhilePopupOpen(matched)) {
        this.clearSequence()
        return
      }

      const handled = this.executeBinding(matched, executionTarget, event)
      if (handled) {
        event.preventDefault()
      }
      this.clearSequence()
      return
    }

    const isPotential = this.isPotentialSequence(sequenceStr, primarySource, fallbackSource)
    if (isPotential) {
      event.preventDefault()
      this.sequenceTimeout = setTimeout(() => {
        this.clearSequence()
      }, SEQUENCE_TIMEOUT)
      return
    }

    if (popupOpen) {
      this.clearSequence()
      return
    }

    this.clearSequence()
  }

  handleKeyUp(event) {
    if (!this.enabled) return

    const key = this.normalizeKey(event)
    if (!key) return

    const pressKey = this.getPressKey(event)
    const activePress = this.activePresses.get(pressKey)
    if (activePress) {
      this.activePresses.delete(pressKey)
      const handled = this.executeBinding(activePress.binding, activePress.target, event, 'up')
      if (handled) {
        event.preventDefault()
      }
      return
    }

    if (this.isEditableEventTarget(event)) {
      return
    }

    const focused = this.resolveFocusedSource(event)
    const primarySource = focused?.source || 'layout'
    const fallbackSource = primarySource === 'layout' ? null : 'layout'
    const popupOpen = this.hasOpenPopup()

    let matched = this.matchBinding(primarySource, key, 'keyup')
    let executionTarget = focused?.element || this.getSourceElement(primarySource)

    if (!matched && fallbackSource) {
      matched = this.matchBinding(fallbackSource, key, 'keyup')
      if (matched) {
        executionTarget = this.getSourceElement(fallbackSource)
      }
    }

    if (matched) {
      if (popupOpen && !this.isBindingAllowedWhilePopupOpen(matched)) {
        return
      }

      const handled = this.executeBinding(matched, executionTarget, event, 'up')
      if (handled) {
        event.preventDefault()
      }
    }
  }

  handleWindowBlur() {
    this.releaseActiveBindings()
    this.clearSequence()
  }

  handleVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      this.releaseActiveBindings()
      this.clearSequence()
    }
  }

  handleFocusIn(event) {
    if (!this.isEditableEventTarget(event)) {
      return
    }

    this.releaseActiveBindings()
    this.clearSequence()
  }

  resolveFocusedSource(event) {
    if (this.hasOpenPopup()) {
      return {
        source: 'layout',
        element: this.getSourceElement('layout')
      }
    }

    const path = typeof event.composedPath === 'function' ? event.composedPath() : []

    for (const node of path) {
      const element = this.findViewElement(node)
      if (!element) continue
      const source = this.getSourceFromElement(element)
      if (source) {
        return { source, element }
      }
    }

    const active = this.getDeepActiveElement(document)
    const fallbackElement = this.findViewElement(active)
    if (fallbackElement) {
      const source = this.getSourceFromElement(fallbackElement)
      if (source) {
        return { source, element: fallbackElement }
      }
    }

    return null
  }

  getDeepActiveElement(root) {
    let current = root?.activeElement || null
    while (current?.shadowRoot?.activeElement) {
      current = current.shadowRoot.activeElement
    }
    return current
  }

  findViewElement(node) {
    let current = node instanceof Node ? node : null
    while (current) {
      if (current instanceof HTMLElement) {
        const tag = current.tagName.toLowerCase()
        if (tag === 'layout-manager') return current
        if (this.isViewTag(tag)) return current
      }
      current = current.parentNode || current.host || null
    }
    return null
  }

  isViewTag(tag) {
    return tag.startsWith('view-') &&
      tag !== 'view-area' &&
      tag !== 'view-popup' &&
      tag !== 'view--corner' &&
      tag !== 'view--handle'
  }

  getSourceFromElement(element) {
    const tag = element.tagName.toLowerCase()
    if (tag === 'layout-manager') return 'layout'
    if (this.isViewTag(tag)) return tag.slice(5)
    return null
  }

  getSourceElement(source) {
    if (source === 'layout') {
      return document.querySelector('layout-manager')
    }

    const active = this.getDeepActiveElement(document)
    const focused = this.findViewElement(active)
    if (focused && this.getSourceFromElement(focused) === source) {
      return focused
    }

    const tag = `view-${source}`
    return document.querySelector(tag)
  }

  matchBinding(source, keys, eventType = 'keydown') {
    const sourceBindings = this.bindingsBySource.get(source)
    if (!sourceBindings) return null

    const exactBindings = sourceBindings.get(eventType)
    if (exactBindings?.has(keys)) {
      return exactBindings.get(keys) || null
    }

    if (eventType === 'keydown') {
      const holdBindings = sourceBindings.get('both')
      if (holdBindings?.has(keys)) {
        return holdBindings.get(keys) || null
      }
    }

    return null
  }

  isPotentialSequence(sequenceStr, primarySource, fallbackSource) {
    const candidates = [primarySource]
    if (fallbackSource) candidates.push(fallbackSource)

    for (const source of candidates) {
      const sourceBindings = this.bindingsBySource.get(source)
      if (!sourceBindings) continue
      for (const eventType of ['keydown', 'both']) {
        const bindings = sourceBindings.get(eventType)
        if (!bindings) continue
        for (const [keys] of bindings) {
          if (keys.startsWith(sequenceStr) && keys !== sequenceStr) {
            return true
          }
        }
      }
    }

    return false
  }

  executeBinding(binding, target, domEvent, phase = 'down') {
    if (phase === 'up' && binding.eventType === 'keydown') {
      return false
    }

    if (!target || typeof target.handleKeybinding !== 'function') {
      if (DEBUG) {
        console.warn(`[KeybindingManager] No keybinding handler for ${binding.source}.${binding.eventName}`)
      }
      return false
    }

    if (DEBUG) {
      console.log(`[KeybindingManager] Executing ${binding.keys} -> ${binding.source}.${binding.eventName}`)
    }

    try {
      const handled = target.handleKeybinding(binding.eventName, {
        binding,
        phase,
        domEvent
      }) !== false

      if (handled && phase === 'down' && binding.eventType === 'both' && domEvent) {
        this.activePresses.set(this.getPressKey(domEvent), { binding, target })
      }

      return handled
    } catch (error) {
      console.error(`[KeybindingManager] Handler failed for ${binding.bindingId}:`, error)
      return false
    }
  }

  normalizeKey(event) {
    let key = ''
    const hasCmd = event.metaKey
    const hasAlt = event.altKey
    const hasShift = event.shiftKey
    const hasCtrl = event.ctrlKey

    const specialKeys = {
      Enter: '<CR>',
      Escape: '<Esc>',
      ' ': '<Space>',
      Tab: '<Tab>',
      Backspace: '<BS>',
      Delete: '<Del>',
      ArrowUp: '<Up>',
      ArrowDown: '<Down>',
      ArrowLeft: '<Left>',
      ArrowRight: '<Right>'
    }

    for (let i = 1; i <= 12; i++) {
      specialKeys[`F${i}`] = `<F${i}>`
    }

    if (specialKeys[event.key]) {
      const baseKey = specialKeys[event.key]
      if (hasCmd || hasAlt || hasShift || hasCtrl) {
        key = '<'
        if (hasCmd) key += 'C-'
        if (hasAlt) key += 'M-'
        if (hasShift) key += 'S-'
        if (hasCtrl) key += 'D-'
        key += baseKey.slice(1)
      } else {
        key = baseKey
      }
    } else if (hasCmd || hasAlt || hasCtrl) {
      let baseKey = event.key
      if (baseKey.length === 1 && baseKey >= 'A' && baseKey <= 'Z') {
        baseKey = baseKey.toLowerCase()
      }

      key = '<'
      if (hasCmd) key += 'C-'
      if (hasAlt) key += 'M-'
      if (hasShift) key += 'S-'
      if (hasCtrl) key += 'D-'
      key += `${baseKey}>`
    } else {
      key = event.key
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
        return null
      }
    }

    return key
  }

  getPressKey(event) {
    if (!event) return null
    return event.code || this.normalizeKey(event)
  }

  isEditableEventTarget(event) {
    const path = typeof event?.composedPath === 'function' ? event.composedPath() : []

    for (const node of path) {
      if (this.isEditableElement(node)) {
        return true
      }
    }

    return this.isEditableElement(this.getDeepActiveElement(document))
  }

  isEditableElement(node) {
    if (!(node instanceof HTMLElement)) {
      return false
    }

    if (
      node instanceof HTMLInputElement ||
      node instanceof HTMLTextAreaElement ||
      node instanceof HTMLSelectElement ||
      node.isContentEditable
    ) {
      return true
    }

    return Boolean(node.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'))
  }

  releaseActiveBindings() {
    for (const [pressKey, activePress] of this.activePresses.entries()) {
      this.activePresses.delete(pressKey)
      this.executeBinding(activePress.binding, activePress.target, null, 'up')
    }
  }

  hasOpenPopup() {
    const popupManager = document.querySelector('popup-manager')
    if (!popupManager) return false
    return popupManager.querySelector('view-popup') !== null
  }

  isBindingAllowedWhilePopupOpen(binding) {
    return binding?.eventName === 'popup:close'
  }

  clearSequence() {
    this.keySequence = []
    this.sequenceSource = null
    if (this.sequenceTimeout) {
      clearTimeout(this.sequenceTimeout)
      this.sequenceTimeout = null
    }
  }

  enable() {
    this.enabled = true
  }

  disable() {
    this.enabled = false
    this.releaseActiveBindings()
    this.clearSequence()
  }

  destroy() {
    document.removeEventListener('keydown', this.handleKeyDown)
    document.removeEventListener('keyup', this.handleKeyUp)
    document.removeEventListener('focusin', this.handleFocusIn)
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    window.removeEventListener('blur', this.handleWindowBlur)
    this.releaseActiveBindings()
    this.clearSequence()
  }
}

export const keybindingManager = new KeybindingManager()
