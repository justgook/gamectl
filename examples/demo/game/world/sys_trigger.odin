package world

import "../director"
import "../host"
import "logic"
import "shape"

Director_Config :: struct {
	player:       director.Entity_Id,
	spawn_x:      director.Word_Id,
	spawn_y:      director.Word_Id,
	world_entity: director.Word_Id,
	spawn:        director.Word_Id,
	prefab:       director.Word_Id,
	prefab_id:    director.Word_Id,
	vision_enter: director.Word_Id,
	vision_exit:  director.Word_Id,
	attack_enter: director.Word_Id,
	attack_exit:  director.Word_Id,
	behavior:     director.Word_Id,
	target:       director.Word_Id,
	firing:       director.Word_Id,
	patrolling:   director.Entity_Id,
	chasing:      director.Entity_Id,
	attacking:    director.Entity_Id,
	dialog:       director.Word_Id,
	text_id:      director.Word_Id,
	answer_links: [4]director.Word_Id,
}

Segment_Trigger :: struct {
	once:            bool,
	used:            bool,
	director_signal: director.Word_Id,
}

Director_Entity :: struct {
	id: director.Entity_Id,
}

Director_Trigger_Aabb :: struct {
	bounds: shape.Aabb,
	once:   bool,
	used:   bool,
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

	director_trigger_aabb_contact(w)
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

	host.info("sys_trigger", "segment trigger contact", contact_kind, entity, segment^)

	result := director.trigger(&w.director, director.Trigger{kind = .Signal, signal = trigger.director_signal})
	assert(result.matched)
	apply_director_changes(w, result.changes)

	trigger.used = true
}

@(private = "file")
director_trigger_aabb_contact :: proc(w: ^World) {
	player_pos, has_player_pos := logic.get_component(&w.position, w.player1_id)
	assert(has_player_pos)
	player_collider, has_player_collider := logic.get_component(&w.collider, w.player1_id)
	assert(has_player_collider)
	player_bounds := capsule_aabb(player_pos, player_collider)

	contacts: [dynamic]logic.Entity
	defer delete(contacts)

	view := logic.view(&w.position, &w.director_trigger_aabb, &w.director_entity)
	for entity, pos, trigger, _ in logic.each(&view) {
		if trigger.once && trigger.used {
			continue
		}
		trigger_bounds := world_aabb(pos, trigger.bounds)
		if aabb_overlap(player_bounds, trigger_bounds) {
			append(&contacts, entity)
		}
	}

	for entity in contacts {
		trigger, has_trigger := logic.get_component(&w.director_trigger_aabb, entity)
		assert(has_trigger)
		if trigger.once && trigger.used {
			continue
		}
		director_entity, has_director_entity := logic.get_component(&w.director_entity, entity)
		assert(has_director_entity)

		host.info("sys_trigger", "director aabb contact", director_entity.id, entity)
		trigger.used = true
		result := director.trigger(&w.director, director.Trigger{kind = .Entity, entity = director_entity.id})
		assert(result.matched)
		apply_director_changes(w, result.changes)
	}
}

apply_director_changes :: proc(w: ^World, changes: []director.Applied_Change) {
	for change in changes {
		#partial switch change.kind {
		case .Tag_Added:
			if change.key == w.director_config.spawn {
				director_spawn_world_entity(w, change.entity)
			}
		case .Tag_Removed:
			if change.key == w.director_config.spawn {
				director_remove_world_entity(w, change.entity)
			}
		case .Stat_Set, .Stat_Removed, .Link_Set, .Link_Removed, .Entity_Added, .Entity_Removed:
		}
	}
}

Prefab_Id :: enum i32 {
	Coin  = 1,
	Enemy = 2,
}

Prefab_Resolve_Error :: enum {
	None,
	Missing_Link,
	Unknown_Id,
}

@(require_results)
director_resolve_prefab :: proc(w: ^World, director_entity: director.Entity_Id) -> (Prefab_Id, Prefab_Resolve_Error) {
	prefab, has_prefab := director.entity_link(&w.director, director_entity, w.director_config.prefab)
	if !has_prefab {
		return {}, .Missing_Link
	}

	prefab_id := director.entity_stat(&w.director, prefab, w.director_config.prefab_id)
	switch prefab_id {
	case i32(Prefab_Id.Coin):
		return .Coin, .None
	case i32(Prefab_Id.Enemy):
		return .Enemy, .None
	case:
		return {}, .Unknown_Id
	}
}

@(private = "file")
director_spawn_world_entity :: proc(w: ^World, director_entity: director.Entity_Id) {
	prefab_id, prefab_error := director_resolve_prefab(w, director_entity)
	assert(prefab_error != .Missing_Link, "spawned Director entity must have a prefab link")
	assert(prefab_error != .Unknown_Id, "unknown prefab id")

	spawn_x := director.entity_stat(&w.director, director_entity, w.director_config.spawn_x)
	spawn_y := director.entity_stat(&w.director, director_entity, w.director_config.spawn_y)
	entity := create_entity(w)
	director.entity_set_stat(&w.director, director_entity, w.director_config.world_entity, i32(entity))
	logic.add_component(&w.director_entity, entity, Director_Entity{id = director_entity})
	logic.add_component(&w.position, entity, Position{spawn_x, spawn_y})

	switch prefab_id {
	case .Coin:
		director_spawn_coin(w, entity)
	case .Enemy:
		director_spawn_enemy(w, entity)
	}
}

@(private = "file")
director_spawn_coin :: proc(w: ^World, entity: logic.Entity) {
	logic.add_component(&w.sprite, entity, Sprite{opacity = 1, uv = w.uv[12]})
	logic.add_component(&w.animation, entity, animation_create(&w.animation_atlas.defs[45]))
	logic.add_component(
		&w.director_trigger_aabb,
		entity,
		Director_Trigger_Aabb{bounds = {-8 * UNIT, -8 * UNIT, 8 * UNIT, 8 * UNIT}, once = true},
	)
}

@(private = "file")
director_spawn_enemy :: proc(w: ^World, entity: logic.Entity) {
	enemy_anim_base := 15
	logic.add_component(&w.sprite, entity, Sprite{opacity = 1, uv = w.uv[12]})
	logic.add_component(&w.animation, entity, animation_create(&w.animation_atlas.defs[enemy_anim_base]))
	logic.add_component(
		&w.platformer_anim,
		entity,
		platformer_anim_create_char_from_atlas(&w.animation_atlas, enemy_anim_base),
	)
	logic.add_component(&w.collider, entity, shape.Capsule{radius = 6 * UNIT, height = 12 * UNIT})
	logic.add_component(&w.brain, entity, Brain(1))
	logic.add_component(
		&w.enemy_vision,
		entity,
		Enemy_Vision{sector = shape.make_sector_degrees(0, 0, 96 * UNIT, {1, 0}, 45)},
	)
	logic.add_component(&w.enemy_attack_area, entity, Enemy_Attack_Area{circle = shape.Circle{radius = 16 * UNIT}})
	logic.add_component(&w.bullet, entity, bullet_component(&w.bullet_patterns[0]))
	logic.add_component(&w.velocity, entity, Velocity{})
	logic.add_component(&w.input, entity, Input{.East})
	logic.add_component(&w.platformer, entity, Platformer{facing = 1})
}

@(private = "file")
director_remove_world_entity :: proc(w: ^World, director_entity: director.Entity_Id) {
	entity := director.entity_stat(&w.director, director_entity, w.director_config.world_entity)
	assert(entity != 0)
	entity_delete(w, logic.Entity(entity))
}

@(private = "file")
@(require_results)
capsule_aabb :: proc(pos: ^Position, capsule: ^shape.Capsule) -> shape.Aabb {
	half_height := capsule.height / 2
	return {
		pos.x + i32(capsule.x - capsule.radius),
		pos.y + i32(capsule.y - half_height - capsule.radius),
		pos.x + i32(capsule.x + capsule.radius),
		pos.y + i32(capsule.y + half_height + capsule.radius),
	}
}

@(private = "file")
@(require_results)
world_aabb :: proc(pos: ^Position, bounds: shape.Aabb) -> shape.Aabb {
	return {pos.x + bounds[0], pos.y + bounds[1], pos.x + bounds[2], pos.y + bounds[3]}
}

@(private = "file")
@(require_results)
aabb_overlap :: proc(a, b: shape.Aabb) -> bool {
	return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3])
}
