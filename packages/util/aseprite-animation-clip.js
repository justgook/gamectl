import { runtime, unwrap } from "/core/runtime.js"
import { validateAnimationSelector } from "/util/animation-tree.js"

function assert(condition, message) {
    if (!condition) throw new Error(message)
}

function uniqueRecordByName(records, name, label) {
    assert(Array.isArray(records), `Aseprite ${label} must be an array`)
    const matches = records.filter((record, index) => {
        assert(
            record && typeof record === "object" && !Array.isArray(record),
            `Aseprite ${label}[${index}] must be an object`,
        )
        assert(
            typeof record.name === "string" && record.name.trim().length > 0,
            `Aseprite ${label}[${index}].name must be non-empty`,
        )
        return record.name.trim() === name
    })
    assert(matches.length === 1, `Aseprite ${label} must contain exactly one ${name}`)
    return matches[0]
}

function validateDocumentInfo(info) {
    assert(info && typeof info === "object" && !Array.isArray(info), "Aseprite document info must be an object")
    assert(Number.isInteger(info.width) && info.width > 0, "Aseprite document width must be a positive integer")
    assert(Number.isInteger(info.height) && info.height > 0, "Aseprite document height must be a positive integer")
    return info
}

function validateFrame(frame, index) {
    assert(frame && typeof frame === "object" && !Array.isArray(frame), `Aseprite frames[${index}] must be an object`)
    assert(Number(frame.index) === index, `Aseprite frames[${index}].index must match its array index`)
    const durationMs = Number(frame["duration-ms"])
    assert(
        Number.isFinite(durationMs) && durationMs > 0,
        `Aseprite frames[${index}].duration-ms must be positive and finite`,
    )
    return durationMs
}

function validatePixels(pixels, width, height, label) {
    assert(pixels && typeof pixels === "object" && !Array.isArray(pixels), `${label} must be an object`)
    assert(Number(pixels.width) === width, `${label}.width must match the Aseprite document`)
    assert(Number(pixels.height) === height, `${label}.height must match the Aseprite document`)
    assert(Array.isArray(pixels.data), `${label}.data must be an array`)
    assert(pixels.data.length === width * height * 4, `${label}.data length must match RGBA dimensions`)
    return { width, height, data: pixels.data.slice() }
}

function canvasPixels(canvas) {
    const context = canvas.getContext("2d")
    assert(context, "Aseprite animation clip canvas requires a 2d context")
    return {
        width: canvas.width,
        height: canvas.height,
        data: Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data),
    }
}

function pixelsCanvas(pixels, label) {
    assert(pixels && typeof pixels === "object" && !Array.isArray(pixels), `${label} must be an object`)
    assert(Number.isInteger(pixels.width) && pixels.width > 0, `${label}.width must be a positive integer`)
    assert(Number.isInteger(pixels.height) && pixels.height > 0, `${label}.height must be a positive integer`)
    assert(
        Array.isArray(pixels.data) && pixels.data.length === pixels.width * pixels.height * 4,
        `${label}.data length must match RGBA dimensions`,
    )
    const canvas = document.createElement("canvas")
    canvas.width = pixels.width
    canvas.height = pixels.height
    const context = canvas.getContext("2d")
    assert(context, `${label} canvas requires a 2d context`)
    context.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0)
    return canvas
}

async function renderLayerFrame(documentResource, frameIndex, layer, info) {
    const canvas = document.createElement("canvas")
    canvas.width = info.width
    canvas.height = info.height
    const context = canvas.getContext("2d")
    assert(context, "Aseprite animation layer canvas requires a 2d context")
    context.imageSmoothingEnabled = false
    const cels = unwrap(await runtime.invoke("aseprite/aseprite::cels", documentResource, frameIndex), "aseprite cels")
    assert(Array.isArray(cels), `Aseprite frame ${frameIndex} cels must be an array`)
    const layerCels = cels.filter((cel, index) => {
        assert(
            cel && typeof cel === "object" && !Array.isArray(cel),
            `Aseprite frame ${frameIndex} cels[${index}] must be an object`,
        )
        return Number(cel["layer-index"]) === Number(layer.index)
    })
    assert(layerCels.length <= 1, `Aseprite frame ${frameIndex} layer ${layer.name} must contain at most one cel`)
    if (layerCels.length === 0) return canvasPixels(canvas)
    const cel = layerCels[0]
    const celIndex = Number(cel["cel-index"])
    assert(
        Number.isInteger(celIndex) && celIndex >= 0,
        `Aseprite frame ${frameIndex} cel index must be a non-negative integer`,
    )
    const celPixels = unwrap(
        await runtime.invoke("aseprite/aseprite::cel-pixels", documentResource, frameIndex, celIndex),
        "aseprite cel pixels",
    )
    const source = pixelsCanvas(celPixels, `Aseprite frame ${frameIndex} layer ${layer.name} pixels`)
    const celOpacity = Number(cel.opacity)
    const layerOpacity = Number(layer.opacity)
    assert(
        Number.isInteger(celOpacity) && celOpacity >= 0 && celOpacity <= 255,
        `Aseprite frame ${frameIndex} cel opacity must be an unsigned byte`,
    )
    assert(
        Number.isInteger(layerOpacity) && layerOpacity >= 0 && layerOpacity <= 255,
        `Aseprite layer ${layer.name} opacity must be an unsigned byte`,
    )
    const x = Number(cel.x)
    const y = Number(cel.y)
    assert(
        Number.isInteger(x) && Number.isInteger(y),
        `Aseprite frame ${frameIndex} cel position must contain integers`,
    )
    context.globalAlpha = (celOpacity / 255) * (layerOpacity / 255)
    context.drawImage(source, x, y)
    context.globalAlpha = 1
    return canvasPixels(canvas)
}

function selectedFrameIndexes(frames, tag) {
    if (tag === null) return frames.map((_, index) => index)
    const from = Number(tag["from-frame"])
    const to = Number(tag["to-frame"])
    assert(
        Number.isInteger(from) && Number.isInteger(to) && from >= 0 && from <= to && to < frames.length,
        `Aseprite tag ${tag.name} frame range is invalid`,
    )
    return Array.from({ length: to - from + 1 }, (_, index) => from + index)
}

export async function loadAsepriteAnimationClip(selector) {
    validateAnimationSelector(selector, "Aseprite animation clip selector")
    assert(selector.url.length > 0, "Aseprite animation clip selector.url must be non-empty")
    let documentResource = null
    try {
        documentResource = unwrap(await runtime.invoke("aseprite/aseprite::open", selector.url), "aseprite open")
        const info = validateDocumentInfo(
            unwrap(await runtime.invoke("aseprite/aseprite::info", documentResource), "aseprite info"),
        )
        const frames = unwrap(await runtime.invoke("aseprite/aseprite::frames", documentResource), "aseprite frames")
        assert(Array.isArray(frames) && frames.length > 0, "Aseprite animation clip requires at least one frame")
        const durations = frames.map(validateFrame)
        const tags = unwrap(await runtime.invoke("aseprite/aseprite::tags", documentResource), "aseprite tags")
        const tag = selector.tag === "*" ? null : uniqueRecordByName(tags, selector.tag, "tags")
        const direction = tag === null ? "forward" : String(tag.direction)
        assert(
            ["forward", "reverse", "ping-pong", "ping-pong-reverse"].includes(direction),
            `Aseprite tag direction ${direction} is not supported`,
        )
        const repeat = tag === null ? 0 : Number(tag.repeat)
        assert(Number.isInteger(repeat) && repeat >= 0, "Aseprite tag repeat must be a non-negative integer")
        let layer = null
        if (selector.layer !== "*") {
            const layers = unwrap(
                await runtime.invoke("aseprite/aseprite::layers", documentResource),
                "aseprite layers",
            )
            layer = uniqueRecordByName(layers, selector.layer, "layers")
            assert(
                Number.isInteger(Number(layer.index)) && Number(layer.index) >= 0,
                `Aseprite layer ${layer.name} index must be a non-negative integer`,
            )
        }
        const clipFrames = []
        for (const frameIndex of selectedFrameIndexes(frames, tag)) {
            const pixels =
                layer === null
                    ? validatePixels(
                          unwrap(
                              await runtime.invoke("aseprite/aseprite::render-frame", documentResource, frameIndex),
                              "aseprite render frame",
                          ),
                          info.width,
                          info.height,
                          `Aseprite frame ${frameIndex} pixels`,
                      )
                    : await renderLayerFrame(documentResource, frameIndex, layer, info)
            clipFrames.push({ durationMs: durations[frameIndex], pixels })
        }
        return { width: info.width, height: info.height, direction, repeat, frames: clipFrames }
    } finally {
        if (documentResource) await runtime.releaseResource(documentResource)
    }
}
