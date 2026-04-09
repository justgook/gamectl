function encodeResult(value) {
  return {
    returnCode: 0,
    output: new TextEncoder().encode(JSON.stringify(value ?? null)),
  }
}

function decodeBytes(bytes) {
  return new TextDecoder().decode(bytes)
}

function readI32String(result) {
  return Number(decodeBytes(result.output || new Uint8Array()))
}

export class UiLayout extends HTMLElement {
  constructor() {
    super()
    this.runtime = null
    this.buffer = null
    this.ptr = 0
    this.size = 0
    this.i32 = null
    this.lastGeneration = -1
    this.api = {
      refresh: async () => {
        await this.refresh()
        return encodeResult({ ok: true, generation: this.lastGeneration })
      },
      ping: async () => encodeResult({ ok: true, generation: this.lastGeneration }),
    }
  }

  connectedCallback() {
    this.style.display = 'block'
    this.style.marginTop = '24px'
    if (!this.innerHTML) {
      this.innerHTML = `
        <section style="border:1px solid var(--border); border-radius:12px; background:var(--surface-elevated); padding:16px;">
          <h2 style="margin:0 0 12px;">ui.layout</h2>
          <p style="margin:0 0 12px; color:var(--text-muted);">Waiting for runtime...</p>
          <pre data-role="state" style="margin:0; white-space:pre-wrap; background:var(--surface); padding:12px; border-radius:8px; border:1px solid var(--border);"></pre>
        </section>
      `
    }
  }

  async bindRuntime(runtime) {
    this.runtime = runtime
    this.buffer = await runtime.memory('layout')
    this.size = readI32String(await runtime.call('layout', 'get_info_size', ''))
    this.ptr = readI32String(await runtime.call('layout', 'get_info_ptr', ''))
    this.i32 = new Int32Array(this.buffer, this.ptr, Math.floor(this.size / 4))
    this.render()
  }

  snapshot() {
    if (!this.i32) return null
    return {
      initialized: this.i32[0],
      screenW: this.i32[1],
      screenH: this.i32[2],
      maxPanels: this.i32[3],
      maxHandles: this.i32[4],
      areaCount: this.i32[5],
      handleCount: this.i32[6],
      lastError: this.i32[7],
      generation: this.i32[8],
      lastAction: this.i32[9],
      lastIndex: this.i32[10],
      lastX: this.i32[11],
      lastY: this.i32[12],
      handleHalfSize: this.i32[13],
      minPanelSize: this.i32[14],
      memoryShared: this.buffer instanceof SharedArrayBuffer,
      infoPtr: this.ptr,
      infoSize: this.size,
    }
  }

  render() {
    const state = this.querySelector('[data-role="state"]')
    const summary = this.querySelector('p')
    const snapshot = this.snapshot()
    if (!snapshot) {
      if (summary) summary.textContent = 'Layout memory not bound yet.'
      if (state) state.textContent = ''
      return
    }
    this.lastGeneration = snapshot.generation
    if (summary) {
      summary.textContent = `memory=${snapshot.memoryShared ? 'shared' : 'private'} ptr=${snapshot.infoPtr} size=${snapshot.infoSize} generation=${snapshot.generation}`
    }
    if (state) {
      state.textContent = JSON.stringify(snapshot, null, 2)
    }
  }

  async refresh() {
    if (!this.runtime) throw new Error('ui.layout is not bound to runtime')
    const nextPtr = readI32String(await this.runtime.call('layout', 'get_info_ptr', ''))
    if (nextPtr !== this.ptr || !this.i32) {
      this.ptr = nextPtr
      this.i32 = new Int32Array(this.buffer, this.ptr, Math.floor(this.size / 4))
    }
    this.render()
  }
}

if (!customElements.get('ui-layout')) {
  customElements.define('ui-layout', UiLayout)
}
