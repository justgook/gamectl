import { bus } from './event-bus.js'
import { parseCSVLines } from '../util/csv.js'

// Configuration
const SEQUENCE_TIMEOUT = 1000 // milliseconds to wait for next key in sequence
const DEBUG = true // Enable debug logging for development

/**
 * KeybindingManager
 * 
 * Manages keyboard shortcuts using Vim-style key notation.
 * Loads keybindings from SQL database and emits events via event bus.
 * 
 * Features:
 * - Vim-style key notation (<C-s>, <M-j>, gg, etc.)
 * - Mode-based contexts (global, nodegraph, tilemap, etc.)
 * - Multi-key sequences support
 * - Event bus integration for mode switching and event emission
 */
class KeybindingManager {
  constructor() {
    this.currentMode = 'global'
    this.keySequence = []
    this.sequenceTimeout = null
    this.bindings = new Map() // mode -> Map(keys -> binding)
    this.enabled = true

    // Bind methods for event listeners
    this.handleKeyDown = this.handleKeyDown.bind(this)
    this.handleViewFocus = this.handleViewFocus.bind(this)
  }

  /**
   * Initialize the keybinding manager
   * Loads bindings from SQL and sets up event listeners
   */
  async init() {
    await this.loadBindings()

    // Listen to global keyboard events
    document.addEventListener('keydown', this.handleKeyDown)

    // Listen to view focus changes
    bus.on('view:focus', this.handleViewFocus)

    if (DEBUG) {
      console.log('[KeybindingManager] Initialized with modes:', Array.from(this.bindings.keys()))
    }
  }

  /**
   * Load keybindings from SQL database
   */
  async loadBindings() {
    try {
      const result = await window.pluginManager.call(
        'sql',
        'query',
        'SELECT id, mode, keys, event_name, event_data, description FROM keybindings WHERE enabled=1'
      )

      const decoder = new TextDecoder()
      const csv = decoder.decode(result.output)

      // Parse CSV (SQL plugin returns CSV format)
      const lines = parseCSVLines(csv.trim())

      if (lines.length < 2) {
        if (DEBUG) {
          console.log('[KeybindingManager] No keybindings found')
        }
        return
      }

      // First line is headers: id,mode,keys,event_name,event_data,description
      const headers = lines[0]

      // Clear existing bindings
      this.bindings.clear()

      // Parse data rows
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i]
        if (row.length < 4) continue // Need at least id, mode, keys, event_name

        // Parse event_data if it exists and is not NULL
        let eventData = null
        if (row[4] && row[4] !== 'NULL' && row[4].trim() !== '') {
          try {
            eventData = JSON.parse(row[4])
          } catch (e) {
            console.warn(`[KeybindingManager] Failed to parse event_data for binding ${row[0]}:`, e)
          }
        }

        const binding = {
          id: row[0],
          mode: row[1],
          keys: row[2],
          eventName: row[3],
          eventData: eventData,
          description: row[5] || ''
        }

        if (!this.bindings.has(binding.mode)) {
          this.bindings.set(binding.mode, new Map())
        }

        this.bindings.get(binding.mode).set(binding.keys, binding)
      }

      if (DEBUG) {
        console.log('[KeybindingManager] Loaded bindings:', this.bindings)
      }
    } catch (error) {
      console.error('[KeybindingManager] Failed to load bindings:', error)
    }
  }

  /**
   * Reload bindings from database (useful for runtime updates)
   */
  async reloadBindings() {
    if (DEBUG) {
      console.log('[KeybindingManager] Reloading bindings...')
    }
    await this.loadBindings()
  }

  /**
   * Handle view focus changes from event bus
   */
  handleViewFocus(data) {
    if (data && data.mode) {
      this.setMode(data.mode)
    }
  }

  /**
   * Set current mode (context)
   */
  setMode(mode) {
    if (this.currentMode !== mode) {
      this.currentMode = mode
      // Clear any pending sequences when switching modes
      this.clearSequence()

      if (DEBUG) {
        console.log(`[KeybindingManager] Mode changed to: ${mode}`)
      }
    }
  }

  /**
   * Get current mode
   */
  getMode() {
    return this.currentMode
  }

  /**
   * Handle keyboard events
   */
  handleKeyDown(event) {
    if (!this.enabled) return
    const el = event.target;

    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement ||
      el.isContentEditable
    ) {
      return;
    }

    // TODO: Skip if typing in input field (for future enhancement)
    // For now, let all key events through

    // Normalize the key event to Vim notation
    const key = this.normalizeKey(event)
    if (!key) return

    if (DEBUG) {
      console.log(`[KeybindingManager] Key pressed: ${key} (mode: ${this.currentMode})`)
    }

    // Add to sequence
    this.keySequence.push(key)

    // Clear existing timeout
    if (this.sequenceTimeout) {
      clearTimeout(this.sequenceTimeout)
    }

    // Build current sequence string
    const sequenceStr = this.keySequence.join('')

    // Try to match binding in current mode
    let matched = this.matchBinding(this.currentMode, sequenceStr)

    // If no match in current mode, try global
    if (!matched && this.currentMode !== 'global') {
      matched = this.matchBinding('global', sequenceStr)
    }

    if (matched) {
      // Found exact match - execute it
      event.preventDefault()
      this.executeBinding(matched)
      this.clearSequence()
    } else {
      // Check if this could be the start of a sequence
      const isPotentialSequence = this.isPotentialSequence(sequenceStr)

      if (isPotentialSequence) {
        // Wait for next key
        event.preventDefault()
        this.sequenceTimeout = setTimeout(() => {
          if (DEBUG) {
            console.log(`[KeybindingManager] Sequence timeout: ${sequenceStr}`)
          }
          this.clearSequence()
        }, SEQUENCE_TIMEOUT)
      } else {
        // Not a valid sequence, clear it
        this.clearSequence()
      }
    }
  }

  /**
   * Normalize keyboard event to Vim-style key notation
   */
  normalizeKey(event) {
    let key = ''

    // Handle modifiers (order: Ctrl, Alt, Shift, Meta)
    const hasCmd = event.metaKey
    const hasAlt = event.altKey
    const hasShift = event.shiftKey
    const hasCtrl = event.ctrlKey

    // For special keys
    const specialKeys = {
      'Enter': '<CR>',
      'Escape': '<Esc>',
      ' ': '<Space>',
      'Tab': '<Tab>',
      'Backspace': '<BS>',
      'Delete': '<Del>',
      'ArrowUp': '<Up>',
      'ArrowDown': '<Down>',
      'ArrowLeft': '<Left>',
      'ArrowRight': '<Right>',
    }

    // Add F-keys
    for (let i = 1; i <= 12; i++) {
      specialKeys[`F${i}`] = `<F${i}>`
    }

    // Check if it's a special key
    if (specialKeys[event.key]) {
      const baseKey = specialKeys[event.key]

      // Build modifier prefix
      if (hasCmd || hasAlt || hasShift || hasCtrl) {
        key = '<'
        if (hasCmd) key += 'C-'
        if (hasAlt) key += 'M-'
        if (hasShift) key += 'S-'
        if (hasCtrl) key += 'D-'
        // Remove the angle brackets from special key and add to modifiers
        key += baseKey.slice(1)
      } else {
        key = baseKey
      }
    } else if (hasCmd || hasAlt || hasCtrl) {
      // It's a regular key with modifiers
      let baseKey = event.key

      // Normalize letter keys to lowercase
      if (baseKey.length === 1 && baseKey >= 'A' && baseKey <= 'Z') {
        baseKey = baseKey.toLowerCase()
      }

      key = '<'
      if (hasCmd) key += 'C-'
      if (hasAlt) key += 'M-'
      if (hasShift) key += 'S-'
      if (hasCtrl) key += 'D-'
      key += baseKey + '>'
    } else {
      // Plain key (for sequences like 'gg', 'G')
      key = event.key

      // Ignore modifier keys by themselves
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
        return null
      }
    }

    return key
  }

  /**
   * Match binding for given mode and key sequence
   */
  matchBinding(mode, keys) {
    const modeBindings = this.bindings.get(mode)
    if (!modeBindings) return null

    return modeBindings.get(keys) || null
  }

  /**
   * Check if current sequence could potentially match a binding
   */
  isPotentialSequence(sequenceStr) {
    // Check current mode
    const modeBindings = this.bindings.get(this.currentMode)
    if (modeBindings) {
      for (const [keys] of modeBindings) {
        if (keys.startsWith(sequenceStr) && keys !== sequenceStr) {
          return true
        }
      }
    }

    // Check global mode if not already in it
    if (this.currentMode !== 'global') {
      const globalBindings = this.bindings.get('global')
      if (globalBindings) {
        for (const [keys] of globalBindings) {
          if (keys.startsWith(sequenceStr) && keys !== sequenceStr) {
            return true
          }
        }
      }
    }

    return false
  }

  /**
   * Execute a binding by emitting its event
   */
  executeBinding(binding) {
    if (DEBUG) {
      console.log(`[KeybindingManager] Executing: ${binding.keys} -> ${binding.eventName}`, binding.eventData)
    }

    // Emit event via event bus
    bus.emit(binding.eventName, binding.eventData)
  }

  /**
   * Clear key sequence
   */
  clearSequence() {
    this.keySequence = []
    if (this.sequenceTimeout) {
      clearTimeout(this.sequenceTimeout)
      this.sequenceTimeout = null
    }
  }

  /**
   * Enable keybinding manager
   */
  enable() {
    this.enabled = true
  }

  /**
   * Disable keybinding manager
   */
  disable() {
    this.enabled = false
    this.clearSequence()
  }

  /**
   * Get all bindings for a specific mode
   */
  getBindingsForMode(mode) {
    return this.bindings.get(mode) || new Map()
  }

  /**
   * Get all bindings
   */
  getAllBindings() {
    return this.bindings
  }

  /**
   * Cleanup
   */
  destroy() {
    document.removeEventListener('keydown', this.handleKeyDown)
    bus.off('view:focus', this.handleViewFocus)
    this.clearSequence()
  }
}

// Create and export singleton instance
export const keybindingManager = new KeybindingManager()
