import { runtime } from "/core/runtime.js"

function decodeOutput(result) {
  return new TextDecoder().decode(result?.output || new Uint8Array())
}

function unwrapResult(result, label) {
  if (result && Object.prototype.hasOwnProperty.call(result, "ok")) return result.ok
  if (result && Object.prototype.hasOwnProperty.call(result, "err")) throw new Error(`${label}: ${result.err}`)
  throw new Error(`${label}: expected WIT result object`)
}

export async function require2(path) {
  const readResult = unwrapResult(await runtime.invoke("fs/fs::read-file", [path]), `require failed "${path}"`)
  return await importJsFromBytes(new Uint8Array(readResult))
}

export async function require(path, runtimeHost = runtime) {
  const readResult = await runtimeHost.call('fs', 'read', path)
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
    /import\s+["'](\/[^"']+)["']/g,
    (_, path) => `import "${new URL(path, location.origin).href}"`
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

