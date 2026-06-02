import { createProgram } from "./webgl/shader.js"
import { mat4LookAt, mat4Multiply, mat4Perspective } from "./webgl/mat4.js"

const CUBE_INDICES = new Uint16Array([
  0, 1, 2, 2, 1, 3,
  4, 5, 6, 6, 5, 7,
  8, 9, 10, 10, 9, 11,
  12, 13, 14, 14, 13, 15,
  16, 17, 18, 18, 17, 19,
  20, 21, 22, 22, 21, 23,
])

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function face(out, shade, a, b, c, d) {
  for (const p of [a, b, c, d]) out.push(p[0], p[1], p[2], shade)
}

function cubeVertices() {
  const out = []
  face(out, 1.18, [0, 1, 0], [0, 1, 1], [1, 1, 0], [1, 1, 1])
  face(out, 0.58, [0, 0, 1], [0, 0, 0], [1, 0, 1], [1, 0, 0])
  face(out, 0.86, [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1])
  face(out, 0.70, [1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0])
  face(out, 0.98, [1, 0, 1], [1, 0, 0], [1, 1, 1], [1, 1, 0])
  face(out, 0.76, [0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 1])
  return new Float32Array(out)
}

function defaultPalette() {
  const out = new Uint8Array(4)
  out[0] = 255
  out[1] = 0
  out[2] = 255
  out[3] = 255
  return out
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export class VoxelOrbitRenderer {
  constructor(canvas) {
    assert(canvas instanceof HTMLCanvasElement, "VoxelOrbitRenderer requires canvas")
    this.canvas = canvas
    this.gl = canvas.getContext("webgl2", { antialias: true, alpha: true })
    assert(this.gl, "VoxelOrbitRenderer requires WebGL2")

    this.bounds = { width: 1, height: 1, depth: 1 }
    this.instanceCount = 0
    this.paletteWidth = 1
    this.radius = 4
    this.yaw = Math.PI * 0.25
    this.pitch = Math.PI * 0.27
    this.target = [0.5, 0.5, 0.5]
    this.dragging = false
    this.dragStartX = 0
    this.dragStartY = 0
    this.dragStartYaw = 0
    this.dragStartPitch = 0

    this._onPointerDown = this._onPointerDown.bind(this)
    this._onPointerMove = this._onPointerMove.bind(this)
    this._onPointerUp = this._onPointerUp.bind(this)
    this._onWheel = this._onWheel.bind(this)

    this._initGl()
    this.setPalette(defaultPalette(), 1)
    this.attachControls()
  }

  _initGl() {
    const gl = this.gl
    this.program = createProgram(
      gl,
      `#version 300 es
        precision highp float;
        layout(location=0) in vec3 a_pos;
        layout(location=1) in float a_shade;
        layout(location=2) in vec4 a_instance;
        uniform mat4 u_viewProj;
        flat out int v_colorIndex;
        out float v_shade;
        void main() {
          vec3 world = a_pos + a_instance.xyz;
          gl_Position = u_viewProj * vec4(world, 1.0);
          v_colorIndex = int(a_instance.w + 0.5);
          v_shade = a_shade;
        }
      `,
      `#version 300 es
        precision highp float;
        uniform sampler2D u_palette;
        flat in int v_colorIndex;
        in float v_shade;
        out vec4 outColor;
        void main() {
          vec4 color = texelFetch(u_palette, ivec2(v_colorIndex, 0), 0);
          if (color.a < 0.001) discard;
          outColor = vec4(color.rgb * v_shade, color.a);
        }
      `,
    )

    this.vao = gl.createVertexArray()
    this.vertexBuffer = gl.createBuffer()
    this.indexBuffer = gl.createBuffer()
    this.instanceBuffer = gl.createBuffer()
    this.paletteTexture = gl.createTexture()
    assert(this.vao && this.vertexBuffer && this.indexBuffer && this.instanceBuffer && this.paletteTexture, "VoxelOrbitRenderer failed to allocate GL resources")

    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, cubeVertices(), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 16, 12)

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, CUBE_INDICES, gl.STATIC_DRAW)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer)
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 16, 0)
    gl.vertexAttribDivisor(2, 1)
    gl.bindVertexArray(null)

    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
  }

  attachControls() {
    this.canvas.addEventListener("pointerdown", this._onPointerDown)
    this.canvas.addEventListener("pointermove", this._onPointerMove)
    this.canvas.addEventListener("pointerup", this._onPointerUp)
    this.canvas.addEventListener("pointercancel", this._onPointerUp)
    this.canvas.addEventListener("wheel", this._onWheel, { passive: false })
  }

  detachControls() {
    this.canvas.removeEventListener("pointerdown", this._onPointerDown)
    this.canvas.removeEventListener("pointermove", this._onPointerMove)
    this.canvas.removeEventListener("pointerup", this._onPointerUp)
    this.canvas.removeEventListener("pointercancel", this._onPointerUp)
    this.canvas.removeEventListener("wheel", this._onWheel)
  }

  setPalette(bytes, width = bytes.byteLength / 4) {
    assert(bytes instanceof Uint8Array, "VoxelOrbitRenderer palette must be Uint8Array")
    assert(Number.isInteger(width) && width > 0, "VoxelOrbitRenderer palette width must be positive integer")
    assert(bytes.byteLength >= width * 4, "VoxelOrbitRenderer palette bytes too short")
    this.paletteWidth = width
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, this.paletteTexture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes.subarray(0, width * 4))
  }

  setInstances({ bounds, instances, palette, paletteWidth } = {}) {
    assert(bounds && typeof bounds === "object", "VoxelOrbitRenderer setInstances requires bounds")
    assert(instances instanceof Float32Array, "VoxelOrbitRenderer instances must be Float32Array")
    assert(instances.length % 4 === 0, "VoxelOrbitRenderer instance data must be vec4 records")
    const nextBounds = {
      width: Number(bounds.width),
      height: Number(bounds.height),
      depth: Number(bounds.depth),
    }
    assert(Number.isFinite(nextBounds.width) && nextBounds.width > 0, "VoxelOrbitRenderer invalid bounds.width")
    assert(Number.isFinite(nextBounds.height) && nextBounds.height > 0, "VoxelOrbitRenderer invalid bounds.height")
    assert(Number.isFinite(nextBounds.depth) && nextBounds.depth > 0, "VoxelOrbitRenderer invalid bounds.depth")
    const boundsChanged = this.bounds.width !== nextBounds.width || this.bounds.height !== nextBounds.height || this.bounds.depth !== nextBounds.depth
    this.bounds = nextBounds
    this.instanceCount = instances.length / 4
    const gl = this.gl
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, instances, gl.DYNAMIC_DRAW)
    if (palette) this.setPalette(palette, paletteWidth || palette.byteLength / 4)
    if (boundsChanged) this.fit()
    else this.render()
  }

  fit() {
    const w = this.bounds.width
    const h = this.bounds.height
    const d = this.bounds.depth
    this.target = [w / 2, h / 2, d / 2]
    this.radius = Math.max(2, Math.hypot(w, h, d) * 1.35)
    this.render()
  }

  zoom(factor) {
    this.radius = clamp(this.radius * factor, 1, 10000)
    this.render()
  }

  resize(width, height) {
    const w = Math.max(1, Math.round(width))
    const h = Math.max(1, Math.round(height))
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }
    this.render()
  }

  render() {
    const gl = this.gl
    const width = Math.max(1, this.canvas.width)
    const height = Math.max(1, this.canvas.height)
    gl.viewport(0, 0, width, height)
    gl.clearColor(0.043, 0.098, 0.133, 1)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    if (this.instanceCount === 0) return

    const cp = Math.cos(this.pitch)
    const sp = Math.sin(this.pitch)
    const cy = Math.cos(this.yaw)
    const sy = Math.sin(this.yaw)
    const eye = [
      this.target[0] + this.radius * cp * sy,
      this.target[1] + this.radius * sp,
      this.target[2] + this.radius * cp * cy,
    ]
    const view = mat4LookAt(eye, this.target, [0, 1, 0])
    const proj = mat4Perspective(Math.PI / 4, width / height, Math.max(0.01, this.radius / 200), this.radius * 10 + 100)
    const viewProj = mat4Multiply(proj, view)

    gl.useProgram(this.program)
    gl.bindVertexArray(this.vao)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.paletteTexture)
    gl.uniform1i(gl.getUniformLocation(this.program, "u_palette"), 0)
    gl.uniformMatrix4fv(gl.getUniformLocation(this.program, "u_viewProj"), false, viewProj)
    gl.drawElementsInstanced(gl.TRIANGLES, CUBE_INDICES.length, gl.UNSIGNED_SHORT, 0, this.instanceCount)
    gl.bindVertexArray(null)
  }

  dispose() {
    this.detachControls()
    const gl = this.gl
    gl.deleteTexture(this.paletteTexture)
    gl.deleteBuffer(this.instanceBuffer)
    gl.deleteBuffer(this.indexBuffer)
    gl.deleteBuffer(this.vertexBuffer)
    gl.deleteVertexArray(this.vao)
    gl.deleteProgram(this.program)
  }

  _onPointerDown(event) {
    this.dragging = true
    this.dragStartX = event.clientX
    this.dragStartY = event.clientY
    this.dragStartYaw = this.yaw
    this.dragStartPitch = this.pitch
    this.canvas.setPointerCapture(event.pointerId)
  }

  _onPointerMove(event) {
    if (!this.dragging) return
    this.yaw = this.dragStartYaw - (event.clientX - this.dragStartX) * 0.01
    this.pitch = clamp(this.dragStartPitch + (event.clientY - this.dragStartY) * 0.01, -Math.PI * 0.48, Math.PI * 0.48)
    this.render()
  }

  _onPointerUp(event) {
    this.dragging = false
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId)
  }

  _onWheel(event) {
    event.preventDefault()
    this.zoom(event.deltaY < 0 ? 0.9 : 1.1)
  }
}
