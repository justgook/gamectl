#+build freestanding

package debug

import runtime "base:runtime"
import "core:fmt"

foreign import env "env"

@(default_calling_convention = "c")
foreign env {
	js_log :: proc(level: u32, tag_ptr: u32, tag_len: u32, message_ptr: u32, message_len: u32) ---
}

logger :: proc "contextless" () -> Logger {
	return Logger{func = sokol_logger_proc}
}

write :: proc(level: Level, tag, message: string) {
	context = runtime.default_context()
	tag_ptr, tag_len := string_ptr_and_len(tag)
	message_ptr, message_len := string_ptr_and_len(message)
	js_log(u32(level), tag_ptr, tag_len, message_ptr, message_len)
}

string_ptr_and_len :: proc(value: string) -> (u32, u32) {
	bytes := transmute([]u8)value
	if len(bytes) == 0 {
		return 0, 0
	}
	return u32(uintptr(&bytes[0])), u32(len(bytes))
}

cstring_or_empty :: proc(value: cstring) -> string {
	if value == nil {
		return ""
	}
	return string(value)
}

sokol_logger_proc :: proc "c" (
	tag: cstring,
	log_level: u32,
	log_item: u32,
	message: cstring,
	line_nr: u32,
	filename: cstring,
	_: rawptr,
) {
	context = runtime.default_context()

	tag_text := cstring_or_empty(tag)
	message_text := cstring_or_empty(message)
	write(sokol_level(log_level), tag_text, fmt.tprintf("(%d) %s", log_item, message_text))
	if log_level == 0 {
		assert(
			false,
			fmt.tprintf(
				"sokol panic at %s:%d: %s",
				cstring_or_empty(filename),
				line_nr,
				message_text,
			),
		)
	}
}

sokol_level :: proc(log_level: u32) -> Level {
	switch log_level {
	case 1:
		return .Error
	case 2:
		return .Warning
	case:
		return .Info
	}
}
