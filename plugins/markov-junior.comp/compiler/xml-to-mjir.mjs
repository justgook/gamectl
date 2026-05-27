const textEncoder = new TextEncoder()

function u32le(out, value) {
  out.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff)
}

export function xmlAttr(xml, name, fallback = '') {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = xml.match(new RegExp(`(?:^|[\\s<])${escaped}\\s*=\\s*"([^"]*)"`))
  return match?.[1] ?? fallback
}

export function xmlRootTag(xml) {
  const withoutComments = xml.replace(/<!--([\s\S]*?)-->/g, '').trimStart()
  return withoutComments.match(/^<([a-zA-Z0-9_-]+)/)?.[1] ?? ''
}

export function xmlBoolAttr(xml, name, fallback = false) {
  const value = xmlAttr(xml, name, '')
  if (value === '') return fallback
  return value === 'True' || value === 'true'
}

export function parsePattern(pattern) {
  const layers = pattern.split(' ')
  const rows0 = layers[0].split('/')
  const width = rows0[0].length
  const height = rows0.length
  const depth = layers.length
  const data = []

  for (let z = 0; z < depth; z++) {
    const layer = layers[depth - 1 - z]
    const rows = layer.split('/')
    if (rows.length !== height) throw new Error(`pattern has inconsistent row count: ${pattern}`)
    for (let y = 0; y < height; y++) {
      if (rows[y].length !== width) throw new Error(`pattern has inconsistent row width: ${pattern}`)
      for (let x = 0; x < width; x++) data.push(rows[y].charCodeAt(x))
    }
  }
  return { width, height, depth, data }
}

export function encodeMjirV1({ values, node = 'one', rules }) {
  const valueBytes = [...textEncoder.encode(values.replaceAll(' ', ''))]
  const ops = node === 'one' ? rules : [{ op: 'node', kind: node }, ...rules]
  const bytes = []
  bytes.push('M'.charCodeAt(0), 'J'.charCodeAt(0), 'I'.charCodeAt(0), 'R'.charCodeAt(0))
  u32le(bytes, 1)
  u32le(bytes, valueBytes.length)
  bytes.push(...valueBytes)
  u32le(bytes, ops.length)

  for (const op of ops) {
    if (op.op === 'node') {
      const kinds = { one: 1, all: 2, prl: 3 }
      if (!kinds[op.kind]) throw new Error(`unsupported node kind: ${op.kind}`)
      u32le(bytes, 100)
      u32le(bytes, kinds[op.kind])
      continue
    }
    if (op.op !== 'pattern') throw new Error(`unsupported rule op: ${op.op}`)
    const input = parsePattern(op.input)
    const output = parsePattern(op.output)
    const symmetryBytes = [...textEncoder.encode(op.symmetry ?? '')]
    bytes.push(2, 0, 0, 0) // op = pattern rule
    u32le(bytes, input.width)
    u32le(bytes, input.height)
    u32le(bytes, input.depth)
    u32le(bytes, output.width)
    u32le(bytes, output.height)
    u32le(bytes, output.depth)
    u32le(bytes, symmetryBytes.length)
    bytes.push(...symmetryBytes)
    bytes.push(...input.data)
    bytes.push(...output.data)
  }
  return bytes
}

export function compileXmlToMjir(xml) {
  const tag = xmlRootTag(xml)
  if (tag !== 'one' && tag !== 'all') {
    throw new Error(`MJIR v1 compiler supports only root <one>/<all>, got ${tag || 'unknown'}`)
  }
  const values = xmlAttr(xml, 'values')
  const input = xmlAttr(xml, 'in')
  const output = xmlAttr(xml, 'out')
  if (!values) throw new Error('missing values attribute')
  if (!input) throw new Error('missing in attribute')
  if (!output) throw new Error('missing out attribute')
  return encodeMjirV1({
    values,
    node: tag,
    rules: [{ op: 'pattern', input, output, symmetry: xmlAttr(xml, 'symmetry', '') }],
  })
}

export function compileMjirV1FromXml(xml) {
  return compileXmlToMjir(xml)
}

export function initialGrid(width, height, depth, fillIndex = 0) {
  return Array.from({ length: width * height * depth }, () => fillIndex)
}

export function initialGridFromXml(xml, width, height, depth) {
  const cells = initialGrid(width, height, depth, 0)
  if (xmlBoolAttr(xml, 'origin', false)) {
    const index = Math.floor(width / 2) + Math.floor(height / 2) * width + Math.floor(depth / 2) * width * height
    cells[index] = 1
  }
  return cells
}

export function parseMjstate(text) {
  const lines = text.trimEnd().split(/\r?\n/)
  if (lines[0] !== 'MJSTATE 1') throw new Error('not an MJSTATE 1 file')
  const size = lines[1].match(/^size\s+(\d+)\s+(\d+)\s+(\d+)$/)
  if (!size) throw new Error('MJSTATE missing size line')
  const width = Number(size[1])
  const height = Number(size[2])
  const depth = Number(size[3])
  const legend = lines[2].replace(/^legend\s+/, '')
  const cells = []
  for (const line of lines.slice(3)) {
    if (line.startsWith('z ')) continue
    for (const ch of line) {
      const idx = legend.indexOf(ch)
      if (idx < 0) throw new Error(`cell symbol ${ch} is absent from legend ${legend}`)
      cells.push(idx)
    }
  }
  return { width, height, depth, values: legend, cells }
}
