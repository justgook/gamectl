#+build !freestanding
#+build !js
#+build !orca

package main

import runtime "base:runtime"
import "host"
import sapp "sokol/app"

native_init :: proc "c" () {
	context = runtime.default_context()
	app_init()
	app_event(host.initial_event())
}

native_frame :: proc "c" () {
	context = runtime.default_context()

	app_frame()
}

native_cleanup :: proc "c" () {
	context = runtime.default_context()
	app_cleanup()
}

native_event :: proc "c" (e: ^sapp.Event) {
	context = runtime.default_context()
	if event, ok := host.translate_event(e); ok {
		app_event(event)
	}
}

main :: proc() {
	host.run({init = native_init, frame = native_frame, cleanup = native_cleanup}, native_event)
}
