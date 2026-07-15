package director_compiler

MAX_RULES :: 512
MAX_MATCHERS :: 4096
MAX_QUERIES :: 16384
MAX_CHANGES :: 16384
MAX_MATCHER_QUERIES :: 128

Selector_Kind :: enum {Entity, Any, Trigger}
Query_Kind :: enum {Has_Tag, Has_Stat, Has_Link, Not}
Compare_Op :: enum {Eq, Gt, Lt}
Change_Target_Kind :: enum {Entity, Trigger, All_Matching}
Change_Kind :: enum {Add_Tag, Remove_Property, Set_Stat, Inc_Stat, Dec_Stat, Set_Link, Spawn_Entity, Remove_Entity}
Link_Target_Kind :: enum {Entity, Trigger}

Rule_Data :: struct {
	matcher_index:    int,
	condition_offset: int,
	condition_count:  int,
	change_offset:    int,
	change_count:     int,
	weight:           int,
}

Matcher_Data :: struct {
	selector_kind: Selector_Kind,
	entity:        int,
	query_offset:  int,
	query_count:   int,
}

Query_Data :: struct {
	kind:          Query_Kind,
	key:           int,
	nested:        int,
	link_matcher:  int,
	stat_value:    i32,
	op:            Compare_Op,
}

Change_Data :: struct {
	target_kind: Selector_Kind,
	entity:      int,
	kind:        Change_Kind,
	key:         int,
	int_value:   i32,
	link_kind:   Link_Target_Kind,
	link_entity: int,
}

Matcher_Query_Source :: struct {
	key:         int,
	kind:        Query_Kind,
	negated:     bool,
	link_entity: int,
	stat_value:  i32,
	op:          Compare_Op,
}

rules: [MAX_RULES]Rule_Data
rule_count: int
matchers: [MAX_MATCHERS]Matcher_Data
matcher_count: int
queries: [MAX_QUERIES]Query_Data
query_count: int
changes: [MAX_CHANGES]Change_Data
change_count: int

reset_rules :: proc() {
	rule_count = 0
	matcher_count = 0
	query_count = 0
	change_count = 0
}

parse_rules_from :: proc(start: int, start_line: u32) -> bool {
	cursor := start
	line := start_line
	active_rule := -1
	has_do := false
	section := 0

	for cursor < len(compiler_source) {
		line_start := cursor
		for cursor < len(compiler_source) && compiler_source[cursor] != '\n' {cursor += 1}
		line_end := cursor
		if cursor < len(compiler_source) {cursor += 1}
		content_end := line_end
		for i in line_start ..< line_end {
			if compiler_source[i] == '#' {content_end = i; break}
		}
		for content_end > line_start && is_horizontal_space(compiler_source[content_end-1]) {content_end -= 1}
		first := line_start
		for first < content_end && is_horizontal_space(compiler_source[first]) {first += 1}
		if first == content_end {line += 1; continue}
		if first != line_start {
			if active_rule < 0 || (section != 1 && section != 2) {
				add_simple_diagnostic("parse-unexpected-indentation", "indented expression requires active IF or DO section", first, content_end, line)
				return false
			}
			if section == 1 {
				matcher_index, ok := parse_matcher(first, content_end, line)
				if !ok {return false}
				expected := rules[active_rule].condition_offset + rules[active_rule].condition_count
				if matcher_index != expected {
					add_simple_diagnostic("semantic-unrepresentable-ir", "nested condition matchers interrupted contiguous condition range", first, content_end, line)
					return false
				}
				rules[active_rule].condition_count += 1
				rules[active_rule].weight += matcher_weight(matchers[matcher_index], true)
			} else {
				before := change_count
				if !parse_change(first, content_end, line) {return false}
				rules[active_rule].change_count += change_count - before
			}
			line += 1
			continue
		}

		keyword_end := first
		for keyword_end < content_end && is_ascii_alpha(compiler_source[keyword_end]) {keyword_end += 1}
		if keyword_end >= content_end || compiler_source[keyword_end] != ':' {
			add_simple_diagnostic("parse-unexpected-token", "expected ON, IF, or DO rule section", first, content_end, line)
			return false
		}
		value_start := skip_horizontal_space(keyword_end + 1, content_end)
		if value_start >= content_end {
			add_simple_diagnostic("parse-missing-inline-expression", "rule section requires an inline expression", keyword_end + 1, content_end, line)
			return false
		}
		keyword := Text_Ref{start=first, end=keyword_end}
		if text_equals_literal(keyword, "on") {
			if active_rule >= 0 && !has_do {
				add_simple_diagnostic("parse-missing-do", "rule requires DO section", first, keyword_end, line)
				return false
			}
			if rule_count >= MAX_RULES {return false}
			matcher_index, ok := parse_matcher(value_start, content_end, line)
			if !ok {return false}
			active_rule = rule_count
			rules[rule_count] = Rule_Data{
				matcher_index=matcher_index,
				condition_offset=0,
				change_offset=change_count,
				weight=matcher_weight(matchers[matcher_index], false),
			}
			rule_count += 1
			has_do = false
			section = 0
		} else if text_equals_literal(keyword, "do") {
			if active_rule < 0 || has_do {
				add_simple_diagnostic("parse-invalid-rule-order", "DO requires one active rule after ON", first, keyword_end, line)
				return false
			}
			before := change_count
			if !parse_change(value_start, content_end, line) {return false}
			rules[active_rule].change_count += change_count - before
			has_do = true
			section = 2
		} else if text_equals_literal(keyword, "if") {
			if active_rule < 0 || section != 0 || has_do {
				add_simple_diagnostic("parse-invalid-rule-order", "IF must occur once between ON and DO", first, keyword_end, line)
				return false
			}
			matcher_index, ok := parse_matcher(value_start, content_end, line)
			if !ok {return false}
			rules[active_rule].condition_offset = matcher_index
			rules[active_rule].condition_count = 1
			rules[active_rule].weight += matcher_weight(matchers[matcher_index], true)
			section = 1
		} else {
			add_simple_diagnostic("parse-unexpected-token", "unknown rule section", first, keyword_end, line)
			return false
		}
		line += 1
	}
	if active_rule >= 0 && !has_do {
		add_simple_diagnostic("parse-missing-do", "rule requires DO section", len(compiler_source), len(compiler_source), line)
		return false
	}
	return true
}

matcher_weight :: proc(matcher: Matcher_Data, condition: bool) -> int {
	base := 0
	if matcher.selector_kind == .Entity {
		if condition {base = 10} else {base = 100}
	}
	return base + matcher.query_count
}

parse_matcher :: proc(start, end: int, line: u32) -> (int, bool) {
	if matcher_count >= MAX_MATCHERS {return -1, false}
	pos := start
	selector_kind := Selector_Kind.Entity
	selector_entity := 0
	if compiler_source[pos] == '*' {
		selector_kind = .Any
		pos += 1
	} else if compiler_source[pos] == '$' {
		selector_kind = .Trigger
		pos += 1
	} else {
		name, next, ok := parse_entity_identifier(pos, end)
		if !ok {return -1, false}
		selector_entity = find_entity(name)
		if selector_entity < 0 {
			add_simple_diagnostic("semantic-unknown-entity", "unknown entity reference", name.start, name.end, line)
			return -1, false
		}
		pos = next
	}

	matcher_index := matcher_count
	matcher_count += 1
	query_sources: [MAX_MATCHER_QUERIES]Matcher_Query_Source
	source_count := 0
	for {
		pos = skip_horizontal_space(pos, end)
		if pos >= end {break}
		if compiler_source[pos] != '.' {
			add_simple_diagnostic("parse-unexpected-token", "expected matcher query", pos, pos+1, line)
			return -1, false
		}
		pos += 1
		pos = skip_horizontal_space(pos, end)
		negated := false
		if pos < end && compiler_source[pos] == '!' {negated = true; pos += 1}
		property, next, ok := parse_property_identifier(pos, end)
		if !ok {return -1, false}
		key := intern_word(property)
		pos = skip_horizontal_space(next, end)
		query := Matcher_Query_Source{key=key, kind=.Has_Tag, negated=negated, link_entity=-1, op=.Eq}
		if pos < end && (compiler_source[pos] == '=' || compiler_source[pos] == '<' || compiler_source[pos] == '>') {
			operator := compiler_source[pos]
			if operator == '<' {query.op = .Lt} else if operator == '>' {query.op = .Gt}
			pos += 1
			pos = skip_horizontal_space(pos, end)
			value, value_end, number_ok := parse_i32(pos, end)
			if number_ok {
				query.kind = .Has_Stat
				query.stat_value = value
				pos = value_end
			} else {
				if operator != '=' {return -1, false}
				target, target_end, target_ok := parse_entity_identifier(pos, end)
				if !target_ok {return -1, false}
				query.kind = .Has_Link
				query.link_entity = find_entity(target)
				if query.link_entity < 0 {
					add_simple_diagnostic("semantic-unknown-entity", "unknown entity reference", target.start, target.end, line)
					return -1, false
				}
				pos = target_end
			}
		}
		if source_count >= MAX_MATCHER_QUERIES {return -1, false}
		query_sources[source_count] = query
		source_count += 1
	}

	query_offset := query_count
	nested_indices: [MAX_MATCHER_QUERIES]int
	aux_indices: [MAX_MATCHER_QUERIES]int
	for i in 0 ..< source_count {nested_indices[i] = -1; aux_indices[i] = -1}
	for i in 0 ..< source_count {
		source_query := query_sources[i]
		positive := Query_Data{kind=source_query.kind, key=source_query.key, nested=0, link_matcher=0, stat_value=source_query.stat_value, op=source_query.op}
		if source_query.kind == .Has_Link {
			aux := matcher_count
			matcher_count += 1
			matchers[aux] = Matcher_Data{selector_kind=.Entity, entity=source_query.link_entity}
			positive.link_matcher = aux
			aux_indices[i] = aux
		}
		if source_query.negated {
			queries[query_count] = Query_Data{kind=.Not, nested=-1}
			nested_indices[i] = query_count
		} else {
			queries[query_count] = positive
		}
		query_count += 1
	}
	for i in 0 ..< source_count {
		if nested_indices[i] >= 0 {
			source_query := query_sources[i]
			positive := Query_Data{kind=source_query.kind, key=source_query.key, stat_value=source_query.stat_value, op=source_query.op}
			if source_query.kind == .Has_Link {positive.link_matcher = aux_indices[i]}
			queries[nested_indices[i]].nested = query_count
			queries[query_count] = positive
			query_count += 1
		}
	}
	for i in 0 ..< source_count {
		if aux_indices[i] >= 0 {matchers[aux_indices[i]].query_offset = query_count}
	}
	matchers[matcher_index] = Matcher_Data{selector_kind=selector_kind, entity=selector_entity, query_offset=query_offset, query_count=source_count}
	return matcher_index, true
}

parse_change :: proc(start, end: int, line: u32) -> bool {
	pos := start
	target_kind := Selector_Kind.Entity
	target_entity := 0
	if compiler_source[pos] == '$' {
		target_kind = .Trigger
		pos += 1
	} else {
		name, next, ok := parse_entity_identifier(pos, end)
		if !ok {return false}
		target_entity = find_entity(name)
		if target_entity < 0 {return false}
		pos = next
	}
	pos = skip_horizontal_space(pos, end)
	if pos >= end || compiler_source[pos] != '.' {return false}
	pos += 1
	pos = skip_horizontal_space(pos, end)
	property, next, ok := parse_property_identifier(pos, end)
	if !ok {return false}
	key := intern_word(property)
	pos = skip_horizontal_space(next, end)
	if pos >= end || compiler_source[pos] != '=' {return false}
	pos += 1
	pos = skip_horizontal_space(pos, end)
	link_kind := Link_Target_Kind.Entity
	link_entity := 0
	change_kind := Change_Kind.Set_Link
	int_value: i32 = 0
	value, value_end, number_ok := parse_i32(pos, end)
	if number_ok {
		change_kind = .Set_Stat
		int_value = value
		pos = value_end
	} else if pos < end && compiler_source[pos] == '$' {
		link_kind = .Trigger
		pos += 1
	} else {
		target, target_end, target_ok := parse_entity_identifier(pos, end)
		if !target_ok {return false}
		link_entity = find_entity(target)
		if link_entity < 0 {
			add_simple_diagnostic("semantic-unknown-entity", "unknown entity reference", target.start, target.end, line)
			return false
		}
		pos = target_end
	}
	pos = skip_horizontal_space(pos, end)
	if pos != end {return false}
	changes[change_count] = Change_Data{
		target_kind=target_kind, entity=target_entity, kind=change_kind, key=key,
		int_value=int_value, link_kind=link_kind, link_entity=link_entity,
	}
	change_count += 1
	return true
}

find_entity :: proc(name: Text_Ref) -> int {
	for i in 0 ..< entity_count {
		if text_equal_fold(name, entities[i].name) {return i}
	}
	return -1
}

text_equals_literal :: proc(text: Text_Ref, literal: string) -> bool {
	if text.end-text.start != len(literal) {return false}
	for i in 0 ..< len(literal) {
		if ascii_lower(compiler_source[text.start+i]) != literal[i] {return false}
	}
	return true
}
