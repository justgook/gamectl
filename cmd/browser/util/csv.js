// RFC 4180 compliant CSV utilities
// Provides functions for parsing and formatting CSV data with proper handling
// of quoted fields, escaped quotes, and special characters.

/**
 * Parse CSV text into an array of arrays
 * @param {string} text - CSV text to parse
 * @returns {Array<Array<string>>} Array of rows, where each row is an array of field values
 */
export function parseCSVLines(text) {
  const lines = []
  let currentLine = []
  let currentField = ''
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote - add single quote to field
          currentField += '"'
          i += 2 // Skip both quotes
          continue
        } else {
          // End of quoted field
          inQuotes = false
        }
      } else {
        // Regular character inside quotes
        currentField += char
      }
    } else {
      if (char === '"') {
        // Start of quoted field
        inQuotes = true
      } else if (char === ',') {
        // End of field
        currentLine.push(currentField)
        currentField = ''
      } else if (char === '\n' || char === '\r') {
        // End of line
        if (currentField || currentLine.length > 0) {
          currentLine.push(currentField)
          lines.push(currentLine)
          currentLine = []
          currentField = ''
        }
        // Skip \r\n combinations
        if (char === '\r' && nextChar === '\n') {
          i++
        }
      } else {
        // Regular character
        currentField += char
      }
    }
    i++
  }

  // Handle final field and line
  if (currentField || currentLine.length > 0) {
    currentLine.push(currentField)
    lines.push(currentLine)
  }

  return lines
}

/**
 * Format an array of arrays into CSV text
 * @param {Array<Array<string>>} lines - Array of rows to format
 * @returns {string} CSV formatted text
 */
export function formatCSVLines(lines) {
  return lines.map(line => 
    line.map(field => formatCSVField(field)).join(',')
  ).join('\n')
}

/**
 * Format a single field for CSV output with proper quoting and escaping
 * @param {string} field - Field value to format
 * @returns {string} CSV formatted field
 */
export function formatCSVField(field) {
  if (!field) return ''
  
  const needsQuoting = field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')
  
  if (needsQuoting) {
    // Escape quotes by doubling them and wrap in quotes
    return '"' + field.replace(/"/g, '""') + '"'
  }
  
  return field
}

/**
 * Parse CSV with headers into an array of objects
 * @param {string} csvText - CSV text with header row
 * @returns {Array<Object>} Array of objects with keys from header row
 */
export function parseCSVWithHeaders(csvText) {
  const lines = parseCSVLines(csvText.trim())
  if (lines.length < 2) return []

  const headers = lines[0]
  const data = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i]
    if (values.length === 0) continue

    const row = {}
    headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })
    data.push(row)
  }

  return data
}