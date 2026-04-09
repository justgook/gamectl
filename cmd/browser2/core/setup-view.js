function decodeInput(input) {
  if (typeof input === 'string') return input
  if (input instanceof Uint8Array) return new TextDecoder().decode(input)
  if (ArrayBuffer.isView(input)) {
    return new TextDecoder().decode(new Uint8Array(input.buffer, input.byteOffset, input.byteLength))
  }
  return String(input ?? '')
}

export async function applySetupView(runtime) {
  const steps = []

  runtime.register({
    id: 'view.debug',
    methods: {
      async ping(input) {
        return { returnCode: 0, output: new TextEncoder().encode(`view.debug pong: ${String(input ?? '')}`) }
      },
    },
  })
  steps.push({ phase: 'register-main-plugin', plugin: 'view.debug' })

  runtime.register({
    id: 'view.echo',
    methods: {
      async hello(input) {
        console.log(`[view.echo]::hello ${decodeInput(input)}`)
        return { returnCode: 0, output: new TextEncoder().encode(`view.echo hello ${decodeInput(input)}`) }
      },
      async call(input) {
        console.log(`[view.echo]::call ${decodeInput(input)}`)
        return { returnCode: 0, output: new TextEncoder().encode(`view.echo call ${decodeInput(input)}`) }
      },
    },
  })
  steps.push({ phase: 'register-main-plugin', plugin: 'view.echo' })

  return {
    ok: true,
    steps,
  }
}
