package world

import "logic"

// Timer component - counts down frames and triggers callbacks
// Can be used for:
// - Timed effects (screen flash, invincibility)
// - Delayed actions
// - Cooldowns (when attached to ability entities)
// - Particle lifetimes
Timer :: struct {
	frames:             int, // Remaining frames (decrements each tick)
	data:               rawptr, // Optional data pointer for callbacks
	disable_autofree:   bool, // If true, don't free `data` on complete
	delete_on_complete: bool, //TODO reaneme to delete_self_only - default fals, and if set to false - deletes also component.  original: If true, delete the entity when timer ends (default: true for backwards compat)
	on_update:          proc(w: ^World, entity: int, data: rawptr), // Called each frame while active
	on_complete:        proc(w: ^World, entity: int, data: rawptr), // Called when timer reaches 0
}

// Create a simple timer that deletes the entity on completion
timer_create :: proc(
	frames: int,
	on_complete: proc(w: ^World, entity: int, data: rawptr) = nil,
) -> Timer {
	return Timer{frames = frames, on_complete = on_complete, delete_on_complete = true}
}

// Create a timer with update callback (useful for effects that change over time)
timer_create_with_update :: proc(
	frames: int,
	on_update: proc(w: ^World, entity: int, data: rawptr),
	on_complete: proc(w: ^World, entity: int, data: rawptr) = nil,
) -> Timer {
	return Timer {
		frames = frames,
		on_update = on_update,
		on_complete = on_complete,
		delete_on_complete = true,
	}
}

// Get the progress ratio (0.0 = just started, 1.0 = complete)
// Requires knowing the original duration
timer_get_ratio :: proc(timer: ^Timer, original_frames: int) -> f32 {
	if original_frames <= 0 {
		return 1.0
	}
	return 1.0 - f32(timer.frames) / f32(original_frames)
}

// Get remaining ratio (1.0 = just started, 0.0 = complete)
timer_get_remaining_ratio :: proc(timer: ^Timer, original_frames: int) -> f32 {
	if original_frames <= 0 {
		return 0.0
	}
	return f32(timer.frames) / f32(original_frames)
}

// Timer system - processes all timer components
// Should run in the fixed update loop
sys_timer :: proc(w: ^World) {
	view := logic.view(&w.timer)
	for id, timer in logic.each(&view) {
		timer.frames -= 1

		// Call update callback if set
		if timer.on_update != nil {
			timer.on_update(w, id, timer.data)
		}

		// Timer still running
		if timer.frames >= 0 {
			continue
		}

		// Timer complete
		if timer.on_complete != nil {
			timer.on_complete(w, id, timer.data)
		}

		// Free data if allocated and autofree enabled
		if timer.data != nil && !timer.disable_autofree {
			free(timer.data)
		}

		// Delete entity or just remove timer component
		if timer.delete_on_complete {
			entity_delete(w, id)
		} else {
			logic.delete_component(&w.timer, id)
		}
	}
}
