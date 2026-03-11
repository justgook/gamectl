package debug

Level :: enum u32 {
	Debug,
	Info,
	Warning,
	Error,
}

Logger :: struct {
	func:      proc "c" (
		tag: cstring,
		log_level: u32,
		log_item: u32,
		message: cstring,
		line_nr: u32,
		filename: cstring,
		user_data: rawptr,
	),
	user_data: rawptr,
}

DEBUG_LOG :: #config(DEBUG_LOG, ODIN_DEBUG)

info :: proc(tag, message: string) {
	write(.Info, tag, message)
}

warn :: proc(tag, message: string) {
	write(.Warning, tag, message)
}

error :: proc(tag, message: string) {
	write(.Error, tag, message)
}

debug :: proc(tag, message: string) {
	when DEBUG_LOG {
		write(.Debug, tag, message)
	}
}
