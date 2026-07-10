package world

import "../director"

@(private = "file")
MOCK_DIRECTOR_PLAYER :: director.Entity_Id(0)

@(private = "file")
MOCK_DIRECTOR_HP :: director.Word_Id(0)

@(private = "file")
mock_director_runtime_player_stats: [1]director.Stat

@(private = "file")
mock_director_runtime_entities: [1]director.Entity_Def

@(private = "file")
mock_director_runtime_words: [1]string

@(private = "file")
mock_director_runtime_data: director.Director_Data

mock_director_data :: proc() -> ^director.Director_Data {
	mock_director_runtime_player_stats = {
		{key = MOCK_DIRECTOR_HP, value = 100},
	}
	mock_director_runtime_entities = {
		{id = MOCK_DIRECTOR_PLAYER, stats = mock_director_runtime_player_stats[:]},
	}
	mock_director_runtime_words = {
		"hp",
	}
	mock_director_runtime_data = director.Director_Data {
		entities = mock_director_runtime_entities[:],
		words    = mock_director_runtime_words[:],
	}
	return &mock_director_runtime_data
}
