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
	Climb,
	Swim,
	Swim_Vertical,
	Swim_Idle,
	Swim_Jump,
	Land,
	Hurt,
	Death,
}

Platformer_Anim_Ref :: struct {
	atlas_base_id: u32,
}

Platformer_Anim_Clip :: struct {
	def:                  ^AnimDef,
	base_speed:           f32,
	velocity_speed_scale: f32,
	lock_until_finished:  bool,
}

Platformer_Anim :: struct {
	set:          [Platformer_Anim_Key]Platformer_Anim_Clip,
	current:      Platformer_Anim_Key,
	facing:       i32,
	sprite_flip:  u8,
	apply_facing: bool,
	locked:       bool,
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
		ctrl.sprite_flip = 0
		ctrl.apply_facing = true
		if next == .Swim_Vertical && p.velocity.y < 0 {
			ctrl.sprite_flip = 6 // Anti-diagonal + vertical displays as 90 degrees clockwise.
		}

		velocity_abs :=
			max(abs(p.velocity.x), abs(p.velocity.y)) if p.in_water else abs(p.velocity.y) if p.on_ladder else abs(p.velocity.x)
		platformer_anim_play(anim, ctrl, next, velocity_abs)
	}
}

platformer_anim_create_char_from_atlas :: proc(atlas: ^Animation_Atlas, base_id: int) -> Platformer_Anim {
	assert(base_id >= 0)
	assert(base_id + 14 < len(atlas.defs))
	anim := atlas.defs
	return platformer_anim_create_char(
		&anim[base_id + 0],
		&anim[base_id + 1],
		&anim[base_id + 2],
		&anim[base_id + 3],
		&anim[base_id + 4],
		&anim[base_id + 5],
		&anim[base_id + 6],
		&anim[base_id + 7],
		&anim[base_id + 8],
		&anim[base_id + 9],
		&anim[base_id + 10],
		&anim[base_id + 11],
		&anim[base_id + 12],
		&anim[base_id + 14],
	)
}

platformer_anim_create_char :: proc(
	idle, run, jump, fall, wall_slide, dash, land, hurt, death, climb, swim, swim_vertical, swim_idle, swim_jump: ^AnimDef,
) -> Platformer_Anim {
	return Platformer_Anim {
		set = {
			.Idle = Platformer_Anim_Clip{def = idle, base_speed = 1},
			.Run = Platformer_Anim_Clip{def = run, base_speed = 1},
			.Jump = Platformer_Anim_Clip{def = jump, base_speed = 1},
			.Fall = Platformer_Anim_Clip{def = fall, base_speed = 1},
			.Wall_Slide = Platformer_Anim_Clip{def = wall_slide, base_speed = 1},
			.Dash = Platformer_Anim_Clip{def = dash, base_speed = 1},
			.Climb = Platformer_Anim_Clip{def = climb, base_speed = 0, velocity_speed_scale = 1.0 / f32(UNIT * 2)},
			.Swim = Platformer_Anim_Clip{def = swim, base_speed = 1},
			.Swim_Vertical = Platformer_Anim_Clip{def = swim_vertical, base_speed = 1},
			.Swim_Idle = Platformer_Anim_Clip{def = swim_idle, base_speed = 1},
			.Swim_Jump = Platformer_Anim_Clip{def = swim_jump, base_speed = 1},
			.Land = Platformer_Anim_Clip{def = land, base_speed = 1},
			.Hurt = Platformer_Anim_Clip{def = hurt, base_speed = 1},
			.Death = Platformer_Anim_Clip{def = death, base_speed = 1},
		},
		current = .Idle,
		facing = 1,
		apply_facing = true,
	}
}


@(private = "file")
platformer_anim_select :: proc(p: ^Platformer) -> Platformer_Anim_Key {
	if p.swim_jumping {return .Swim_Jump}
	if p.in_water {
		if p.velocity.y != 0 {return .Swim_Vertical}
		if p.velocity.x != 0 {return .Swim}
		return .Swim_Idle
	}
	if p.dash_frames > 0 {return .Dash}
	if p.on_ladder {return .Climb}
	if !p.on_ground && p.on_wall {return .Wall_Slide}
	if !p.on_ground && p.velocity.y > 0 {return .Jump}
	if !p.on_ground {return .Fall}
	if abs(p.velocity.x) > 0 {return .Run}

	return .Idle
}

@(private = "file")
platformer_anim_play :: proc(anim: ^Animation, ctrl: ^Platformer_Anim, key: Platformer_Anim_Key, velocity_abs: i32) {
	clip := &ctrl.set[key]
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
