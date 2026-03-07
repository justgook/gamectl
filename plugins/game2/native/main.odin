#+build !freestanding
#+build !js
#+build !orca

package main

import game2 ".."
import sapp "../sokol/app"

main :: proc() {
	app_desc := game2.native_app_desc()
	app_desc.init_cb = game2.native_init
	app_desc.frame_cb = game2.native_frame
	app_desc.cleanup_cb = game2.native_cleanup
	app_desc.event_cb = game2.native_event
	sapp.run(app_desc)
}
