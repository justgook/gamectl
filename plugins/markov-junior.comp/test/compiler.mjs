import assert from 'node:assert/strict'
import {
  compileXmlToMjir,
  encodeMjirV1,
  initialGrid,
  initialGridFromXml,
  parseMjstate,
  parsePattern,
  xmlAttr,
  xmlBoolAttr,
  xmlChildNodeTags,
  xmlDirectChildTags,
  xmlRootTag,
  xmlRootStartTag,
  xmlRuleTags,
  xmlUnionTags,
} from '../compiler/xml-to-mjir.mjs'

function readU32(bytes, pos) {
  return bytes[pos] | (bytes[pos + 1] << 8) | (bytes[pos + 2] << 16) | (bytes[pos + 3] << 24)
}

function readF64(bytes, pos) {
  const view = new DataView(Uint8Array.from(bytes.slice(pos, pos + 8)).buffer)
  return view.getFloat64(0, true)
}

function decodeMjirV1(bytes) {
  let pos = 0
  assert.equal(String.fromCharCode(...bytes.slice(pos, pos + 4)), 'MJIR')
  pos += 4
  const version = readU32(bytes, pos); pos += 4
  const valuesLen = readU32(bytes, pos); pos += 4
  const values = String.fromCharCode(...bytes.slice(pos, pos + valuesLen)); pos += valuesLen
  const ruleCount = readU32(bytes, pos); pos += 4
  const rules = []
  const nodes = []
  for (let i = 0; i < ruleCount; i++) {
    const op = readU32(bytes, pos); pos += 4
    if (op === 100) {
      nodes.push({ kind: readU32(bytes, pos), steps: readU32(bytes, pos + 4) }); pos += 8
      continue
    }
    if (op === 101) {
      const symbol = String.fromCharCode(bytes[pos]); pos += 1
      const valuesLen = readU32(bytes, pos); pos += 4
      const unionValues = String.fromCharCode(...bytes.slice(pos, pos + valuesLen)); pos += valuesLen
      rules.push({ op, symbol, values: unionValues })
      continue
    }
    if (op === 102) {
      rules.push({ op })
      continue
    }
    if (op === 103) {
      const forSymbol = String.fromCharCode(bytes[pos]); pos += 1
      const recompute = readU32(bytes, pos) !== 0; pos += 4
      const essential = readU32(bytes, pos) !== 0; pos += 4
      const toLen = readU32(bytes, pos); pos += 4
      const to = String.fromCharCode(...bytes.slice(pos, pos + toLen)); pos += toLen
      const fromLen = readU32(bytes, pos); pos += 4
      const from = String.fromCharCode(...bytes.slice(pos, pos + fromLen)); pos += fromLen
      const onLen = readU32(bytes, pos); pos += 4
      const on = String.fromCharCode(...bytes.slice(pos, pos + onLen)); pos += onLen
      rules.push({ op, for: forSymbol, recompute, essential, to, from, on })
      continue
    }
    if (op === 104) {
      const temperature = readF64(bytes, pos); pos += 8
      rules.push({ op, temperature })
      continue
    }
    if (op === 105) {
      const value = String.fromCharCode(bytes[pos]); pos += 1
      const fromLen = readU32(bytes, pos); pos += 4
      const from = String.fromCharCode(...bytes.slice(pos, pos + fromLen)); pos += fromLen
      const toLen = readU32(bytes, pos); pos += 4
      const to = String.fromCharCode(...bytes.slice(pos, pos + toLen)); pos += toLen
      rules.push({ op, value, from, to })
      continue
    }
    const imx = readU32(bytes, pos); pos += 4
    const imy = readU32(bytes, pos); pos += 4
    const imz = readU32(bytes, pos); pos += 4
    const omx = readU32(bytes, pos); pos += 4
    const omy = readU32(bytes, pos); pos += 4
    const omz = readU32(bytes, pos); pos += 4
    const probability = readF64(bytes, pos); pos += 8
    const symmetryLen = readU32(bytes, pos); pos += 4
    const symmetry = String.fromCharCode(...bytes.slice(pos, pos + symmetryLen)); pos += symmetryLen
    const inputLen = imx * imy * imz
    const outputLen = omx * omy * omz
    const input = String.fromCharCode(...bytes.slice(pos, pos + inputLen)); pos += inputLen
    const output = String.fromCharCode(...bytes.slice(pos, pos + outputLen)); pos += outputLen
    rules.push({ op, imx, imy, imz, omx, omy, omz, probability, symmetry, input, output })
  }
  assert.equal(pos, bytes.length)
  return { version, values, nodes, rules }
}

assert.equal(xmlAttr('<one values="BW" origin="True" in="WB" out="WW"/>', 'in'), 'WB')
assert.equal(xmlAttr('<one values="BW" origin="True" in="WB" out="WW"/>', 'origin'), 'True')
assert.equal(xmlAttr('<one values="BW"/>', 'missing', 'fallback'), 'fallback')
assert.equal(xmlBoolAttr('<one origin="True"/>', 'origin'), true)
assert.equal(xmlBoolAttr('<one origin="false"/>', 'origin', true), false)
assert.equal(xmlRootStartTag('<!-- comment -->\n<one values="BW"/>'), '<one values="BW"/>')
assert.equal(xmlRootTag('<!-- comment -->\n<one values="BW"/>'), 'one')

assert.deepEqual(parsePattern('WB'), { width: 2, height: 1, depth: 1, data: [...'WB'].map((c) => c.charCodeAt(0)) })
assert.deepEqual(parsePattern('*BB/WBB/*BB'), {
  width: 3,
  height: 3,
  depth: 1,
  data: [...'*BBWBB*BB'].map((c) => c.charCodeAt(0)),
})
assert.deepEqual(parsePattern('AB/CD EF/GH'), {
  width: 2,
  height: 2,
  depth: 2,
  data: [...'EFGHABCD'].map((c) => c.charCodeAt(0)),
})
assert.throws(() => parsePattern('A/BC'), /inconsistent row width/)
assert.throws(() => parsePattern('AB C/D'), /inconsistent row count/)

assert.deepEqual(decodeMjirV1(compileXmlToMjir('<one values="B W" origin="True" in="WB" out="WW" symmetry="()"/>')), {
  version: 1,
  values: 'BW',
  nodes: [],
  rules: [{ op: 2, imx: 2, imy: 1, imz: 1, omx: 2, omy: 1, omz: 1, probability: 1, symmetry: '()', input: 'WB', output: 'WW' }],
})
assert.deepEqual(decodeMjirV1(compileXmlToMjir('<all values="BW" origin="True" in="WB" out="*W"/>')), {
  version: 1,
  values: 'BW',
  nodes: [{ kind: 2, steps: 0 }],
  rules: [{ op: 2, imx: 2, imy: 1, imz: 1, omx: 2, omy: 1, omz: 1, probability: 1, symmetry: '', input: 'WB', output: '*W' }],
})
assert.deepEqual(xmlRuleTags('<all><rule in="WB" out="WW"/><rule in="AW" out="AA" symmetry="()"/></all>').length, 2)
assert.deepEqual(decodeMjirV1(compileXmlToMjir('<all values="BWAD" origin="True" symmetry="(x)"><rule in="WB" out="WW"/><rule in="AW" out="AA" symmetry="()"/></all>')), {
  version: 1,
  values: 'BWAD',
  nodes: [{ kind: 2, steps: 0 }],
  rules: [
    { op: 2, imx: 2, imy: 1, imz: 1, omx: 2, omy: 1, omz: 1, probability: 1, symmetry: '(x)', input: 'WB', output: 'WW' },
    { op: 2, imx: 2, imy: 1, imz: 1, omx: 2, omy: 1, omz: 1, probability: 1, symmetry: '()', input: 'AW', output: 'AA' },
  ],
})
assert.deepEqual(decodeMjirV1(encodeMjirV1({
  values: 'BWA',
  rules: [{ op: 'pattern', input: 'WBB', output: 'WAW', symmetry: '' }],
})).rules[0], { op: 2, imx: 3, imy: 1, imz: 1, omx: 3, omy: 1, omz: 1, probability: 1, symmetry: '', input: 'WBB', output: 'WAW' })
assert.deepEqual(decodeMjirV1(compileXmlToMjir('<prl values="BGR"><rule in="B" out="G" p="0.01"/></prl>')), {
  version: 1,
  values: 'BGR',
  nodes: [{ kind: 3, steps: 0 }],
  rules: [{ op: 2, imx: 1, imy: 1, imz: 1, omx: 1, omy: 1, omz: 1, probability: 0.01, symmetry: '', input: 'B', output: 'G' }],
})
assert.deepEqual(xmlUnionTags('<sequence><union symbol="?" values="BR"/></sequence>').length, 1)
assert.deepEqual(xmlDirectChildTags('<sequence><sequence><one in="B" out="W"/></sequence></sequence>').map(xmlRootTag), ['sequence'])
assert.deepEqual(xmlChildNodeTags('<markov values="BRWU"><one in="RB" out="WR"/><one in="RW" out="UR"/></markov>').length, 2)
assert.deepEqual(decodeMjirV1(compileXmlToMjir('<markov values="BRWU" origin="True"><one in="RB" out="WR"/><one in="RW" out="UR"/></markov>')).nodes, [{ kind: 4, steps: 0 }, { kind: 1, steps: 0 }, { kind: 1, steps: 0 }])
assert.deepEqual(decodeMjirV1(compileXmlToMjir('<sequence values="BR"><one in="B" out="R" steps="24"/><all in="RB" out="BR"/></sequence>')).nodes, [{ kind: 5, steps: 0 }, { kind: 1, steps: 24 }, { kind: 2, steps: 0 }])
assert.deepEqual(decodeMjirV1(compileXmlToMjir('<sequence values="BRACDG"><union symbol="?" values="BR"/><one in="?" out="A"/></sequence>')).rules[0], { op: 101, symbol: '?', values: 'BR' })
assert.deepEqual(decodeMjirV1(compileXmlToMjir('<sequence values="BW"><markov><one in="B" out="W"/></markov></sequence>')).nodes, [{ kind: 5, steps: 0 }, { kind: 4, steps: 0 }, { kind: 1, steps: 0 }])
assert.deepEqual(decodeMjirV1(compileXmlToMjir('<one values="BRW" in="RBB" out="WWR" temperature="0.1"><field for="W" to="R" on="B" recompute="False"/></one>')).rules.slice(0, 2), [
  { op: 104, temperature: 0.1 },
  { op: 103, for: 'W', recompute: false, essential: false, to: 'R', from: '', on: 'B' },
])
assert.throws(() => compileXmlToMjir('<one values="BW" in="B" out="W"><field for="W"/></one>'), /child <field> missing on attribute/)
assert.deepEqual(decodeMjirV1(compileXmlToMjir('<sequence values="BW"><one in="B" out="W"><field for="W" to="B" on="B"/></one></sequence>')).rules[0], { op: 103, for: 'W', recompute: false, essential: false, to: 'B', from: '', on: 'B' })
assert.deepEqual(decodeMjirV1(compileXmlToMjir('<markov values="BRGW"><one in="RB" out="WR"><observe value="G" from="B" to="R"/><observe value="B" to="BW"/></one></markov>')).rules.slice(0, 2), [
  { op: 105, value: 'G', from: 'B', to: 'R' },
  { op: 105, value: 'B', from: '', to: 'BW' },
])
assert.throws(() => compileXmlToMjir('<one values="BW" file="Rule"/>'), /unsupported file attribute/)
assert.throws(() => compileXmlToMjir('<sequence values="BW"><union values="B"/><one in="B" out="W"/></sequence>'), /union missing symbol attribute/)
assert.throws(() => compileXmlToMjir('<map values="BW" in="B" out="W"/>'), /supports only root <one>\/<all>\/<prl>\/<markov>\/<sequence>/)
assert.throws(() => compileXmlToMjir('<one values="BW" out="W"/>'), /missing in attribute/)
assert.throws(() => compileXmlToMjir('<all values="BW"><rule out="W"/></all>'), /child <rule> missing in attribute/)

assert.deepEqual(initialGrid(2, 2, 1, 7), [7, 7, 7, 7])
assert.deepEqual(initialGridFromXml('<one values="BW"/>', 3, 3, 1), [0, 0, 0, 0, 0, 0, 0, 0, 0])
assert.deepEqual(initialGridFromXml('<one values="BW" origin="True"/>', 3, 3, 1), [0, 0, 0, 0, 1, 0, 0, 0, 0])
assert.deepEqual(initialGridFromXml('<one values="BW" origin="True"/>', 3, 3, 3).filter((cell) => cell === 1).length, 1)

assert.deepEqual(parseMjstate('MJSTATE 1\nsize 2 2 1\nlegend BW\nBW\nWB\n'), {
  width: 2,
  height: 2,
  depth: 1,
  values: 'BW',
  cells: [0, 1, 1, 0],
})
assert.deepEqual(parseMjstate('MJSTATE 1\nsize 2 1 2\nlegend BW\nz 0\nBW\nz 1\nWB\n'), {
  width: 2,
  height: 1,
  depth: 2,
  values: 'BW',
  cells: [0, 1, 1, 0],
})
assert.throws(() => parseMjstate('nope\n'), /not an MJSTATE 1 file/)

console.log('markov-junior compiler tests ok')
