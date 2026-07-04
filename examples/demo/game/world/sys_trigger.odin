package world

import "../host"
import "logic"

Segment_Trigger :: struct {
	id:   string,
	once: bool,
	used: bool,
}

sys_trigger :: proc(w: ^World) {
	view := logic.view(&w.platformer)
	for entity, platformer in logic.each(&view) {
		if platformer.on_ground && platformer.ground_segment != nil {
			segment_trigger_contact(w, entity, platformer.ground_segment, "ground")
		}
		if platformer.on_wall && platformer.wall_segment != nil {
			segment_trigger_contact(w, entity, platformer.wall_segment, "wall")
		}
	}
}

@(private = "file")
segment_trigger_contact :: proc(w: ^World, entity: logic.Entity, segment: ^[4]int, contact_kind: string) {
	if w.segment_triggers == nil {
		return
	}

	trigger, ok := &w.segment_triggers[segment]
	if !ok {
		return
	}

	if trigger.once && trigger.used {
		return
	}

	host.info("sys_trigger", "segment trigger contact", trigger.id, contact_kind, entity, segment^)

	trigger.used = true
}
