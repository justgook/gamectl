package world
import "core:math"
import "core:math/linalg"

// import "logic"

sys_camera :: proc(w: ^World, dt: f64) {

	// Get target position if we're tracking an entity
	// target_pos: Maybe([2]f32)
	// if w.player_entity >= 0 {
	// 	if pos, ok := logic.get_component(&w.position, w.player_entity); ok {
	// 		target_pos = to_pixelf(pos^)
	// 	}
	// }

	// Update camera
	target_pos := [2]f32{0, 0}
	camera_update(&w.cam, target_pos, f32(dt))
	w.cam.ortho = camera_get_matrix(&w.cam, w.cam.viewport)
}


// Camera state - lives in World, not as a component (singleton)
Camera :: struct {
	// Current position (in pixels, f32 for smooth movement)
	position:      [2]f32,
	viewport:      [2]f32,
	ortho:         linalg.Matrix4f32,
	// Target zoom level
	zoom:          f32,
	// Current zoom (smoothed towards target)
	current_zoom:  f32,
	// Target entity to follow (entity ID, -1 for none)
	target_entity: int,
	// Offset from target position
	target_offset: [2]f32,
	// Configuration
	config:        Camera_Config,
	// Active effects
	shake:         Shake_State,
	bump:          Bump_State,
	zoom_bump:     f32,
	// Velocity for smooth movement
	velocity:      [2]f32,
}

Camera_Config :: struct {
	// Dead zone - camera won't move if target is within this distance
	deadzone_x:           f32,
	deadzone_y:           f32,
	// Tracking speed (0-1, higher = faster catch up)
	tracking_speed:       f32,
	// Friction applied to camera velocity
	friction:             f32,
	// Zoom interpolation speed
	zoom_speed:           f32,
	// Zoom limits
	min_zoom:             f32,
	max_zoom:             f32,
	// Level bounds (0 = no clamping)
	level_bounds:         [4]f32, // left, top, right, bottom
	clamp_to_level:       bool,
	// Brake distance near bounds (as ratio of viewport)
	brake_dist_near_edge: f32,
}

Shake_State :: struct {
	power_x:   f32,
	power_y:   f32,
	duration:  f32, // remaining duration in seconds
	frequency: f32, // shake frequency
	time:      f32, // accumulated time for noise
}

Bump_State :: struct {
	offset_x: f32,
	offset_y: f32,
	friction: f32,
}

// Default configuration
DEFAULT_CONFIG :: Camera_Config {
	deadzone_x           = 32,
	deadzone_y           = 48,
	tracking_speed       = 0.015,
	friction             = 0.89,
	zoom_speed           = 0.1,
	min_zoom             = 0.5,
	max_zoom             = 4.0,
	level_bounds         = {0, 0, 0, 0},
	clamp_to_level       = false,
	brake_dist_near_edge = 0.1,
}

// Initialize camera with default values
camera_init :: proc(
	viewport: [2]f32 = {100, 100},
	initial_pos: [2]f32 = {0, 0},
	initial_zoom: f32 = 1.0,
) -> Camera {
	return Camera {
		position = initial_pos,
		viewport = viewport,
		zoom = initial_zoom,
		current_zoom = initial_zoom,
		target_entity = -1,
		target_offset = {0, 0},
		config = DEFAULT_CONFIG,
		shake = {},
		bump = {friction = 0.85},
		zoom_bump = 0,
		velocity = {0, 0},
	}
}

// Set camera to track an entity
camera_track :: proc(cam: ^Camera, entity_id: int, immediate: bool = false) {
	cam.target_entity = entity_id
	// If immediate, we'll snap to target in the update when target_pos is provided
}

// Stop tracking
camera_stop_tracking :: proc(cam: ^Camera) {
	cam.target_entity = -1
}

// Set target zoom level
camera_set_zoom :: proc(cam: ^Camera, zoom: f32) {
	cam.zoom = clamp(zoom, cam.config.min_zoom, cam.config.max_zoom)
}

// Force zoom immediately (no interpolation)
camera_force_zoom :: proc(cam: ^Camera, zoom: f32) {
	cam.zoom = clamp(zoom, cam.config.min_zoom, cam.config.max_zoom)
	cam.current_zoom = cam.zoom
}

// Center camera on position immediately
camera_center_on :: proc(cam: ^Camera, pos: [2]f32) {
	cam.position = pos + cam.target_offset
	cam.velocity = {0, 0}
}

//=============================================================================
// EFFECTS
//=============================================================================

// Apply camera shake
// power: shake intensity in pixels
// duration: how long the shake lasts in seconds
camera_shake :: proc(cam: ^Camera, power_x, power_y: f32, duration: f32, frequency: f32 = 1.1) {
	// Don't override stronger shake
	if cam.shake.duration > 0 {
		cam.shake.power_x = max(cam.shake.power_x, power_x)
		cam.shake.power_y = max(cam.shake.power_y, power_y)
		cam.shake.duration = max(cam.shake.duration, duration)
	} else {
		cam.shake.power_x = power_x
		cam.shake.power_y = power_y
		cam.shake.duration = duration
		cam.shake.frequency = frequency
		cam.shake.time = 0
	}
}

// Apply camera bump (instant offset that decays)
camera_bump :: proc(cam: ^Camera, x, y: f32) {
	cam.bump.offset_x += x
	cam.bump.offset_y += y
}

// Apply zoom bump (instant zoom change that decays)
camera_bump_zoom :: proc(cam: ^Camera, amount: f32) {
	cam.zoom_bump += amount
}

//=============================================================================
// UPDATE
//=============================================================================

// Update camera - call once per frame
// target_pos: position of tracked entity (in pixels), or nil if not tracking
// dt: delta time in seconds
// viewport_size: current viewport dimensions
@(private = "file")
camera_update :: proc(cam: ^Camera, target_pos: Maybe([2]f32), dt: f32) {
	// Calculate tmod for frame-rate independent movement
	tmod := dt * 60.0 // Normalize to 60fps

	// Follow target if we have one
	if pos, ok := target_pos.?; ok {
		target := pos + cam.target_offset
		update_tracking(cam, target, cam.viewport, tmod)
	}

	// Update zoom
	update_zoom(cam, tmod)

	// Update effects
	update_shake(cam, dt, tmod)
	update_bump(cam, tmod)
}

@(private = "file")
update_tracking :: proc(cam: ^Camera, target: [2]f32, viewport_size: [2]f32, tmod: f32) {
	config := &cam.config

	// Calculate distance to target
	distance_vec := target - cam.position
	dist_x := abs(distance_vec.x)
	dist_y := abs(distance_vec.y)

	// Apply dead zone - only move if outside dead zone
	speed_x := config.tracking_speed * cam.current_zoom
	speed_y := config.tracking_speed * cam.current_zoom * 1.5 // Slightly faster vertical tracking

	if dist_x > config.deadzone_x {
		move_x := (dist_x - config.deadzone_x) * speed_x
		cam.velocity.x += math.sign(distance_vec.x) * move_x * tmod
	}

	if dist_y > config.deadzone_y {
		move_y := (dist_y - config.deadzone_y) * speed_y
		cam.velocity.y += math.sign(distance_vec.y) * move_y * tmod
	}

	// Apply friction
	friction := math.pow(config.friction, tmod)
	cam.velocity *= friction

	// Apply velocity
	cam.position += cam.velocity * tmod

	// Clamp to level bounds if enabled
	if config.clamp_to_level {
		clamp_to_bounds(cam, viewport_size)
	}
}

@(private = "file")
clamp_to_bounds :: proc(cam: ^Camera, viewport_size: [2]f32) {
	bounds := cam.config.level_bounds
	half_w := viewport_size.x * 0.5 / cam.current_zoom
	half_h := viewport_size.y * 0.5 / cam.current_zoom

	// Only clamp if bounds are set (non-zero)
	if bounds[2] > bounds[0] { 	// right > left
		cam.position.x = clamp(cam.position.x, bounds[0] + half_w, bounds[2] - half_w)
	}
	if bounds[3] > bounds[1] { 	// bottom > top
		cam.position.y = clamp(cam.position.y, bounds[1] + half_h, bounds[3] - half_h)
	}
}

@(private = "file")
update_zoom :: proc(cam: ^Camera, tmod: f32) {
	// Interpolate current zoom towards target zoom
	diff := cam.zoom - cam.current_zoom
	cam.current_zoom += diff * cam.config.zoom_speed * tmod

	// Snap if close enough
	if abs(diff) < 0.001 {
		cam.current_zoom = cam.zoom
	}

	// Decay zoom bump
	cam.zoom_bump *= math.pow(0.9, tmod)
	if abs(cam.zoom_bump) < 0.001 {
		cam.zoom_bump = 0
	}
}

@(private = "file")
update_shake :: proc(cam: ^Camera, dt: f32, tmod: f32) {
	if cam.shake.duration <= 0 {
		return
	}

	cam.shake.time += dt
	cam.shake.duration -= dt

	// Decay power as duration decreases
	if cam.shake.duration <= 0 {
		cam.shake.power_x = 0
		cam.shake.power_y = 0
		cam.shake.duration = 0
	}
}

@(private = "file")
update_bump :: proc(cam: ^Camera, tmod: f32) {
	friction := math.pow(cam.bump.friction, tmod)
	cam.bump.offset_x *= friction
	cam.bump.offset_y *= friction

	// Zero out small values
	if abs(cam.bump.offset_x) < 0.1 {
		cam.bump.offset_x = 0
	}
	if abs(cam.bump.offset_y) < 0.1 {
		cam.bump.offset_y = 0
	}
}

//=============================================================================
// MATRIX GENERATION
//=============================================================================

// Get the final camera position including all effects
camera_get_render_position :: proc(cam: ^Camera) -> [2]f32 {
	pos := cam.position

	// Add bump offset
	pos.x -= cam.bump.offset_x
	pos.y -= cam.bump.offset_y

	// Add shake offset
	if cam.shake.duration > 0 {
		ratio := cam.shake.duration // Use remaining duration as intensity multiplier
		t := cam.shake.time * cam.shake.frequency
		pos.x += math.cos(t * 1.1) * cam.shake.power_x * ratio
		pos.y += math.sin(t * 1.7 + 0.3) * cam.shake.power_y * ratio
	}

	return pos
}

// Get the final zoom including effects
camera_get_render_zoom :: proc(cam: ^Camera) -> f32 {
	return cam.current_zoom + cam.zoom_bump
}

// Generate the view matrix for rendering
// viewport_size: window dimensions in pixels
camera_get_matrix :: proc(cam: ^Camera, viewport_size: [2]f32) -> linalg.Matrix4f32 {
	pos := camera_get_render_position(cam)
	zoom := camera_get_render_zoom(cam)

	// Create orthographic projection centered on viewport
	half_w := viewport_size.x * 0.5
	half_h := viewport_size.y * 0.5
	ortho := linalg.matrix_ortho3d_f32(-half_w, half_w, -half_h, half_h, -1, 1)

	// Translate to camera position
	translate := linalg.matrix4_translate_f32({-pos.x, -pos.y, 0})

	// Apply zoom (inverse because we're zooming the world, not the camera)
	scale := linalg.matrix4_scale_f32({1.0 / zoom, 1.0 / zoom, 1.0})

	// Combine: projection * scale * translate
	return ortho * translate * scale
}

//=============================================================================
// UTILITIES
//=============================================================================

// Convert screen coordinates to world coordinates
screen_to_world :: proc(cam: ^Camera, screen_pos: [2]f32, viewport_size: [2]f32) -> [2]f32 {
	pos := camera_get_render_position(cam)
	zoom := camera_get_render_zoom(cam)

	// Screen center is camera position
	// Offset from center, scaled by zoom
	offset_x := (screen_pos.x - viewport_size.x * 0.5) * zoom
	offset_y := (screen_pos.y - viewport_size.y * 0.5) * zoom

	return {pos.x + offset_x, pos.y + offset_y}
}

// Convert world coordinates to screen coordinates
world_to_screen :: proc(cam: ^Camera, world_pos: [2]f32, viewport_size: [2]f32) -> [2]f32 {
	pos := camera_get_render_position(cam)
	zoom := camera_get_render_zoom(cam)

	offset_x := (world_pos.x - pos.x) / zoom
	offset_y := (world_pos.y - pos.y) / zoom

	return {viewport_size.x * 0.5 + offset_x, viewport_size.y * 0.5 + offset_y}
}

// Check if a point is visible on screen (with optional padding)
is_on_screen :: proc(
	cam: ^Camera,
	world_pos: [2]f32,
	viewport_size: [2]f32,
	padding: f32 = 0,
) -> bool {
	pos := camera_get_render_position(cam)
	zoom := camera_get_render_zoom(cam)

	half_w := (viewport_size.x * 0.5 / zoom) + padding
	half_h := (viewport_size.y * 0.5 / zoom) + padding

	return abs(world_pos.x - pos.x) <= half_w && abs(world_pos.y - pos.y) <= half_h
}

// Check if a rectangle is visible on screen
is_rect_on_screen :: proc(
	cam: ^Camera,
	rect_pos: [2]f32,
	rect_size: [2]f32,
	viewport_size: [2]f32,
	padding: f32 = 0,
) -> bool {
	pos := camera_get_render_position(cam)
	zoom := camera_get_render_zoom(cam)

	half_w := (viewport_size.x * 0.5 / zoom) + padding
	half_h := (viewport_size.y * 0.5 / zoom) + padding

	// AABB overlap test
	return(
		!(rect_pos.x + rect_size.x < pos.x - half_w ||
			rect_pos.x > pos.x + half_w ||
			rect_pos.y + rect_size.y < pos.y - half_h ||
			rect_pos.y > pos.y + half_h) \
	)
}
