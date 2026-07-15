package director_compiler

MAX_DIAGNOSTICS :: 100

Source_Position :: struct {
	byte_offset: u32,
	line:        u32,
	column:      u32,
}

Source_Span :: struct {
	start: Source_Position,
	end:   Source_Position,
}

Diagnostic :: struct {
	code:    string,
	message: string,
	span:    Source_Span,
}

diagnostics: [MAX_DIAGNOSTICS]Diagnostic
diagnostic_count: int

scan_source :: proc(source: []u8) {
	diagnostic_count = 0
	i := 0
	line: u32 = 1
	column: u32 = 1

	for i < len(source) {
		byte := source[i]
		if byte == '\n' {
			i += 1
			line += 1
			column = 1
			continue
		}
		if byte == '#' {
			for i < len(source) && source[i] != '\n' {
				i += 1
				column += 1
			}
			continue
		}
		if byte == '"' {
			i, line, column = scan_quoted_signal(source, i, line, column)
			continue
		}
		if byte >= '0' && byte <= '9' {
			number_start := i
			number_column := column
			for i < len(source) && source[i] >= '0' && source[i] <= '9' {
				i += 1
				column += 1
			}
			continues_identifier := i < len(source) && is_property_identifier_byte(source[i])
			previous := number_start - 1
			for previous >= 0 && (source[previous] == ' ' || source[previous] == '\t') {
				previous -= 1
			}
			is_negative := previous >= 0 && source[previous] == '-'
			if !continues_identifier && integer_exceeds_i32(source[number_start:i], is_negative) {
				add_diagnostic(
					"lex-integer-out-of-range",
					"integer must fit in signed 32-bit range",
					position(number_start, line, number_column),
					position(i, line, column),
				)
			}
			continue
		}
		if !is_source_byte(byte) {
			width := utf8_sequence_width(source, i)
			add_diagnostic(
				"lex-invalid-character",
				"invalid character",
				position(i, line, column),
				position(i + width, line, column + 1),
			)
			i += width
			column += 1
			continue
		}
		i += 1
		column += 1
	}
}

is_source_byte :: proc(byte: u8) -> bool {
	return (byte >= 'a' && byte <= 'z') ||
	       (byte >= 'A' && byte <= 'Z') ||
	       (byte >= '0' && byte <= '9') ||
	       byte == ' ' || byte == '\t' || byte == '\r' ||
	       byte == '_' || byte == '-' || byte == ':' || byte == '+' ||
	       byte == '.' || byte == '*' || byte == '$' || byte == '!' ||
	       byte == '=' || byte == '<' || byte == '>' ||
	       byte == '(' || byte == ')'
}

scan_quoted_signal :: proc(source: []u8, start_index: int, start_line, start_column: u32) -> (int, u32, u32) {
	i := start_index + 1
	line := start_line
	column := start_column + 1

	for i < len(source) {
		byte := source[i]
		if byte == '"' {
			return i + 1, line, column + 1
		}
		if byte == '\n' {
			add_diagnostic(
				"lex-unterminated-signal",
				"quoted signal must end before the physical line ends",
				position(start_index, start_line, start_column),
				position(i, line, column),
			)
			return i, line, column
		}
		if byte < 0x20 || byte > 0x7e {
			width := utf8_sequence_width(source, i)
			add_diagnostic(
				"lex-invalid-signal-character",
				"quoted signals support printable ASCII only",
				position(i, line, column),
				position(i + width, line, column + 1),
			)
			i += width
			column += 1
			continue
		}
		if byte == '\\' {
			escape_start := position(i, line, column)
			if i + 1 >= len(source) || source[i + 1] == '\n' {
				add_diagnostic(
					"lex-unterminated-signal",
					"quoted signal must end before the physical line ends",
					position(start_index, start_line, start_column),
					position(i + 1, line, column + 1),
				)
				return i + 1, line, column + 1
			}
			escaped := source[i + 1]
			if escaped != '"' && escaped != '\\' {
				add_diagnostic(
					"lex-invalid-escape",
					`quoted signals support only \" and \\ escapes`,
					escape_start,
					position(i + 2, line, column + 2),
				)
			}
			i += 2
			column += 2
			continue
		}
		i += 1
		column += 1
	}

	add_diagnostic(
		"lex-unterminated-signal",
		"quoted signal must end before the physical line ends",
		position(start_index, start_line, start_column),
		position(i, line, column),
	)
	return i, line, column
}

is_property_identifier_byte :: proc(byte: u8) -> bool {
	return (byte >= 'a' && byte <= 'z') ||
	       (byte >= 'A' && byte <= 'Z') ||
	       byte == '_' || byte == ':'
}

integer_exceeds_i32 :: proc(digits: []u8, negative: bool) -> bool {
	first_nonzero := 0
	for first_nonzero < len(digits) && digits[first_nonzero] == '0' {
		first_nonzero += 1
	}
	significant := digits[first_nonzero:]
	max_i32 := "2147483647"
	if negative {
		max_i32 = "2147483648"
	}
	if len(significant) != len(max_i32) {
		return len(significant) > len(max_i32)
	}
	for i in 0 ..< len(significant) {
		if significant[i] != max_i32[i] {
			return significant[i] > max_i32[i]
		}
	}
	return false
}

utf8_sequence_width :: proc(source: []u8, index: int) -> int {
	first := source[index]
	width := 1
	if first >= 0xf0 {
		width = 4
	} else if first >= 0xe0 {
		width = 3
	} else if first >= 0xc0 {
		width = 2
	}
	if index + width > len(source) {
		return len(source) - index
	}
	return width
}

position :: proc(byte_offset: int, line, column: u32) -> Source_Position {
	return Source_Position {
		byte_offset = u32(byte_offset),
		line = line,
		column = column,
	}
}

add_diagnostic :: proc(code, message: string, start, end: Source_Position) {
	if diagnostic_count >= MAX_DIAGNOSTICS {
		return
	}
	diagnostics[diagnostic_count] = Diagnostic {
		code = code,
		message = message,
		span = Source_Span {start = start, end = end},
	}
	diagnostic_count += 1
}

@(export)
director_compiler_core_diagnostic_count :: proc "c" () -> uintptr {
	return uintptr(diagnostic_count)
}

@(export)
director_compiler_core_diagnostic_code_ptr :: proc "c" (index: uintptr) -> rawptr {
	return raw_data(diagnostics[int(index)].code)
}

@(export)
director_compiler_core_diagnostic_code_len :: proc "c" (index: uintptr) -> uintptr {
	return uintptr(len(diagnostics[int(index)].code))
}

@(export)
director_compiler_core_diagnostic_message_ptr :: proc "c" (index: uintptr) -> rawptr {
	return raw_data(diagnostics[int(index)].message)
}

@(export)
director_compiler_core_diagnostic_message_len :: proc "c" (index: uintptr) -> uintptr {
	return uintptr(len(diagnostics[int(index)].message))
}

@(export)
director_compiler_core_diagnostic_start_byte :: proc "c" (index: uintptr) -> u32 {
	return diagnostics[int(index)].span.start.byte_offset
}

@(export)
director_compiler_core_diagnostic_start_line :: proc "c" (index: uintptr) -> u32 {
	return diagnostics[int(index)].span.start.line
}

@(export)
director_compiler_core_diagnostic_start_column :: proc "c" (index: uintptr) -> u32 {
	return diagnostics[int(index)].span.start.column
}

@(export)
director_compiler_core_diagnostic_end_byte :: proc "c" (index: uintptr) -> u32 {
	return diagnostics[int(index)].span.end.byte_offset
}

@(export)
director_compiler_core_diagnostic_end_line :: proc "c" (index: uintptr) -> u32 {
	return diagnostics[int(index)].span.end.line
}

@(export)
director_compiler_core_diagnostic_end_column :: proc "c" (index: uintptr) -> u32 {
	return diagnostics[int(index)].span.end.column
}
