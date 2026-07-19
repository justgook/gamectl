package world

// Enemy behavior roadmap:
// 1. [done] Ledge-safe patrol — reverse at walls and before leaving walkable ground.
// 2. [done] Radius-based perception sensor — detect targets within an omnidirectional range.
// 3. [done] Detection enter/exit transitions — notify decisions only when perception changes.
// 4. [todo] Director patrolling ↔ chasing — let Director rules own discrete enemy intent.
// 5. [todo] Chase Brain behavior — convert chasing intent into movement toward the target.
// 6. [todo] Cone perception and optional line-of-sight — add directional sight and map occlusion.
// 7. [todo] Damage and combat integration — route hits, damage sources, health, and death through Director.

import "../director"
import "../host"
import "grid"
import "logic"
import "shape"

Brain :: i8

Enemy_Vision :: struct {
	radius:        int,
	player_inside: bool,
}

InputSet :: enum {
	North,
	East,
	South,
	West,
	Action1,
	Action2,
	Action3,
	Action4,
}

InputSet_Vectors :: [InputSet][2]int {
	.North   = {0, -1},
	.East    = {+1, 0},
	.South   = {0, +1},
	.West    = {-1, 0},
	.Action1 = {0, 0},
	.Action2 = {0, 0},
	.Action3 = {0, 0},
	.Action4 = {0, 0},
}

Input :: bit_set[InputSet;u8]

sys_enemy_vision :: proc(w: ^World) {
	player_pos, has_player_pos := logic.get_component(&w.position, w.player1_id)
	assert(has_player_pos)
	player_point := [2]int{int(player_pos.x), int(player_pos.y)}

	view := logic.view(&w.position, &w.enemy_vision, &w.director_entity)
	for entity, pos, vision, director_entity in logic.each(&view) {
		sensor := shape.Circle {
			x      = int(pos.x),
			y      = int(pos.y),
			radius = vision.radius,
		}
		player_inside := shape.circle_point_test(&sensor, &player_point)
		if player_inside == vision.player_inside {
			continue
		}

		vision.player_inside = player_inside
		event_key := w.director_config.vision_exit
		if player_inside {
			event_key = w.director_config.vision_enter
		}

		director.entity_set_link(&w.director, director_entity.id, event_key, w.director_config.player)
		result := director.trigger(&w.director, director.Trigger{kind = .Entity, entity = director_entity.id})
		director.entity_remove_link(&w.director, director_entity.id, event_key)
		assert(result.matched)

		host.info("sys_enemy_vision", "player transition", entity, player_inside)
		apply_director_effects(w, result.effects)
	}
}

sys_brain :: proc(w: ^World) {
	view := logic.view(&w.brain, &w.position, &w.input)
	for entity, brain, pos, input in logic.each(&view) {
		if brain^ == 0 {
			w.player1 = input

			continue
		}

		switch brain^ {
		case 1:
			collider, has_collider := logic.get_component(&w.collider, entity)
			assert(has_collider)
			platformer, has_platformer := logic.get_component(&w.platformer, entity)
			assert(has_platformer)
			brain1(w, input, pos, collider, platformer)
		case:
			host.error("sys_brain", "unknown brain")
		}

	}
}

@(private = "file")
brain1 :: proc(w: ^World, input: ^Input, pos: ^Position, collider: ^shape.Capsule, platformer: ^Platformer) {
	direction := brain1_direction(input)
	test := [4]int{int(pos.x), int(pos.y), int(pos.x) + direction * 10 * UNIT, int(pos.y)}
	found := grid.query_segment(&w.grid, &test)
	defer delete(found)

	for wall in found {
		shape.segment_segment_test(wall, &test) or_continue
		brain1_reverse(input, direction)
		return
	}

	if platformer.on_ground {
		ground := platformer_probe_ground_ahead(&w.grid, pos, collider, platformer, 16 * UNIT, direction)
		if !ground.found {
			brain1_reverse(input, direction)
		}
	}
}

@(private = "file")
@(require_results)
brain1_direction :: proc(input: ^Input) -> int {
	if .East in input {
		return 1
	}
	assert(.West in input)
	return -1
}

@(private = "file")
brain1_reverse :: proc(input: ^Input, direction: int) {
	assert(direction == -1 || direction == 1)
	if direction > 0 {
		input^ -= {.East}
		input^ += {.West}
	} else {
		input^ -= {.West}
		input^ += {.East}
	}
}
