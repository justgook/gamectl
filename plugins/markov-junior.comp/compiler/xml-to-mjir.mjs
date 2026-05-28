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

function convolutionFromElement(elementXml) {
  const start = xmlRootStartTag(elementXml)
  const direct = xmlDirectChildTags(elementXml)
  const unsupported = direct.map((childXml) => xmlRootTag(childXml)).filter((childTag) => childTag !== 'rule')
  if (unsupported.length > 0) throw new Error(`convolution has unsupported direct children: ${unsupported.join(', ')}`)
  const loadRule = (ruleXml) => {
    const tag = xmlRootStartTag(ruleXml)
    const input = xmlAttr(tag, 'in')
    const output = xmlAttr(tag, 'out')
    if (!input) throw new Error('convolution rule missing in attribute')
    if (!output) throw new Error('convolution rule missing out attribute')
    return { input, output, values: xmlAttr(tag, 'values', ''), sum: xmlAttr(tag, 'sum', ''), probability: Number(xmlAttr(tag, 'p', '1')) }
  }
  const rules = direct.length > 0 ? direct.map(loadRule) : [loadRule(elementXml)]
  return { neighborhood: xmlAttr(start, 'neighborhood', ''), periodic: xmlBoolAttr(start, 'periodic', false), rules }
}

export function encodeMjirV1({ values, node = 'one', rules, fields = [], temperature = 0, observations = [], children, unions = [] }) {
  const valueBytes = [...textEncoder.encode(values.replaceAll(' ', ''))]
  const nodeOps = (kind, steps, nodeFields = [], nodeTemperature = 0, nodeObservations = []) => [
    { op: 'node', kind, steps: steps ?? 0 },
    ...(nodeTemperature ? [{ op: 'temperature', value: nodeTemperature }] : []),
    ...nodeFields.map((field) => ({ op: 'field', ...field })),
    ...nodeObservations.map((observation) => ({ op: 'observe', ...observation })),
  ]
  const childOps = (child) => {
    if (child.children) return [...nodeOps(child.node, child.steps, child.fields, child.temperature, child.observations), ...child.children.flatMap(childOps), { op: 'end' }]
    return [...nodeOps(child.node, child.steps, child.fields, child.temperature, child.observations), ...(child.path ? [{ op: 'path', ...child.path }] : []), ...(child.convolution ? [{ op: 'convolution', ...child.convolution }] : []), ...child.rules]
  }
  const bodyOps = children
    ? [{ op: 'node', kind: node, steps: 0 }, ...children.flatMap(childOps)]
    : (node === 'one' && fields.length === 0 && observations.length === 0 && temperature === 0 ? rules : [...nodeOps(node, 0, fields, temperature, observations), ...rules])
  const ops = [...unions.map((union) => ({ op: 'union', ...union })), ...bodyOps]
  const bytes = []
  bytes.push('M'.charCodeAt(0), 'J'.charCodeAt(0), 'I'.charCodeAt(0), 'R'.charCodeAt(0))
  u32le(bytes, 1)
  u32le(bytes, valueBytes.length)
  bytes.push(...valueBytes)
  u32le(bytes, ops.length)

  for (const op of ops) {
    if (op.op === 'node') {
      const kinds = { one: 1, all: 2, prl: 3, markov: 4, sequence: 5, path: 6, convolution: 7 }
      if (!kinds[op.kind]) throw new Error(`unsupported node kind: ${op.kind}`)
      u32le(bytes, 100)
      u32le(bytes, kinds[op.kind])
      u32le(bytes, op.steps ?? 0)
      continue
    }
    if (op.op === 'union') {
      const valuesBytes = [...textEncoder.encode(op.values)]
      u32le(bytes, 101)
      bytes.push(op.symbol.charCodeAt(0))
      u32le(bytes, valuesBytes.length)
      bytes.push(...valuesBytes)
      continue
    }
    if (op.op === 'end') {
      u32le(bytes, 102)
      continue
    }
    if (op.op === 'field') {
      const toBytes = [...textEncoder.encode(op.to ?? '')]
      const fromBytes = [...textEncoder.encode(op.from ?? '')]
      const onBytes = [...textEncoder.encode(op.on ?? '')]
      u32le(bytes, 103)
      bytes.push(op.for.charCodeAt(0))
      u32le(bytes, op.recompute ? 1 : 0)
      u32le(bytes, op.essential ? 1 : 0)
      u32le(bytes, toBytes.length)
      bytes.push(...toBytes)
      u32le(bytes, fromBytes.length)
      bytes.push(...fromBytes)
      u32le(bytes, onBytes.length)
      bytes.push(...onBytes)
      continue
    }
    if (op.op === 'temperature') {
      u32le(bytes, 104)
      f64le(bytes, op.value)
      continue
    }
    if (op.op === 'observe') {
      const fromBytes = [...textEncoder.encode(op.from ?? '')]
      const toBytes = [...textEncoder.encode(op.to)]
      u32le(bytes, 105)
      bytes.push(op.value.charCodeAt(0))
      u32le(bytes, fromBytes.length)
      bytes.push(...fromBytes)
      u32le(bytes, toBytes.length)
      bytes.push(...toBytes)
      continue
    }
    if (op.op === 'convolution') {
      const neighborhoodBytes = [...textEncoder.encode(op.neighborhood ?? '')]
      u32le(bytes, 107)
      u32le(bytes, neighborhoodBytes.length)
      bytes.push(...neighborhoodBytes)
      u32le(bytes, op.periodic ? 1 : 0)
      u32le(bytes, op.rules.length)
      for (const rule of op.rules) {
        const valuesBytes = [...textEncoder.encode(rule.values ?? '')]
        const sumsBytes = [...textEncoder.encode(rule.sum ?? '')]
        bytes.push(rule.input.charCodeAt(0), rule.output.charCodeAt(0))
        f64le(bytes, rule.probability ?? 1)
        u32le(bytes, valuesBytes.length)
        bytes.push(...valuesBytes)
        u32le(bytes, sumsBytes.length)
        bytes.push(...sumsBytes)
      }
      continue
    }
    if (op.op === 'path') {
      const fromBytes = [...textEncoder.encode(op.from)]
      const toBytes = [...textEncoder.encode(op.to)]
      const onBytes = [...textEncoder.encode(op.on)]
      const colorBytes = [...textEncoder.encode(op.color ?? op.from[0])]
      u32le(bytes, 106)
      u32le(bytes, fromBytes.length); bytes.push(...fromBytes)
      u32le(bytes, toBytes.length); bytes.push(...toBytes)
      u32le(bytes, onBytes.length); bytes.push(...onBytes)
      bytes.push(colorBytes[0])
      u32le(bytes, op.inertia ? 1 : 0)
      u32le(bytes, op.longest ? 1 : 0)
      u32le(bytes, op.edges ? 1 : 0)
      u32le(bytes, op.vertices ? 1 : 0)
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

export function xmlUnionTags(xml) {
  return [...xml.matchAll(/<union\b([^>]*)\/?\s*>/g)].map((match) => match[0])
}

function unionsFromXml(xml) {
  return xmlUnionTags(xml).map((tag) => {
    const symbol = xmlAttr(tag, 'symbol')
    const values = xmlAttr(tag, 'values')
    if (!symbol) throw new Error('union missing symbol attribute')
    if (!values) throw new Error('union missing values attribute')
    return { symbol, values }
  })
}

export function xmlDirectChildTags(xml) {
  const source = xml.replace(/<!--([\s\S]*?)-->/g, '')
  const rootStart = xmlRootStartTag(source)
  const root = xmlRootTag(source)
  const closeRoot = source.lastIndexOf(`</${root}>`)
  const inner = closeRoot >= 0 ? source.slice(rootStart.length, closeRoot) : source.slice(rootStart.length)
  const children = []
  let i = 0
  while (i < inner.length) {
    const start = inner.indexOf('<', i)
    if (start < 0) break
    if (inner[start + 1] === '/') { i = start + 2; continue }
    const headEnd = inner.indexOf('>', start)
    if (headEnd < 0) break
    const name = inner.slice(start + 1, headEnd).trim().match(/^([a-zA-Z0-9_-]+)/)?.[1]
    if (!name) { i = headEnd + 1; continue }
    if (inner[headEnd - 1] === '/') {
      children.push(inner.slice(start, headEnd + 1))
      i = headEnd + 1
      continue
    }

    const close = `</${name}>`
    const closeStart = inner.indexOf(close, headEnd + 1)
    if (closeStart < 0) break
    children.push(inner.slice(start, closeStart + close.length))
    i = closeStart + close.length
  }
  return children
}

export function xmlChildNodeTags(xml) {
  return xmlDirectChildTags(xml).filter((tag) => ['one', 'all', 'prl'].includes(xmlRootTag(tag)))
}

function nodeFromElement(elementXml, inheritedSymmetry = '') {
  const tag = xmlRootTag(elementXml)
  const start = xmlRootStartTag(elementXml)
  const steps = Number(xmlAttr(start, 'steps', '0'))
  if (tag === 'path') {
    const path = pathFromElement(elementXml)
    return { node: tag, steps, rules: [], path }
  }
  if (tag === 'convolution') {
    const convolution = convolutionFromElement(elementXml)
    return { node: tag, steps, rules: [], convolution }
  }
  if (tag === 'markov' || tag === 'sequence') {
    const direct = xmlDirectChildTags(elementXml)
    const unsupported = direct.map((childXml) => xmlRootTag(childXml)).filter((childTag) => !['one', 'all', 'prl', 'path', 'convolution', 'markov', 'sequence'].includes(childTag))
    if (unsupported.length > 0) throw new Error(`${tag} child has unsupported direct children: ${unsupported.join(', ')}`)
    const children = direct.map((childXml) => nodeFromElement(childXml, inheritedSymmetry))
    if (children.length === 0) throw new Error(`child <${tag}> missing child nodes`)
    return { node: tag, steps, children }
  }
  return { node: tag, steps, rules: rulesFromElement(elementXml, inheritedSymmetry), fields: fieldsFromElement(elementXml), observations: observationsFromElement(elementXml), temperature: Number(xmlAttr(start, 'temperature', '0')) }
}

function fieldsFromElement(elementXml) {
  return xmlDirectChildTags(elementXml).filter((childXml) => xmlRootTag(childXml) === 'field').map((fieldXml) => {
    const start = xmlRootStartTag(fieldXml)
    const forSymbol = xmlAttr(start, 'for')
    const on = xmlAttr(start, 'on')
    const to = xmlAttr(start, 'to')
    const from = xmlAttr(start, 'from')
    if (!forSymbol) throw new Error('child <field> missing for attribute')
    if (!on) throw new Error('child <field> missing on attribute')
    if (!to && !from) throw new Error('child <field> missing to/from attribute')
    return { for: forSymbol, on, to, from, recompute: xmlBoolAttr(start, 'recompute', false), essential: xmlBoolAttr(start, 'essential', false) }
  })
}

function pathFromElement(elementXml) {
  const start = xmlRootStartTag(elementXml)
  const from = xmlAttr(start, 'from')
  const to = xmlAttr(start, 'to')
  const on = xmlAttr(start, 'on')
  if (!from) throw new Error('<path> missing from attribute')
  if (!to) throw new Error('<path> missing to attribute')
  if (!on) throw new Error('<path> missing on attribute')
  return {
    from,
    to,
    on,
    color: xmlAttr(start, 'color', from[0]),
    inertia: xmlBoolAttr(start, 'inertia', false),
    longest: xmlBoolAttr(start, 'longest', false),
    edges: xmlBoolAttr(start, 'edges', false),
    vertices: xmlBoolAttr(start, 'vertices', false),
  }
}

function observationsFromElement(elementXml) {
  return xmlDirectChildTags(elementXml).filter((childXml) => xmlRootTag(childXml) === 'observe').map((observeXml) => {
    const start = xmlRootStartTag(observeXml)
    const value = xmlAttr(start, 'value')
    const to = xmlAttr(start, 'to')
    if (!value) throw new Error('child <observe> missing value attribute')
    if (!to) throw new Error('child <observe> missing to attribute')
    return { value, from: xmlAttr(start, 'from', ''), to }
  })
}

function rulesFromElement(elementXml, inheritedSymmetry = '') {
  const start = xmlRootStartTag(elementXml)
  for (const attr of ['file', 'fin', 'fout', 'search']) {
    if (xmlAttr(start, attr, '') !== '') throw new Error(`unsupported ${attr} attribute`)
  }
  const directChildren = xmlDirectChildTags(elementXml)
  const unsupportedChildren = directChildren.map((childXml) => xmlRootTag(childXml)).filter((childTag) => childTag !== 'rule' && childTag !== 'field' && childTag !== 'observe')
  if (unsupportedChildren.length > 0) throw new Error(`unsupported children: ${unsupportedChildren.join(', ')}`)
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
  if (tag !== 'one' && tag !== 'all' && tag !== 'prl' && tag !== 'markov' && tag !== 'sequence' && tag !== 'path' && tag !== 'convolution') {
    throw new Error(`MJIR v1 compiler supports only root <one>/<all>/<prl>/<markov>/<sequence>/<path>/<convolution>, got ${tag || 'unknown'}`)
  }
  const rootStart = xmlRootStartTag(xml)
  const values = xmlAttr(rootStart, 'values')
  if (!values) throw new Error('missing values attribute')

  const rootSymmetry = xmlAttr(rootStart, 'symmetry', '')
  if (tag === 'markov' || tag === 'sequence') {
    const direct = xmlDirectChildTags(xml)
    const unsupported = direct.map((childXml) => xmlRootTag(childXml)).filter((childTag) => !['one', 'all', 'prl', 'path', 'convolution', 'markov', 'sequence', 'union'].includes(childTag))
    if (unsupported.length > 0) throw new Error(`${tag} root has unsupported direct children: ${unsupported.join(', ')}`)
    const children = direct.filter((childXml) => xmlRootTag(childXml) !== 'union').map((childXml) => nodeFromElement(childXml, rootSymmetry))
    if (children.length === 0) throw new Error(`${tag} root missing child nodes`)
    for (const child of children) if (!child.children && !child.path && !child.convolution && child.rules.length === 0) throw new Error(`child <${child.node}> missing in/out attributes or child <rule> elements`)
    return encodeMjirV1({ values, node: tag, children, unions: unionsFromXml(xml) })
  }

  if (tag === 'path') {
    return encodeMjirV1({ values, node: tag, rules: [{ op: 'path', ...pathFromElement(xml) }], unions: unionsFromXml(xml) })
  }
  if (tag === 'convolution') {
    return encodeMjirV1({ values, node: tag, rules: [{ op: 'convolution', ...convolutionFromElement(xml) }], unions: unionsFromXml(xml) })
  }

  const rules = rulesFromElement(xml, rootSymmetry)
  if (rules.length === 0) throw new Error('missing in/out attributes or child <rule> elements')
  return encodeMjirV1({ values, node: tag, rules, fields: fieldsFromElement(xml), observations: observationsFromElement(xml), temperature: Number(xmlAttr(rootStart, 'temperature', '0')), unions: unionsFromXml(xml) })
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
