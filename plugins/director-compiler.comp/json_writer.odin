package director_compiler

build_director_json :: proc() -> bool {
	output_len = 0
	if !write_text(`{"entities":[`) {return false}
	for entity_index in 0 ..< entity_count {
		if entity_index > 0 && !write_byte(',') {return false}
		entity := entities[entity_index]
		if !write_text(`{"id":`) || !write_int(entity_index) || !write_text(`,"tags":[`) {return false}
		for i in 0 ..< entity.tag_count {
			if i > 0 && !write_byte(',') {return false}
			if !write_int(tags[entity.tag_offset + i]) {return false}
		}
		if !write_text(`],"stats":[`) {return false}
		for i in 0 ..< entity.stat_count {
			if i > 0 && !write_byte(',') {return false}
			stat := stats[entity.stat_offset + i]
			if !write_text(`{"key":`) || !write_int(stat.key) ||
			   !write_text(`,"value":`) || !write_int(int(stat.value)) || !write_byte('}') {return false}
		}
		if !write_text(`],"links":[`) {return false}
		for i in 0 ..< entity.link_count {
			if i > 0 && !write_byte(',') {return false}
			link := links[entity.link_offset + i]
			if !write_text(`{"key":`) || !write_int(link.key) ||
			   !write_text(`,"target":`) || !write_int(link.target) || !write_byte('}') {return false}
		}
		if !write_byte(']') {return false}
		if entity.removed && !write_text(`,"removed":true`) {return false}
		if !write_byte('}') {return false}
	}
	if !write_text(`],"rules":[`) {return false}
	for i in 0 ..< rule_count {
		if i > 0 && !write_byte(',') {return false}
		rule := rules[i]
		if !write_text(`{"id":`) || !write_int(i) ||
		   !write_text(`,"trigger":{"kind":"`) || !write_text(trigger_kind_name(rule.trigger_kind)) ||
		   !write_text(`","signal":`) || !write_int(rule.signal) || !write_text(`,"matcher_index":`) || !write_int(rule.matcher_index) ||
		   !write_text(`},"conditions":{"offset":`) || !write_int(rule.condition_offset) || !write_text(`,"count":`) || !write_int(rule.condition_count) ||
		   !write_text(`},"changes":{"offset":`) || !write_int(rule.change_offset) || !write_text(`,"count":`) || !write_int(rule.change_count) ||
		   !write_text(`},"weight":`) || !write_int(rule.weight) || !write_byte('}') {return false}
	}
	if !write_text(`],"matchers":[`) {return false}
	for i in 0 ..< matcher_count {
		if i > 0 && !write_byte(',') {return false}
		matcher := matchers[i]
		if !write_text(`{"selector":{"kind":"`) || !write_text(selector_kind_name(matcher.selector_kind)) ||
		   !write_text(`","entity":`) || !write_int(matcher.entity) ||
		   !write_text(`},"queries":{"offset":`) || !write_int(matcher.query_offset) ||
		   !write_text(`,"count":`) || !write_int(matcher.query_count) || !write_text(`}}`) {return false}
	}
	if !write_text(`],"queries":[`) {return false}
	for i in 0 ..< query_count {
		if i > 0 && !write_byte(',') {return false}
		query := queries[i]
		if !write_text(`{"kind":"`) || !write_text(query_kind_name(query.kind)) ||
		   !write_text(`","key":`) || !write_int(query.key) ||
		   !write_text(`,"op":"`) || !write_text(compare_op_name(query.op)) || !write_text(`","stat_value":{"kind":"Immediate","entity":0,"key":0,"value":`) || !write_int(int(query.stat_value)) || !write_text(`},`) ||
		   !write_text(`"link_value":{"kind":"Specific_Matcher","matcher_index":`) || !write_int(query.link_matcher) ||
		   !write_text(`,"entity":0,"key":0},"nested":`) || !write_int(query.nested) || !write_byte('}') {return false}
	}
	if !write_text(`],"changes":[`) {return false}
	for i in 0 ..< change_count {
		if i > 0 && !write_byte(',') {return false}
		change := changes[i]
		if !write_text(`{"target":{"kind":"`) || !write_text(change_target_kind_name(change.target_kind)) ||
		   !write_text(`","entity":`) || !write_int(change.entity) || !write_text(`,"matcher_index":`) || !write_int(change.matcher_index) || !write_text(`},`) ||
		   !write_text(`"kind":"`) || !write_text(change_kind_name(change.kind)) || !write_text(`","key":`) || !write_int(change.key) ||
		   !write_text(`,"int_value":`) || !write_int(int(change.int_value)) ||
		   !write_text(`,"link_target":{"kind":"`) || !write_text(link_target_kind_name(change.link_kind)) ||
		   !write_text(`","entity":`) || !write_int(change.link_entity) || !write_text(`,"key":0}}`) {return false}
	}
	if !write_text(`],"value_paths":[],"path_steps":[],"symbols":{"entities":{`) {return false}
	for entity_index in 0 ..< entity_count {
		if entity_index > 0 && !write_byte(',') {return false}
		if !write_byte('"') || !write_canonical_word(entities[entity_index].name, false) ||
		   !write_text(`":`) || !write_int(entity_index) {return false}
	}
	if !write_text(`},"words":{`) {return false}
	for word_index in 0 ..< word_count {
		if word_index > 0 && !write_byte(',') {return false}
		if !write_byte('"') || !write_canonical_word(words[word_index], word_is_signal[word_index]) ||
		   !write_text(`":`) || !write_int(word_index) {return false}
	}
	return write_text(`}}}`)
}

selector_kind_name :: proc(kind: Selector_Kind) -> string {
	switch kind {case .Entity: return "Entity"; case .Any: return "Any"; case .Trigger: return "Trigger"}
	return ""
}

trigger_kind_name :: proc(kind: Trigger_Kind) -> string {
	switch kind {case .Entity_Matcher: return "Entity_Matcher"; case .Signal: return "Signal"}
	return ""
}

change_target_kind_name :: proc(kind: Change_Target_Kind) -> string {
	switch kind {case .Entity: return "Entity"; case .Trigger: return "Trigger"; case .All_Matching: return "All_Matching"}
	return ""
}

compare_op_name :: proc(op: Compare_Op) -> string {
	switch op {case .Eq: return "Eq"; case .Gt: return "Gt"; case .Lt: return "Lt"}
	return ""
}

query_kind_name :: proc(kind: Query_Kind) -> string {
	switch kind {case .Has_Tag: return "Has_Tag"; case .Has_Stat: return "Has_Stat"; case .Has_Link: return "Has_Link"; case .Not: return "Not"}
	return ""
}

change_kind_name :: proc(kind: Change_Kind) -> string {
	switch kind {
	case .Add_Tag: return "Add_Tag"; case .Remove_Property: return "Remove_Property"
	case .Set_Stat: return "Set_Stat"; case .Inc_Stat: return "Inc_Stat"; case .Dec_Stat: return "Dec_Stat"
	case .Set_Link: return "Set_Link"; case .Add_Entity: return "Add_Entity"; case .Remove_Entity: return "Remove_Entity"
	}
	return ""
}

link_target_kind_name :: proc(kind: Link_Target_Kind) -> string {
	switch kind {case .Entity: return "Entity"; case .Trigger: return "Trigger"}
	return ""
}

write_canonical_word :: proc(text: Text_Ref, quoted: bool) -> bool {
	pos := text.start
	for {
		byte, next, ok := canonical_text_next(text, quoted, pos)
		if !ok {return true}
		byte = ascii_lower(byte)
		if byte == '"' || byte == '\\' {
			if !write_byte('\\') {return false}
		}
		if !write_byte(byte) {return false}
		pos = next
	}
}

write_text :: proc(text: string) -> bool {
	data := transmute([]u8)text
	if output_len + len(data) > len(output_buffer) {
		return false
	}
	copy(output_buffer[output_len:output_len + len(data)], data)
	output_len += len(data)
	return true
}

write_byte :: proc(byte: u8) -> bool {
	if output_len >= len(output_buffer) {
		return false
	}
	output_buffer[output_len] = byte
	output_len += 1
	return true
}

write_int :: proc(value: int) -> bool {
	if value == 0 {
		return write_byte('0')
	}
	negative := value < 0
	magnitude: u64
	if negative {
		magnitude = u64(-(value + 1)) + 1
	} else {
		magnitude = u64(value)
	}
	digits: [32]u8
	count := 0
	for magnitude > 0 {
		digits[count] = u8(magnitude % 10) + '0'
		count += 1
		magnitude /= 10
	}
	if negative && !write_byte('-') {
		return false
	}
	for i := count - 1; i >= 0; i -= 1 {
		if !write_byte(digits[i]) {
			return false
		}
	}
	return true
}
