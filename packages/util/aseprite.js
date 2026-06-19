/*
 * Aseprite .ase/.aseprite parser utilities for GAMS browser views.
 *
 * Parser structure is adapted from TheCyberRonin/ase-parser (MIT):
 * https://github.com/TheCyberRonin/ase-parser
 * Copyright (c) 2019 Ronin
 */

const textDecoder = new TextDecoder()

const LAYER_FLAG_MAP = {
    visible: 0b1,
    editable: 0b10,
    lockMovement: 0b100,
    background: 0b1000,
    preferLinkedCels: 0b10000,
    collapsedGroup: 0b100000,
    reference: 0b1000000,
}

const COLOR_PROFILE_TYPES = ["None", "sRGB", "ICC"]
const TAG_DIRECTIONS = ["Forward", "Reverse", "Ping-pong", "Ping-pong Reverse"]

function assert(condition, message) {
    if (!condition) throw new Error(message)
}

function toUint8Array(input) {
    if (input instanceof Uint8Array) return input
    if (input instanceof ArrayBuffer) return new Uint8Array(input)
    if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
    throw new Error("Aseprite parser requires an ArrayBuffer or typed array")
}

function translateLayerFlags(flagValue) {
    const flags = {}
    for (const flag in LAYER_FLAG_MAP) {
        flags[flag] = (flagValue & LAYER_FLAG_MAP[flag]) === LAYER_FLAG_MAP[flag]
    }
    return flags
}

async function inflateWithDecompressionStream(bytes) {
    assert(typeof DecompressionStream === "function", "Aseprite compressed chunks require options.inflate or browser DecompressionStream")
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"))
    return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function inflateBytes(bytes, inflate) {
    if (typeof inflate === "function") {
        const result = await inflate(bytes)
        return toUint8Array(result)
    }
    return inflateWithDecompressionStream(bytes)
}

class AsepriteReader {
    constructor(input) {
        this.bytes = toUint8Array(input)
        this.view = new DataView(this.bytes.buffer, this.bytes.byteOffset, this.bytes.byteLength)
        this.offset = 0
    }

    ensure(size) {
        assert(this.offset + size <= this.bytes.byteLength, "Unexpected end of Aseprite file")
    }

    readByte() {
        this.ensure(1)
        const value = this.view.getUint8(this.offset)
        this.offset += 1
        return value
    }

    readWord() {
        this.ensure(2)
        const value = this.view.getUint16(this.offset, true)
        this.offset += 2
        return value
    }

    readShort() {
        this.ensure(2)
        const value = this.view.getInt16(this.offset, true)
        this.offset += 2
        return value
    }

    readDWord() {
        this.ensure(4)
        const value = this.view.getUint32(this.offset, true)
        this.offset += 4
        return value
    }

    readLong() {
        this.ensure(4)
        const value = this.view.getInt32(this.offset, true)
        this.offset += 4
        return value
    }

    readFixed() {
        this.ensure(4)
        const raw = this.view.getInt32(this.offset, true)
        this.offset += 4
        return raw / 65536
    }

    readBytes(length) {
        this.ensure(length)
        const value = this.bytes.slice(this.offset, this.offset + length)
        this.offset += length
        return value
    }

    readString() {
        const length = this.readWord()
        return textDecoder.decode(this.readBytes(length))
    }

    skip(length) {
        this.ensure(length)
        this.offset += length
    }
}

export class AsepriteFile {
    constructor(input, name = "sprite.aseprite", options = {}) {
        this.reader = new AsepriteReader(input)
        this.name = name
        this.inflate = options.inflate
        this.frames = []
        this.layers = []
        this.slices = []
        this.tags = []
        this.tilesets = []
        this.palette = null
        this.colorProfile = null
        this.fileSize = 0
        this.numFrames = 0
        this.width = 0
        this.height = 0
        this.colorDepth = 0
        this.paletteIndex = 0
        this.numColors = 0
        this.pixelRatio = "1:1"
    }

    readHeader() {
        const reader = this.reader
        this.fileSize = reader.readDWord()
        const magic = reader.readWord()
        assert(magic === 0xa5e0, "Invalid Aseprite file magic")
        this.numFrames = reader.readWord()
        this.width = reader.readWord()
        this.height = reader.readWord()
        this.colorDepth = reader.readWord()
        reader.skip(14)
        this.paletteIndex = reader.readByte()
        reader.skip(3)
        this.numColors = reader.readWord()
        const pixelWidth = reader.readByte()
        const pixelHeight = reader.readByte()
        this.pixelRatio = `${pixelWidth}:${pixelHeight}`
        reader.skip(92)
    }

    async readFrame() {
        const reader = this.reader
        const bytesInFrame = reader.readDWord()
        const magic = reader.readWord()
        assert(magic === 0xf1fa, "Invalid Aseprite frame magic")
        const oldChunkCount = reader.readWord()
        const frameDuration = reader.readWord()
        reader.skip(2)
        const newChunkCount = reader.readDWord()
        const numChunks = newChunkCount === 0 ? oldChunkCount : newChunkCount
        const cels = []

        for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex += 1) {
            const chunkStart = reader.offset
            const chunkSize = reader.readDWord()
            const type = reader.readWord()

            if (type === 0x2004) this.readLayerChunk()
            else if (type === 0x2005) cels.push(await this.readCelChunk(chunkSize))
            else if (type === 0x2007) this.readColorProfileChunk()
            else if (type === 0x2018) this.readFrameTagsChunk()
            else if (type === 0x2019) this.palette = this.readPaletteChunk()
            else if (type === 0x2022) this.readSliceChunk()
            else if (type === 0x2023) this.tilesets.push(await this.readTilesetChunk())

            const nextChunkStart = chunkStart + chunkSize
            assert(reader.offset <= nextChunkStart, `Aseprite chunk 0x${type.toString(16)} over-read`)
            reader.offset = nextChunkStart
        }

        this.frames.push({ bytesInFrame, frameDuration, numChunks, cels })
    }

    readColorProfileChunk() {
        const reader = this.reader
        const typeIndex = reader.readWord()
        const flag = reader.readWord()
        const fGamma = reader.readFixed()
        reader.skip(8)
        const profile = { type: COLOR_PROFILE_TYPES[typeIndex], flag, fGamma }
        if (typeIndex === 2) profile.icc = reader.readBytes(reader.readDWord())
        this.colorProfile = profile
    }

    readFrameTagsChunk() {
        const reader = this.reader
        const numTags = reader.readWord()
        reader.skip(8)
        for (let index = 0; index < numTags; index += 1) {
            const from = reader.readWord()
            const to = reader.readWord()
            const animDirection = TAG_DIRECTIONS[reader.readByte()]
            const repeat = reader.readWord()
            reader.skip(6)
            const color = [...reader.readBytes(3)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
            reader.skip(1)
            const name = reader.readString()
            this.tags.push({ from, to, animDirection, repeat, color, name })
        }
    }

    readPaletteChunk() {
        const reader = this.reader
        const paletteSize = reader.readDWord()
        const firstColor = reader.readDWord()
        const lastColor = reader.readDWord()
        reader.skip(8)
        const colors = Array.from({ length: paletteSize }, () => ({ red: 0, green: 0, blue: 0, alpha: 0, name: "none" }))
        for (let index = firstColor; index <= lastColor; index += 1) {
            const flag = reader.readWord()
            const red = reader.readByte()
            const green = reader.readByte()
            const blue = reader.readByte()
            const alpha = reader.readByte()
            const name = flag === 1 ? reader.readString() : "none"
            colors[index] = { red, green, blue, alpha, name }
        }
        const palette = { paletteSize, firstColor, lastColor, colors }
        if (this.colorDepth === 8) palette.index = this.paletteIndex
        return palette
    }

    async readTilesetChunk() {
        const reader = this.reader
        const id = reader.readDWord()
        const flags = reader.readDWord()
        const tileCount = reader.readDWord()
        const tileWidth = reader.readWord()
        const tileHeight = reader.readWord()
        reader.skip(16)
        const name = reader.readString()
        const tileset = { id, flags, tileCount, tileWidth, tileHeight, name }
        if ((flags & 1) !== 0) tileset.externalFile = { id: reader.readDWord(), tilesetId: reader.readDWord() }
        if ((flags & 2) !== 0) tileset.rawTilesetData = await inflateBytes(reader.readBytes(reader.readDWord()), this.inflate)
        return tileset
    }

    readSliceChunk() {
        const reader = this.reader
        const numSliceKeys = reader.readDWord()
        const flags = reader.readDWord()
        reader.skip(4)
        const name = reader.readString()
        const keys = []
        for (let index = 0; index < numSliceKeys; index += 1) {
            const key = {
                frameNumber: reader.readDWord(),
                x: reader.readLong(),
                y: reader.readLong(),
                width: reader.readDWord(),
                height: reader.readDWord(),
            }
            if ((flags & 1) !== 0) {
                key.patch = { x: reader.readLong(), y: reader.readLong(), width: reader.readDWord(), height: reader.readDWord() }
            }
            if ((flags & 2) !== 0) key.pivot = { x: reader.readLong(), y: reader.readLong() }
            keys.push(key)
        }
        this.slices.push({ flags, name, keys })
    }

    readLayerChunk() {
        const reader = this.reader
        const layer = {
            flags: translateLayerFlags(reader.readWord()),
            type: reader.readWord(),
            layerChildLevel: reader.readWord(),
        }
        reader.skip(4)
        layer.blendMode = reader.readWord()
        layer.opacity = reader.readByte()
        reader.skip(3)
        layer.name = reader.readString()
        if (layer.type === 2) layer.tilesetIndex = reader.readDWord()
        this.layers.push(layer)
    }

    async readCelChunk(chunkSize) {
        const reader = this.reader
        const layerIndex = reader.readWord()
        const xpos = reader.readShort()
        const ypos = reader.readShort()
        const opacity = reader.readByte()
        const celType = reader.readWord()
        const zIndex = reader.readShort()
        reader.skip(5)

        if (celType === 1) return { layerIndex, xpos, ypos, opacity, celType, zIndex, w: 0, h: 0, rawCelData: null, link: reader.readWord() }

        const w = reader.readWord()
        const h = reader.readWord()
        const cel = { layerIndex, xpos, ypos, opacity, celType, zIndex, w, h }

        if (celType === 0) cel.rawCelData = reader.readBytes(chunkSize - 26)
        else if (celType === 2) cel.rawCelData = await inflateBytes(reader.readBytes(chunkSize - 26), this.inflate)
        else if (celType === 3) {
            cel.tilemapMetadata = {
                bitsPerTile: reader.readWord(),
                bitmaskForTileId: reader.readDWord(),
                bitmaskForXFlip: reader.readDWord(),
                bitmaskForYFlip: reader.readDWord(),
                bitmaskFor90CWRotation: reader.readDWord(),
            }
            reader.skip(10)
            cel.rawCelData = await inflateBytes(reader.readBytes(chunkSize - 54), this.inflate)
        } else {
            throw new Error(`Unsupported Aseprite cel type ${celType}`)
        }
        return cel
    }

    resolveLinkedCels() {
        for (const frame of this.frames) {
            for (const cel of frame.cels) {
                if (cel.celType !== 1) continue
                const linkedFrame = this.frames[cel.link]
                assert(linkedFrame, `Linked Aseprite cel references missing frame ${cel.link}`)
                const source = linkedFrame.cels.find((sourceCel) => sourceCel.layerIndex === cel.layerIndex)
                assert(source, `Linked Aseprite cel references missing layer ${cel.layerIndex}`)
                cel.w = source.w
                cel.h = source.h
                cel.rawCelData = source.rawCelData
                cel.tilemapMetadata = source.tilemapMetadata
            }
        }
    }

    async parse() {
        this.readHeader()
        for (let frameIndex = 0; frameIndex < this.numFrames; frameIndex += 1) await this.readFrame()
        this.resolveLinkedCels()
        return this
    }

    toJSON() {
        return {
            fileSize: this.fileSize,
            numFrames: this.numFrames,
            width: this.width,
            height: this.height,
            colorDepth: this.colorDepth,
            paletteIndex: this.paletteIndex,
            numColors: this.numColors,
            pixelRatio: this.pixelRatio,
            colorProfile: this.colorProfile,
            palette: this.palette,
            layers: this.layers,
            tags: this.tags,
            slices: this.slices,
            tilesets: this.tilesets,
            frames: this.frames.map((frame) => ({
                bytesInFrame: frame.bytesInFrame,
                frameDuration: frame.frameDuration,
                numChunks: frame.numChunks,
                cels: frame.cels.map((cel) => ({ ...cel, rawCelData: cel.rawCelData ? "bytes" : null })),
            })),
        }
    }
}

export async function parseAseprite(input, options = {}) {
    const aseprite = new AsepriteFile(input, options.name || "sprite.aseprite", options)
    return aseprite.parse()
}

export function celToRgba(aseprite, cel) {
    assert(cel.rawCelData, "Aseprite cel has no pixel data")
    if (cel.celType === 3) throw new Error("Tilemap Aseprite cels cannot be converted to RGBA pixels directly")

    const pixelCount = cel.w * cel.h
    const rgba = new Uint8ClampedArray(pixelCount * 4)
    const raw = cel.rawCelData

    if (aseprite.colorDepth === 32) {
        assert(raw.byteLength >= rgba.byteLength, "Aseprite RGBA cel data is shorter than expected")
        rgba.set(raw.subarray(0, rgba.byteLength))
        return rgba
    }

    if (aseprite.colorDepth === 16) {
        assert(raw.byteLength >= pixelCount * 2, "Aseprite grayscale cel data is shorter than expected")
        for (let pixel = 0; pixel < pixelCount; pixel += 1) {
            const gray = raw[pixel * 2]
            rgba[pixel * 4] = gray
            rgba[pixel * 4 + 1] = gray
            rgba[pixel * 4 + 2] = gray
            rgba[pixel * 4 + 3] = raw[pixel * 2 + 1]
        }
        return rgba
    }

    if (aseprite.colorDepth === 8) {
        assert(aseprite.palette, "Indexed Aseprite file requires a palette chunk")
        for (let pixel = 0; pixel < pixelCount; pixel += 1) {
            const paletteIndex = raw[pixel]
            const color = aseprite.palette.colors[paletteIndex]
            assert(color, `Indexed Aseprite cel references missing palette color ${paletteIndex}`)
            rgba[pixel * 4] = color.red
            rgba[pixel * 4 + 1] = color.green
            rgba[pixel * 4 + 2] = color.blue
            rgba[pixel * 4 + 3] = paletteIndex === aseprite.paletteIndex ? 0 : color.alpha
        }
        return rgba
    }

    throw new Error(`Unsupported Aseprite color depth ${aseprite.colorDepth}`)
}

function blendPixel(output, position, red, green, blue, alpha) {
    const sourceAlpha = alpha / 255
    if (sourceAlpha <= 0) return

    const destAlpha = output[position + 3] / 255
    const outAlpha = sourceAlpha + destAlpha * (1 - sourceAlpha)
    if (outAlpha <= 0) return

    output[position] = Math.round((red * sourceAlpha + output[position] * destAlpha * (1 - sourceAlpha)) / outAlpha)
    output[position + 1] = Math.round((green * sourceAlpha + output[position + 1] * destAlpha * (1 - sourceAlpha)) / outAlpha)
    output[position + 2] = Math.round((blue * sourceAlpha + output[position + 2] * destAlpha * (1 - sourceAlpha)) / outAlpha)
    output[position + 3] = Math.round(outAlpha * 255)
}

export function renderAsepriteFrame(aseprite, frameIndex = 0) {
    const frame = aseprite.frames[frameIndex]
    assert(frame, `Aseprite frame ${frameIndex} does not exist`)

    const output = new Uint8ClampedArray(aseprite.width * aseprite.height * 4)
    const cels = [...frame.cels].sort((a, b) => a.layerIndex + a.zIndex - (b.layerIndex + b.zIndex) || a.zIndex - b.zIndex)

    for (const cel of cels) {
        const layer = aseprite.layers[cel.layerIndex]
        assert(layer, `Aseprite cel references missing layer ${cel.layerIndex}`)
        if (layer.flags.visible === false || cel.celType === 3) continue

        const celPixels = celToRgba(aseprite, cel)
        const opacity = (cel.opacity / 255) * (layer.opacity / 255)

        for (let y = 0; y < cel.h; y += 1) {
            const targetY = cel.ypos + y
            if (targetY < 0 || targetY >= aseprite.height) continue
            for (let x = 0; x < cel.w; x += 1) {
                const targetX = cel.xpos + x
                if (targetX < 0 || targetX >= aseprite.width) continue
                const source = (y * cel.w + x) * 4
                const alpha = celPixels[source + 3] * opacity
                blendPixel(output, (targetY * aseprite.width + targetX) * 4, celPixels[source], celPixels[source + 1], celPixels[source + 2], alpha)
            }
        }
    }

    return { width: aseprite.width, height: aseprite.height, data: output, duration: frame.frameDuration }
}

export function createAsepriteFrameImageData(aseprite, frameIndex = 0) {
    const frame = renderAsepriteFrame(aseprite, frameIndex)
    assert(typeof ImageData === "function", "ImageData is not available in this environment")
    return new ImageData(frame.data, frame.width, frame.height)
}

export default AsepriteFile
