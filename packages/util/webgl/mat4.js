export function mat4Identity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
}

export function mat4Multiply(a, b) {
  const out = new Float32Array(16)
  for (let c = 0; c < 4; c += 1) {
    for (let r = 0; r < 4; r += 1) {
      out[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0] +
        a[1 * 4 + r] * b[c * 4 + 1] +
        a[2 * 4 + r] * b[c * 4 + 2] +
        a[3 * 4 + r] * b[c * 4 + 3]
    }
  }
  return out
}

export function mat4Perspective(fovyRadians, aspect, near, far) {
  const f = 1 / Math.tan(fovyRadians / 2)
  const nf = 1 / (near - far)
  const out = new Float32Array(16)
  out[0] = f / aspect
  out[5] = f
  out[10] = (far + near) * nf
  out[11] = -1
  out[14] = 2 * far * near * nf
  return out
}

function normalize(v) {
  const length = Math.hypot(v[0], v[1], v[2])
  if (length === 0) return [0, 0, 0]
  return [v[0] / length, v[1] / length, v[2] / length]
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

export function mat4LookAt(eye, center, up) {
  const z = normalize([eye[0] - center[0], eye[1] - center[1], eye[2] - center[2]])
  const x = normalize(cross(up, z))
  const y = cross(z, x)
  const out = mat4Identity()
  out[0] = x[0]
  out[1] = y[0]
  out[2] = z[0]
  out[4] = x[1]
  out[5] = y[1]
  out[6] = z[1]
  out[8] = x[2]
  out[9] = y[2]
  out[10] = z[2]
  out[12] = -dot(x, eye)
  out[13] = -dot(y, eye)
  out[14] = -dot(z, eye)
  return out
}
