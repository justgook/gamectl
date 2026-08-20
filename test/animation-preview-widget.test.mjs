import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

class HTMLElementStub extends EventTarget {
    constructor() {
        super()
        this.dataset = {}
        this.isConnected = false
    }
}

const registrations = new Map()
globalThis.HTMLElement = HTMLElementStub
globalThis.HTMLCanvasElement = class HTMLCanvasElementStub {}
globalThis.window = { setTimeout: () => 0, clearTimeout: () => {} }
globalThis.customElements = {
    define: (name, elementClass) => registrations.set(name, elementClass),
    get: (name) => registrations.get(name),
}

const { WidgetAnimationPreview } = await import("../packages/widgets/animation-preview.js")
const guide = await readFile(new URL("../docs/reference/gams-view-development-guide.md", import.meta.url), "utf8")
const treeSource = await readFile(new URL("../views/view-animation-tree.js", import.meta.url), "utf8")
const loaderSource = await readFile(new URL("../packages/util/aseprite-animation-clip.js", import.meta.url), "utf8")

function clip(direction = "forward", repeat = 0) {
    return {
        width: 1,
        height: 1,
        direction,
        repeat,
        frames: [
            { durationMs: 40, pixels: { width: 1, height: 1, data: [255, 0, 0, 255] } },
            { durationMs: 50, pixels: { width: 1, height: 1, data: [0, 255, 0, 255] } },
            { durationMs: 60, pixels: { width: 1, height: 1, data: [0, 0, 255, 255] } },
        ],
    }
}

function playbackFrames(direction, advances) {
    const preview = new WidgetAnimationPreview()
    preview.clip = clip(direction)
    preview.playing = true
    const frames = [preview.frameIndex]
    for (let index = 0; index < advances; index += 1) {
        preview.advanceFrame()
        frames.push(preview.frameIndex)
    }
    return frames
}

test("animation preview is a documented control-free widget", () => {
    assert.equal(registrations.get("widget-animation-preview"), WidgetAnimationPreview)
    assert.match(guide, /`widget-animation-preview` - control-free pixel animation preview surface/)
    const preview = new WidgetAnimationPreview()
    assert.equal(preview.querySelector, undefined, "the disconnected widget does not create controls")
})

test("animation preview validates and owns normalized clips", () => {
    const preview = new WidgetAnimationPreview()
    const source = clip()
    preview.clip = source
    source.frames[0].pixels.data[0] = 0
    assert.equal(preview.clip.frames[0].pixels.data[0], 255)
    assert.throws(() => {
        preview.clip = { ...clip(), width: 0 }
    }, /width must be a positive integer/)
    assert.throws(() => {
        preview.clip = { ...clip(), extra: true }
    }, /must contain only/)
    assert.throws(() => {
        preview.playbackRate = 0
    }, /positive and finite/)
    assert.throws(() => {
        preview.frameIndex = 3
    }, /out of range/)
})

test("animation preview follows forward, reverse, and ping-pong playback order", () => {
    assert.deepEqual(playbackFrames("forward", 3), [0, 1, 2, 0])
    assert.deepEqual(playbackFrames("reverse", 3), [2, 1, 0, 2])
    assert.deepEqual(playbackFrames("ping-pong", 4), [0, 1, 2, 1, 0])
    assert.deepEqual(playbackFrames("ping-pong-reverse", 4), [2, 1, 0, 1, 2])
})

test("Animation Tree places an autoplaying leaf preview first in the inspector", () => {
    assert.match(treeSource, /import "\/widgets\/animation-preview\.js"/)
    assert.match(
        treeSource,
        /animationPreviewMarkup\(node\)[\s\S]*?<fieldset data-element="animation-preview-fieldset"><legend>Preview<\/legend><widget-animation-preview data-element="animation-preview">/,
    )
    assert.match(
        treeSource,
        /<form data-element="\$\{this\.escapeAttribute\(node\.kind\)\}-inspector">\s*\$\{this\.animationPreviewMarkup\(node\)\}/,
    )
    assert.match(
        treeSource,
        /<form data-element="state-inspector">\s*\$\{this\.animationPreviewMarkup\(node\.animationNode\)\}/,
    )
    assert.match(treeSource, /const clip = await loadAsepriteAnimationClip\(structuredClone\(node\.animation\)\)/)
    assert.match(treeSource, /preview\.clip = clip\s*preview\.playing = true/)
    assert.match(treeSource, /input\.dataset\.target === "animation"\) void this\.loadAnimationPreview\(node\)/)
})

test("Aseprite selectors load normalized clips and release their document", () => {
    for (const method of ["open", "info", "frames", "tags", "render-frame", "layers", "cels", "cel-pixels"]) {
        assert.match(loaderSource, new RegExp(`aseprite/aseprite::${method}`))
    }
    assert.match(
        loaderSource,
        /return \{ width: info\.width, height: info\.height, direction, repeat, frames: clipFrames \}/,
    )
    assert.match(
        loaderSource,
        /finally \{\s*if \(documentResource\) await runtime\.releaseResource\(documentResource\)/,
    )
})

test("finite animation preview playback stops and emits ended", () => {
    const preview = new WidgetAnimationPreview()
    preview.clip = clip("forward", 1)
    let ended = 0
    preview.addEventListener("ended", () => {
        ended += 1
    })
    preview.playing = true
    preview.advanceFrame()
    preview.advanceFrame()
    preview.advanceFrame()
    assert.equal(preview.frameIndex, 2)
    assert.equal(preview.playing, false)
    assert.equal(ended, 1)
})
