const textEncoder = new TextEncoder()

function u32le(out, value) {
  out.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff)
}

function attr(xml, name) {
  const match = xml.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`))
  return match?.[1] ?? ''
}

export function compileMjirV1FromXml(xml) {
  const tag = xml.match(/^\s*<([a-zA-Z0-9_-]+)/)?.[1]
  if (tag !== 'one') {
    throw new Error(`MJIR v1 tracer supports only <one>, got ${tag || 'unknown'}`)
  }

  const values = attr(xml, 'values')
  const input = attr(xml, 'in')
  const output = attr(xml, 'out')
  if (!values) throw new Error('missing values attribute')
  if (input.length !== 1 || output.length !== 1) {
    throw new Error('MJIR v1 tracer supports only one-symbol in/out attributes')
  }

  const inputIndex = values.indexOf(input)
  const outputIndex = values.indexOf(output)
  if (inputIndex < 0) throw new Error(`input symbol ${input} is not present in values=${values}`)
  if (outputIndex < 0) throw new Error(`output symbol ${output} is not present in values=${values}`)

  return encodeOneCellReplace(values, inputIndex, outputIndex)
}

export function encodeOneCellReplace(values, inputIndex, outputIndex) {
  const valueBytes = [...textEncoder.encode(values)]
  const bytes = []
  bytes.push('M'.charCodeAt(0), 'J'.charCodeAt(0), 'I'.charCodeAt(0), 'R'.charCodeAt(0))
  u32le(bytes, 1) // version
  u32le(bytes, valueBytes.length)
  bytes.push(...valueBytes)
  u32le(bytes, 1) // rule count
  u32le(bytes, 1) // op: one-cell replace
  bytes.push(inputIndex, outputIndex)
  return bytes
}

export function initialGrid(width, height, depth, fillIndex = 0) {
  return Array.from({ length: width * height * depth }, () => fillIndex)
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
