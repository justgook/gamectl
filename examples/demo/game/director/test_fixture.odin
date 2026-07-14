#+build !freestanding
#+build !js
#+build !orca
#+test

package director

E_PLAYER :: Entity_Id(0)
E_CAVE :: Entity_Id(1)
E_TORCH :: Entity_Id(2)
E_GOBLIN :: Entity_Id(3)
E_DEN :: Entity_Id(4)
E_KEY :: Entity_Id(5)

W_item :: Word_Id(0)
W_location :: Word_Id(1)
W_dark :: Word_Id(2)
W_home_to :: Word_Id(3)
W_enemy :: Word_Id(4)
W_strength :: Word_Id(5)
W_armor :: Word_Id(6)
W_explored :: Word_Id(7)
W_start :: Word_Id(8)
W_locked :: Word_Id(9)
W_held_by :: Word_Id(10)
W_suspect :: Word_Id(11)
W_blinded :: Word_Id(12)
W_world_entity :: Word_Id(13)

R_intro :: Rule_Id(0)
R_take_item :: Rule_Id(1)
R_unlock :: Rule_Id(2)
R_generic_item :: Rule_Id(3)
R_mark_items :: Rule_Id(4)

test_player_links := [?]Link{{key = W_location, target = E_CAVE}}
test_player_stats := [?]Stat{{key = W_strength, value = 5}}
test_cave_tags := [?]Word_Id{W_dark, W_location, W_locked}
test_torch_tags := [?]Word_Id{W_item}
test_torch_links := [?]Link{{key = W_location, target = E_PLAYER}}
test_goblin_tags := [?]Word_Id{W_enemy}
test_goblin_links := [?]Link{{key = W_location, target = E_CAVE}, {key = W_home_to, target = E_DEN}}
test_goblin_stats := [?]Stat{{key = W_armor, value = 5}}
test_den_tags := [?]Word_Id{W_location, W_dark}
test_key_tags := [?]Word_Id{W_item, W_suspect}
test_key_links := [?]Link{{key = W_location, target = E_DEN}}

test_entities := [?]Entity_Def {
	{id = E_PLAYER, stats = test_player_stats[:], links = test_player_links[:]},
	{id = E_CAVE, tags = test_cave_tags[:]},
	{id = E_TORCH, tags = test_torch_tags[:], links = test_torch_links[:]},
	{id = E_GOBLIN, tags = test_goblin_tags[:], stats = test_goblin_stats[:], links = test_goblin_links[:]},
	{id = E_DEN, tags = test_den_tags[:]},
	{id = E_KEY, tags = test_key_tags[:], links = test_key_links[:]},
}

test_queries := [?]Query {
	{kind = .Has_Tag, key = W_item},
	{kind = .Has_Link, key = W_location, link_value = {kind = .Specific_Matcher, matcher_index = 0}},
	{kind = .Has_Tag, key = W_dark},
	{kind = .Has_Link, key = W_location, link_value = {kind = .Specific_Matcher, matcher_index = 3}},
	{kind = .Has_Link, key = W_home_to, link_value = {kind = .Specific_Matcher, matcher_index = 3}},
	{kind = .Has_Tag, key = W_enemy},
	{
		kind = .Has_Stat,
		key = W_strength,
		op = .Eq,
		stat_value = {kind = .From_Entity_Stat, entity = E_GOBLIN, key = W_armor},
	},
	{kind = .Has_Link, key = W_location, link_value = {kind = .From_Entity_Link, entity = E_GOBLIN, key = W_home_to}},
	{kind = .Not, nested = 10},
	{kind = .Has_Tag, key = W_item},
	{kind = .Has_Tag, key = W_suspect},
	{kind = .Has_Tag, key = W_locked},
}

test_matchers := [?]Matcher {
	{selector = {kind = .Entity, entity = E_PLAYER}},
	{selector = {kind = .Any}, queries = {offset = 0, count = 2}},
	{selector = {kind = .Entity, entity = E_GOBLIN}, queries = {offset = 3, count = 2}},
	{selector = {kind = .Any}, queries = {offset = 2, count = 1}},
	{selector = {kind = .Any}, queries = {offset = 5, count = 1}},
	{selector = {kind = .Entity, entity = E_PLAYER}, queries = {offset = 6, count = 1}},
	{selector = {kind = .Entity, entity = E_KEY}, queries = {offset = 7, count = 1}},
	{selector = {kind = .Any}, queries = {offset = 8, count = 2}},
	{selector = {kind = .Entity, entity = E_CAVE}, queries = {offset = 11, count = 1}},
	{selector = {kind = .Trigger}},
	{selector = {kind = .Any}, queries = {offset = 9, count = 1}},
}

test_changes := [?]Change {
	{target = {kind = .Entity, entity = E_CAVE}, kind = .Add_Tag, key = W_explored},
	{
		target = {kind = .Trigger},
		kind = .Set_Link,
		key = W_location,
		link_target = {kind = .Entity, entity = E_PLAYER},
	},
	{target = {kind = .Entity, entity = E_CAVE}, kind = .Remove_Tag, key = W_locked},
	{
		target = {kind = .All_Matching, matcher_index = 10},
		kind = .Set_Link,
		key = W_held_by,
		link_target = {kind = .Entity, entity = E_PLAYER},
	},
}

test_rules := [?]Rule {
	{
		id = R_intro,
		trigger = {kind = .Signal, signal = W_start},
		changes = {offset = 0, count = 1},
		weight = 0,
	},
	{id = R_generic_item, trigger = {kind = .Entity_Matcher, matcher_index = 10}, weight = 1},
	{
		id = R_take_item,
		trigger = {kind = .Entity_Matcher, matcher_index = 1},
		changes = {offset = 1, count = 1},
		weight = 10,
	},
	{
		id = R_unlock,
		trigger = {kind = .Entity_Matcher, matcher_index = 0},
		conditions = {offset = 8, count = 1},
		changes = {offset = 2, count = 1},
		weight = 20,
	},
	{id = R_mark_items, trigger = {kind = .Signal, signal = W_blinded}, changes = {offset = 3, count = 1}},
}

test_words := [?]string {
	"item",
	"location",
	"dark",
	"home_to",
	"enemy",
	"strength",
	"armor",
	"explored",
	"start",
	"locked",
}
test_data := Director_Data {
	entities = test_entities[:],
	rules    = test_rules[:],
	matchers = test_matchers[:],
	queries  = test_queries[:],
	changes  = test_changes[:],
	words    = test_words[:],
}
