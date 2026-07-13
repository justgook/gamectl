package world

import "../director"

@(private = "file")
MOCK_DIRECTOR_PLAYER :: director.Entity_Id(0)

@(private = "file")
MOCK_DIRECTOR_ROOM_001 :: director.Entity_Id(1)

@(private = "file")
MOCK_DIRECTOR_COIN_001 :: director.Entity_Id(2)

@(private = "file")
MOCK_DIRECTOR_COIN_002 :: director.Entity_Id(3)

@(private = "file")
MOCK_DIRECTOR_HP :: director.Word_Id(0)

@(private = "file")
MOCK_DIRECTOR_MONEY :: director.Word_Id(1)

MOCK_DIRECTOR_ENTER_ROOM_001 :: director.Word_Id(2)

@(private = "file")
MOCK_DIRECTOR_COIN :: director.Word_Id(3)

MOCK_DIRECTOR_COIN_PREFAB :: director.Word_Id(4)

@(private = "file")
MOCK_DIRECTOR_SPAWN_ROOM_001_COINS_RULE :: director.Rule_Id(0)

@(private = "file")
MOCK_DIRECTOR_COLLECT_COIN_RULE :: director.Rule_Id(1)

@(private = "file")
mock_director_runtime_player_stats: [2]director.Stat

@(private = "file")
mock_director_runtime_coin_tags: [1]director.Word_Id

@(private = "file")
mock_director_runtime_entities: [4]director.Entity_Def

@(private = "file")
mock_director_runtime_queries: [1]director.Query

@(private = "file")
mock_director_runtime_matchers: [1]director.Matcher

@(private = "file")
mock_director_runtime_changes: [4]director.Change

@(private = "file")
mock_director_runtime_rules: [2]director.Rule

@(private = "file")
mock_director_runtime_words: [5]string

@(private = "file")
mock_director_runtime_data: director.Director_Data

mock_director_data :: proc() -> ^director.Director_Data {
	mock_director_runtime_player_stats = {
		{key = MOCK_DIRECTOR_HP, value = 100},
		{key = MOCK_DIRECTOR_MONEY, value = 0},
	}
	mock_director_runtime_coin_tags = {MOCK_DIRECTOR_COIN}
	mock_director_runtime_entities = {
		{id = MOCK_DIRECTOR_PLAYER, stats = mock_director_runtime_player_stats[:]},
		{id = MOCK_DIRECTOR_ROOM_001},
		{id = MOCK_DIRECTOR_COIN_001, tags = mock_director_runtime_coin_tags[:], removed = true},
		{id = MOCK_DIRECTOR_COIN_002, tags = mock_director_runtime_coin_tags[:], removed = true},
	}
	mock_director_runtime_queries = {
		{kind = .Has_Tag, key = MOCK_DIRECTOR_COIN},
	}
	mock_director_runtime_matchers = {
		{selector = {kind = .Trigger}, queries = {offset = 0, count = 1}},
	}
	mock_director_runtime_changes = {
		{
			target = {kind = .Entity, entity = MOCK_DIRECTOR_COIN_001},
			kind = .Spawn_Entity,
			spawn_prefab = MOCK_DIRECTOR_COIN_PREFAB,
			spawn_position = {180 * UNIT, 82 * UNIT},
		},
		{
			target = {kind = .Entity, entity = MOCK_DIRECTOR_COIN_002},
			kind = .Spawn_Entity,
			spawn_prefab = MOCK_DIRECTOR_COIN_PREFAB,
			spawn_position = {220 * UNIT, 102 * UNIT},
		},
		{
			target = {kind = .Entity, entity = MOCK_DIRECTOR_PLAYER},
			kind = .Inc_Stat,
			key = MOCK_DIRECTOR_MONEY,
			int_value = 1,
		},
		{
			target = {kind = .Trigger},
			kind = .Remove_Entity,
		},
	}
	mock_director_runtime_rules = {
		{
			id = MOCK_DIRECTOR_SPAWN_ROOM_001_COINS_RULE,
			trigger = {kind = .Signal, signal = MOCK_DIRECTOR_ENTER_ROOM_001},
			changes = {offset = 0, count = 2},
			weight = 0,
		},
		{
			id = MOCK_DIRECTOR_COLLECT_COIN_RULE,
			trigger = {kind = .Entity_Matcher, matcher_index = 0},
			changes = {offset = 2, count = 2},
			weight = 10,
		},
	}
	mock_director_runtime_words = {
		"hp",
		"money",
		"enter_room_001",
		"coin",
		"coin_prefab",
	}
	mock_director_runtime_data = director.Director_Data {
		entities = mock_director_runtime_entities[:],
		rules    = mock_director_runtime_rules[:],
		matchers = mock_director_runtime_matchers[:],
		queries  = mock_director_runtime_queries[:],
		changes  = mock_director_runtime_changes[:],
		words    = mock_director_runtime_words[:],
	}
	return &mock_director_runtime_data
}
