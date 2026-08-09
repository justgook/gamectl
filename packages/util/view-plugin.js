import { runtime } from "/core/runtime.js"
import {
    observeViewSourceState,
    persistViewSourceState,
    restoreViewSourceState,
} from "./view-source-state.js"

const sourceStateObservers = new WeakMap()

function toResult(value) {
    if (value && typeof value === "object" && Object.hasOwn(value, "ok")) return value
    if (value && typeof value === "object" && Object.hasOwn(value, "err")) return value
    return { ok: value ?? true }
}

function viewTypeForElement(view) {
    const tag = view.tagName.toLowerCase()
    if (!tag) throw new Error("view plugin registration requires a custom element tag")
    return tag.replace(/^view-/, "").replaceAll("-", ".")
}

async function noop() {
    return { ok: true }
}

function viewMethod(view, methodName, after = null) {
    const method = view[methodName]
    if (typeof method !== "function") return noop
    return async (input) => {
        const result = toResult(await method.call(view, input))
        if (after) after(view)
        return result
    }
}

function customOpenMethod(view, methods) {
    if (!Object.hasOwn(methods, "open")) return viewMethod(view, "open", persistViewSourceState)
    if (typeof methods.open !== "function") throw new Error("view plugin custom open method must be a function")
    return async (input) => {
        const result = await methods.open(input)
        persistViewSourceState(view)
        return result
    }
}

export function registerViewPlugin(view, methods = {}) {
    if (!(view instanceof HTMLElement)) throw new Error("registerViewPlugin requires an HTMLElement")
    if (typeof view.pluginId === "string" && view.pluginId.length > 0) return view.pluginId

    restoreViewSourceState(view)
    sourceStateObservers.set(view, observeViewSourceState(view))

    const pluginId = `view.${viewTypeForElement(view)}.${crypto.randomUUID()}`
    view.pluginId = pluginId
    runtime.register({
        id: pluginId,
        methods: {
            ping: async () => ({ ok: { id: pluginId } }),
            save: viewMethod(view, "save"),
            saveAs: viewMethod(view, "saveAs"),
            new: viewMethod(view, "new"),
            run: viewMethod(view, "run"),
            reload: viewMethod(view, "reload"),
            add: viewMethod(view, "add"),
            edit: viewMethod(view, "edit"),
            undo: viewMethod(view, "undo"),
            redo: viewMethod(view, "redo"),
            copy: viewMethod(view, "copy"),
            paste: viewMethod(view, "paste"),
            zoomIn: viewMethod(view, "zoomIn"),
            zoomOut: viewMethod(view, "zoomOut"),
            zoomFit: viewMethod(view, "zoomFit"),
            clearSelection: viewMethod(view, "clearSelection"),
            deleteSelected: viewMethod(view, "deleteSelected"),
            tool_1: noop,
            tool_2: noop,
            tool_3: noop,
            tool_4: noop,
            tool_5: noop,
            tool_6: noop,
            ...methods,
            open: customOpenMethod(view, methods),
        },
    })
    void runtime.call("ui.context.activateView", pluginId)

    return pluginId
}

export async function unregisterViewPlugin(view) {
    if (!(view instanceof HTMLElement)) throw new Error("unregisterViewPlugin requires an HTMLElement")
    const pluginId = view.pluginId
    if (typeof pluginId !== "string" || pluginId.length === 0) return
    persistViewSourceState(view)
    const observer = sourceStateObservers.get(view)
    if (!observer) throw new Error("registered view plugin is missing its source state observer")
    observer.disconnect()
    sourceStateObservers.delete(view)
    view.pluginId = ""
    await runtime.unregister(pluginId)
}

export function viewOk(value = true) {
    return toResult(value)
}
