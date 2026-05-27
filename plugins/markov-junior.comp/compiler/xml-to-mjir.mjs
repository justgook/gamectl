const textEncoder = new TextEncoder()

function u32le(out, value) {
  out.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff)
}

function f64le(out, value) {
  const buffer = new ArrayBuffer(8)
  new DataView(buffer).setFloat64(0, value, true)
  out.push(...new Uint8Array(buffer))
}

export function xmlAttr(xml, name, fallback = '') {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = xml.match(new RegExp(`(?:^|[\\s<])${escaped}\\s*=\\s*"([^"]*)"`))
  return match?.[1] ?? fallback
}

export function xmlRootStartTag(xml) {
  const withoutComments = xml.replace(/<!--([\s\S]*?)-->/g, '').trimStart()
  return withoutComments.match(/^<[^>]+>/)?.[0] ?? ''
}

export function xmlRootTag(xml) {
  return xmlRootStartTag(xml).match(/^<([a-zA-Z0-9_-]+)/)?.[1] ?? ''
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

export function encodeMjirV1({ values, node = 'one', rules, children }) {
  const valueBytes = [...textEncoder.encode(values.replaceAll(' ', ''))]
  const ops = children
    ? [{ op: 'node', kind: node }, ...children.flatMap((child) => [{ op: 'node', kind: child.node }, ...child.rules])]
    : (node === 'one' ? rules : [{ op: 'node', kind: node }, ...rules])
  const bytes = []
  bytes.push('M'.charCodeAt(0), 'J'.charCodeAt(0), 'I'.charCodeAt(0), 'R'.charCodeAt(0))
  u32le(bytes, 1)
  u32le(bytes, valueBytes.length)
  bytes.push(...valueBytes)
  u32le(bytes, ops.length)

  for (const op of ops) {
    if (op.op === 'node') {
      const kinds = { one: 1, all: 2, prl: 3, markov: 4, sequence: 5 }
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
    f64le(bytes, op.probability ?? 1)
    u32le(bytes, symmetryBytes.length)
    bytes.push(...symmetryBytes)
    bytes.push(...input.data)
    bytes.push(...output.data)
  }
  return bytes
}

export function xmlRuleTags(xml) {
  return [...xml.matchAll(/<rule\b([^>]*)\/?\s*>/g)].map((match) => match[0])
}

export function xmlChildNodeTags(xml) {
  const withoutRootStart = xml.slice(xmlRootStartTag(xml).length)
  const matches = []
  const re = /<(one|all|prl)\b[^>]*(?:\/>|>[\s\S]*?<\/\1>)/g
  for (const match of withoutRootStart.matchAll(re)) matches.push(match[0])
  return matches
}

function rulesFromElement(elementXml, inheritedSymmetry = '') {
  const start = xmlRootStartTag(elementXml)
  const input = xmlAttr(start, 'in')
  const output = xmlAttr(start, 'out')
  const symmetry = xmlAttr(start, 'symmetry', inheritedSymmetry)
  if (input || output) {
    if (!input) throw new Error('missing in attribute')
    if (!output) throw new Error('missing out attribute')
    return [{ op: 'pattern', input, output, symmetry, probability: Number(xmlAttr(start, 'p', '1')) }]
  }

  const rules = []
  for (const ruleTag of xmlRuleTags(elementXml)) {
    const ruleInput = xmlAttr(ruleTag, 'in')
    const ruleOutput = xmlAttr(ruleTag, 'out')
    if (!ruleInput) throw new Error('child <rule> missing in attribute')
    if (!ruleOutput) throw new Error('child <rule> missing out attribute')
    rules.push({ op: 'pattern', input: ruleInput, output: ruleOutput, symmetry: xmlAttr(ruleTag, 'symmetry', symmetry), probability: Number(xmlAttr(ruleTag, 'p', '1')) })
  }
  return rules
}

export function compileXmlToMjir(xml) {
  const tag = xmlRootTag(xml)
  if (tag !== 'one' && tag !== 'all' && tag !== 'prl' && tag !== 'markov') {
    throw new Error(`MJIR v1 compiler supports only root <one>/<all>/<prl>/<markov>, got ${tag || 'unknown'}`)
  }
  const rootStart = xmlRootStartTag(xml)
  const values = xmlAttr(rootStart, 'values')
  if (!values) throw new Error('missing values attribute')

  const rootSymmetry = xmlAttr(rootStart, 'symmetry', '')
  if (tag === 'markov') {
    const children = xmlChildNodeTags(xml).map((childXml) => ({ node: xmlRootTag(childXml), rules: rulesFromElement(childXml, rootSymmetry) }))
    if (children.length === 0) throw new Error('markov root missing child nodes')
    for (const child of children) if (child.rules.length === 0) throw new Error(`child <${child.node}> missing in/out attributes or child <rule> elements`)
    return encodeMjirV1({ values, node: tag, children })
  }

  const rules = rulesFromElement(xml, rootSymmetry)
  if (rules.length === 0) throw new Error('missing in/out attributes or child <rule> elements')
  return encodeMjirV1({ values, node: tag, rules })
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
