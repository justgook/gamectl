const STORAGE_KEY_PREFIX = "gams:view-source:v1:"
const SOURCE_ATTRIBUTES = ["data-source", "data-source-input"]

function assertView(view) {
    if (!(view instanceof HTMLElement)) throw new Error("view source state requires an HTMLElement")
}

function storageKey(view) {
    const tag = view.tagName.toLowerCase()
    if (!tag) throw new Error("view source state requires a custom element tag")
    return `${STORAGE_KEY_PREFIX}${tag}`
}

function readStoredState(view) {
    const json = localStorage.getItem(storageKey(view))
    if (json === null) return null

    const state = JSON.parse(json)
    if (!state || typeof state !== "object" || Array.isArray(state))
        throw new Error(`stored view source state for '${view.tagName.toLowerCase()}' must be an object`)

    for (const [name, value] of Object.entries(state)) {
        if (!SOURCE_ATTRIBUTES.includes(name))
            throw new Error(`stored view source state for '${view.tagName.toLowerCase()}' has unknown field '${name}'`)
        if (typeof value !== "string" || value.length === 0)
            throw new Error(`stored view source state '${name}' for '${view.tagName.toLowerCase()}' must be non-empty`)
    }
    return state
}

export function restoreViewSourceState(view, explicitAttributes = {}) {
    assertView(view)
    if (!explicitAttributes || typeof explicitAttributes !== "object" || Array.isArray(explicitAttributes))
        throw new Error("view source state explicit attributes must be an object")

    const state = readStoredState(view)
    if (!state) return

    for (const name of SOURCE_ATTRIBUTES) {
        if (Object.hasOwn(explicitAttributes, name) || view.hasAttribute(name)) continue
        if (Object.hasOwn(state, name)) view.setAttribute(name, state[name])
    }
}

export function persistViewSourceState(view) {
    assertView(view)
    const state = {}
    for (const name of SOURCE_ATTRIBUTES) {
        const value = view.getAttribute(name)
        if (typeof value === "string" && value.length > 0) state[name] = value
    }

    const key = storageKey(view)
    if (Object.keys(state).length === 0) {
        localStorage.removeItem(key)
        return
    }
    localStorage.setItem(key, JSON.stringify(state))
}

export function observeViewSourceState(view) {
    assertView(view)
    const observer = new MutationObserver(() => persistViewSourceState(view))
    observer.observe(view, { attributes: true, attributeFilter: SOURCE_ATTRIBUTES })
    return observer
}
