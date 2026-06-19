package world

import "logic"

// Animation playback data.
//
// Animation_Atlas owns shared animation definitions and frames. Each entity's
// Animation component stores only playback state and a pointer to one definition
// in the atlas. Frames reference World.uv by index so sprite UVs remain shared.

AnimFrame :: struct {
	uv_index: u32,
	offset:   [2]i32,
	duration: f32,
	flip:     u8,
}

AnimDef :: struct {
	frame_start: u32,
	frame_count: u32,
	looping:     u8,
}

Animation_Atlas :: struct {
	defs:   []AnimDef,
	frames: []AnimFrame,
}

Animation :: struct {
	def:         ^AnimDef,
	frame_index: u32,
	frame_timer: f32,
	playing:     bool,
	speed:       f32,
	on_loop:     proc(w: ^World, entity: logic.Entity),
	on_frame:    proc(w: ^World, entity: logic.Entity, frame: u32),
}

atlas_get_anim :: proc(atlas: ^Animation_Atlas, index: int) -> ^AnimDef {
	if atlas == nil || index < 0 || index >= len(atlas.defs) {
		return nil
	}
	return &atlas.defs[index]
}

atlas_get_frames :: proc(atlas: ^Animation_Atlas, def: ^AnimDef) -> []AnimFrame {
	if atlas == nil || def == nil {
		return nil
	}

	frame_start := int(def.frame_start)
	frame_end := frame_start + int(def.frame_count)
	if frame_start < 0 || frame_end > len(atlas.frames) {
		return nil
	}
	return atlas.frames[frame_start:frame_end]
}

animation_create :: proc(def: ^AnimDef) -> Animation {
	return Animation{def = def, playing = true, speed = 1}
}

animation_create_stopped :: proc(def: ^AnimDef) -> Animation {
	anim := animation_create(def)
	anim.playing = false
	return anim
}

animation_play :: proc(anim: ^Animation, def: ^AnimDef) {
	anim.def = def
	animation_reset(anim)
	anim.playing = true
}

animation_play_if_different :: proc(anim: ^Animation, def: ^AnimDef) {
	if anim.def != def {
		animation_play(anim, def)
	}
}

animation_stop :: proc(anim: ^Animation) {
	anim.playing = false
}

animation_resume :: proc(anim: ^Animation) {
	anim.playing = true
}

animation_reset :: proc(anim: ^Animation) {
	anim.frame_index = 0
	anim.frame_timer = 0
}

animation_is_finished :: proc(anim: ^Animation) -> bool {
	if anim.def == nil {
		return true
	}
	if anim.def.looping != 0 {
		return false
	}
	return anim.frame_index >= anim.def.frame_count - 1 && !anim.playing
}

animation_get_frame :: proc(atlas: ^Animation_Atlas, anim: ^Animation) -> ^AnimFrame {
	if anim.def == nil || anim.def.frame_count == 0 {
		return nil
	}

	frames := atlas_get_frames(atlas, anim.def)
	if len(frames) == 0 || int(anim.frame_index) >= len(frames) {
		return nil
	}
	return &frames[anim.frame_index]
}

animation_get_progress :: proc(anim: ^Animation) -> f32 {
	if anim.def == nil || anim.def.frame_count == 0 {
		return 0
	}
	if anim.def.frame_count == 1 {
		return 1
	}
	return f32(anim.frame_index) / f32(anim.def.frame_count - 1)
}

animation_set_speed :: proc(anim: ^Animation, speed: f32) {
	anim.speed = speed
}

animdef_total_duration :: proc(atlas: ^Animation_Atlas, def: ^AnimDef) -> f32 {
	frames := atlas_get_frames(atlas, def)
	total: f32
	for frame in frames {
		total += frame.duration
	}
	return total
}

sys_animation :: proc(w: ^World, dt: f64) {
	view: logic.View2(Animation, Sprite) = logic.view(&w.animation, &w.sprite)
	atlas := &w.animation_atlas

	for entity, anim, sprite in logic.each(&view) {
		if anim.def == nil || !anim.playing {
			continue
		}

		frames := atlas_get_frames(atlas, anim.def)
		if len(frames) == 0 {
			continue
		}
		assert(int(anim.frame_index) < len(frames))

		previous_frame := anim.frame_index
		anim.frame_timer += f32(dt) * anim.speed
		current_frame := &frames[anim.frame_index]
		assert(current_frame.duration > 0)

		for anim.frame_timer >= current_frame.duration {
			anim.frame_timer -= current_frame.duration
			anim.frame_index += 1

			if int(anim.frame_index) >= len(frames) {
				if anim.def.looping != 0 {
					anim.frame_index = 0
					if anim.on_loop != nil {
						anim.on_loop(w, entity)
					}
				} else {
					anim.frame_index = u32(len(frames) - 1)
					anim.frame_timer = 0
					anim.playing = false
					break
				}
			}

			current_frame = &frames[anim.frame_index]
			assert(current_frame.duration > 0)
		}

		if anim.frame_index != previous_frame && anim.on_frame != nil {
			anim.on_frame(w, entity, anim.frame_index)
		}

		frame := &frames[anim.frame_index]
		assert(int(frame.uv_index) < len(w.uv))
		sprite.uv = w.uv[frame.uv_index]
		sprite.offset = frame.offset
		sprite.flip = frame.flip
	}
}
