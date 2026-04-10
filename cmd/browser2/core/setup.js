export async function applySetup(runtime, bootstrap = {}) {
  const steps = []

  const initial = resolveInitialSetup(bootstrap)
  steps.push({ phase: 'initial', initial })

  await runtime.load(initial.fs)
  runtime.setCapability('fs', initial.fs)
  steps.push({ phase: 'fs-ready', provider: initial.fs })

  const sql = resolveSqlSetup(bootstrap)
  await runtime.load(sql.id)
  runtime.setCapability('sql', sql.id)
  const openResult = await runtime.call('sql', 'open', '')
  const openText = decodeOutput(openResult)
  steps.push({ phase: 'sql-ready', sql, openResult: { returnCode: openResult?.returnCode || 0, output: openText } })

  const initHooks = await runPluginInitHooks(runtime)
  steps.push({ phase: 'plugin-init-hooks', initHooks })

  const postFs = await resolvePostFsSetup(runtime, bootstrap)
  steps.push({ phase: 'post-fs', postFs })

  return {
    ok: true,
    fs: initial.fs,
    sql: sql.id,
    next: postFs,
    steps,
  }
}

function resolveInitialSetup(bootstrap) {
  const fs = bootstrap?.fs || 'fs.opfs'
  return { fs }
}

function resolveSqlSetup(bootstrap) {
  return {
    id: bootstrap?.sql || 'sql',
  }
}

async function runPluginInitHooks(runtime) {
  const results = []
  for (const definition of runtime.getDefinitions()) {
    if (definition.runtime !== 'wasm') continue
    for (const hook of ['__fs_init', '__sql_init']) {
      if (!await runtime.hasMethod(definition.id, hook)) continue
      const result = await runtime.call(definition.id, hook, '')
      results.push({
        plugin: definition.id,
        hook,
        returnCode: result?.returnCode || 0,
        output: decodeOutput(result),
      })
    }
  }
  return results
}

async function resolvePostFsSetup(runtime, bootstrap) {
  const existsResult = await runtime.call('fs', 'exists', '/browser.config.json')
  const existsText = decodeOutput(existsResult)
  return {
    sql: bootstrap?.sql || 'sql',
    configExists: existsResult?.returnCode === 0 && existsText === 'true',
    note: 'Migrations move here next.',
  }
}

function decodeOutput(result) {
  return result?.output ? new TextDecoder().decode(result.output).trim() : ''
}
