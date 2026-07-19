package director_compiler

MAX_ENTITIES :: 512
MAX_WORDS :: 2048
MAX_TAGS :: 4096
MAX_STATS :: 4096
MAX_LINKS :: 4096

Text_Ref :: struct {
	start: int,
	end:   int,
}

Entity_Source :: struct {
	name:         Text_Ref,
	tag_offset:   int,
	tag_count:    int,
	stat_offset:  int,
	stat_count:   int,
	link_offset:  int,
	link_count:   int,
	removed:      bool,
}

Stat_Source :: struct {
	key:   int,
	value: i32,
}

Link_Source :: struct {
	key:         int,
	target_name: Text_Ref,
	target:      int,
}

entities: [MAX_ENTITIES]Entity_Source
entity_count: int
words: [MAX_WORDS]Text_Ref
word_is_signal: [MAX_WORDS]bool
word_count: int
tags: [MAX_TAGS]int
tag_count: int
stats: [MAX_STATS]Stat_Source
stat_count: int
links: [MAX_LINKS]Link_Source
link_count: int
compiler_source: []u8

compile_entities :: proc(source: []u8) -> bool {
	reset_compiler(source)
	cursor := 0
	current_entity := -1
	line: u32 = 1

	for cursor < len(source) {
		line_start := cursor
		for cursor < len(source) && source[cursor] != '\n' {
			cursor += 1
		}
		line_end := cursor
		if cursor < len(source) {
			cursor += 1
		}

		content_end := source_content_end(line_start, line_end)
		for content_end > line_start && is_horizontal_space(source[content_end - 1]) {
			content_end -= 1
		}
		first := line_start
		for first < content_end && is_horizontal_space(source[first]) {
			first += 1
		}
		if first == content_end {
			line += 1
			continue
		}

		if source[first] == '.' {
			if current_entity < 0 {
				add_simple_diagnostic("parse-orphan-continuation", "property continuation has no preceding expression", first, first + 1, line)
				return false
			}
			if !parse_entity_properties(current_entity, first, content_end, line) {
				return false
			}
			line += 1
			continue
		}

		if first != line_start {
			add_simple_diagnostic("parse-unexpected-indentation", "indented expression is valid only inside IF or DO", first, content_end, line)
			return false
		}
		if starts_rule_keyword(source[first:content_end]) {
			if !resolve_entity_links() {
				return false
			}
			return parse_rules_from(first, line)
		}
		if entity_count >= MAX_ENTITIES {
			add_simple_diagnostic("semantic-unrepresentable-ir", "entity limit exceeded", first, content_end, line)
			return false
		}

		removed := false
		name_start := first
		if source[name_start] == '-' {
			removed = true
			name_start += 1
		}
		name, after_name, ok := parse_entity_identifier(name_start, content_end)
		if !ok {
			add_simple_diagnostic("parse-unexpected-token", "expected entity identifier", name_start, content_end, line)
			return false
		}
		for i in 0 ..< entity_count {
			if text_equal_fold(entities[i].name, name) {
				add_simple_diagnostic("semantic-duplicate-entity", "duplicate entity declaration", name.start, name.end, line)
				return false
			}
		}

		current_entity = entity_count
		entities[entity_count] = Entity_Source {
			name = name,
			tag_offset = tag_count,
			stat_offset = stat_count,
			link_offset = link_count,
			removed = removed,
		}
		entity_count += 1
		pos := skip_horizontal_space(after_name, content_end)
		if pos < content_end && !parse_entity_properties(current_entity, pos, content_end, line) {
			return false
		}
		line += 1
	}

	return resolve_entity_links()
}

reset_compiler :: proc(source: []u8) {
	compiler_source = source
	entity_count = 0
	word_count = 0
	tag_count = 0
	stat_count = 0
	link_count = 0
	reset_rules()
}

parse_entity_properties :: proc(entity_index, start, end: int, line: u32) -> bool {
	pos := start
	for pos < end {
		pos = skip_horizontal_space(pos, end)
		if pos >= end {
			return true
		}
		if compiler_source[pos] != '.' {
			add_simple_diagnostic("parse-unexpected-token", "expected '.' before entity property", pos, pos + 1, line)
			return false
		}
		pos += 1
		pos = skip_horizontal_space(pos, end)
		property, next, ok := parse_property_identifier(pos, end)
		if !ok {
			add_simple_diagnostic("parse-unexpected-token", "expected property name", pos, min(pos + 1, end), line)
			return false
		}
		word := intern_word(property)
		if word < 0 {
			add_simple_diagnostic("semantic-unrepresentable-ir", "word limit exceeded", property.start, property.end, line)
			return false
		}
		pos = skip_horizontal_space(next, end)
		if pos < end && compiler_source[pos] == '=' {
			pos += 1
			pos = skip_horizontal_space(pos, end)
			if pos >= end {
				add_simple_diagnostic("parse-unexpected-token", "expected value after '='", pos, pos, line)
				return false
			}
			value, value_end, number_ok := parse_i32(pos, end)
			if number_ok {
				if stat_count >= MAX_STATS {
					add_simple_diagnostic("semantic-unrepresentable-ir", "stat limit exceeded", property.start, property.end, line)
					return false
				}
				stats[stat_count] = Stat_Source {key = word, value = value}
				stat_count += 1
				entities[entity_index].stat_count += 1
				pos = value_end
			} else {
				target, target_end, target_ok := parse_entity_identifier(pos, end)
				if !target_ok {
					add_simple_diagnostic("parse-unexpected-token", "expected integer or entity link target", pos, min(pos + 1, end), line)
					return false
				}
				if link_count >= MAX_LINKS {
					add_simple_diagnostic("semantic-unrepresentable-ir", "link limit exceeded", property.start, property.end, line)
					return false
				}
				links[link_count] = Link_Source {key = word, target_name = target, target = -1}
				link_count += 1
				entities[entity_index].link_count += 1
				pos = target_end
			}
		} else {
			if tag_count >= MAX_TAGS {
				add_simple_diagnostic("semantic-unrepresentable-ir", "tag limit exceeded", property.start, property.end, line)
				return false
			}
			tags[tag_count] = word
			tag_count += 1
			entities[entity_index].tag_count += 1
		}
		pos = skip_horizontal_space(pos, end)
		if pos < end && compiler_source[pos] != '.' {
			add_simple_diagnostic("parse-unexpected-token", "unexpected text after entity property", pos, pos + 1, line)
			return false
		}
	}
	return true
}

resolve_entity_links :: proc() -> bool {
	for i in 0 ..< link_count {
		found := -1
		for entity_index in 0 ..< entity_count {
			if text_equal_fold(links[i].target_name, entities[entity_index].name) {
				found = entity_index
				break
			}
		}
		if found < 0 {
			line := line_for_offset(links[i].target_name.start)
			add_simple_diagnostic("semantic-unknown-entity", "unknown entity reference", links[i].target_name.start, links[i].target_name.end, line)
			return false
		}
		links[i].target = found
	}
	return true
}

intern_word :: proc(text: Text_Ref) -> int {
	return intern_canonical_word(text, false)
}

intern_signal_word :: proc(text: Text_Ref) -> int {
	return intern_canonical_word(text, true)
}

intern_canonical_word :: proc(text: Text_Ref, quoted: bool) -> int {
	for i in 0 ..< word_count {
		if canonical_text_equal(words[i], word_is_signal[i], text, quoted) {
			return i
		}
	}
	if word_count >= MAX_WORDS {
		return -1
	}
	result := word_count
	words[word_count] = text
	word_is_signal[word_count] = quoted
	word_count += 1
	return result
}

canonical_text_equal :: proc(left: Text_Ref, left_quoted: bool, right: Text_Ref, right_quoted: bool) -> bool {
	left_pos, right_pos := left.start, right.start
	for {
		left_byte, left_next, left_ok := canonical_text_next(left, left_quoted, left_pos)
		right_byte, right_next, right_ok := canonical_text_next(right, right_quoted, right_pos)
		if left_ok != right_ok {return false}
		if !left_ok {return true}
		if ascii_lower(left_byte) != ascii_lower(right_byte) {return false}
		left_pos, right_pos = left_next, right_next
	}
}

canonical_text_next :: proc(text: Text_Ref, quoted: bool, pos: int) -> (u8, int, bool) {
	if pos >= text.end {return 0, pos, false}
	if quoted && compiler_source[pos] == '\\' {
		return compiler_source[pos + 1], pos + 2, true
	}
	return compiler_source[pos], pos + 1, true
}

parse_entity_identifier :: proc(start, end: int) -> (Text_Ref, int, bool) {
	if start >= end || !is_ascii_alpha(compiler_source[start]) {
		return Text_Ref{}, start, false
	}
	pos := start + 1
	for pos < end && is_entity_identifier_byte(compiler_source[pos]) {
		pos += 1
	}
	return Text_Ref {start = start, end = pos}, pos, true
}

parse_property_identifier :: proc(start, end: int) -> (Text_Ref, int, bool) {
	if start >= end || !is_property_start_byte(compiler_source[start]) {
		return Text_Ref{}, start, false
	}
	pos := start + 1
	for pos < end && is_property_name_byte(compiler_source[pos]) {
		pos += 1
	}
	return Text_Ref {start = start, end = pos}, pos, true
}

parse_i32 :: proc(start, end: int) -> (i32, int, bool) {
	pos := start
	negative := false
	if pos < end && compiler_source[pos] == '-' {
		negative = true
		pos += 1
	}
	if pos >= end || compiler_source[pos] < '0' || compiler_source[pos] > '9' {
		return 0, start, false
	}
	value: i64 = 0
	for pos < end && compiler_source[pos] >= '0' && compiler_source[pos] <= '9' {
		value = value * 10 + i64(compiler_source[pos] - '0')
		pos += 1
	}
	if negative {
		value = -value
	}
	if value < -2147483648 || value > 2147483647 {
		return 0, start, false
	}
	return i32(value), pos, true
}

text_equal_fold :: proc(left, right: Text_Ref) -> bool {
	if left.end - left.start != right.end - right.start {
		return false
	}
	for i in 0 ..< left.end - left.start {
		if ascii_lower(compiler_source[left.start + i]) != ascii_lower(compiler_source[right.start + i]) {
			return false
		}
	}
	return true
}

line_for_offset :: proc(offset: int) -> u32 {
	line: u32 = 1
	for i in 0 ..< min(offset, len(compiler_source)) {
		if compiler_source[i] == '\n' {
			line += 1
		}
	}
	return line
}

column_for_offset :: proc(offset: int) -> u32 {
	column: u32 = 1
	i := offset - 1
	for i >= 0 && compiler_source[i] != '\n' {
		column += 1
		i -= 1
	}
	return column
}

add_simple_diagnostic :: proc(code, message: string, start, end: int, line: u32) {
	_ = line
	add_diagnostic(
		code,
		message,
		position(start, line_for_offset(start), column_for_offset(start)),
		position(end, line_for_offset(end), column_for_offset(end)),
	)
}

skip_horizontal_space :: proc(start, end: int) -> int {
	pos := start
	for pos < end && is_horizontal_space(compiler_source[pos]) {
		pos += 1
	}
	return pos
}

source_content_end :: proc(start, end: int) -> int {
	quoted := false
	escaped := false
	for i in start ..< end {
		byte := compiler_source[i]
		if quoted {
			if escaped {
				escaped = false
			} else if byte == '\\' {
				escaped = true
			} else if byte == '"' {
				quoted = false
			}
		} else if byte == '"' {
			quoted = true
		} else if byte == '#' {
			return i
		}
	}
	return end
}

starts_rule_keyword :: proc(line: []u8) -> bool {
	if len(line) < 2 {
		return false
	}
	keywords := [?]string{"on", "if", "do"}
	for keyword in keywords {
		if len(line) >= len(keyword) + 1 {
			matches := true
			for i in 0 ..< len(keyword) {
				if ascii_lower(line[i]) != keyword[i] {
					matches = false
					break
				}
			}
			if matches && line[len(keyword)] == ':' {
				return true
			}
		}
	}
	return false
}

is_horizontal_space :: proc(byte: u8) -> bool {
	return byte == ' ' || byte == '\t' || byte == '\r'
}

is_ascii_alpha :: proc(byte: u8) -> bool {
	return (byte >= 'a' && byte <= 'z') || (byte >= 'A' && byte <= 'Z')
}

is_entity_identifier_byte :: proc(byte: u8) -> bool {
	return is_ascii_alpha(byte) || (byte >= '0' && byte <= '9') ||
	       byte == '_' || byte == '-' || byte == ':' || byte == '+'
}

is_property_start_byte :: proc(byte: u8) -> bool {
	return is_ascii_alpha(byte) || (byte >= '0' && byte <= '9') || byte == '_' || byte == ':'
}

is_property_name_byte :: proc(byte: u8) -> bool {
	return is_property_start_byte(byte)
}

ascii_lower :: proc(byte: u8) -> u8 {
	if byte >= 'A' && byte <= 'Z' {
		return byte + ('a' - 'A')
	}
	return byte
}
