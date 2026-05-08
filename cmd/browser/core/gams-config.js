export const GAMS_CONFIG_PATH = '/demo/gams.json'
export const DEFAULT_GAMS_CONFIG_URL = GAMS_CONFIG_PATH

export async function loadDefaultGamsConfig() {
  const response = await fetch(DEFAULT_GAMS_CONFIG_URL, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Failed to load default GAMS config: ${response.status} ${response.statusText}`)
  }

  return validateGamsConfig(await response.json(), DEFAULT_GAMS_CONFIG_URL)
}

export function validateGamsConfig(config, source) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`${source} must contain a JSON object`)
  }
  if (!config.fs || typeof config.fs !== 'object' || Array.isArray(config.fs)) {
    throw new Error(`${source} must contain an fs object`)
  }
  if (!config.fs.mount || typeof config.fs.mount !== 'object' || Array.isArray(config.fs.mount)) {
    throw new Error(`${source} must contain an fs.mount object`)
  }
  if (!Array.isArray(config.plugins)) {
    throw new Error(`${source} must contain a plugins array`)
  }
  if (config.ui != null) {
    if (typeof config.ui !== 'object' || Array.isArray(config.ui)) {
      throw new Error(`${source} ui must be an object`)
    }
    if (config.ui.keys != null && !Array.isArray(config.ui.keys)) {
      throw new Error(`${source} ui.keys must be an array`)
    }
    if (config.ui.theme != null) {
      if (typeof config.ui.theme !== 'object' || Array.isArray(config.ui.theme)) {
        throw new Error(`${source} ui.theme must be an object`)
      }
      if (typeof config.ui.theme.path !== 'string' || config.ui.theme.path.length === 0) {
        throw new Error(`${source} ui.theme.path must be a non-empty string`)
      }
    }
    if (config.ui.views != null && (typeof config.ui.views !== 'object' || Array.isArray(config.ui.views))) {
      throw new Error(`${source} ui.views must be an object`)
    }
    if (config.ui.views != null) {
      for (const [tag, viewConfig] of Object.entries(config.ui.views)) {
        if (viewConfig == null || typeof viewConfig !== 'object' || Array.isArray(viewConfig)) {
          throw new Error(`${source} ui.views.${tag} must be an object`)
        }
        if (viewConfig.defaultSource != null && (typeof viewConfig.defaultSource !== 'string' || viewConfig.defaultSource.length === 0)) {
          throw new Error(`${source} ui.views.${tag}.defaultSource must be a non-empty string`)
        }
      }
    }
  }

  return config
}
