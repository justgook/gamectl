package director_compiler

import mem "core:mem"
import runtime "base:runtime"

OUTPUT_CAPACITY :: 2 * 1024 * 1024

output_buffer: [OUTPUT_CAPACITY]u8
output_len: int

@(export)
director_compiler_core_compile :: proc "c" (source_ptr: rawptr, source_count: uintptr) -> u32 {
	context = runtime.default_context()
	source := source_slice(source_ptr, source_count)
	scan_source(source)
	if diagnostic_count > 0 {
		output_len = 0
		return 1
	}
	if !compile_entities(source) {
		output_len = 0
		return 1
	}
	if !build_director_json() {
		add_diagnostic(
			"semantic-unrepresentable-ir",
			"compiled JSON exceeds output capacity",
			position(0, 1, 1),
			position(0, 1, 1),
		)
		output_len = 0
		return 1
	}
	return 0
}

@(export)
director_compiler_core_output_ptr :: proc "c" () -> rawptr {
	if output_len == 0 {
		return nil
	}
	return rawptr(&output_buffer[0])
}

@(export)
director_compiler_core_output_len :: proc "c" () -> uintptr {
	return uintptr(output_len)
}

source_slice :: proc(ptr: rawptr, count: uintptr) -> []u8 {
	if count == 0 {
		return []u8{}
	}
	return mem.slice_ptr(cast(^u8)ptr, int(count))
}

