let currentContextMenuClose = null

function assert(condition, message) {
    if (!condition) throw new Error(message)
}

function normalizeItems(items, path = "items") {
    assert(Array.isArray(items), `context-menu ${path} must be an array`)
    return items.map((rawItem, index) => {
        const item = Array.isArray(rawItem) ? { label: rawItem[0], action: rawItem[1] } : rawItem
        assert(
            item && typeof item === "object" && !Array.isArray(item),
            `context-menu ${path}[${index}] must be an object`,
        )
        const label = String(item.label || "").trim()
        assert(label.length > 0, `context-menu ${path}[${index}].label must be non-empty`)
        const action = item.action || item.onClick
        const children = item.items === undefined ? null : normalizeItems(item.items, `${path}[${index}].items`)
        if (!children) assert(typeof action === "function", `context-menu ${path}[${index}].action must be a function`)
        return {
            label,
            action,
            disabled: item.disabled === true,
            items: children,
        }
    })
}

function closeExistingContextMenu() {
    if (currentContextMenuClose) currentContextMenuClose()
    currentContextMenuClose = null
    document.querySelectorAll('[data-util-context-menu="true"]').forEach((element) => element.remove())
}

function appendItem(parent, item, close) {
    const li = document.createElement("li")
    if (item.items) {
        const label = document.createElement("label")
        label.textContent = item.label
        li.appendChild(label)
        const submenu = document.createElement("menu")
        submenu.setAttribute("role", "group")
        for (const child of item.items) appendItem(submenu, child, close)
        li.appendChild(submenu)
        parent.appendChild(li)
        return
    }

    const button = document.createElement("button")
    button.type = "button"
    button.setAttribute("role", "menuitem")
    button.textContent = item.label
    button.disabled = item.disabled
    button.addEventListener("click", async (event) => {
        event.preventDefault()
        event.stopPropagation()
        if (item.disabled) return
        close()
        await item.action()
    })
    li.appendChild(button)
    parent.appendChild(li)
}

export function showContextMenu({ x, y, items, className = "" }) {
    assert(Number.isFinite(x), "context-menu x must be a finite number")
    assert(Number.isFinite(y), "context-menu y must be a finite number")
    const normalizedItems = normalizeItems(items)
    closeExistingContextMenu()

    const menu = document.createElement("menu")
    menu.dataset.utilContextMenu = "true"
    menu.setAttribute("role", "menu")
    menu.hidden = true
    menu.tabIndex = -1
    if (className) menu.className = className
    menu.style.position = "fixed"
    menu.style.zIndex = "10000"
    menu.style.minWidth = "220px"
    menu.style.maxHeight = "60vh"
    menu.style.overflow = "auto"

    let closed = false
    const onPointerDown = (event) => {
        if (menu.contains(event.target)) return
        close()
    }
    const onKeyDown = (event) => {
        if (event.key !== "Escape") return
        event.preventDefault()
        close()
    }
    const close = () => {
        if (closed) return
        closed = true
        window.removeEventListener("pointerdown", onPointerDown, { capture: true })
        window.removeEventListener("keydown", onKeyDown, { capture: true })
        menu.remove()
        if (currentContextMenuClose === close) currentContextMenuClose = null
    }
    currentContextMenuClose = close

    for (const item of normalizedItems) appendItem(menu, item, close)
    document.body.appendChild(menu)
    menu.style.left = `${Math.round(x)}px`
    menu.style.top = `${Math.round(y)}px`
    menu.hidden = false
    const rect = menu.getBoundingClientRect()
    menu.style.left = `${Math.max(0, Math.round(Math.min(x, window.innerWidth - rect.width)))}px`
    menu.style.top = `${Math.max(0, Math.round(Math.min(y, window.innerHeight - rect.height)))}px`
    menu.focus()
    window.addEventListener("pointerdown", onPointerDown, { capture: true })
    window.addEventListener("keydown", onKeyDown, { capture: true })

    return { element: menu, close }
}
