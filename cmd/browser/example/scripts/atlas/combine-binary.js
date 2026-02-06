// Combine atlas UVs (magic 1) and animations (magic 2) into single file
// Each section starts with its magic number, so decoder can parse sequentially

const atlasBytes = Uint8Array.fromBase64($in.atlasBinary)
const animBytes = Uint8Array.fromBase64($in.animBinary)

// Concatenate: [atlas section][animation section]
const combined = new Uint8Array(atlasBytes.length + animBytes.length)
combined.set(atlasBytes, 0)
combined.set(animBytes, atlasBytes.length)

$out.binary = combined.toBase64()
$out.metadata = {
  atlasSize: atlasBytes.length,
  animSize: animBytes.length,
  totalSize: combined.length
}
