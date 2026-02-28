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

    const icon = document.createElement('i')
    icon.setAttribute('aria-hidden', 'true')
    icon.textContent = 'description'
    info.appendChild(icon)

    const table = document.createElement('table')
    const rows = [
      ['Name:', fileInfo.name],
      ['Path:', fileInfo.path],
      ['Size:', formatSize(content.length || content.byteLength || 0)],
      ['Type:', getFileType(fileInfo.name)],
    ]

    for (const [label, value] of rows) {
      const tr = document.createElement('tr')
      const th = document.createElement('th')
      th.textContent = label
      const td = document.createElement('td')
      td.textContent = value
      tr.appendChild(th)
      tr.appendChild(td)
      table.appendChild(tr)
    }

    info.appendChild(table)

    const message = document.createElement('p')
    message.textContent = 'No preview available for this file type.'
    info.appendChild(message)

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
