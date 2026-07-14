#+build !freestanding
#+build !js
#+build !orca
#+test

package world

import "../director"
import "core:testing"

@(test)
test_load_segment_triggers_resolves_serialized_coordinates :: proc(t: ^testing.T) {
	w := new(World)
	defer free(w)
	append(&w.segments, [4]int{0, 0, 64, 0})
	append(&w.segments, [4]int{128, 16, 256, 64})
	defer delete(w.segments)

	defs := [1]Segment_Trigger_Def {{
		segment         = {128, 16, 256, 64},
		id              = "demo.room_001.enter",
		once            = true,
		director_signal = director.Word_Id(2),
	}}
	load_segment_triggers(w, defs[:])
	defer delete(w.segment_triggers)

	trigger, ok := &w.segment_triggers[&w.segments[1]]
	testing.expectf(t, ok, "expected trigger for matching segment")
	testing.expectf(t, trigger.id == "demo.room_001.enter", "trigger id = %q", trigger.id)
	testing.expectf(t, trigger.once, "trigger should be once-only")
	testing.expectf(t, trigger.director_signal == director.Word_Id(2), "director signal = %v", trigger.director_signal)
}
