function assert(condition, message) {
  if (!condition) throw new Error(message)
}

export function createShader(gl, type, source) {
  const shader = gl.createShader(type)
  assert(shader, "webgl shader creation failed")
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || "unknown shader compile error"
    gl.deleteShader(shader)
    throw new Error(info)
  }
  return shader
}

export function createProgram(gl, vertexSource, fragmentSource) {
  const vertex = createShader(gl, gl.VERTEX_SHADER, vertexSource)
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
  const program = gl.createProgram()
  assert(program, "webgl program creation failed")
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || "unknown program link error"
    gl.deleteProgram(program)
    throw new Error(info)
  }
  return program
}
