#+build !freestanding
#+build !js
#+build !orca
#+private
package host

import sapp "../sokol/app"
import sg "../sokol/gfx"
import sglue "../sokol/glue"
import runtime "base:runtime"
import "core:fmt"
import "core:log"
import "core:mem"
import "core:os"
import "core:strings"


when ODIN_DEBUG {
	track: mem.Tracking_Allocator
}

native_logger: log.Logger
default_context_host :: proc() -> runtime.Context {
	ctx := runtime.default_context()

	when ODIN_DEBUG {
		mem.tracking_allocator_init(&track, ctx.allocator)
		ctx.allocator = mem.tracking_allocator(&track)
	}

	if native_logger.procedure == nil {
		context = ctx
		native_logger = log.create_console_logger()
	}
	ctx.logger = native_logger

	return ctx
}

logger_host :: proc() -> Logger {
	return Logger{func = sokol_logger_proc}
}

write :: proc(level: Level, tag, message: string, args: ..any, location := #caller_location) {
	formatted_message := format_message(message, ..args)
	log.logf(map_level(level), "[%s] %s", tag, formatted_message, location = location)
}

format_message :: proc(message: string, args: ..any) -> string {
	if len(args) == 0 {
		return message
	}
	if strings.contains(message, "%") {
		return fmt.tprintf(message, ..args)
	}
	builder: strings.Builder
	strings.builder_init(&builder, context.temp_allocator)
	strings.write_string(&builder, message)
	for arg in args {
		strings.write_byte(&builder, ' ')
		fmt.sbprint(&builder, arg)
	}
	return strings.to_string(builder)
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
	context = default_context_host()

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

/// LOGGER END

GAME_ASSET_PREFIX :: "/game/"

asset_name_from_path :: proc(path: string) -> (string, bool) {
	if !strings.has_prefix(path, GAME_ASSET_PREFIX) {
		return "", false
	}
	name := path[len(GAME_ASSET_PREFIX):]
	if len(name) == 0 {
		return "", false
	}
	if strings.contains(name, "..") {
		return "", false
	}
	if strings.contains(name, "/") {
		return "", false
	}
	return name, true
}


asset_read_all_host :: proc(path: string) -> ([]u8, bool) {
	name, ok := asset_name_from_path(path)
	if !ok {
		assert(false, fmt.tprintf("native asset read rejected invalid path: %s", path))
		return nil, false
	}
	candidates := [4]string {
		fmt.tprintf("../../assets/%s", name),
		fmt.tprintf("../../example/%s", name),
		fmt.tprintf("example/%s", name),
		name,
	}
	for candidate in candidates {
		if data, err := os.read_entire_file(candidate, context.allocator); err == nil {
			return data, true
		}
	}
	assert(
		false,
		fmt.tprintf(
			"native asset not found: %s (tried: %s, %s, %s, %s)",
			path,
			candidates[0],
			candidates[1],
			candidates[2],
			candidates[3],
		),
	)
	return nil, false
}


swapchain_host :: proc() -> sg.Swapchain {
	return sglue.swapchain()
}


frame_duration_host :: proc() -> f64 {
	return sapp.frame_duration()
}


widthf_host :: proc() -> f32 {
	return sapp.widthf()
}


heightf_host :: proc() -> f32 {
	return sapp.heightf()
}


setup_graphics_host :: proc() {
	logger := transmute(sg.Logger)logger_host()
	sg.setup({environment = sglue.environment(), logger = logger})
}

shutdown_graphics_host :: proc() {
	sg.shutdown()
	log.destroy_console_logger(native_logger)
	when ODIN_DEBUG {
		info("mem", "------------------------------------------------------------")
		defer info("mem", "------------------------------------------------------------")
		if len(track.allocation_map) > 0 {
			info("mem", "=== %v allocations not freed: ===\n", len(track.allocation_map))

			for _, entry in track.allocation_map {
				info("mem", "- %v bytes @ %v\n", entry.size, entry.location)
			}
		}

		mem.tracking_allocator_destroy(&track)
	}
}
