package util

import (
	"strings"
)

// ParseCSVLines parses CSV text into an array of arrays
// This is a complete port of the JavaScript parseCSVLines function
func ParseCSVLines(text string) [][]string {
	lines := [][]string{}
	currentLine := []string{}
	currentField := ""
	inQuotes := false
	i := 0

	for i < len(text) {
		char := text[i]
		var nextChar byte
		if i+1 < len(text) {
			nextChar = text[i+1]
		}

		if inQuotes {
			if char == '"' {
				if nextChar == '"' {
					// Escaped quote - add single quote to field
					currentField += "\""
					i += 2 // Skip both quotes
					continue
				} else {
					// End of quoted field
					inQuotes = false
				}
			} else {
				// Regular character inside quotes
				currentField += string(char)
			}
		} else {
			if char == '"' {
				// Start of quoted field
				inQuotes = true
			} else if char == ',' {
				// End of field
				currentLine = append(currentLine, currentField)
				currentField = ""
			} else if char == '\n' || char == '\r' {
				// End of line
				if currentField != "" || len(currentLine) > 0 {
					currentLine = append(currentLine, currentField)
					lines = append(lines, currentLine)
					currentLine = []string{}
					currentField = ""
				}
				// Skip \r\n combinations
				if char == '\r' && nextChar == '\n' {
					i++
				}
			} else {
				// Regular character
				currentField += string(char)
			}
		}
		i++
	}

	// Handle final field and line
	if currentField != "" || len(currentLine) > 0 {
		currentLine = append(currentLine, currentField)
		lines = append(lines, currentLine)
	}

	return lines
}

// FormatCSVLines formats an array of arrays into CSV text
func FormatCSVLines(lines [][]string) string {
	result := make([]string, len(lines))
	for i, line := range lines {
		formattedFields := make([]string, len(line))
		for j, field := range line {
			formattedFields[j] = FormatCSVField(field)
		}
		result[i] = strings.Join(formattedFields, ",")
	}
	return strings.Join(result, "\n")
}

// FormatCSVField formats a single field for CSV output with proper quoting and escaping
func FormatCSVField(field string) string {
	if field == "" {
		return ""
	}

	needsQuoting := strings.Contains(field, ",") ||
		strings.Contains(field, "\"") ||
		strings.Contains(field, "\n") ||
		strings.Contains(field, "\r")

	if needsQuoting {
		// Escape quotes by doubling them and wrap in quotes
		escaped := strings.ReplaceAll(field, "\"", "\"\"")
		return "\"" + escaped + "\""
	}

	return field
}

// ParseCSVWithHeaders parses CSV with headers into an array of maps
func ParseCSVWithHeaders(csvText string) []map[string]string {
	lines := ParseCSVLines(strings.TrimSpace(csvText))
	if len(lines) < 2 {
		return []map[string]string{}
	}

	headers := lines[0]
	data := []map[string]string{}

	for i := 1; i < len(lines); i++ {
		values := lines[i]
		if len(values) == 0 {
			continue
		}

		row := make(map[string]string)
		for j, header := range headers {
			if j < len(values) {
				row[header] = values[j]
			} else {
				row[header] = ""
			}
		}
		data = append(data, row)
	}

	return data
}
