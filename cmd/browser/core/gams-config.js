export const GAMS_CONFIG_PATH = '/gams.json'
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

  return config
}
