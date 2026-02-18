/**
 * File Handler Registry
 * 
 * Provides a central registry for file type handlers (addons).
 * Each handler defines how to display, preview, and edit files of certain types.
 * 
 * Handler interface:
 * {
 *   extensions: string[],      // File extensions this handler supports
 *   icon: string,              // Icon key for file tree
 *   kind: string,              // Display name for file type
 *   canPreview: boolean,       // Can this handler show a preview?
 *   canEdit: boolean,          // Can this handler edit files?
 *   preview(content, container, fileInfo) => void,  // Render preview
 *   edit(content, container, fileInfo) => () => newContent,  // Render editor, return save callback
 * }
 */

// Map of extension -> handler
const handlers = new Map()

// Default handler for unknown file types
let defaultHandler = null

/**
 * Register a file type handler
 * @param {object} handler - Handler object with extensions array and methods
 */
export function registerHandler(handler) {
  if (!handler.extensions || !Array.isArray(handler.extensions)) {
    console.error('Handler must have extensions array:', handler)
    return
  }

  for (const ext of handler.extensions) {
    handlers.set(ext.toLowerCase(), handler)
  }
}

/**
 * Register the default (fallback) handler
 * @param {object} handler - Handler object
 */
export function registerDefaultHandler(handler) {
  defaultHandler = handler
}

/**
 * Get handler for a filename
 * @param {string} filename - File name or path
 * @returns {object} Handler for this file type
 */
export function getHandler(filename) {
  const ext = getExtension(filename)
  
  if (ext && handlers.has(ext)) {
    return handlers.get(ext)
  }

  // Check for special filenames without extension
  const basename = filename.split('/').pop()?.toLowerCase()
  if (basename && handlers.has(basename)) {
    return handlers.get(basename)
  }

  return defaultHandler || createFallbackHandler()
}

/**
 * Get all registered handlers
 * @returns {Map} Map of extension to handler
 */
export function getAllHandlers() {
  return new Map(handlers)
}

/**
 * Get file extension (lowercase, without dot)
 * @param {string} filename 
 * @returns {string|null}
 */
function getExtension(filename) {
  const basename = filename.split('/').pop() || filename
  const parts = basename.split('.')
  if (parts.length > 1) {
    return parts.pop().toLowerCase()
  }
  return null
}

/**
 * Create a minimal fallback handler if none registered
 */
function createFallbackHandler() {
  return {
    extensions: ['*'],
    icon: 'description',
    kind: 'File',
    canPreview: false,
    canEdit: false,
    preview(content, container, fileInfo) {
      container.textContent = `No preview available for ${fileInfo.name}`
    },
    edit(content, container, fileInfo) {
      container.textContent = `Cannot edit ${fileInfo.name}`
      return () => content
    }
  }
}

// NOTE: Handlers are NOT auto-imported here to avoid circular dependencies.
// They must be imported by view-files.js after importing this module.
