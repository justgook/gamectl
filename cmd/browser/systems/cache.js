import { bus as eventBus } from "./event-bus.js"
import { parseCSVLines } from "../util/csv.js"

class CacheManager {
  constructor(bus = eventBus) {
    this.bus = bus
    this.caches = new Map()
    this.DE = new TextDecoder()
    this.bus.subscriptionHook = this.subscriptionHook.bind(this)
    this.bus.unSubscriptionHook = this.unSubscriptionHook.bind(this)

    // Listen for save events
    this.bus.on('cache:save', this.saveData.bind(this))
  }

  subscriptionHook(eventType, listener) {
    if (!eventType.startsWith("cache:changed:")) { return }

    const sqlQuery = eventType.replace("cache:changed:", "")
    if (this.caches.has(sqlQuery)) {
      return listener(this.caches.get(sqlQuery))
    }

    this.requestData(sqlQuery, listener)
    this.bus.on(`cache:load:${sqlQuery}`, () => {
      this.requestData(sqlQuery, (data) => this.bus.emit(`cache:changed:${sqlQuery}`, data))
    })

    this.bus.onSkipHook(`cache:changed:${sqlQuery}`, (data) => {
      if (this.caches.get(sqlQuery) === data) { return }
      console.log(data)
      this.caches.set(sqlQuery, data)
    })
  }

  unSubscriptionHook(eventType, listener) {
    if (!eventType.startsWith("cache:changed:")) { return }

    console.warn("IMPLEMENT CacheManager::unSubscriptionHook")
  }

  async requestData(sqlQuery, listener) {
    const result = await window.pluginManager.call('sql', 'query', sqlQuery)
    const csv = this.DE.decode(result.output)

    // Parse CSV to get JSON data
    const lines = parseCSVLines(csv.trim())
    if (lines.length < 2 || lines[1].length < 1) {
      console.warn("cache failed load", sqlQuery)
      return null
    }

    const data = JSON.parse(lines[1][0]) // First column of second row
    this.caches.set(sqlQuery, data)

    listener(data)
  }

  /**
   * Save cached data to database
   * @param {Object} payload - Contains selectQuery and insertQueryFn
   * @param {string} payload.selectQuery - The SELECT query used to load the data
   * @param {Function} payload.insertQueryFn - Function that takes (name, jsonData) and returns INSERT query
   */
  async saveData({ selectQuery, insertQueryFn }) {
    const data = this.caches.get(selectQuery)
    
    if (!data) {
      console.error('No cached data found for query:', selectQuery)
      this.bus.emit('cache:save:error', { selectQuery, error: 'No cached data found' })
      return
    }

    try {
      // Extract name from SELECT query (e.g., "SELECT data FROM table WHERE name = 'foo'")
      const nameMatch = selectQuery.match(/name\s*=\s*'([^']+)'/)
      if (!nameMatch) {
        throw new Error('Could not extract name from SELECT query')
      }
      const name = nameMatch[1]

      // Generate INSERT query
      const jsonData = JSON.stringify(data)
      const escapedData = jsonData.replace(/'/g, "''")
      const insertQuery = insertQueryFn(name, escapedData)

      // Execute save
      const result = await window.pluginManager.call('sql', 'exec', insertQuery)
      console.log('Cache saved:', this.DE.decode(result.output))
      
      this.bus.emit('cache:save:success', { selectQuery, name })
    } catch (error) {
      console.error('Failed to save cache:', error)
      this.bus.emit('cache:save:error', { selectQuery, error: error.message })
    }
  }
}

export const cache = new CacheManager()
