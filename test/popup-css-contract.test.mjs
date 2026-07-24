import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const css = await readFile(new URL("../packages/css/base.css", import.meta.url), "utf8")

function layerBody(name) {
    const marker = `@layer ${name} {`
    const start = css.indexOf(marker)
    assert.notEqual(start, -1, `base.css must define ${marker}`)

    let depth = 0
    for (let index = start + marker.length - 1; index < css.length; index++) {
        if (css[index] === "{") depth++
        if (css[index] === "}") depth--
        if (depth === 0) return css.slice(start + marker.length, index)
    }

    assert.fail(`@layer ${name} must have a closing brace`)
}

test("popup cascade hides every popup except the topmost one", () => {
    const theme = layerBody("theme")
    const popupLayout = theme.indexOf("view-popup {")
    const hiddenPopups = theme.indexOf("popup-manager view-popup:not(:last-of-type) {")

    assert.notEqual(popupLayout, -1, "the theme layer must define popup layout")
    assert.ok(
        hiddenPopups > popupLayout,
        "the topmost-popup rule must follow popup layout in the same cascade layer",
    )
    assert.match(
        theme.slice(hiddenPopups),
        /popup-manager view-popup:not\(:last-of-type\)\s*\{\s*display:\s*none;/,
    )
})
