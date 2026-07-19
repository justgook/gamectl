package world

import "../director"
import "grid"
import "logic"
import "shape"

Damage_Hit :: struct {
	bullet:          logic.Entity,
	target:          logic.Entity,
	source:          director.Entity_Id,
	target_director: director.Entity_Id,
}

sys_bullet_collision :: proc(w: ^World) {
	damage_hits: [dynamic]Damage_Hit
	defer delete(damage_hits)
	collect_player_bullet_hits(w, &damage_hits)
	collect_enemy_bullet_hits(w, &damage_hits)

	for hit in damage_hits {
		apply_damage_hit(w, hit)
	}

	// Actor hits consume bullets before remaining projectiles test world collision.
	view := logic.view(&w.player_hit, &w.position, &w.velocity)
	bullet_world_collision(w, &view)
	view = logic.view(&w.enemy_hit, &w.position, &w.velocity)
	bullet_world_collision(w, &view)
}

@(private = "file")
collect_player_bullet_hits :: proc(w: ^World, out: ^[dynamic]Damage_Hit) {
	hit_view := logic.view(&w.player_hit, &w.position, &w.bullet)
	hurt_view := logic.view(&w.enemy_hurt, &w.position, &w.director_entity)
	for bullet_entity, hit_circle, hit_pos, bullet in logic.each(&hit_view) {
		assert(bullet.side == .Player)
		world_hit := hit_circle^
		shape.move_circle(&world_hit, {int(hit_pos.x), int(hit_pos.y)})

		for target_entity, hurt_capsule, hurt_pos, target_director in logic.each(&hurt_view) {
			world_hurt := hurt_capsule^
			shape.move_capsule(&world_hurt, {int(hurt_pos.x), int(hurt_pos.y)})
			if shape.circle_capsule_test(&world_hit, &world_hurt) {
				append(
					out,
					Damage_Hit {
						bullet = bullet_entity,
						target = target_entity,
						source = bullet.damage_source,
						target_director = target_director.id,
					},
				)
				break
			}
		}
	}
}

@(private = "file")
collect_enemy_bullet_hits :: proc(w: ^World, out: ^[dynamic]Damage_Hit) {
	hit_view := logic.view(&w.enemy_hit, &w.position, &w.bullet)
	hurt_view := logic.view(&w.player_hurt, &w.position, &w.director_entity)
	for bullet_entity, hit_circle, hit_pos, bullet in logic.each(&hit_view) {
		assert(bullet.side == .Enemy)
		world_hit := hit_circle^
		shape.move_circle(&world_hit, {int(hit_pos.x), int(hit_pos.y)})

		for target_entity, hurt_capsule, hurt_pos, target_director in logic.each(&hurt_view) {
			world_hurt := hurt_capsule^
			shape.move_capsule(&world_hurt, {int(hurt_pos.x), int(hurt_pos.y)})
			if shape.circle_capsule_test(&world_hit, &world_hurt) {
				append(
					out,
					Damage_Hit {
						bullet = bullet_entity,
						target = target_entity,
						source = bullet.damage_source,
						target_director = target_director.id,
					},
				)
				break
			}
		}
	}
}

@(private = "file")
apply_damage_hit :: proc(w: ^World, hit: Damage_Hit) {
	// A prior hit in this frame may already have removed the target projection.
	if !logic.has_component(&w.director_entity, hit.target) {
		if logic.has_component(&w.bullet, hit.bullet) {
			entity_delete(w, hit.bullet)
		}
		return
	}

	director.entity_set_link(&w.director, hit.target_director, w.director_config.damage_source, hit.source)
	result := director.trigger(&w.director, director.Trigger{kind = .Entity, entity = hit.target_director})
	director.entity_remove_link(&w.director, hit.target_director, w.director_config.damage_source)
	assert(result.matched)
	apply_director_changes(w, result.changes)

	if logic.has_component(&w.bullet, hit.bullet) {
		entity_delete(w, hit.bullet)
	}
}

@(private = "file")
bullet_world_collision :: proc(w: ^World, view: ^logic.View3(shape.Circle, Position, Velocity)) {
	bullets_to_delete: [dynamic]logic.Entity
	defer delete(bullets_to_delete)

	for entity, _, pos, vel in logic.each(view) {
		movement := [4]int{int(pos.x), int(pos.y), int(pos.x + vel.x), int(pos.y + vel.y)}
		found := grid.query_segment(&w.grid, &movement)

		for wall in found {
			if shape.segment_segment_test(wall, &movement) {
				append(&bullets_to_delete, entity)
				break
			}
		}
		delete(found)
	}

	for bullet in bullets_to_delete {
		entity_delete(w, bullet)
	}
}
