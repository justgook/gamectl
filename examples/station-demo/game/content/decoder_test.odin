#+test

package content

import director "../director"
import station "../station"
import "core:os"
import "core:testing"

clone_bytes :: proc(bytes: []u8) -> []u8 {
	result := make([]u8, len(bytes))
	copy(result, bytes)
	return result
}

write_u32 :: proc(bytes: []u8, offset: int, value: u32) {
	bytes[offset + 0] = u8(value)
	bytes[offset + 1] = u8(value >> 8)
	bytes[offset + 2] = u8(value >> 16)
	bytes[offset + 3] = u8(value >> 24)
}

read_test_u32 :: proc(bytes: []u8, offset: int) -> u32 {
	return(
		u32(bytes[offset]) |
		u32(bytes[offset + 1]) << 8 |
		u32(bytes[offset + 2]) << 16 |
		u32(bytes[offset + 3]) << 24 \
	)
}

slot_offset :: proc(bytes: []u8, slot: int) -> int {
	return int(read_test_u32(bytes, 8 + slot * 8))
}

queries_offset :: proc(bytes: []u8) -> (count_offset, values_offset: int) {
	pos := slot_offset(bytes, 0)
	entity_count := int(read_test_u32(bytes, pos))
	pos += 4
	element_sizes := [?]int{4, 8, 8}
	for _ in 0 ..< entity_count {
		pos += 4
		for element_size in element_sizes {
			count := int(read_test_u32(bytes, pos))
			pos += 4 + count * element_size
		}
		pos += 1
	}
	rule_count := int(read_test_u32(bytes, pos))
	pos += 4 + rule_count * 36
	matcher_count := int(read_test_u32(bytes, pos))
	pos += 4 + matcher_count * 16
	return pos, pos + 4
}

binding_offsets :: proc(bytes: []u8, binding_index: int) -> (kind_offset, name_count_offset, value_offset: int) {
	pos := slot_offset(bytes, 1) + 4
	for index in 0 ..= binding_index {
		kind_offset = pos
		name_count_offset = pos + 4
		name_count := int(read_test_u32(bytes, name_count_offset))
		value_offset = name_count_offset + 4 + name_count
		if index == binding_index {return}
		pos = value_offset + 4
	}
	return
}

expect_rejected :: proc(t: ^testing.T, malformed: []u8, description: string) {
	decoded, ok := read(malformed)
	testing.expectf(t, !ok, "malformed pack must reject %s", description)
	if ok {destroy(&decoded)}
	delete(malformed)
}

@(test)
test_malformed_packs_are_rejected_without_leaks :: proc(t: ^testing.T) {
	bytes, err := os.read_entire_file("station.rspk", context.allocator)
	testing.expectf(t, err == nil, "read station.rspk: %v", err)
	if err != nil {return}
	defer delete(bytes)

	malformed := clone_bytes(bytes)
	query_count_offset, query_values: int
	kind_offset, name_count_offset, value_offset: int
	write_u32(malformed, 8, 0xffffffff)
	expect_rejected(t, malformed, "an overflowing slot offset")

	malformed = clone_bytes(bytes)
	write_u32(malformed, slot_offset(malformed, 0), 0xffffffff)
	expect_rejected(t, malformed, "a vector count larger than the remaining slot before allocation")

	malformed = clone_bytes(bytes)
	_, query_values = queries_offset(malformed)
	write_u32(malformed, query_values, 0xffffffff)
	expect_rejected(t, malformed, "an out-of-range query enum")

	malformed = clone_bytes(bytes)
	_, query_values = queries_offset(malformed)
	write_u32(malformed, query_values, u32(director.Query_Kind.Not))
	write_u32(malformed, query_values + 44, 0)
	expect_rejected(t, malformed, "a directly cyclic Not query")

	malformed = clone_bytes(bytes)
	query_count_offset, query_values = queries_offset(malformed)
	testing.expect(t, read_test_u32(malformed, query_count_offset) >= 2)
	write_u32(malformed, query_values, u32(director.Query_Kind.Not))
	write_u32(malformed, query_values + 44, 1)
	write_u32(malformed, query_values + 48, u32(director.Query_Kind.Not))
	write_u32(malformed, query_values + 48 + 44, 0)
	expect_rejected(t, malformed, "an indirectly cyclic Not query")

	malformed = clone_bytes(bytes)
	_, name_count_offset, _ = binding_offsets(malformed, 0)
	write_u32(malformed, name_count_offset, 0xffffffff)
	expect_rejected(t, malformed, "a string count larger than the remaining slot")

	malformed = clone_bytes(bytes)
	kind_offset, _, _ = binding_offsets(malformed, 0)
	write_u32(malformed, kind_offset, 0xffffffff)
	expect_rejected(t, malformed, "an out-of-range binding enum")

	malformed = clone_bytes(bytes)
	_, _, value_offset = binding_offsets(malformed, 0)
	write_u32(malformed, value_offset, 0xffffffff)
	expect_rejected(t, malformed, "an out-of-range entity binding")

	malformed = clone_bytes(bytes)
	_, name_count_offset, _ = binding_offsets(malformed, 0)
	copy(malformed[name_count_offset + 4:name_count_offset + 10], "BROKEN")
	expect_rejected(t, malformed, "a missing required binding")

	malformed = clone_bytes(bytes)
	kind_offset, name_count_offset, _ = binding_offsets(malformed, 5)
	write_u32(malformed, kind_offset, u32(station.Binding_Kind.Entity))
	copy(malformed[name_count_offset + 4:name_count_offset + 16], "POWER_SWITCH")
	expect_rejected(t, malformed, "a duplicate binding")
}

@(test)
test_development_pack_decodes_and_drives_power_rule :: proc(t: ^testing.T) {
	bytes, err := os.read_entire_file("station.rspk", context.allocator)
	testing.expectf(t, err == nil, "read station.rspk: %v", err)
	if err != nil {return}
	defer delete(bytes)
	decoded, ok := read(bytes)
	testing.expect(t, ok)
	if !ok {return}
	defer destroy(&decoded)
	game := station.init(decoded.data, decoded.bindings)
	defer station.destroy(&game)

	game.player = station.EXIT_POS
	station.interact(&game)
	testing.expect(t, station.is_locked(&game))
	game.player = station.KEY_POS
	station.interact(&game)
	testing.expect(t, station.has_key(&game))
	game.player = station.EXIT_POS
	station.interact(&game)
	testing.expect(t, station.is_locked(&game))
	game.player = station.SWITCH_POS
	station.interact(&game)
	testing.expect(t, station.has_power(&game))
	game.player = station.EXIT_POS
	station.interact(&game)
	testing.expect(t, !station.is_locked(&game))
}
