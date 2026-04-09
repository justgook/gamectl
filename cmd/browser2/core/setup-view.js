export async function applySetupView(runtime) {
  const steps = []

  runtime.registerMainPlugin({
    id: 'view.debug',
    methods: {
      async ping(input) {
        return { returnCode: 0, output: new TextEncoder().encode(`view.debug pong: ${String(input ?? '')}`) }
      },
    },
  })
  steps.push({ phase: 'register-main-plugin', plugin: 'view.debug' })

  runtime.registerMainPlugin({
    id: 'view.echo',
    methods: {
      async hello(input) {
        console.log(`[view.echo]::hello ${input}`)
        return { returnCode: 0, output: new TextEncoder().encode(`view.echo hello ${String(input ?? '')}`) }
      },
      async call(input) {
        console.log(`[view.echo]::call ${input}`)
        return { returnCode: 0, output: new TextEncoder().encode(`view.echo call ${String(input ?? '')}`) }
      },
    },
  })
  steps.push({ phase: 'register-main-plugin', plugin: 'view.echo' })

  return {
    ok: true,
    steps,
  }
}
