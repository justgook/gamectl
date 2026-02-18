/**
 * Image File Handler
 * 
 * Handler for image files (preview only, no editing).
 * Supports: PNG, JPG, JPEG, GIF, WebP, SVG, ICO, BMP
 */

import { registerHandler } from '../file-handlers.js'

const imageExtensions = {
  png: { kind: 'PNG Image', mime: 'image/png' },
  jpg: { kind: 'JPEG Image', mime: 'image/jpeg' },
  jpeg: { kind: 'JPEG Image', mime: 'image/jpeg' },
  gif: { kind: 'GIF Image', mime: 'image/gif' },
  webp: { kind: 'WebP Image', mime: 'image/webp' },
  svg: { kind: 'SVG Image', mime: 'image/svg+xml' },
  ico: { kind: 'Icon', mime: 'image/x-icon' },
  bmp: { kind: 'BMP Image', mime: 'image/bmp' },
}

const imageHandler = {
  extensions: Object.keys(imageExtensions),
  icon: 'image',
  kind: 'Image',
  canPreview: true,
  canEdit: false,

  /**
   * Preview image file
   */
  preview(content, container, fileInfo) {
    const ext = fileInfo.name.split('.').pop()?.toLowerCase()
    const info = imageExtensions[ext] || { kind: 'Image', mime: 'image/png' }

    const wrapper = document.createElement('div')
    wrapper.className = 'file-preview-image'

    // Create blob URL from content
    const blob = new Blob([content], { type: info.mime })
    const url = URL.createObjectURL(blob)

    const img = document.createElement('img')
    img.src = url
    img.alt = fileInfo.name
    img.className = 'file-preview-img'
    
    // Show dimensions once loaded
    img.onload = () => {
      const dims = document.createElement('div')
      dims.className = 'file-preview-dims'
      dims.textContent = `${img.naturalWidth} x ${img.naturalHeight} px`
      wrapper.appendChild(dims)
      
      // Cleanup blob URL on container removal
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (Array.from(mutation.removedNodes).includes(wrapper)) {
            URL.revokeObjectURL(url)
            observer.disconnect()
          }
        }
      })
      if (container.parentElement) {
        observer.observe(container.parentElement, { childList: true })
      }
    }

    img.onerror = () => {
      wrapper.innerHTML = `
        <div class="file-preview-error">
          <span class="icon file-preview-icon" aria-hidden="true">image</span>
          <p>Failed to load image</p>
        </div>
      `
      URL.revokeObjectURL(url)
    }

    wrapper.appendChild(img)
    
    // File info
    const infoDiv = document.createElement('div')
    infoDiv.className = 'file-preview-info-bar'
    infoDiv.innerHTML = `
      <span>${info.kind}</span>
      <span>${formatSize(content.byteLength || content.length)}</span>
    `
    wrapper.appendChild(infoDiv)

    container.appendChild(wrapper)
  },

  /**
   * Editing not supported for images
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

// Register handler for each image extension
for (const [ext, info] of Object.entries(imageExtensions)) {
  registerHandler({
    extensions: [ext],
    icon: 'image',
    kind: info.kind,
    canPreview: imageHandler.canPreview,
    canEdit: imageHandler.canEdit,
    preview: imageHandler.preview,
    edit: imageHandler.edit,
  })
}

export default imageHandler
