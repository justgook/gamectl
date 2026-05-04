import { runtime } from "/core/runtime.js"

export async function require(path) {
  const readResult = await runtime.call('fs', 'read', path)
  if (readResult.returnCode !== 0) throw new Error(decodeOutput(readResult) || `fs.read failed for ${path}`)

  return await importJsFromBytes(readResult.output)
}

export async function importJsFromBytes(bytes) {
  let source = new TextDecoder().decode(bytes)

  source = source.replace(
    /from\s+["'](\/[^"']+)["']/g,
    (_, path) => `from "${new URL(path, location.origin).href}"`
  )

  source = source.replace(
    /import\s*\(\s*["'](\/[^"']+)["']\s*\)/g,
    (_, path) => `import("${new URL(path, location.origin).href}")`
  )

  const blob = new Blob([source], { type: "text/javascript" })
  const url = URL.createObjectURL(blob)

  try {
    return await import(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

