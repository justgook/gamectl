import { runtime, unwrap } from "/core/runtime.js"
import { ViewCanvasBase } from "/util/view-canvas-base.js"

const VIEW_WIDTH = 480
const VIEW_HEIGHT = 640
const ROOT_X = VIEW_WIDTH / 2
const ROOT_Y = 72
const DEFAULT_TARGET_X = VIEW_WIDTH / 2
const DEFAULT_TARGET_Y = VIEW_HEIGHT - 72
const MAX_INSTRUCTIONS_PER_TICK = 2048
const MAX_BULLETS = 4096

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function basename(path) {
  const parts = String(path).split("/")
  return parts[parts.length - 1] || "new.gbml.json"
}

function errorMessage(error) {
  if (error instanceof Error) return error.message
  return String(error)
}

function requireObject(value, name) {
  assert(
    value && typeof value === "object" && !Array.isArray(value),
    `${name} must be an object`,
  )
  return value
}

function requireArray(value, name) {
  assert(Array.isArray(value), `${name} must be an array`)
  return value
}

function createEmptyGbml() {
  return {
    format: "gams.gbml",
    version: 1,
    source: {
      language: "bulletml-0.21",
      orientation: "vertical",
    },
    compatibility: {
      semantics: "gams-corrected-v1",
    },
    entrypoints: [],
    definitions: {
      actions: [],
      bullets: [],
      fires: [],
    },
    expressions: [],
  }
}

function stringifyGbml(gbml) {
  return `${JSON.stringify(gbml, null, 2)}\n`
}

function summarizeGbml(gbml) {
  requireObject(gbml, "gbml")
  assert(gbml.format === "gams.gbml", "gbml.format must be gams.gbml")
  assert(gbml.version === 1, "gbml.version must be 1")
  const source = requireObject(gbml.source, "gbml.source")
  const compatibility = requireObject(gbml.compatibility, "gbml.compatibility")
  const definitions = requireObject(gbml.definitions, "gbml.definitions")
  const entrypoints = requireArray(gbml.entrypoints, "gbml.entrypoints")
  const actions = requireArray(definitions.actions, "gbml.definitions.actions")
  const bullets = requireArray(definitions.bullets, "gbml.definitions.bullets")
  const fires = requireArray(definitions.fires, "gbml.definitions.fires")
  const expressions = requireArray(gbml.expressions, "gbml.expressions")

  return [
    `format: ${gbml.format} v${gbml.version}`,
    `source: ${source.language} (${source.orientation})`,
    `semantics: ${compatibility.semantics}`,
    `entrypoints: ${entrypoints.length}`,
    `actions: ${actions.length}`,
    `bullets: ${bullets.length}`,
    `fires: ${fires.length}`,
    `expressions: ${expressions.length}`,
  ].join("\n")
}

function degToRad(degrees) {
  return (degrees * Math.PI) / 180
}

function velocityFromDirection(direction, speed) {
  const radians = degToRad(direction)
  return {
    x: Math.sin(radians) * speed,
    y: -Math.cos(radians) * speed,
  }
}

function directionToPoint(fromX, fromY, toX, toY) {
  return (Math.atan2(toX - fromX, -(toY - fromY)) * 180) / Math.PI
}

function normalizeDirection(direction) {
  const normalized = direction % 360
  return normalized < 0 ? normalized + 360 : normalized
}

function createFrame(action, params = [], repeat = 1) {
  assert(action && Array.isArray(action.ops), "GBML action frame requires ops")
  return { ops: action.ops, pc: 0, params, repeat }
}

class BulletMLEngine {
  constructor() {
    this.gbml = null
    this.expressions = []
    this.actions = new Map()
    this.bullets = new Map()
    this.fires = new Map()
    this.entities = []
    this.frame = 0
    this.spawned = 0
    this.vanished = 0
    this.rank = 0.5
    this.seed = 1
    this.targetX = DEFAULT_TARGET_X
    this.targetY = DEFAULT_TARGET_Y
    this.running = false
    this.lastInstructionCount = 0
  }

  load(gbml) {
    summarizeGbml(gbml)
    this.gbml = gbml
    this.expressions = gbml.expressions
    this.actions = this.mapDefinitions(gbml.definitions.actions, "action")
    this.bullets = this.mapDefinitions(gbml.definitions.bullets, "bullet")
    this.fires = this.mapDefinitions(gbml.definitions.fires, "fire")
    this.reset()
  }

  mapDefinitions(definitions, kind) {
    const map = new Map()
    for (const definition of definitions) {
      assert(typeof definition.id === "string" && definition.id.length > 0, `${kind} definition requires id`)
      assert(!map.has(definition.id), `duplicate ${kind} definition id ${definition.id}`)
      map.set(definition.id, definition)
      if (definition.label) {
        const labelID = `${kind}:${definition.label}`
        const existing = map.get(labelID)
        assert(
          !existing || existing === definition,
          `duplicate ${kind} definition label ${definition.label}`,
        )
        map.set(labelID, definition)
      }
    }
    return map
  }

  reset() {
    this.entities = []
    this.frame = 0
    this.spawned = 0
    this.vanished = 0
    this.seed = 1
    this.lastInstructionCount = 0
    if (!this.gbml) return
    for (const [index, entrypoint] of this.gbml.entrypoints.entries()) {
      const action = this.resolveAction(entrypoint.action)
      this.entities.push({
        id: index,
        visible: false,
        x: ROOT_X,
        y: ROOT_Y,
        direction: 180,
        speed: 0,
        accelX: 0,
        accelY: 0,
        wait: 0,
        alive: true,
        lastFireDirection: 180,
        lastFireSpeed: 1,
        frames: [createFrame(action)],
        dirTween: null,
        speedTween: null,
        accelTween: null,
      })
    }
  }

  step() {
    if (!this.gbml) return
    this.frame += 1
    this.lastInstructionCount = 0
    const entities = [...this.entities]
    for (const entity of entities) {
      if (!entity.alive) continue
      this.updateTweens(entity)
      this.moveEntity(entity)
      this.runEntity(entity)
      if (entity.visible && this.isOutOfBounds(entity)) this.kill(entity)
    }
    this.entities = this.entities.filter((entity) => entity.alive)
  }

  updateTweens(entity) {
    this.updateTween(entity, "direction", "dirTween")
    this.updateTween(entity, "speed", "speedTween")
    if (entity.accelTween) {
      const tween = entity.accelTween
      if (tween.remaining <= 0) {
        entity.accelX = tween.targetX
        entity.accelY = tween.targetY
        entity.accelTween = null
      } else {
        entity.accelX += (tween.targetX - entity.accelX) / tween.remaining
        entity.accelY += (tween.targetY - entity.accelY) / tween.remaining
        tween.remaining -= 1
      }
    }
  }

  updateTween(entity, field, tweenField) {
    const tween = entity[tweenField]
    if (!tween) return
    if (tween.remaining <= 0) {
      entity[field] = tween.target
      entity[tweenField] = null
      return
    }
    entity[field] += (tween.target - entity[field]) / tween.remaining
    tween.remaining -= 1
  }

  moveEntity(entity) {
    if (!entity.visible) return
    entity.x += entity.accelX
    entity.y += entity.accelY
    const velocity = velocityFromDirection(entity.direction, entity.speed)
    entity.x += velocity.x
    entity.y += velocity.y
  }

  runEntity(entity) {
    if (entity.wait > 0) {
      entity.wait -= 1
      return
    }

    while (entity.alive && entity.frames.length > 0) {
      this.lastInstructionCount += 1
      assert(
        this.lastInstructionCount <= MAX_INSTRUCTIONS_PER_TICK,
        "GBML runner exceeded max instructions in one frame",
      )
      const frame = entity.frames[entity.frames.length - 1]
      if (frame.pc >= frame.ops.length) {
        if (frame.repeat > 1) {
          frame.repeat -= 1
          frame.pc = 0
          continue
        }
        entity.frames.pop()
        continue
      }
      const op = frame.ops[frame.pc]
      frame.pc += 1
      const paused = this.executeOp(entity, frame, op)
      if (paused) return
    }
  }

  executeOp(entity, frame, op) {
    assert(op && typeof op.op === "string", "GBML op requires op string")
    if (op.op === "wait") {
      entity.wait = Math.max(0, Math.floor(this.evalExpr(op.expr, frame.params)))
      return true
    }
    if (op.op === "vanish") {
      this.kill(entity)
      return true
    }
    if (op.op === "fire") {
      this.fire(entity, op.fire, frame.params)
      return false
    }
    if (op.op === "fireRef") {
      const ref = this.evalRef(op.fireRef, frame.params)
      this.fire(entity, this.resolveFire(`fire:${ref.label}`), ref.params)
      return false
    }
    if (op.op === "action") {
      entity.frames.push(createFrame(op.action, frame.params))
      return false
    }
    if (op.op === "actionRef") {
      const ref = this.evalRef(op.actionRef, frame.params)
      entity.frames.push(createFrame(this.resolveAction(`action:${ref.label}`), ref.params))
      return false
    }
    if (op.op === "repeat") {
      const repeat = Math.max(0, Math.floor(this.evalExpr(op.times, frame.params)))
      if (repeat <= 0) return false
      if (op.action) entity.frames.push(createFrame(op.action, frame.params, repeat))
      else if (op.actionRef) {
        const ref = this.evalRef(op.actionRef, frame.params)
        entity.frames.push(createFrame(this.resolveAction(`action:${ref.label}`), ref.params, repeat))
      } else throw new Error("GBML repeat requires action or actionRef")
      return false
    }
    if (op.op === "changeDirection") {
      const target = this.resolveDirection(entity, op.direction, frame.params)
      const term = Math.max(0, Math.floor(this.evalExpr(op.term, frame.params)))
      entity.dirTween = { target, remaining: term }
      return false
    }
    if (op.op === "changeSpeed") {
      const target = this.resolveSpeed(entity, op.speed, frame.params)
      const term = Math.max(0, Math.floor(this.evalExpr(op.term, frame.params)))
      entity.speedTween = { target, remaining: term }
      return false
    }
    if (op.op === "accel") {
      const targetX = op.horizontal ? this.resolveAxis(entity.accelX, op.horizontal, frame.params) : entity.accelX
      const targetY = op.vertical ? this.resolveAxis(entity.accelY, op.vertical, frame.params) : entity.accelY
      const term = Math.max(0, Math.floor(this.evalExpr(op.term, frame.params)))
      entity.accelTween = { targetX, targetY, remaining: term }
      return false
    }
    throw new Error(`unsupported GBML op ${op.op}`)
  }

  fire(parent, fireSpec, params) {
    assert(this.entities.length < MAX_BULLETS, "GBML runner exceeded max bullets")
    assert(fireSpec && fireSpec.bullet, "GBML fire requires bullet")
    const direction = this.resolveDirection(parent, fireSpec.direction, params)
    const speed = this.resolveSpeed(parent, fireSpec.speed, params)
    const bullet = this.resolveBulletUse(fireSpec.bullet, params)
    const child = {
      id: this.spawned + 1,
      visible: true,
      x: parent.x,
      y: parent.y,
      direction,
      speed,
      accelX: 0,
      accelY: 0,
      wait: 0,
      alive: true,
      lastFireDirection: direction,
      lastFireSpeed: speed,
      frames: this.createBulletFrames(bullet.definition, bullet.params),
      dirTween: null,
      speedTween: null,
      accelTween: null,
    }
    this.applyBulletInitializers(parent, child, bullet.definition, bullet.params)
    parent.lastFireDirection = direction
    parent.lastFireSpeed = speed
    this.spawned += 1
    this.entities.push(child)
  }

  createBulletFrames(bullet, params) {
    const frames = []
    for (const actionUse of bullet.actions || []) {
      if (actionUse.kind === "action") frames.push(createFrame(actionUse.action, params))
      else if (actionUse.kind === "actionRef") {
        const ref = this.evalRef(actionUse.ref, params)
        frames.push(createFrame(this.resolveAction(`action:${ref.label}`), ref.params))
      } else throw new Error(`unsupported bullet action kind ${actionUse.kind}`)
    }
    return frames
  }

  applyBulletInitializers(parent, child, bullet, params) {
    if (bullet.direction) child.direction = this.resolveDirection(parent, bullet.direction, params)
    if (bullet.speed) child.speed = this.resolveSpeed(parent, bullet.speed, params)
  }

  resolveBulletUse(bulletUse, params) {
    if (bulletUse.kind === "bullet") return { definition: bulletUse.bullet, params }
    if (bulletUse.kind === "bulletRef") {
      const ref = this.evalRef(bulletUse.ref, params)
      return { definition: this.resolveBullet(`bullet:${ref.label}`), params: ref.params }
    }
    throw new Error(`unsupported bullet use kind ${bulletUse.kind}`)
  }

  resolveDirection(entity, valueRef, params) {
    if (!valueRef) return directionToPoint(entity.x, entity.y, this.targetX, this.targetY)
    const value = this.evalExpr(valueRef.expr, params)
    if (valueRef.mode === "aim") return normalizeDirection(directionToPoint(entity.x, entity.y, this.targetX, this.targetY) + value)
    if (valueRef.mode === "absolute") return normalizeDirection(value)
    if (valueRef.mode === "relative") return normalizeDirection(entity.direction + value)
    if (valueRef.mode === "sequence") return normalizeDirection(entity.lastFireDirection + value)
    throw new Error(`unsupported direction mode ${valueRef.mode}`)
  }

  resolveSpeed(entity, valueRef, params) {
    if (!valueRef) return 1
    const value = this.evalExpr(valueRef.expr, params)
    if (valueRef.mode === "absolute") return value
    if (valueRef.mode === "relative") return entity.speed + value
    if (valueRef.mode === "sequence") return entity.lastFireSpeed + value
    throw new Error(`unsupported speed mode ${valueRef.mode}`)
  }

  resolveAxis(current, valueRef, params) {
    const value = this.evalExpr(valueRef.expr, params)
    if (valueRef.mode === "absolute") return value
    if (valueRef.mode === "relative") return current + value
    if (valueRef.mode === "sequence") return current + value
    throw new Error(`unsupported accel mode ${valueRef.mode}`)
  }

  evalRef(ref, params) {
    assert(ref && typeof ref.label === "string" && ref.label.length > 0, "GBML ref requires label")
    return {
      label: ref.label,
      params: (ref.params || []).map((expr) => this.evalExpr(expr, params)),
    }
  }

  evalExpr(exprID, params) {
    assert(Number.isInteger(exprID), "GBML expression id must be integer")
    const expression = this.expressions[exprID]
    assert(expression, `GBML missing expression ${exprID}`)
    const source = String(expression.source).trim()
    assert(source.length > 0, `GBML expression ${exprID} must not be empty`)
    const rewritten = source.replace(/\$(\d+|rand|rank)/g, (_match, name) => {
      if (name === "rand") return `(${this.random()})`
      if (name === "rank") return `(${this.rank})`
      const index = Number(name) - 1
      assert(index >= 0 && index < params.length, `GBML expression ${exprID} missing parameter $${name}`)
      return `(${params[index]})`
    })
    assert(
      /^[0-9+\-*/%().\s]+$/.test(rewritten),
      `GBML expression ${exprID} contains unsupported syntax: ${source}`,
    )
    const value = Function(`"use strict"; return (${rewritten})`)()
    assert(Number.isFinite(value), `GBML expression ${exprID} did not produce finite number`)
    return value
  }

  random() {
    this.seed = (1664525 * this.seed + 1013904223) >>> 0
    return this.seed / 0x100000000
  }

  resolveAction(id) {
    const action = this.actions.get(id)
    assert(action, `GBML missing action ${id}`)
    return action
  }

  resolveBullet(id) {
    const bullet = this.bullets.get(id)
    assert(bullet, `GBML missing bullet ${id}`)
    return bullet
  }

  resolveFire(id) {
    const fire = this.fires.get(id)
    assert(fire, `GBML missing fire ${id}`)
    return fire
  }

  kill(entity) {
    if (!entity.alive) return
    entity.alive = false
    this.vanished += 1
  }

  isOutOfBounds(entity) {
    return entity.x < -96 || entity.x > VIEW_WIDTH + 96 || entity.y < -96 || entity.y > VIEW_HEIGHT + 96
  }

  visibleBullets() {
    return this.entities.filter((entity) => entity.alive && entity.visible)
  }

  isScriptActive(entity) {
    return entity.alive && (entity.wait > 0 || entity.frames.length > 0)
  }

  isSpawningDone() {
    return !this.entities.some((entity) => this.isScriptActive(entity))
  }

  isSimulationDone() {
    return this.isSpawningDone() && this.visibleBullets().length === 0
  }

  phase() {
    if (this.isSimulationDone()) return "finished"
    if (this.isSpawningDone()) return "draining"
    return "running"
  }

  stats() {
    return {
      frame: this.frame,
      alive: this.visibleBullets().length,
      spawned: this.spawned,
      vanished: this.vanished,
      instructions: this.lastInstructionCount,
      phase: this.phase(),
    }
  }
}

export class ViewBullet extends ViewCanvasBase {
  static get observedAttributes() {
    return ["data-source"]
  }

  constructor() {
    super()
    this.sourcePath = ""
    this.gbml = null
    this.programText = ""
    this.dirty = false
    this.engine = new BulletMLEngine()
    this.summaryOutput = null
    this.pathOutput = null
    this.dirtyOutput = null
    this.statusOutput = null
    this.statsOutput = null
    this._animationFrame = 0
    this._animationToken = 0
    this._lastAnimationTime = 0
    this._ready = false
    this._headerControlsBound = false
    this._lastPlayPausePointerDown = -Infinity
    this._draggingTarget = false
    this._animate = this._animate.bind(this)
  }

  connectedCallback() {
    if (!this._ready) {
      const config = this.config
      const configSource = config && typeof config === "object" ? config.defaultSource : undefined
      const attrSource = this.getAttribute("data-source")
      assert(
        (typeof attrSource === "string" && attrSource.trim().length > 0) ||
          (typeof configSource === "string" && configSource.trim().length > 0),
        "view-bullet requires data-source or config.defaultSource",
      )
      this.sourcePath = String(attrSource || configSource).trim()
      this.autoFitOnLoad = true
      this.innerHTML = `
        <canvas data-element="canvas"></canvas>
        <footer>
          <output data-element="path"></output>
          <output data-element="dirty"></output>
          <output data-element="stats"></output>
          <output data-element="status">Loading...</output>
          <pre data-element="summary">Loading GBML...</pre>
        </footer>
      `
      this.summaryOutput = this.querySelector('[data-element="summary"]')
      this.pathOutput = this.querySelector('[data-element="path"]')
      this.dirtyOutput = this.querySelector('[data-element="dirty"]')
      this.statusOutput = this.querySelector('[data-element="status"]')
      this.statsOutput = this.querySelector('[data-element="stats"]')
      assert(this.summaryOutput instanceof HTMLPreElement, "view-bullet missing summary output")
      assert(this.pathOutput instanceof HTMLOutputElement, "view-bullet missing path output")
      assert(this.dirtyOutput instanceof HTMLOutputElement, "view-bullet missing dirty output")
      assert(this.statusOutput instanceof HTMLOutputElement, "view-bullet missing status output")
      assert(this.statsOutput instanceof HTMLOutputElement, "view-bullet missing stats output")
      this._ready = true
    }
    super.connectedCallback()
    this.updateFooter()
    void this.load()
  }

  disconnectedCallback() {
    this.stopPlayback()
    super.disconnectedCallback()
    this._headerControlsBound = false
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return
    if (name !== "data-source") return
    this.sourcePath = String(newValue || "").trim()
    if (!this._ready) return
    assert(this.sourcePath.length > 0, "view-bullet data-source must not be empty")
    this.updateFooter()
    void this.load()
  }

  createHeaderControlsElement() {
    const controls = document.createElement("div")
    controls.dataset.element = "header-controls"
    controls.innerHTML = `
      <div role="buttongroup" data-element="file-actions">
        <button type="button" data-action="new" aria-label="New GBML" title="New GBML"><i aria-hidden="true">docs</i></button>
        <button type="button" data-action="open" aria-label="Open GBML" title="Open GBML"><i aria-hidden="true">folder_open</i></button>
        <button type="button" data-action="save" class="accent" aria-label="Save GBML" title="Save GBML"><i aria-hidden="true">save</i></button>
        <button type="button" data-action="save-as" aria-label="Save GBML as" title="Save GBML as"><i aria-hidden="true">save_as</i></button>
        <button type="button" data-action="reload" aria-label="Reload GBML" title="Reload GBML"><i aria-hidden="true">refresh</i></button>
      </div>
      <div role="buttongroup" data-element="tool-actions">
        <button type="button" data-action="edit" aria-label="Edit GBML JSON" title="Edit GBML JSON"><i aria-hidden="true">edit</i></button>
        <button type="button" data-action="restart" aria-label="Restart preview" title="Restart preview"><i aria-hidden="true">restart_alt</i></button>
        <button type="button" data-action="play-pause" aria-label="Play preview" title="Play preview" aria-pressed="false"><i aria-hidden="true">play_arrow</i></button>
        <button type="button" data-action="step" aria-label="Step one frame" title="Step one frame"><i aria-hidden="true">skip_next</i></button>
      </div>
      <div role="buttongroup" data-element="view-actions">
        <button type="button" data-action="zoom-in" aria-label="Zoom In" title="Zoom In"><i aria-hidden="true">zoom_in</i></button>
        <button type="button" data-action="zoom-out" aria-label="Zoom Out" title="Zoom Out"><i aria-hidden="true">zoom_out</i></button>
        <button type="button" data-action="zoom-fit" aria-label="Fit View" title="Fit View"><i aria-hidden="true">fit_screen</i></button>
      </div>
    `
    queueMicrotask(() => this.bindHeaderControls())
    return controls
  }

  bindHeaderControls() {
    if (this._headerControlsBound) return
    this._headerControlsBound = true
    this.headerButton("new").addEventListener("click", () => void this.new())
    this.headerButton("open").addEventListener("click", () => void this.open())
    this.headerButton("save").addEventListener("click", () => void this.save())
    this.headerButton("save-as").addEventListener("click", () => void this.saveAs())
    this.headerButton("reload").addEventListener("click", () => void this.reload())
    this.headerButton("edit").addEventListener("click", () => void this.edit())
    this.headerButton("restart").addEventListener("click", (event) => {
      event.preventDefault()
      this.restartPreview()
    })
    const playPauseButton = this.headerButton("play-pause")
    playPauseButton.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return
      event.preventDefault()
      this._lastPlayPausePointerDown = performance.now()
      this.togglePlayback()
    })
    playPauseButton.addEventListener("click", (event) => {
      event.preventDefault()
      if (event.detail > 0 && performance.now() - this._lastPlayPausePointerDown < 1000) return
      this.togglePlayback()
    })
    this.headerButton("step").addEventListener("click", (event) => {
      event.preventDefault()
      this.stepPreview()
    })
    this.headerButton("zoom-in").addEventListener("click", () => this.zoomIn())
    this.headerButton("zoom-out").addEventListener("click", () => this.zoomOut())
    this.headerButton("zoom-fit").addEventListener("click", () => this.zoomFit())
    this.renderHeaderControls()
  }

  headerButton(action) {
    const element = this.queryHeaderControl(`[data-action="${action}"]`)
    assert(element instanceof HTMLButtonElement, `view-bullet missing ${action} header button`)
    return element
  }

  renderHeaderControls() {
    if (!this._headerControlsElement) return
    const hasProgram = this.gbml !== null
    const hasPath = this.sourcePath.length > 0
    this.headerButton("save").disabled = !hasProgram || !hasPath
    this.headerButton("save-as").disabled = !hasProgram
    this.headerButton("reload").disabled = !hasPath
    this.headerButton("edit").disabled = !hasPath
    this.headerButton("restart").disabled = !hasProgram
    this.headerButton("play-pause").disabled = !hasProgram
    this.headerButton("step").disabled = !hasProgram
    const playbackButton = this.headerButton("play-pause")
    const playIcon = playbackButton.querySelector("i")
    assert(playIcon instanceof HTMLElement, "view-bullet play-pause button missing icon")
    const running = this.engine.running
    playIcon.textContent = running ? "pause" : "play_arrow"
    playbackButton.setAttribute("aria-pressed", running ? "true" : "false")
    playbackButton.setAttribute("aria-label", running ? "Pause preview" : "Play preview")
    playbackButton.setAttribute("title", running ? "Pause preview" : "Play preview")
  }

  calculateContentBounds(_data) {
    return { minX: 0, minY: 0, maxX: VIEW_WIDTH, maxY: VIEW_HEIGHT }
  }

  drawContent(ctx, _data) {
    const visibleMinX = -this.offsetX / this.scale
    const visibleMinY = -this.offsetY / this.scale
    const visibleWidth = this.canvas.width / this.scale
    const visibleHeight = this.canvas.height / this.scale
    ctx.fillStyle = "#08131a"
    ctx.fillRect(visibleMinX, visibleMinY, visibleWidth, visibleHeight)

    ctx.fillStyle = "#54d6ff"
    ctx.beginPath()
    ctx.arc(ROOT_X, ROOT_Y, 5, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = "#6aff88"
    ctx.beginPath()
    ctx.moveTo(this.engine.targetX - 8, this.engine.targetY)
    ctx.lineTo(this.engine.targetX + 8, this.engine.targetY)
    ctx.moveTo(this.engine.targetX, this.engine.targetY - 8)
    ctx.lineTo(this.engine.targetX, this.engine.targetY + 8)
    ctx.stroke()

    for (const bullet of this.engine.visibleBullets()) {
      ctx.fillStyle = "#ff6688"
      ctx.beginPath()
      ctx.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2)
      ctx.fill()
      const velocity = velocityFromDirection(bullet.direction, 8)
      ctx.strokeStyle = "#ffd1dc"
      ctx.beginPath()
      ctx.moveTo(bullet.x, bullet.y)
      ctx.lineTo(bullet.x + velocity.x, bullet.y + velocity.y)
      ctx.stroke()
    }
  }

  onCanvasMouseDown(event) {
    this._draggingTarget = true
    this.moveTargetToEvent(event)
  }

  onCanvasMouseMove(event) {
    if (!this._draggingTarget) return
    this.moveTargetToEvent(event)
  }

  onCanvasMouseUp(_event) {
    this._draggingTarget = false
  }

  onCanvasMouseLeave(_event) {
    this._draggingTarget = false
  }

  moveTargetToEvent(event) {
    const point = this.getWorldPoint(event.clientX, event.clientY)
    this.engine.targetX = point.x
    this.engine.targetY = point.y
    this.draw()
  }

  setStatus(text, tone = null) {
    assert(this.statusOutput instanceof HTMLOutputElement, "view-bullet missing status output")
    this.statusOutput.textContent = text
    this.statusOutput.classList.remove("accent", "success", "warning", "danger", "info")
    if (tone) this.statusOutput.classList.add(tone)
  }

  updateFooter(status = null, tone = null) {
    assert(this.pathOutput instanceof HTMLOutputElement, "view-bullet missing path output")
    assert(this.dirtyOutput instanceof HTMLOutputElement, "view-bullet missing dirty output")
    assert(this.statsOutput instanceof HTMLOutputElement, "view-bullet missing stats output")
    this.pathOutput.textContent = `Path: ${this.sourcePath}`
    this.dirtyOutput.textContent = this.dirty ? "Dirty" : "Saved"
    this.dirtyOutput.className = this.dirty ? "warning" : "success"
    const stats = this.engine.stats()
    this.statsOutput.textContent = `Frame: ${stats.frame} Phase: ${stats.phase} Alive: ${stats.alive} Spawned: ${stats.spawned} Vanished: ${stats.vanished}`
    if (status !== null) this.setStatus(status, tone)
    this.renderHeaderControls()
  }

  setProgram(gbml, { dirty = false, status = "Ready", tone = "success" } = {}) {
    this.gbml = gbml
    this.programText = stringifyGbml(gbml)
    this.dirty = dirty
    this.summaryOutput.textContent = summarizeGbml(gbml)
    this.engine.load(gbml)
    this.setData(gbml, { autoFit: true })
    this.updateFooter(status, tone)
  }

  async load() {
    assert(this.sourcePath.length > 0, "view-bullet load requires source path")
    this.stopPlayback()
    this.setStatus("Loading...", "info")
    try {
      const text = unwrap(await runtime.invoke("fs/fs::read-text", this.sourcePath))
      const gbml = JSON.parse(text)
      this.setProgram(gbml, { dirty: false, status: "Ready", tone: "success" })
    } catch (error) {
      this.setStatus(`Error: ${errorMessage(error)}`, "danger")
      console.error("view-bullet load failed:", error)
    }
  }

  async reload() {
    await this.load()
    await runtime.call("ui.toast.success", { message: `Reloaded ${this.sourcePath}` })
  }

  async new() {
    const payload = unwrap(await runtime.call("ui.popup.open", this.createNewPopupOptions()))
    if (!payload || payload.cancelled) return
    const path = typeof payload.path === "string" ? payload.path.trim() : ""
    assert(path.length > 0, "view-bullet new requires GBML file path")
    this.sourcePath = path
    this.setProgram(createEmptyGbml(), { dirty: false, status: `Created ${path}`, tone: "success" })
    await this.saveToPath(path)
    await runtime.call("ui.toast.success", { message: `Created ${path}` })
  }

  async open() {
    const payload = unwrap(await runtime.call("ui.popup.open", this.createOpenPopupOptions()))
    if (!payload || payload.cancelled) return
    const selection = Array.isArray(payload.selection) ? payload.selection[0] : payload.selection
    assert(selection && selection.path, "view-bullet open requires selected GBML file path")
    this.sourcePath = selection.path
    await this.load()
  }

  async save() {
    assert(this.gbml !== null, "view-bullet save requires loaded GBML")
    assert(this.sourcePath.length > 0, "view-bullet save requires GBML file path")
    await this.saveToPath(this.sourcePath)
    this.dirty = false
    this.updateFooter(`Saved ${this.sourcePath}`, "success")
    await runtime.call("ui.toast.success", { message: `Saved ${this.sourcePath}` })
  }

  async saveAs() {
    assert(this.gbml !== null, "view-bullet save-as requires loaded GBML")
    const payload = unwrap(await runtime.call("ui.popup.open", this.createSavePopupOptions()))
    if (!payload || payload.cancelled) return
    const path = typeof payload.path === "string" ? payload.path.trim() : ""
    assert(path.length > 0, "view-bullet save-as requires GBML file path")
    await this.saveToPath(path)
    this.sourcePath = path
    this.dirty = false
    this.updateFooter(`Saved as ${path}`, "success")
    await runtime.call("ui.toast.success", { message: `Saved ${path}` })
  }

  async edit() {
    assert(this.sourcePath.length > 0, "view-bullet edit requires GBML file path")
    const payload = unwrap(
      await runtime.call("ui.popup.open", {
        title: "Edit GBML JSON",
        size: "large",
        tag: "view-code",
        attributes: { "data-source": this.sourcePath, "data-lang": "json" },
      }),
    )
    if (payload && payload.reload) await this.load()
  }

  async saveToPath(path) {
    assert(this.gbml !== null, "view-bullet save requires loaded GBML")
    assert(typeof path === "string" && path.length > 0, "view-bullet save requires GBML path")
    this.programText = stringifyGbml(this.gbml)
    unwrap(await runtime.invoke("fs/fs::write-text", path, this.programText))
  }

  restartPreview() {
    assert(this.gbml !== null, "view-bullet restart requires loaded GBML")
    this.engine.reset()
    this.draw()
    this.updateFooter("Restarted", "success")
  }

  stepPreview() {
    assert(this.gbml !== null, "view-bullet step requires loaded GBML")
    this.engine.step()
    this.draw()
    this.updateFooter("Stepped one frame", "info")
  }

  togglePlayback() {
    assert(this.gbml !== null, "view-bullet playback requires loaded GBML")
    if (this.engine.running) this.stopPlayback()
    else this.startPlayback()
    this.renderHeaderControls()
  }

  startPlayback() {
    if (this.engine.running) return
    this.engine.running = true
    this._animationToken += 1
    this._lastAnimationTime = 0
    const token = this._animationToken
    this._animationFrame = requestAnimationFrame((time) =>
      this._animate(time, token),
    )
  }

  stopPlayback() {
    this.engine.running = false
    this._animationToken += 1
    if (this._animationFrame) cancelAnimationFrame(this._animationFrame)
    this._animationFrame = 0
    this.renderHeaderControls()
  }

  _animate(time, token) {
    this._animationFrame = 0
    if (!this.engine.running || token !== this._animationToken) return
    if (this._lastAnimationTime === 0) this._lastAnimationTime = time
    const elapsed = time - this._lastAnimationTime
    const steps = Math.max(1, Math.min(4, Math.floor(elapsed / (1000 / 60)) || 1))
    for (let i = 0; i < steps; i += 1) this.engine.step()
    this._lastAnimationTime = time
    this.draw()
    if (this.engine.isSimulationDone()) {
      this.stopPlayback()
      this.updateFooter("Finished", "success")
      return
    }
    this.updateFooter()
    if (!this.engine.running || token !== this._animationToken) return
    this._animationFrame = requestAnimationFrame((nextTime) =>
      this._animate(nextTime, token),
    )
  }

  createOpenPopupOptions() {
    return {
      title: "Open GBML",
      size: "medium",
      tag: "view-files",
      props: { mode: "chooser", filter: "*.gbml.json,*.json" },
    }
  }

  createNewPopupOptions() {
    return {
      title: "Create GBML",
      size: "medium",
      tag: "view-files",
      props: { mode: "saver", filter: "*.gbml.json,*.json", defaultName: "new.gbml.json" },
    }
  }

  createSavePopupOptions() {
    return {
      title: "Save GBML As",
      size: "medium",
      tag: "view-files",
      props: {
        mode: "saver",
        filter: "*.gbml.json,*.json",
        defaultName: basename(this.sourcePath || "new.gbml.json"),
      },
    }
  }
}

if (!customElements.get("view-bullet")) {
  customElements.define("view-bullet", ViewBullet)
}
