package world

import "logic"
// Animation system - advances animation frames and updates sprite components
//
// This system:
// 1. Advances frame timer based on delta time and speed
// 2. Switches frames when timer exceeds frame duration
// 3. Handles looping and stopping at end
// 4. Updates the entity's Sprite component UV from current frame
// 5. Fires callbacks on loop and frame change

sys_animation :: proc(w: ^World, dt: f64) {
	view: logic.View2(Animation, Sprite) = logic.view(&w.animation, &w.sprite)
	atlas := &w.animation_atlas

	for id, anim, sprite in logic.each(&view) {
		// Skip if no animation definition or not playing
		if anim.def == nil || !anim.playing {
			continue
		}

		frames := atlas_get_frames(atlas, anim.def)
		if len(frames) == 0 {
			continue
		}

		// Store previous frame for callback
		prev_frame := anim.frame_index

		// Advance timer
		anim.frame_timer += f32(dt) * anim.speed

		// Get current frame duration
		current_frame := &frames[anim.frame_index]

		// Check if we need to advance frames
		for anim.frame_timer >= current_frame.duration {
			anim.frame_timer -= current_frame.duration
			anim.frame_index += 1

			// Handle end of animation
			if int(anim.frame_index) >= len(frames) {
				if anim.def.looping != 0 {
					// Loop back to start
					anim.frame_index = 0
					if anim.on_loop != nil {
						anim.on_loop(w, id)
					}
				} else {
					// Stop at last frame
					anim.frame_index = u32(len(frames) - 1)
					anim.frame_timer = 0
					anim.playing = false
					break
				}
			}

			// Update current frame reference for next iteration
			current_frame = &frames[anim.frame_index]
		}

		// Fire frame changed callback if frame changed
		if anim.frame_index != prev_frame && anim.on_frame != nil {
			anim.on_frame(w, id, anim.frame_index)
		}

		// Update sprite component from current animation frame
		frame := &frames[anim.frame_index]
		sprite.uv = w.uv[int(frame.uv_index)] // atlas_get_uv(&w.sprite_atlas, int(frame.uv_index))
		// sprite.offset = [2]int{int(frame.offset[0]), int(frame.offset[1])}
		sprite.flip = frame.flip
	}
}

// Animation System
//
// Three-level architecture:
// 1. AnimationAtlas - Shared storage for all animation defs and frames (loaded from binary)
// 2. AnimDef - Animation definition referencing frames in the atlas
// 3. Animation - Per-entity playback state (current frame, timer, callbacks)
//
// UV coordinates are stored in a shared SpriteAtlas. Animation frames reference
// UVs by index, allowing reuse without duplication.
//
// Binary format for AnimationAtlas:
//   Header: def_count (u32), frame_count (u32)
//   Data:   [def_count]AnimDef, [frame_count]AnimFrame
//
// Usage:
//   // Get animation definition from atlas
//   def := atlas_get_anim(&w.animation_atlas, ANIM_HERO_IDLE)
//
//   // Add component to entity
//   logic.add_component(&w.animation, entity, animation_create(def))
//
//   // Change animation
//   animation_play(&anim, new_def)

// Single frame of animation
AnimFrame :: struct {
	uv_index: u32, // Index into SpriteAtlas.uvs (shared UV storage)
	offset:   [2]i32, // Sprite offset adjustment in subpixels
	duration: f32, // Seconds this frame displays
	flip:     u8, // Flip, // Flip flags for this frame (FLIP_X, FLIP_Y, FLIP_XY)
}

// Animation definition - shared data, multiple entities can reference same def
// References frames by index into AnimationAtlas.frames
AnimDef :: struct {
	frame_start: u32, // Start index into AnimationAtlas.frames
	frame_count: u32, // Number of frames in this animation
	looping:     u8,
}

// Animation atlas - stores all animation definitions and their frames
// Loaded from binary data, zero-copy mapping
Animation_Atlas :: struct {
	defs:   []AnimDef, // All animation definitions
	frames: []AnimFrame, // All frames, defs reference by index
}

// Per-entity animation playback state
Animation :: struct {
	def:         ^AnimDef, // Pointer to animation definition (nil = no animation)
	frame_index: u32, // Current frame index
	frame_timer: f32, // Time accumulated in current frame
	playing:     bool, // Is animation playing
	speed:       f32, // Playback speed multiplier (1.0 = normal, 0.5 = half speed)
	// Callbacks (optional, can be nil)
	on_loop:     proc(w: ^World, entity: int), // Called when animation loops
	on_frame:    proc(w: ^World, entity: int, frame: u32), // Called when frame changes
}

// Animation IDs for registry lookup
// AnimId :: enum {
// 	None,
// 	// Hero animations
// 	Hero_Idle,
// 	Hero_Run,
// 	Hero_Jump_Up,
// 	Hero_Jump_Down,
// 	Hero_Land,
// 	Hero_Dash,
// 	Hero_Hurt,
// 	// Enemy animations
// 	Enemy_Idle,
// 	Enemy_Walk,
// 	Enemy_Hurt,
// 	Enemy_Death,
// }

// Get animation definition from atlas by index
atlas_get_anim :: proc(atlas: ^Animation_Atlas, index: int) -> ^AnimDef {
	if atlas == nil || index < 0 || index >= len(atlas.defs) {
		return nil
	}
	return &atlas.defs[index]
}

// Get frames slice for an animation definition
atlas_get_frames :: proc(atlas: ^Animation_Atlas, def: ^AnimDef) -> []AnimFrame {
	if atlas == nil || def == nil {
		return nil
	}
	end := def.frame_start + def.frame_count
	if def.frame_start < 0 || int(end) > len(atlas.frames) {
		return nil
	}
	return atlas.frames[def.frame_start:end]
}

// Create a new Animation component pointing to a definition
animation_create :: proc(def: ^AnimDef) -> Animation {
	return Animation {
		def = def,
		frame_index = 0,
		frame_timer = 0,
		playing = true,
		speed = 1.0,
		on_loop = nil,
		on_frame = nil,
	}
}

// Create Animation component in stopped state
animation_create_stopped :: proc(def: ^AnimDef) -> Animation {
	anim := animation_create(def)
	anim.playing = false
	return anim
}

// Start playing an animation from the beginning
animation_play :: proc(anim: ^Animation, def: ^AnimDef) {
	anim.def = def
	anim.frame_index = 0
	anim.frame_timer = 0
	anim.playing = true
}

// Play animation only if it's different from current
animation_play_if_different :: proc(anim: ^Animation, def: ^AnimDef) {
	if anim.def != def {
		animation_play(anim, def)
	}
}

// Stop animation at current frame
animation_stop :: proc(anim: ^Animation) {
	anim.playing = false
}

// Resume animation from current position
animation_resume :: proc(anim: ^Animation) {
	anim.playing = true
}

// Reset animation to first frame
animation_reset :: proc(anim: ^Animation) {
	anim.frame_index = 0
	anim.frame_timer = 0
}

// Check if animation has finished (only meaningful for non-looping)
animation_is_finished :: proc(anim: ^Animation) -> bool {
	if anim.def == nil {
		return true
	}
	if anim.def.looping != 0 {
		return false
	}
	return anim.frame_index >= anim.def.frame_count - 1 && !anim.playing
}

// Get current frame from atlas (nil if no animation)
animation_get_frame :: proc(atlas: ^Animation_Atlas, anim: ^Animation) -> ^AnimFrame {
	if anim.def == nil || anim.def.frame_count == 0 {
		return nil
	}
	frames := atlas_get_frames(atlas, anim.def)
	if frames == nil {
		return nil
	}
	return &frames[anim.frame_index]
}

// Get animation progress (0.0 to 1.0)
animation_get_progress :: proc(anim: ^Animation) -> f32 {
	if anim.def == nil || anim.def.frame_count == 0 {
		return 0
	}
	if anim.def.frame_count == 1 {
		return 1.0
	}
	return f32(anim.frame_index) / f32(anim.def.frame_count - 1)
}

// Set playback speed (1.0 = normal, 2.0 = double speed, 0.5 = half speed)
animation_set_speed :: proc(anim: ^Animation, speed: f32) {
	anim.speed = speed
}

// Helper to calculate total duration of an animation
animdef_total_duration :: proc(atlas: ^Animation_Atlas, def: ^AnimDef) -> f32 {
	if def == nil {
		return 0
	}
	frames := atlas_get_frames(atlas, def)
	if frames == nil {
		return 0
	}
	total: f32 = 0
	for &frame in frames {
		total += frame.duration
	}
	return total
}
