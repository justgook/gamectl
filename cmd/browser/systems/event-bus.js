class EventBus {
  listeners = new Map()
  subscriptionHook = () => { }
  unSubscriptionHook = () => { }

  on(eventType, listener) {
    let set = this.listeners.get(eventType)
    if (!set) {
      set = new Set()
      this.listeners.set(eventType, set)
    }
    set.add(listener)

    this.subscriptionHook(eventType, listener)

    return () => {
      this.off(eventType, listener)
    }
  }

  once(eventType, listener) {
    const wrapper = payload => {
      try {
        listener(payload)
      } finally {
        this.off(eventType, wrapper)
      }
    }
    return this.on(eventType, wrapper)
  }

  off(eventType, listener) {
    const set = this.listeners.get(eventType)
    if (!set) return
    set.delete(listener)
    if (set.size === 0) {
      this.listeners.delete(eventType)
    }

    this.unSubscriptionHook(eventType, listener)
  }

  emit(eventType, payload) {
    const set = this.listeners.get(eventType)
    if (!set) return
    for (const listener of Array.from(set)) {
      try {
        listener(payload)
      } catch (err) {
        console.error(`Error in event handler for "${eventType}":`, err)
      }
    }
  }

  clear(eventType) {
    if (eventType) {
      this.listeners.delete(eventType)
    } else {
      this.listeners.clear()
    }
  }
}

export const bus = new EventBus()

