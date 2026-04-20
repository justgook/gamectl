export const defaultPlugins = [
  {
    id: 'sql',
    runtime: 'wasm',
    role: 'service',
    url: `local:/plugins/sql.wasm?t=${Date.now()}`,
  },
  {
    id: 'random',
    runtime: 'wasm',
    role: 'service',
    url: `local:/plugins/random.wasm?t=${Date.now()}`,
  },
  {
    id: 'treegen',
    runtime: 'wasm',
    role: 'service',
    deps: ['random'],
    url: `local:/plugins/treegen.wasm?t=${Date.now()}`,
  },
  {
    id: 'echo',
    runtime: 'wasm',
    role: 'service',
    url: `local:/plugins/echo.wasm?t=${Date.now()}`,
  },
  {
    id: 'layout',
    runtime: 'wasm',
    role: 'service',
    url: `local:/plugins/layout2.wasm?t=${Date.now()}`,
    memory: {
      import: true,
      shared: true,
      initialPages: 288,
      maximumPages: 512,
    },
  },
  {
    id: 'ai.provider.mock',
    runtime: 'js',
    role: 'service',
    url: 'local:/plugins/ai_provider_mock/index.js',
  },
  {
    id: 'ai.agent',
    runtime: 'js',
    role: 'service',
    deps: ['fs', 'ai.provider.mock'],
    url: 'local:/plugins/ai_agent/index.js',
  },
]
