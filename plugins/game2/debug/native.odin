#+build !freestanding
#+build !js
#+build !orca

package debug

import runtime "base:runtime"
import "core:log"

native_logger: log.Logger

ensure_context_with_logger :: proc() -> runtime.Context {
	ctx := runtime.default_context()
	if native_logger.procedure == nil {
		context = ctx
		native_logger = log.create_console_logger()
	}
	ctx.logger = native_logger
	return ctx
}

logger :: proc "contextless" () -> Logger {
	return Logger{func = sokol_logger_proc}
}

write :: proc(level: Level, tag, message: string) {
	context = ensure_context_with_logger()
	log.logf(map_level(level), "[%s] %s", tag, message)
}

map_level :: proc(level: Level) -> log.Level {
	#partial switch level {
	case .Warning:
		return .Warning
	case .Error:
		return .Error
	case:
		return .Info
	}
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
	context = ensure_context_with_logger()

	tag_text := cstring_or_empty(tag)
	message_text := cstring_or_empty(message)
	file_text := cstring_or_empty(filename)
	loc := runtime.Source_Code_Location {
		file_path = file_text,
		line      = i32(line_nr),
	}

	switch log_level {
	case 0:
		log.panicf("[%s] (%i) %s", tag_text, log_item, message_text, location = loc)
	case 1:
		log.logf(.Error, "[%s] (%i) %s", tag_text, log_item, message_text, location = loc)
	case 2:
		log.logf(.Warning, "[%s] (%i) %s", tag_text, log_item, message_text, location = loc)
	case:
		log.logf(.Info, "[%s] (%i) %s", tag_text, log_item, message_text, location = loc)
	}
}
