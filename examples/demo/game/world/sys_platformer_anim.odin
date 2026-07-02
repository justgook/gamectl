package world

import "logic"

// Platformer animation controller.
//
// This is intentionally separate from sys_animation. Platformer systems own
// movement/gameplay state; this system translates that state into animation
// playback requests. The low-level Animation component remains only a clip
// player.

Platformer_Anim_Key :: enum {
	Idle,
	Run,
	Jump,
	Fall,
	Wall_Slide,
	Dash,
	Land,
	Hurt,
	Death,
}

Platformer_Anim_Clip :: struct {
	def:                  ^AnimDef,
	base_speed:           f32,
	velocity_speed_scale: f32,
	lock_until_finished:  bool,
}

Platformer_Anim_Set :: struct {
	idle:       Platformer_Anim_Clip,
	run:        Platformer_Anim_Clip,
	jump:       Platformer_Anim_Clip,
	fall:       Platformer_Anim_Clip,
	wall_slide: Platformer_Anim_Clip,
	dash:       Platformer_Anim_Clip,
	land:       Platformer_Anim_Clip,
	hurt:       Platformer_Anim_Clip,
	death:      Platformer_Anim_Clip,
}

Platformer_Anim :: struct {
	set:     Platformer_Anim_Set,
	current: Platformer_Anim_Key,
	facing:  i32,
	locked:  bool,
}

sys_platformer_anim :: proc(w: ^World) {
	view := logic.view(&w.platformer, &w.animation, &w.platformer_anim)

	for _, p, anim, ctrl in logic.each(&view) {
		if ctrl.locked {
			if animation_is_finished(anim) {
				ctrl.locked = false
			} else {
				continue
			}
		}

		next := platformer_anim_select(p)

		if p.facing != 0 {
			ctrl.facing = p.facing
		}

		platformer_anim_play(anim, ctrl, next, abs(p.velocity.x))
	}
}

platformer_anim_create_default :: proc(default_def: ^AnimDef) -> Platformer_Anim {
	clip := Platformer_Anim_Clip {
		def        = default_def,
		base_speed = 1,
	}
	return Platformer_Anim {
		set = {
			idle = clip,
			run = {def = default_def, base_speed = 1, velocity_speed_scale = 0.0005},
			jump = clip,
			fall = clip,
			wall_slide = clip,
			dash = clip,
			land = clip,
			hurt = clip,
			death = clip,
		},
		current = .Idle,
		facing = 1,
	}
}

@(private = "file")
platformer_anim_clip :: proc(set: ^Platformer_Anim_Set, key: Platformer_Anim_Key) -> Platformer_Anim_Clip {
	switch key {
	case .Idle:
		return set.idle
	case .Run:
		return set.run
	case .Jump:
		return set.jump
	case .Fall:
		return set.fall
	case .Wall_Slide:
		return set.wall_slide
	case .Dash:
		return set.dash
	case .Land:
		return set.land
	case .Hurt:
		return set.hurt
	case .Death:
		return set.death
	}

	return set.idle
}

@(private = "file")
platformer_anim_select :: proc(p: ^Platformer) -> Platformer_Anim_Key {
	if p.dash_frames > 0 {
		return .Dash
	}
	if !p.on_ground && p.on_wall {
		return .Wall_Slide
	}
	if !p.on_ground && p.velocity.y > 0 {
		return .Jump
	}
	if !p.on_ground {
		return .Fall
	}
	if abs(p.velocity.x) > 0 {
		return .Run
	}
	return .Idle
}

@(private = "file")
platformer_anim_play :: proc(anim: ^Animation, ctrl: ^Platformer_Anim, key: Platformer_Anim_Key, velocity_abs: i32) {
	clip := platformer_anim_clip(&ctrl.set, key)
	assert(clip.def != nil)

	if ctrl.current != key || anim.def != clip.def {
		animation_play(anim, clip.def)
		ctrl.current = key
		ctrl.locked = clip.lock_until_finished
	}

	speed := clip.base_speed
	if clip.velocity_speed_scale != 0 {
		speed += f32(velocity_abs) * clip.velocity_speed_scale
	}
	animation_set_speed(anim, speed)
}
