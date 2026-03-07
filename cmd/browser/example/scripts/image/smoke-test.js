const decode = new TextDecoder()

async function call(module, fn, payload) {
  const input = typeof payload === 'string' ? payload : JSON.stringify(payload)
  const result = await window.pluginManager.call(module, fn, input)
  const text = decode.decode(result.output)
  if (result.returnCode !== 0) {
    throw new Error(`${module}.${fn} failed: ${text}`)
  }
  return JSON.parse(text)
}

const sourcePath = $in.sourcePath || 'local:/example/tilemap.png'
const cropRect = $in.crop || { x0: 0, y0: 0, x1: 16, y1: 16 }
const resizedSize = $in.resize || { width: 32, height: 32, filter: 'nearest' }
const canvasSize = $in.canvas || { width: 48, height: 48 }
const blitAt = $in.blit || { x: 8, y: 8 }
const outputQoi = $in.outputQoi || '/tmp/image-smoke.qoi'
const outputPng = $in.outputPng || '/tmp/image-smoke.png'

const opened = await call('image', 'open', { path: sourcePath })
const cropped = await call('image', 'crop', { src: opened.handle, ...cropRect })
const resized = await call('image', 'resize', { src: cropped.handle, ...resizedSize })
const canvas = await call('image', 'create', {
  width: canvasSize.width,
  height: canvasSize.height,
  fill: [0, 0, 0, 0]
})
const blitted = await call('image', 'blit', {
  dst: canvas.handle,
  src: resized.handle,
  x: blitAt.x,
  y: blitAt.y
})
const qoi = await call('image', 'encode', {
  src: blitted.handle,
  path: outputQoi,
  format: 'qoi'
})
const png = await call('image', 'encode', {
  src: blitted.handle,
  path: outputPng,
  format: 'png'
})
const pixels = await call('image', 'read_pixels', { src: blitted.handle })
const closed = await call('image', 'close_all', {})

$out.sourcePath = sourcePath
$out.crop = cropRect
$out.resize = resizedSize
$out.canvas = canvasSize
$out.blit = blitAt
$out.handles = {
  opened: opened.handle,
  cropped: cropped.handle,
  resized: resized.handle,
  canvas: canvas.handle,
  blitted: blitted.handle
}
$out.outputs = {
  qoi,
  png
}
$out.pixelSummary = {
  width: pixels.width,
  height: pixels.height,
  byteLength: pixels.byteLength,
  encoding: pixels.encoding,
  base64Preview: pixels.data.slice(0, 32)
}
$out.closed = closed.closed
