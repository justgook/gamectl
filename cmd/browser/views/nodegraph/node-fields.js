import { NodeBase } from './node-base.js'

/**
 * NodeFields - Extract multiple fields from objects/arrays
 * 
 * Attributes:
 * - inputs: "input:sourceNode" - The object/array to extract from
 * - outputs: "field1,field2,[0].name,nested.field" - Comma-separated field paths
 * 
 * Supports complex field extraction:
 * - "data" → obj.data
 * - "[0]" → obj[0] (array access)
 * - "[0].name" → obj[0].name 
 * - "nested.field.value" → obj.nested.field.value
 * - "items[2].metadata.id" → obj.items[2].metadata.id
 * 
 * Example:
 * <node-fields id="extract" x="400" y="100"
 *              inputs="input:parseJson.output"
 *              outputs="tree,metadata,nodes[0],stats.count">
 * </node-fields>
 */
export class NodeFields extends NodeBase {
  getDisplayInfo() {
    const inputs = this.getInputPorts()
    const outputs = this.getOutputPorts()

    return {
      title: 'Fields',
      type: 'helper',
      width: 200,
      height: Math.max(120, 50 + Math.max(inputs.length, outputs.length) * 24),
      inputs,
      outputs
    }
  }

  async executeNode(resolvers) {
    this.state = 'running'
    this.requestRedraw()
    
    try {
      const input = await this.getInputValue('input')
      
      // Extract each field specified in outputs
      for (const outputName of this._parsedOutputs) {
        const fieldPath = outputName
        const value = this.extractField(input, fieldPath)
        resolvers.get(outputName).resolve(value)
      }
      
      this.state = 'success'
      console.log(`✓ Fields extraction completed for paths:`, this._parsedOutputs)

    } catch (error) {
      this.state = 'error'
      this.error = error.message
      console.error(`✗ Fields extraction failed:`, error)
      
      // Reject all outputs
      for (const outputName of this._parsedOutputs) {
        resolvers.get(outputName).reject(error)
      }
    }

    this.requestRedraw()
  }

  /**
   * Extract field from object using path notation
   * @param {any} obj - Source object
   * @param {string} path - Field path (e.g., "data", "[0].name", "nested.field")
   * @returns {any} Extracted value
   */
  extractField(obj, path) {
    if (obj === null || obj === undefined) {
      return null
    }

    try {
      // Handle array indices: [0], [1], etc.
      if (path.startsWith('[') && path.includes(']')) {
        const match = path.match(/^\\[(\\d+)\\](.*)/)
        if (match && Array.isArray(obj)) {
          const index = parseInt(match[1])
          const remaining = match[2]
          
          if (remaining.length === 0) {
            // Just array access: [0]
            return obj[index]
          } else if (remaining.startsWith('.')) {
            // Array access with field: [0].name
            return this.extractField(obj[index], remaining.slice(1))
          } else {
            // Array access with more complex path: [0]something
            return this.extractField(obj[index], remaining)
          }
        }
        // If not valid array access, fall through to regular field access
      }

      // Handle dot notation: field.subfield.etc
      if (path.includes('.')) {
        const [first, ...rest] = path.split('.')
        const restPath = rest.join('.')
        
        // Handle array access in first part: items[0]
        if (first.includes('[') && first.includes(']')) {
          const arrayMatch = first.match(/^([^\\[]+)\\[(\\d+)\\]$/)
          if (arrayMatch) {
            const fieldName = arrayMatch[1]
            const index = parseInt(arrayMatch[2])
            if (obj[fieldName] && Array.isArray(obj[fieldName])) {
              return this.extractField(obj[fieldName][index], restPath)
            }
          }
        }
        
        return this.extractField(obj[first], restPath)
      }

      // Handle simple array access in field name: items[0]
      if (path.includes('[') && path.includes(']')) {
        const arrayMatch = path.match(/^([^\\[]+)\\[(\\d+)\\]$/)
        if (arrayMatch) {
          const fieldName = arrayMatch[1]
          const index = parseInt(arrayMatch[2])
          if (obj[fieldName] && Array.isArray(obj[fieldName])) {
            return obj[fieldName][index]
          }
        }
      }

      // Simple field access
      return obj[path]

    } catch (error) {
      console.warn(`Field extraction failed for path "${path}":`, error)
      return null
    }
  }
}

customElements.define('node-fields', NodeFields)