package world

import "logic"

// Platformer animation controller.
//
// Gameplay selects a locomotion or action state. This controller owns the
// non-interruptible start/loop/exit sequences around slide and jump actions.

Platformer_Anim_Key :: enum {
	Idle,
	Run,
	Slide_Start,
	Slide,
	Slide_Exit,
	Jump_Start,
	Jump,
	Jump_Land,
}

Platformer_Anim_Ref :: struct {
	atlas_base_id: u32,
}

Platformer_Anim_Clip :: struct {
	def:   ^AnimDef,
	speed: f32,
}

Platformer_Anim_Sequence :: struct {
	start: Platformer_Anim_Clip,
	loop:  Platformer_Anim_Clip,
	exit:  Platformer_Anim_Clip,
}

Platformer_Anim :: struct {
	idle:    Platformer_Anim_Clip,
	run:     Platformer_Anim_Clip,
	slide:   Platformer_Anim_Sequence,
	jump:    Platformer_Anim_Sequence,
	current: Platformer_Anim_Key,
	facing:  i32,
}

Platformer_Anim_Sequence_Phase :: enum {
	Start,
	Loop,
	Exit,
}

sys_platformer_anim :: proc(w: ^World) {
	view := logic.view(&w.platformer, &w.animation, &w.platformer_anim)

	for _, platformer, anim, ctrl in logic.each(&view) {
		if platformer.facing != 0 {
			ctrl.facing = platformer.facing
		}

		desired := platformer_anim_desired(platformer)
		sequence, phase, in_sequence := platformer_anim_sequence_state(ctrl.current)
		if !in_sequence {
			platformer_anim_enter_desired(anim, ctrl, desired)
			continue
		}

		switch phase {
		case .Start:
			if sequence == .Jump && desired != .Jump {
				platformer_anim_play_once(anim, ctrl, .Jump_Land)
				continue
			}
			if !animation_is_finished(anim) {
				continue
			}
			if desired == sequence {
				platformer_anim_play_loop(anim, ctrl, sequence)
			} else {
				platformer_anim_play_once(anim, ctrl, platformer_anim_sequence_exit(sequence))
			}
		case .Loop:
			if desired != sequence {
				platformer_anim_play_once(anim, ctrl, platformer_anim_sequence_exit(sequence))
			}
		case .Exit:
			if !animation_is_finished(anim) {
				continue
			}
			platformer_anim_enter_desired(anim, ctrl, desired)
		}
	}
}

platformer_anim_create_char_from_atlas :: proc(atlas: ^Animation_Atlas, base_id: int) -> Platformer_Anim {
	assert(atlas != nil)
	assert(base_id >= 0 && base_id + 7 < len(atlas.defs))
	return platformer_anim_create_char(
		&atlas.defs[base_id + 0],
		&atlas.defs[base_id + 1],
		&atlas.defs[base_id + 2],
		&atlas.defs[base_id + 3],
		&atlas.defs[base_id + 4],
		&atlas.defs[base_id + 5],
		&atlas.defs[base_id + 6],
		&atlas.defs[base_id + 7],
	)
}

platformer_anim_create_char :: proc(
	idle, run, slide_start, slide_loop, slide_exit, jump_start, jump_loop, jump_land: ^AnimDef,
) -> Platformer_Anim {
	assert(idle != nil)
	assert(run != nil)
	assert(slide_start != nil)
	assert(slide_loop != nil)
	assert(slide_exit != nil)
	assert(jump_start != nil)
	assert(jump_loop != nil)
	assert(jump_land != nil)
	return Platformer_Anim {
		idle = {def = idle, speed = 1},
		run = {def = run, speed = 1},
		slide = {
			start = {def = slide_start, speed = 1},
			loop = {def = slide_loop, speed = 1},
			exit = {def = slide_exit, speed = 1},
		},
		jump = {
			start = {def = jump_start, speed = 1},
			loop = {def = jump_loop, speed = 1},
			exit = {def = jump_land, speed = 1},
		},
		current = .Idle,
		facing = 1,
	}
}

@(private = "file")
platformer_anim_desired :: proc(p: ^Platformer) -> Platformer_Anim_Key {
	if p.slide_active {
		return .Slide
	}
	if !p.on_ground {
		return .Jump
	}
	if abs(p.velocity.x) > 0 {
		return .Run
	}
	return .Idle
}

@(private = "file")
platformer_anim_sequence_state :: proc(
	key: Platformer_Anim_Key,
) -> (
	sequence: Platformer_Anim_Key,
	phase: Platformer_Anim_Sequence_Phase,
	ok: bool,
) {
	switch key {
	case .Slide_Start:
		return .Slide, .Start, true
	case .Slide:
		return .Slide, .Loop, true
	case .Slide_Exit:
		return .Slide, .Exit, true
	case .Jump_Start:
		return .Jump, .Start, true
	case .Jump:
		return .Jump, .Loop, true
	case .Jump_Land:
		return .Jump, .Exit, true
	case .Idle, .Run:
		return {}, {}, false
	}
	unreachable()
}

@(private = "file")
platformer_anim_sequence_start :: proc(sequence: Platformer_Anim_Key) -> Platformer_Anim_Key {
	#partial switch sequence {
	case .Slide:
		return .Slide_Start
	case .Jump:
		return .Jump_Start
	}
	panic("animation key is not a sequence")
}

@(private = "file")
platformer_anim_sequence_exit :: proc(sequence: Platformer_Anim_Key) -> Platformer_Anim_Key {
	#partial switch sequence {
	case .Slide:
		return .Slide_Exit
	case .Jump:
		return .Jump_Land
	}
	panic("animation key is not a sequence")
}

@(private = "file")
platformer_anim_enter_desired :: proc(anim: ^Animation, ctrl: ^Platformer_Anim, desired: Platformer_Anim_Key) {
	switch desired {
	case .Idle, .Run:
		platformer_anim_play_loop(anim, ctrl, desired)
	case .Slide, .Jump:
		platformer_anim_play_once(anim, ctrl, platformer_anim_sequence_start(desired))
	case .Slide_Start, .Slide_Exit, .Jump_Start, .Jump_Land:
		panic("transitional animation cannot be a desired state")
	}
}

@(private = "file")
platformer_anim_clip :: proc(ctrl: ^Platformer_Anim, key: Platformer_Anim_Key) -> ^Platformer_Anim_Clip {
	switch key {
	case .Idle:
		return &ctrl.idle
	case .Run:
		return &ctrl.run
	case .Slide_Start:
		return &ctrl.slide.start
	case .Slide:
		return &ctrl.slide.loop
	case .Slide_Exit:
		return &ctrl.slide.exit
	case .Jump_Start:
		return &ctrl.jump.start
	case .Jump:
		return &ctrl.jump.loop
	case .Jump_Land:
		return &ctrl.jump.exit
	}
	unreachable()
}

@(private = "file")
platformer_anim_play_loop :: proc(anim: ^Animation, ctrl: ^Platformer_Anim, key: Platformer_Anim_Key) {
	assert(key == .Idle || key == .Run || key == .Slide || key == .Jump)
	clip := platformer_anim_clip(ctrl, key)
	assert(clip.def != nil)
	if ctrl.current != key || anim.def != clip.def || !anim.playing {
		animation_play_loop(anim, clip.def)
		ctrl.current = key
	}
	animation_set_speed(anim, clip.speed)
}

@(private = "file")
platformer_anim_play_once :: proc(anim: ^Animation, ctrl: ^Platformer_Anim, key: Platformer_Anim_Key) {
	assert(key == .Slide_Start || key == .Slide_Exit || key == .Jump_Start || key == .Jump_Land)
	clip := platformer_anim_clip(ctrl, key)
	assert(clip.def != nil)
	animation_play_once(anim, clip.def)
	animation_set_speed(anim, clip.speed)
	ctrl.current = key
}
