import { bus as eventBus } from "./event-bus.js"
import { parseCSVLines } from "../util/csv.js"

class CacheManager {
  constructor(bus = eventBus) {
    this.bus = bus
    this.caches = new Map()
    this.DE = new TextDecoder()
    this.bus.subscriptionHook = this.subscriptionHook.bind(this)
    this.bus.unSubscriptionHook = this.unSubscriptionHook.bind(this)
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
}

export const cache = new CacheManager()
