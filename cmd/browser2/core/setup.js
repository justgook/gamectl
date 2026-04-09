export async function applySetup(runtime, bootstrap = {}) {
  const steps = []

  const initial = resolveInitialSetup(bootstrap)
  steps.push({ phase: 'initial', initial })

  await runtime.load(initial.fs)
  runtime.setCapability('fs', initial.fs)
  steps.push({ phase: 'fs-ready', provider: initial.fs })

  const postFs = await resolvePostFsSetup(runtime, bootstrap)
  steps.push({ phase: 'post-fs', postFs })

  return {
    ok: true,
    fs: initial.fs,
    next: postFs,
    steps,
  }
}

function resolveInitialSetup(bootstrap) {
  const fs = bootstrap?.fs || 'fs.opfs'
  return { fs }
}

async function resolvePostFsSetup(runtime, bootstrap) {
  const decoder = new TextDecoder()
  const existsResult = await runtime.call('fs', 'exists', '/browser.config.json')
  const existsText = existsResult?.output ? decoder.decode(existsResult.output).trim() : ''
  return {
    sql: bootstrap?.sql || 'sql.default',
    configExists: existsResult?.returnCode === 0 && existsText === 'true',
    note: 'SQL bootstrap and migrations move here next.',
  }
}
