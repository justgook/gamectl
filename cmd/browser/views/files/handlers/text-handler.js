/**
 * Text File Handler
 * 
 * Handler for text-based files including:
 * - Plain text (.txt)
 * - Markdown (.md)
 * - JSON (.json)
 * - JavaScript (.js, .mjs)
 * - Go (.go)
 * - CSS (.css)
 * - HTML (.html, .htm)
 * - YAML (.yaml, .yml)
 * - XML (.xml)
 * - Shell scripts (.sh, .bash)
 * - Config files (.toml, .ini, .cfg, .conf)
 * - And more...
 */

import { registerHandler } from '../file-handlers.js'

// Extension to language/kind mapping
const extensionInfo = {
  // Plain text
  txt: { icon: '📝', kind: 'Text', language: 'text' },
  log: { icon: '📋', kind: 'Log', language: 'text' },
  
  // Markdown
  md: { icon: '📖', kind: 'Markdown', language: 'markdown' },
  markdown: { icon: '📖', kind: 'Markdown', language: 'markdown' },
  
  // JSON
  json: { icon: '{ }', kind: 'JSON', language: 'json' },
  
  // JavaScript/TypeScript
  js: { icon: '🟨', kind: 'JavaScript', language: 'javascript' },
  mjs: { icon: '🟨', kind: 'JavaScript Module', language: 'javascript' },
  ts: { icon: '🟦', kind: 'TypeScript', language: 'typescript' },
  tsx: { icon: '🟦', kind: 'TypeScript React', language: 'typescript' },
  jsx: { icon: '🟨', kind: 'JavaScript React', language: 'javascript' },
  
  // Go
  go: { icon: '🐹', kind: 'Go', language: 'go' },
  mod: { icon: '🐹', kind: 'Go Module', language: 'go' },
  sum: { icon: '🐹', kind: 'Go Sum', language: 'text' },
  
  // Zig
  zig: { icon: '⚡', kind: 'Zig', language: 'zig' },
  
  // Web
  html: { icon: '🌐', kind: 'HTML', language: 'html' },
  htm: { icon: '🌐', kind: 'HTML', language: 'html' },
  css: { icon: '🎨', kind: 'CSS', language: 'css' },
  scss: { icon: '🎨', kind: 'SCSS', language: 'scss' },
  less: { icon: '🎨', kind: 'LESS', language: 'less' },
  
  // Config
  yaml: { icon: '⚙️', kind: 'YAML', language: 'yaml' },
  yml: { icon: '⚙️', kind: 'YAML', language: 'yaml' },
  toml: { icon: '⚙️', kind: 'TOML', language: 'toml' },
  ini: { icon: '⚙️', kind: 'INI', language: 'ini' },
  cfg: { icon: '⚙️', kind: 'Config', language: 'ini' },
  conf: { icon: '⚙️', kind: 'Config', language: 'ini' },
  env: { icon: '⚙️', kind: 'Environment', language: 'text' },
  
  // XML
  xml: { icon: '📰', kind: 'XML', language: 'xml' },
  svg: { icon: '🖼️', kind: 'SVG', language: 'xml' },
  
  // Shell
  sh: { icon: '🐚', kind: 'Shell Script', language: 'shell' },
  bash: { icon: '🐚', kind: 'Bash Script', language: 'shell' },
  zsh: { icon: '🐚', kind: 'Zsh Script', language: 'shell' },
  fish: { icon: '🐚', kind: 'Fish Script', language: 'shell' },
  
  // Other languages
  py: { icon: '🐍', kind: 'Python', language: 'python' },
  rb: { icon: '💎', kind: 'Ruby', language: 'ruby' },
  rs: { icon: '🦀', kind: 'Rust', language: 'rust' },
  c: { icon: '🔧', kind: 'C', language: 'c' },
  h: { icon: '🔧', kind: 'C Header', language: 'c' },
  cpp: { icon: '🔧', kind: 'C++', language: 'cpp' },
  hpp: { icon: '🔧', kind: 'C++ Header', language: 'cpp' },
  java: { icon: '☕', kind: 'Java', language: 'java' },
  
  // Data
  csv: { icon: '📊', kind: 'CSV', language: 'csv' },
  sql: { icon: '🗃️', kind: 'SQL', language: 'sql' },
  
  // Make/Build
  makefile: { icon: '🔨', kind: 'Makefile', language: 'makefile' },
  dockerfile: { icon: '🐳', kind: 'Dockerfile', language: 'dockerfile' },
  
  // Git
  gitignore: { icon: '🚫', kind: 'Git Ignore', language: 'text' },
  gitattributes: { icon: '📋', kind: 'Git Attributes', language: 'text' },
}

// Special filenames (without extensions)
const specialFiles = {
  'makefile': { icon: '🔨', kind: 'Makefile', language: 'makefile' },
  'dockerfile': { icon: '🐳', kind: 'Dockerfile', language: 'dockerfile' },
  'readme': { icon: '📖', kind: 'Readme', language: 'markdown' },
  'license': { icon: '📜', kind: 'License', language: 'text' },
  'changelog': { icon: '📋', kind: 'Changelog', language: 'markdown' },
}

const decoder = new TextDecoder()

const textHandler = {
  extensions: Object.keys(extensionInfo),
  icon: '📝',
  kind: 'Text',
  canPreview: true,
  canEdit: true,

  /**
   * Preview text file content
   */
  preview(content, container, fileInfo) {
    const text = typeof content === 'string' ? content : decoder.decode(content)
    const info = getFileInfo(fileInfo.name)

    const wrapper = document.createElement('div')
    wrapper.className = 'file-preview-text'
    
    const header = document.createElement('div')
    header.className = 'file-preview-header'
    header.innerHTML = `<span class="file-type-badge">${info.language}</span>`
    wrapper.appendChild(header)

    const pre = document.createElement('pre')
    pre.className = 'file-preview-code'
    pre.textContent = text
    wrapper.appendChild(pre)

    container.appendChild(wrapper)
  },

  /**
   * Edit text file
   * Returns a function that retrieves the current content
   */
  edit(content, container, fileInfo) {
    const text = typeof content === 'string' ? content : decoder.decode(content)
    const info = getFileInfo(fileInfo.name)

    const wrapper = document.createElement('div')
    wrapper.className = 'file-edit-text'
    
    const header = document.createElement('div')
    header.className = 'file-edit-header'
    header.innerHTML = `
      <span class="file-type-badge">${info.language}</span>
      <span class="file-edit-hint">Press Ctrl+S to save</span>
    `
    wrapper.appendChild(header)

    const textarea = document.createElement('textarea')
    textarea.className = 'file-edit-textarea'
    textarea.value = text
    textarea.spellcheck = false
    wrapper.appendChild(textarea)

    container.appendChild(wrapper)

    // Focus textarea
    setTimeout(() => textarea.focus(), 0)

    // Handle Ctrl+S
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        // Trigger save via modal (dispatch custom event)
        container.dispatchEvent(new CustomEvent('save-requested', { bubbles: true }))
      }
    })

    // Return getter for current content
    return () => textarea.value
  }
}

/**
 * Get file info (icon, kind, language) for a filename
 */
function getFileInfo(filename) {
  const basename = filename.split('/').pop()?.toLowerCase() || ''
  const ext = basename.split('.').pop()?.toLowerCase()
  
  // Check special filenames first
  const nameWithoutExt = basename.split('.')[0]
  if (specialFiles[nameWithoutExt]) {
    return specialFiles[nameWithoutExt]
  }
  if (specialFiles[basename]) {
    return specialFiles[basename]
  }
  
  // Check extension
  if (ext && extensionInfo[ext]) {
    return extensionInfo[ext]
  }
  
  return { icon: '📝', kind: 'Text', language: 'text' }
}

// Update handler icon and kind based on extension lookup
const handlerWithLookup = {
  ...textHandler,
  
  // These will be called per-file, so we need getters
  get icon() {
    return '📝' // Default, actual icon resolved per-file
  },
  
  get kind() {
    return 'Text' // Default, actual kind resolved per-file
  }
}

// Create a handler factory that returns file-specific info
function createTextHandlerForExtension(ext) {
  const info = extensionInfo[ext] || { icon: '📝', kind: 'Text', language: 'text' }
  return {
    ...textHandler,
    icon: info.icon,
    kind: info.kind,
  }
}

// Register handler for each extension with its specific icon/kind
for (const [ext, info] of Object.entries(extensionInfo)) {
  registerHandler({
    extensions: [ext],
    icon: info.icon,
    kind: info.kind,
    canPreview: textHandler.canPreview,
    canEdit: textHandler.canEdit,
    preview: textHandler.preview,
    edit: textHandler.edit,
  })
}

// Register special filenames
for (const [name, info] of Object.entries(specialFiles)) {
  registerHandler({
    extensions: [name],
    icon: info.icon,
    kind: info.kind,
    canPreview: textHandler.canPreview,
    canEdit: textHandler.canEdit,
    preview: textHandler.preview,
    edit: textHandler.edit,
  })
}

export default textHandler
export { getFileInfo }
