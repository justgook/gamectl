#+test

package station_demo_tests

import content "../game/content"
import director "../game/director"
import station "../game/station"
import "core:os"
import "core:testing"

Variant :: struct {
	name:           string,
	path:           string,
	requires_power: bool,
}

VARIANTS := [?]Variant {
	{
		name = "power",
		path = "examples/station-demo/content/generated/power.rspk",
		requires_power = true,
	},
	{
		name = "key",
		path = "examples/station-demo/content/generated/key.rspk",
		requires_power = false,
	},
}

load_variant :: proc(path: string) -> (content.Decoded, []u8, bool) {
	bytes, err := os.read_entire_file_from_path(path, context.allocator)
	if err != nil {return {}, nil, false}
	decoded, ok := content.read(bytes)
	if !ok {
		delete(bytes)
		return {}, nil, false
	}
	return decoded, bytes, true
}

binding_entity :: proc(bindings: station.Bindings, name: string) -> director.Entity_Id {
	for binding in bindings {
		if binding.kind == .Entity && binding.name == name {
			return director.Entity_Id(binding.value)
		}
	}
	assert(false, "missing entity test binding")
	return director.INVALID_ENTITY
}

trigger_entity :: proc(state: ^station.State, name: string) -> director.Result {
	return director.trigger(
		&state.director_state,
		director.Trigger{kind = .Entity, entity = binding_entity(state.bindings, name)},
	)
}

@(test)
test_both_packed_variants_use_game_decoder_and_rule_matrix :: proc(t: ^testing.T) {
	for variant in VARIANTS {
		for mask in 0 ..< 4 {
			decoded, bytes, ok := load_variant(variant.path)
			testing.expectf(t, ok, "%s pack must decode through game/content.read", variant.name)
			if !ok {return}
			state := station.init(decoded.data, decoded.bindings)

			has_power := mask & 1 != 0
			has_key := mask & 2 != 0
			if has_power {
				result := trigger_entity(&state, "POWER_SWITCH")
				testing.expectf(
					t,
					result.matched,
					"%s matrix %d power interaction did not match",
					variant.name,
					mask,
				)
			}
			if has_key {
				result := trigger_entity(&state, "ACCESS_KEY")
				testing.expectf(
					t,
					result.matched,
					"%s matrix %d key interaction did not match",
					variant.name,
					mask,
				)
			}

			result := trigger_entity(&state, "EXIT")
			expected_unlock := variant.requires_power ? has_power : has_key
			testing.expectf(
				t,
				result.matched == expected_unlock && station.is_locked(&state) != expected_unlock,
				"%s matrix %d unlock result was matched=%v locked=%v",
				variant.name,
				mask,
				result.matched,
				station.is_locked(&state),
			)

			station.destroy(&state)
			content.destroy(&decoded)
			delete(bytes)
		}
	}
}

@(test)
test_repeated_interactions_retry_completion_and_restart :: proc(t: ^testing.T) {
	for variant in VARIANTS {
		decoded, bytes, ok := load_variant(variant.path)
		testing.expectf(t, ok, "%s pack must decode through game/content.read", variant.name)
		if !ok {return}
		state := station.init(decoded.data, decoded.bindings)

		blocked := trigger_entity(&state, "EXIT")
		testing.expectf(
			t,
			!blocked.matched && station.is_locked(&state),
			"%s initial exit must be blocked",
			variant.name,
		)

		power_first := trigger_entity(&state, "POWER_SWITCH")
		power_again := trigger_entity(&state, "POWER_SWITCH")
		testing.expectf(
			t,
			power_first.matched && power_again.matched && len(power_again.changes) == 0,
			"%s power interaction must be idempotent",
			variant.name,
		)

		key_first := trigger_entity(&state, "ACCESS_KEY")
		key_again := trigger_entity(&state, "ACCESS_KEY")
		testing.expectf(
			t,
			key_first.matched && !key_again.matched,
			"%s key pickup must remove its Director entity",
			variant.name,
		)

		retry := trigger_entity(&state, "EXIT")
		testing.expectf(
			t,
			retry.matched && !station.is_locked(&state),
			"%s retry must unlock",
			variant.name,
		)
		repeated_exit := trigger_entity(&state, "EXIT")
		testing.expectf(
			t,
			!repeated_exit.matched,
			"%s unlocked exit must not reapply",
			variant.name,
		)

		state.player = {
			x = 1.0,
			y = 0,
		}
		station.step(&state, 0)
		testing.expectf(t, state.completed, "%s open exit must reach completion", variant.name)

		station.restart(&state)
		testing.expectf(
			t,
			!state.completed &&
			station.is_locked(&state) &&
			!station.has_power(&state) &&
			!station.has_key(&state),
			"%s restart must restore authored initial state",
			variant.name,
		)

		station.destroy(&state)
		content.destroy(&decoded)
		delete(bytes)
	}
}
