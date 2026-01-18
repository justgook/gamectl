/**
 * QOI Image File Handler
 * 
 * Handler for QOI (Quite OK Image) files.
 * Decodes QOI format and renders to canvas for preview.
 */

import { registerHandler } from '../file-handlers.js'
import decode from '../../../util/qoi/decode.js'

const qoiHandler = {
  extensions: ['qoi'],
  icon: '🖼️',
  kind: 'QOI Image',
  canPreview: true,
  canEdit: false,

  /**
   * Preview QOI image file
   */
  preview(content, container, fileInfo) {
    const wrapper = document.createElement('div')
    wrapper.className = 'file-preview-image'

    try {
      // Decode QOI data
      const arrayBuffer = content.buffer || content
      const decoded = decode(arrayBuffer, content.byteOffset, content.byteLength)
      
      // Create canvas and render decoded pixels
      const canvas = document.createElement('canvas')
      canvas.width = decoded.width
      canvas.height = decoded.height
      canvas.className = 'file-preview-img'
      canvas.style.maxWidth = '100%'
      canvas.style.height = 'auto'
      
      const ctx = canvas.getContext('2d')
      const imageData = ctx.createImageData(decoded.width, decoded.height)
      
      // Copy decoded pixel data to ImageData
      if (decoded.channels === 4) {
        imageData.data.set(decoded.data)
      } else {
        // RGB -> RGBA (add alpha channel)
        for (let i = 0, j = 0; i < decoded.data.length; i += 3, j += 4) {
          imageData.data[j] = decoded.data[i]
          imageData.data[j + 1] = decoded.data[i + 1]
          imageData.data[j + 2] = decoded.data[i + 2]
          imageData.data[j + 3] = 255
        }
      }
      
      ctx.putImageData(imageData, 0, 0)
      wrapper.appendChild(canvas)
      
      // Show dimensions
      const dims = document.createElement('div')
      dims.className = 'file-preview-dims'
      dims.textContent = `${decoded.width} x ${decoded.height} px`
      wrapper.appendChild(dims)
      
      // File info
      const infoDiv = document.createElement('div')
      infoDiv.className = 'file-preview-info-bar'
      infoDiv.innerHTML = `
        <span>QOI Image (${decoded.channels}ch)</span>
        <span>${formatSize(content.byteLength || content.length)}</span>
      `
      wrapper.appendChild(infoDiv)
    } catch (error) {
      wrapper.innerHTML = `
        <div class="file-preview-error">
          <span style="font-size: 48px;">🖼️</span>
          <p>Failed to decode QOI image</p>
          <p style="font-size: 12px; opacity: 0.7;">${error.message}</p>
        </div>
      `
    }

    container.appendChild(wrapper)
  },

  /**
   * Editing not supported for QOI images
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

// Register handler
registerHandler(qoiHandler)

export default qoiHandler
