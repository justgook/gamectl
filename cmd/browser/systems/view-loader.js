/**
 * ViewLoader - Dynamic view loading and registration system
 *
 * Loads view JS modules from various sources and registers them as custom elements.
 * Uses the optimal import strategy based on URL scheme:
 *   - local:  -> native import() (fast, browser-cached)
 *   - http(s) -> native import() (ESM over network)
 *   - filesystem paths -> FS read + Blob URL + import() (for OPFS/WebDAV stored views)
 *
 * Each view class should provide a static viewMeta getter:
 *   static get viewMeta() {
 *     return { displayName: 'Node Graph', category: 'Canvas' }
 *   }
 *
 * If not provided, defaults to { displayName: name, category: 'Other' }.
 *
 * Usage:
 *   const loader = new ViewLoader()
 *   await loader.loadView('nodegraph', 'local:/views/view-nodegraph.js')
 *   // -> registers <view-nodegraph>, adds to registry
 *
 *   const groups = loader.getGroupedViews()
 *   // -> Map { 'Canvas' => [{name, tag, displayName, category}], ... }
 */

import { bus } from './event-bus.js'

class ViewLoader {
  constructor() {
    /** @type {Map<string, {tag: string, displayName: string, category: string}>} */
    this.registry = new Map()
  }

  /**
   * Load a single view module and register its custom element
   *
   * @param {string} name - View name (e.g. 'nodegraph' -> registers as 'view-nodegraph')
   * @param {string} url - Module source URL (local:, http:, or filesystem path)
   * @returns {Promise<{name: string, tag: string, displayName: string, category: string}>}
   */
  async loadView(name, url) {
    const tag = `view-${name}`

    try {
      const mod = await this.importModule(url)
      const ViewClass = mod.default

      if (!ViewClass) {
        throw new Error(`Module has no default export: ${url}`)
      }

      // Register the custom element if not already registered
      if (!customElements.get(tag)) {
        customElements.define(tag, ViewClass)
      }

      // Extract metadata from the class
      const meta = ViewClass.viewMeta || {}
      const entry = {
        tag,
        displayName: meta.displayName || name,
        category: meta.category || 'Other'
      }

      this.registry.set(name, entry)
      return entry
    } catch (error) {
      console.error(`[ViewLoader] Failed to load view '${name}' from ${url}:`, error)
      throw error
    }
  }

  /**
   * Load multiple views from a list of {name, url} entries
   *
   * @param {Array<{name: string, url: string}>} views
   * @param {function} [onProgress] - Optional callback for progress updates
   * @returns {Promise<{loaded: string[], failed: Array<{name: string, error: string}>}>}
   */
  async loadAll(views, onProgress) {
    const loaded = []
    const failed = []

    for (const view of views) {
      try {
        if (onProgress) onProgress(view.name)

        const entry = await this.loadView(view.name, view.url)
        loaded.push(view.name)

        console.log(`[ViewLoader] Loaded '${view.name}' (${entry.displayName}) [${entry.category}]`)
      } catch (error) {
        console.error(`[ViewLoader] Failed to load '${view.name}':`, error)
        failed.push({ name: view.name, error: error.message })
      }
    }

    // Notify that the registry is ready
    bus.emit('views:registry-ready')

    console.log(`[ViewLoader] Complete: ${loaded.length} loaded, ${failed.length} failed`)
    return { loaded, failed }
  }

  /**
   * Import a JS module using the optimal strategy for the URL scheme
   *
   * @param {string} url - Module URL
   * @returns {Promise<Module>}
   */
  async importModule(url) {
    // local: paths -> strip prefix, use native import (fast, browser-cached)
    if (url.startsWith('local:')) {
      const path = url.slice(6) // strip 'local:'
      return import(path)
    }

    // http/https -> native import (ESM over network)
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return import(url)
    }

    // Filesystem path -> read via FS plugin, create Blob URL, import
    const result = await window.pluginManager.call('fs', 'read', url)
    if (result.returnCode !== 0) {
      const errMsg = new TextDecoder().decode(result.output)
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

  /**
   * Get views grouped by category for the chrome selector
   *
   * @returns {Map<string, Array<{name: string, tag: string, displayName: string, category: string}>>}
   */
  getGroupedViews() {
    const groups = new Map()

    for (const [name, info] of this.registry) {
      const category = info.category
      if (!groups.has(category)) groups.set(category, [])
      groups.get(category).push({ name, ...info })
    }

    return groups
  }

  /**
   * Get a flat list of all registered views
   *
   * @returns {Array<{name: string, tag: string, displayName: string, category: string}>}
   */
  getAllViews() {
    return [...this.registry.entries()].map(([name, info]) => ({ name, ...info }))
  }

  /**
   * Check if a view is registered
   *
   * @param {string} name - View name (without view- prefix)
   * @returns {boolean}
   */
  hasView(name) {
    return this.registry.has(name)
  }
}

// Export singleton
export const viewLoader = new ViewLoader()
