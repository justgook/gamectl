export function createWriteInput(path, data) {
  console.log("createWriteInput", data, data instanceof Uint8Array)
  const pathBytes = new TextEncoder().encode(path)
  const dataBytes = data instanceof Uint8Array ? data : new TextEncoder().encode(data)

  // Combine: path + null byte + data
  const input = new Uint8Array(pathBytes.length + 1 + dataBytes.length)
  input.set(pathBytes, 0)
  input[pathBytes.length] = 0 // null byte separator
  input.set(dataBytes, pathBytes.length + 1)

  return input
}

