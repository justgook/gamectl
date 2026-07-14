package world

import "../director"
import "../host"
import "logic"
import "shape"

Director_Config :: struct {
	spawn_x:      director.Word_Id,
	spawn_y:      director.Word_Id,
	world_entity: director.Word_Id,
	dialog:       director.Word_Id,
	text_id:      director.Word_Id,
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
	apply_director_effects(w, result.effects)

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
		if director.entity_has_tag(&w.director, director_entity.id, w.director_config.dialog) {
			w.active_dialog_text_id = director.entity_stat(
				&w.director,
				director_entity.id,
				w.director_config.text_id,
			)
			w.dialog_active = true
		}
		apply_director_effects(w, result.effects)
	}
}

apply_director_effects :: proc(w: ^World, effects: []director.Effect) {
	for effect in effects {
		#partial switch effect.kind {
		case .Spawn:
			director_spawn_world_entity(w, effect.entity)
		case .Remove:
			director_remove_world_entity(w, effect.entity)
		}
	}
}

@(private = "file")
director_spawn_world_entity :: proc(w: ^World, director_entity: director.Entity_Id) {
	spawn_x := director.entity_stat(&w.director, director_entity, w.director_config.spawn_x)
	spawn_y := director.entity_stat(&w.director, director_entity, w.director_config.spawn_y)

	entity := create_entity(w)
	director.entity_set_stat(&w.director, director_entity, w.director_config.world_entity, i32(entity))
	logic.add_component(&w.director_entity, entity, Director_Entity{id = director_entity})
	logic.add_component(&w.position, entity, Position{spawn_x, spawn_y})
	logic.add_component(&w.sprite, entity, Sprite{opacity = 1, uv = w.uv[12]})

	money_anim := 45 // len(&w.animation_atlas.defs) - 1
	logic.add_component(&w.animation, entity, animation_create(&w.animation_atlas.defs[money_anim]))
	logic.add_component(
		&w.director_trigger_aabb,
		entity,
		Director_Trigger_Aabb{bounds = {-8 * UNIT, -8 * UNIT, 8 * UNIT, 8 * UNIT}, once = true},
	)
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
