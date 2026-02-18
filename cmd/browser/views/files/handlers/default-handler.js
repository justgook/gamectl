/**
 * Default File Handler
 * 
 * Fallback handler for unknown file types.
 * Shows basic file information but doesn't support preview or editing.
 */

import { registerDefaultHandler } from '../file-handlers.js'

const defaultHandler = {
  extensions: ['*'],
  icon: 'description',
  kind: 'File',
  canPreview: true,
  canEdit: false,

  /**
   * Show file info as preview
   */
  preview(content, container, fileInfo) {
    const info = document.createElement('div')
    info.className = 'file-preview-info'
    info.innerHTML = `
      <div class="file-preview-icon" style="text-align: center; margin-bottom: 16px;"><span class="icon" aria-hidden="true">description</span></div>
      <table class="file-preview-table">
        <tr><th>Name:</th><td>${escapeHtml(fileInfo.name)}</td></tr>
        <tr><th>Path:</th><td>${escapeHtml(fileInfo.path)}</td></tr>
        <tr><th>Size:</th><td>${formatSize(content.length || content.byteLength || 0)}</td></tr>
        <tr><th>Type:</th><td>${getFileType(fileInfo.name)}</td></tr>
      </table>
      <p style="margin-top: 16px; color: var(--color-semantic-text-secondary); text-align: center;">
        No preview available for this file type.
      </p>
    `
    container.appendChild(info)
  },

  /**
   * Not supported
   */
  edit(content, container, fileInfo) {
    this.preview(content, container, fileInfo)
    return () => content
  }
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const size = bytes / Math.pow(1024, i)
  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

function getFileType(filename) {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (!ext || ext === filename.toLowerCase()) return 'Unknown'
  return ext.toUpperCase() + ' File'
}

// Register as default handler
registerDefaultHandler(defaultHandler)

export default defaultHandler
